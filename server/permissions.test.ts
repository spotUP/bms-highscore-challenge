import { describe, expect, it, vi } from 'vitest';
import { mayWriteGames, tournamentIdsForGamesWrite, type QueryExecutor } from './permissions';

const OWNER = 'user-1';
const OUTSIDER = 'user-2';
const TOURNAMENT = 'tournament-1';

// Answers the ownership query for OWNER only, and resolves game rows by id.
const executor = (): QueryExecutor =>
  vi.fn(async (sql: string, params: any[] = []) => {
    if (sql.includes('FROM tournaments t')) {
      const [tournamentId, userId] = params;
      return { rows: tournamentId === TOURNAMENT && userId === OWNER ? [{ '?column?': 1 }] : [] };
    }
    if (sql.includes('FROM games WHERE id')) {
      return { rows: [{ tournament_id: TOURNAMENT }] };
    }
    return { rows: [] };
  });

describe('games write authorization', () => {
  it('lets a tournament owner add games to their own tournament', async () => {
    const allowed = await mayWriteGames(
      executor(),
      OWNER,
      'insert',
      { name: 'Donkey Kong', tournament_id: TOURNAMENT },
      []
    );

    expect(allowed).toBe(true);
  });

  it('refuses a user who does not own the tournament', async () => {
    const allowed = await mayWriteGames(
      executor(),
      OUTSIDER,
      'insert',
      { name: 'Donkey Kong', tournament_id: TOURNAMENT },
      []
    );

    expect(allowed).toBe(false);
  });

  it('refuses an insert that names no tournament', async () => {
    const allowed = await mayWriteGames(executor(), OWNER, 'insert', { name: 'Donkey Kong' }, []);

    expect(allowed).toBe(false);
  });

  it('refuses a batch insert where one row belongs elsewhere', async () => {
    const allowed = await mayWriteGames(
      executor(),
      OWNER,
      'insert',
      [
        { name: 'Donkey Kong', tournament_id: TOURNAMENT },
        { name: 'Tapper', tournament_id: 'someone-elses-tournament' },
      ],
      []
    );

    expect(allowed).toBe(false);
  });

  it('resolves the tournament of a delete filtered by game id', async () => {
    const ids = await tournamentIdsForGamesWrite(executor(), 'delete', null, [
      { column: 'id', op: 'eq', value: 'game-1' },
    ]);

    expect(ids).toEqual([TOURNAMENT]);
  });

  it('refuses a delete that cannot be attributed to a tournament', async () => {
    const allowed = await mayWriteGames(executor(), OWNER, 'delete', null, [
      { column: 'name', op: 'eq', value: 'Donkey Kong' },
    ]);

    expect(allowed).toBe(false);
  });
});
