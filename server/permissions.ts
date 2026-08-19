export type DbFilter = { column: string; op: string; value: any; operator?: string };

// Minimal shape of pg's `pool.query`, so these checks can run against any executor.
export type QueryExecutor = (sql: string, params?: any[]) => Promise<{ rows: any[] }>;

// A tournament owner/admin may manage the games of their own tournament even
// without the global admin role.
export const managesTournament = async (
  query: QueryExecutor,
  userId: string,
  tournamentId: string
) => {
  if (!userId || !tournamentId) return false;
  const { rows } = await query(
    `SELECT 1
       FROM tournaments t
       LEFT JOIN tournament_members m
         ON m.tournament_id = t.id
        AND m.user_id = $2
        AND m.is_active IS NOT FALSE
        AND m.role IN ('owner', 'admin')
      WHERE t.id = $1
        AND (t.created_by = $2 OR m.user_id IS NOT NULL)
      LIMIT 1`,
    [tournamentId, userId]
  );
  return rows.length > 0;
};

// Resolve which tournaments a games write touches, so ownership can be checked.
// Returns null when the write cannot be attributed to a tournament, which callers
// must treat as "deny".
export const tournamentIdsForGamesWrite = async (
  query: QueryExecutor,
  action: string,
  data: any,
  filters: DbFilter[]
): Promise<string[] | null> => {
  if (action === 'insert' || action === 'upsert') {
    const rows = Array.isArray(data) ? data : [data];
    if (!rows.length) return null;
    const ids = rows.map(row => row?.tournament_id);
    return ids.every(Boolean) ? (ids as string[]) : null;
  }

  const eqFilter = (column: string) =>
    (filters || []).find(filter => filter.column === column && filter.op === 'eq');

  const tournamentFilter = eqFilter('tournament_id');
  if (tournamentFilter?.value) return [String(tournamentFilter.value)];

  const idFilter = eqFilter('id');
  if (idFilter?.value) {
    const { rows } = await query('SELECT tournament_id FROM games WHERE id = $1', [idFilter.value]);
    const ids = rows.map(row => row.tournament_id);
    return ids.length && ids.every(Boolean) ? ids : null;
  }

  return null;
};

// Whether a non-admin user may perform this write on the games table.
export const mayWriteGames = async (
  query: QueryExecutor,
  userId: string,
  action: string,
  data: any,
  filters: DbFilter[]
) => {
  const tournamentIds = await tournamentIdsForGamesWrite(query, action, data, filters);
  if (!tournamentIds) return false;
  const checks = await Promise.all(tournamentIds.map(id => managesTournament(query, userId, id)));
  return checks.every(Boolean);
};
