import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const app = express();

// CORS: restrict to known origins (falls back to permissive in dev)
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : null;
app.use(cors({
  origin: ALLOWED_ORIGINS
    ? (origin, cb) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, true);
        else cb(new Error('Not allowed by CORS'));
      }
    : true,
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const PORT = Number(process.env.PORT || 3001);
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count++;
  return entry.count > maxAttempts;
}
// Periodically clean up expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 60_000);

const mediaRoot = path.join(process.cwd(), 'media');
const upload = multer({ storage: multer.memoryStorage() });

type AuthUser = { id: string; email: string; display_name?: string | null };

const isIdentifier = (value: string) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value);

type DbFilter = { column: string; op: string; value: any; operator?: string };
type OrFilter = { column: string; op: string; value: any; operator?: string };

const parseArrayValue = (value: any) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
    return value
      .slice(1, -1)
      .split(',')
      .map(item => item.replace(/^\"|\"$/g, '').trim())
      .filter(Boolean);
  }
  return value;
};

const normalizeFilterValue = (value: any) => {
  if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\"/g, '"');
  }
  if (value === 'null') return null;
  return value;
};

const buildClause = (filter: DbFilter | OrFilter, params: any[]) => {
  const column = filter.column;
  const op = filter.op;
  const value = normalizeFilterValue(filter.value);
  switch (op) {
    case 'eq':
      params.push(value);
      return `${column} = $${params.length}`;
    case 'neq':
      params.push(value);
      return `${column} <> $${params.length}`;
    case 'gt':
      params.push(value);
      return `${column} > $${params.length}`;
    case 'gte':
      params.push(value);
      return `${column} >= $${params.length}`;
    case 'lt':
      params.push(value);
      return `${column} < $${params.length}`;
    case 'lte':
      params.push(value);
      return `${column} <= $${params.length}`;
    case 'in':
      params.push(parseArrayValue(value));
      return `${column} = ANY($${params.length})`;
    case 'like':
      params.push(value);
      return `${column} LIKE $${params.length}`;
    case 'ilike':
      params.push(value);
      return `${column} ILIKE $${params.length}`;
    case 'is':
      if (value === null) {
        return `${column} IS NULL`;
      }
      params.push(value);
      return `${column} IS $${params.length}`;
    case 'contains':
      params.push(parseArrayValue(value));
      return `${column} @> $${params.length}`;
    case 'cs':
      params.push(parseArrayValue(value));
      return `${column} @> $${params.length}`;
    case 'not': {
      const operator = filter.operator || 'eq';
      if (operator === 'is') {
        if (value === null) return `${column} IS NOT NULL`;
        params.push(value);
        return `${column} IS DISTINCT FROM $${params.length}`;
      }
      if (operator === 'cs') {
        params.push(parseArrayValue(value));
        return `NOT (${column} @> $${params.length})`;
      }
      if (operator === 'in') {
        params.push(parseArrayValue(value));
        return `NOT (${column} = ANY($${params.length}))`;
      }
      if (operator === 'ilike') {
        params.push(value);
        return `${column} NOT ILIKE $${params.length}`;
      }
      if (operator === 'like') {
        params.push(value);
        return `${column} NOT LIKE $${params.length}`;
      }
      params.push(value);
      return `${column} <> $${params.length}`;
    }
    default:
      return '';
  }
};

const parseSelect = (rawSelect: string) => {
  const joins: Array<{ table: string; columns: string[] }> = [];
  const joinRegex = /([a-zA-Z_][a-zA-Z0-9_]*)!inner\s*\(([^)]*)\)/g;
  let cleaned = rawSelect;
  let match: RegExpExecArray | null;
  while ((match = joinRegex.exec(rawSelect)) !== null) {
    const table = match[1];
    const columns = match[2]
      .split(',')
      .map(col => col.trim())
      .filter(Boolean);
    joins.push({ table, columns });
    cleaned = cleaned.replace(match[0], '');
  }
  const baseColumns = cleaned
    .split(',')
    .map(col => col.trim())
    .filter(Boolean)
    .filter(col => col !== '');
  return { baseColumns, joins };
};

const joinMap: Record<string, Record<string, { localKey: string; foreignKey: string }>> = {
  scores: {
    games: { localKey: 'game_id', foreignKey: 'id' }
  },
  player_achievements: {
    achievements: { localKey: 'achievement_id', foreignKey: 'id' }
  },
  bracket_matches: {
    bracket_tournaments: { localKey: 'tournament_id', foreignKey: 'id' }
  }
};

const readAuthUser = (req: express.Request): AuthUser | null => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser & { sub: string };
    return { id: payload.id || payload.sub, email: payload.email, display_name: payload.display_name };
  } catch {
    return null;
  }
};

const requireAuth: express.RequestHandler = (req, res, next) => {
  const user = readAuthUser(req);
  if (!user?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  (req as any).user = user;
  next();
};

const isAdmin = async (userId: string) => {
  const { rows } = await pool.query(
    'SELECT 1 FROM user_roles WHERE user_id = $1 AND role = $2 LIMIT 1',
    [userId, 'admin']
  );
  return rows.length > 0;
};

const ensureDir = (target: string) => {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
};

const writeMediaFile = async (bucket: string, objectPath: string, buffer: Buffer) => {
  const safeBucket = bucket.replace(/[^a-zA-Z0-9_-]/g, '');
  const safePath = objectPath.split('/').map(part => part.replace(/[^a-zA-Z0-9._-]/g, '')).join('/');
  const targetDir = path.join(mediaRoot, safeBucket, path.dirname(safePath));
  const targetPath = path.join(mediaRoot, safeBucket, safePath);
  if (!targetPath.startsWith(mediaRoot)) {
    throw new Error('Invalid media path');
  }
  ensureDir(targetDir);
  fs.writeFileSync(targetPath, buffer);
  return `/media/${safeBucket}/${safePath}`;
};

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

type Subscription = {
  socket: WebSocket;
  channel: string;
  table: string;
  event?: string;
};

const subscriptions: Subscription[] = [];

const broadcastChange = (table: string, event: string, payload: { new?: any; old?: any }) => {
  const message = JSON.stringify({
    type: 'postgres_changes',
    table,
    event,
    schema: 'public',
    payload
  });
  subscriptions.forEach(sub => {
    if (sub.table !== table) return;
    if (sub.event && sub.event !== event) return;
    try {
      sub.socket.send(message);
    } catch {
      // ignore broken sockets
    }
  });
};

wss.on('connection', socket => {
  socket.on('message', raw => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'subscribe') {
        const { channel, filter } = msg;
        const table = String(filter?.table || '');
        const event = filter?.event ? String(filter.event) : undefined;
        if (!isIdentifier(table)) return;
        subscriptions.push({ socket: socket as any, channel: String(channel || ''), table, event });
      }
    } catch {
      // ignore malformed messages
    }
  });

  socket.on('close', () => {
    for (let i = subscriptions.length - 1; i >= 0; i -= 1) {
      if (subscriptions[i].socket === socket) {
        subscriptions.splice(i, 1);
      }
    }
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.use('/media', express.static(mediaRoot, { fallthrough: false }));

app.post('/api/storage/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const bucket = String(req.body.bucket || '').trim();
    const objectPath = String(req.body.path || '').trim();
    if (!bucket || !objectPath || !req.file) {
      res.status(400).json({ error: 'Missing bucket, path, or file' });
      return;
    }
    const url = await writeMediaFile(bucket, objectPath, req.file.buffer);
    res.json({ data: { path: objectPath, publicUrl: `${PUBLIC_BASE_URL}${url}` } });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Upload failed' });
  }
});

app.post('/api/storage/signed-url', requireAuth, async (req, res) => {
  const bucket = String(req.body.bucket || '').trim();
  const objectPath = String(req.body.path || '').trim();
  if (!bucket || !objectPath) {
    res.status(400).json({ error: 'Missing bucket or path' });
    return;
  }
  const signedUrl = `${PUBLIC_BASE_URL}/media/${bucket}/${objectPath}`;
  res.json({ signedUrl });
});

app.post('/api/storage/download', requireAuth, async (req, res) => {
  const bucket = String(req.body.bucket || '').trim();
  const objectPath = String(req.body.path || '').trim();
  if (!bucket || !objectPath) {
    res.status(400).json({ error: 'Missing bucket or path' });
    return;
  }
  const filePath = path.join(mediaRoot, bucket, objectPath);
  if (!filePath.startsWith(mediaRoot) || !fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }
  res.sendFile(filePath);
});

app.post('/api/auth/signup', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '').trim();
  const username = String(req.body.username || '').trim();
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  // Rate limit: 5 signups per IP per 15 min
  const ip = req.ip || 'unknown';
  if (rateLimit(`signup:${ip}`, 5, 15 * 60_000)) {
    res.status(429).json({ error: 'Too many signup attempts. Please try again later.' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = uuidv4();
  try {
    await pool.query(
      `INSERT INTO auth.users (id, email, password_hash, display_name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [userId, email, passwordHash, username || null]
    );
    await pool.query(
      `INSERT INTO profiles (id, user_id, email, display_name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, display_name = EXCLUDED.display_name`,
      [userId, userId, email, username || null]
    );
  } catch (error: any) {
    res.status(400).json({ error: error?.message || 'Failed to create user' });
    return;
  }

  const token = jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ session: { access_token: token, user: { id: userId, email } } });
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '').trim();
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  // Rate limit: 10 login attempts per email per 15 min
  if (rateLimit(`login:${email}`, 10, 15 * 60_000)) {
    res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
    return;
  }
  const { rows } = await pool.query(
    'SELECT id, email, password_hash, display_name FROM auth.users WHERE email = $1 LIMIT 1',
    [email]
  );
  const user = rows[0];
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  await pool.query('UPDATE auth.users SET last_sign_in_at = NOW() WHERE id = $1', [user.id]);
  const token = jwt.sign({ id: user.id, email: user.email, display_name: user.display_name }, JWT_SECRET, {
    expiresIn: '7d'
  });
  res.json({ session: { access_token: token, user: { id: user.id, email: user.email, display_name: user.display_name } } });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: (req as any).user });
});

app.post('/api/auth/reset', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  // Rate limit: 3 reset requests per email per 15 min
  if (rateLimit(`reset:${email}`, 3, 15 * 60_000)) {
    res.status(429).json({ error: 'Too many reset attempts. Please try again later.' });
    return;
  }
  const { rows } = await pool.query('SELECT id FROM auth.users WHERE email = $1 LIMIT 1', [email]);
  if (!rows.length) {
    res.json({ success: true });
    return;
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const userId = rows[0].id;
  await pool.query(
    `INSERT INTO password_resets (id, user_id, code, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '20 minutes')`,
    [uuidv4(), userId, code]
  );
  if (process.env.NODE_ENV !== 'production') {
    res.json({ success: true, code });
  } else {
    res.json({ success: true });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const token = String(req.body.token || '').trim();
  if (!email || !token) {
    res.status(400).json({ error: 'Email and code are required' });
    return;
  }

  // Rate limit: 5 OTP attempts per email per 15 min
  if (rateLimit(`otp:${email}`, 5, 15 * 60_000)) {
    res.status(429).json({ error: 'Too many verification attempts. Please try again later.' });
    return;
  }
  const { rows } = await pool.query(
    `SELECT pr.id, pr.user_id, pr.expires_at, pr.used_at
     FROM password_resets pr
     JOIN auth.users u ON u.id = pr.user_id
     WHERE u.email = $1 AND pr.code = $2
     ORDER BY pr.expires_at DESC
     LIMIT 1`,
    [email, token]
  );
  const record = rows[0];
  if (!record || record.used_at || new Date(record.expires_at).getTime() < Date.now()) {
    res.status(400).json({ error: 'Invalid or expired code' });
    return;
  }
  await pool.query('UPDATE password_resets SET used_at = NOW() WHERE id = $1', [record.id]);
  const resetToken = jwt.sign({ id: record.user_id, email, purpose: 'password-reset' }, JWT_SECRET, {
    expiresIn: '30m'
  });
  res.json({ success: true, resetToken });
});

app.post('/api/auth/update-user', async (req, res) => {
  const password = String(req.body.password || '').trim();
  if (!password) {
    res.status(400).json({ error: 'Password is required' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }
  const resetToken = String(req.body.resetToken || '');
  let userId = '';
  if (resetToken) {
    try {
      const payload = jwt.verify(resetToken, JWT_SECRET) as any;
      if (payload?.purpose !== 'password-reset') throw new Error('Invalid token');
      userId = payload.id;
    } catch {
      res.status(400).json({ error: 'Invalid reset token' });
      return;
    }
  } else {
    const authUser = readAuthUser(req);
    if (!authUser?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    userId = authUser.id;
  }

  const hash = await bcrypt.hash(password, 10);
  await pool.query('UPDATE auth.users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, userId]);
  res.json({ success: true });
});

app.post('/api/db', async (req, res) => {
  const {
    table,
    action,
    select = '*',
    data,
    filters = [],
    orFilters = [],
    order,
    range,
    limit,
    onConflict,
    single,
    maybeSingle
  } = req.body || {};

  // Log all requests to track score submission flow
  if (table === 'scores' || table === 'score_submissions') {
    console.log(`[/api/db] ${action?.toUpperCase()} ${table} | filters:`, JSON.stringify(filters).substring(0, 100));
  }

  if (!table || !isIdentifier(table)) {
    res.status(400).json({ error: 'Invalid table name' });
    return;
  }

  const user = readAuthUser(req);
  const isSelect = action === 'select';
  // Allow anonymous score submissions; all other writes require auth
  const anonWriteTables = ['scores', 'score_submissions'];
  if (!user && !isSelect && !anonWriteTables.includes(table)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Table-level write authorization: restrict which tables authenticated users can modify
  const publicWriteTables = ['scores', 'score_submissions', 'player_achievements', 'profiles'];
  const adminOnlyTables = ['user_roles', 'role_audit_log', 'competitions'];
  if (!isSelect && user && adminOnlyTables.includes(table)) {
    // Check if user has admin role
    const { rows: roleRows } = await pool.query(
      "SELECT role FROM user_roles WHERE user_id = $1 AND role = 'admin' LIMIT 1",
      [user.id]
    );
    if (!roleRows.length) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
  }

  const params: any[] = [];
  const whereClauses: string[] = [];
  const orClauses: string[] = [];

  for (const filter of filters as DbFilter[]) {
    const column = String(filter.column || '');
    if (!isIdentifier(column)) {
      res.status(400).json({ error: 'Invalid filter column' });
      return;
    }
    const clause = buildClause(filter, params);
    if (!clause) {
      res.status(400).json({ error: 'Unsupported filter operation' });
      return;
    }
    whereClauses.push(clause);
  }

  for (const filter of orFilters as OrFilter[]) {
    const column = String(filter.column || '');
    if (!isIdentifier(column)) {
      res.status(400).json({ error: 'Invalid OR filter column' });
      return;
    }
    const clause = buildClause(filter, params);
    if (!clause) {
      res.status(400).json({ error: 'Unsupported OR filter operation' });
      return;
    }
    orClauses.push(clause);
  }

  if (orClauses.length) {
    whereClauses.push(`(${orClauses.join(' OR ')})`);
  }

  const whereSql = whereClauses.length ? ` WHERE ${whereClauses.join(' AND ')}` : '';

  try {
    if (action === 'select') {
      const { baseColumns, joins } = parseSelect(String(select));
      const columns = baseColumns.length ? baseColumns : ['*'];
      const safeColumns = columns.every(col => col === '*' || isIdentifier(col));
      if (!safeColumns) {
        const bad = columns.filter(col => col !== '*' && !isIdentifier(col));
        console.error('[/api/db] Invalid select columns:', bad, '| raw select:', select);
        res.status(400).json({ error: 'Invalid select columns', detail: bad });
        return;
      }
      const orderSql = order?.column && isIdentifier(order.column)
        ? ` ORDER BY ${order.column} ${order.ascending === false ? 'DESC' : 'ASC'}`
        : '';
      const limitValue = range ? range.to - range.from + 1 : limit;
      if (typeof limitValue === 'number') {
        params.push(limitValue);
      }
      if (range && typeof range.from === 'number') {
        params.push(range.from);
      }
      const limitSql = typeof limitValue === 'number' ? ` LIMIT $${params.length - (range ? 1 : 0)}` : '';
      const offsetSql = range && typeof range.from === 'number' ? ` OFFSET $${params.length}` : '';

      const sql = `SELECT ${columns.join(', ') || '*'} FROM ${table}${whereSql}${orderSql}${limitSql}${offsetSql}`;
      const result = await pool.query(sql, params);
      let rows = result.rows;

      if (joins.length) {
        for (const join of joins) {
          const mapping = joinMap[table]?.[join.table];
          if (!mapping) continue;
          const ids = rows
            .map(row => row[mapping.localKey])
            .filter((value: any) => value !== null && value !== undefined);
          const uniqueIds = Array.from(new Set(ids));
          if (!uniqueIds.length) {
            rows = [];
            break;
          }
          const joinColumns = Array.from(new Set([mapping.foreignKey, ...join.columns])).filter(isIdentifier);
          const joinResult = await pool.query(
            `SELECT ${joinColumns.join(', ')} FROM ${join.table} WHERE ${mapping.foreignKey} = ANY($1)`,
            [uniqueIds]
          );
          const joinMapById = new Map(joinResult.rows.map(row => [row[mapping.foreignKey], row]));
          rows = rows
            .map(row => ({
              ...row,
              [join.table]: joinMapById.get(row[mapping.localKey]) || null
            }))
            .filter(row => row[join.table]);
        }
      }

      if (single && rows.length !== 1) {
        res.json({ data: null, error: { message: 'Expected a single row' } });
        return;
      }
      if (single) rows = rows.slice(0, 1);
      if (single) {
        res.json({ data: rows[0] || null, error: null });
        return;
      }
      if (maybeSingle) {
        res.json({ data: rows[0] || null, error: null });
        return;
      }
      res.json({ data: rows, error: null });
      return;
    }

    if (action === 'insert' || action === 'upsert') {
      console.log(`[/api/db] ${action.toUpperCase()} ${table}:`, JSON.stringify(data).substring(0, 200));
      const rows = Array.isArray(data) ? data : [data];
      const columns = Object.keys(rows[0] || {});
      if (!columns.length || !columns.every(isIdentifier)) {
        res.status(400).json({ error: 'Invalid insert data' });
        return;
      }
      const valuesSql = rows
        .map((row, rowIndex) => {
          return `(${columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`).join(', ')})`;
        })
        .join(', ');
      const valueParams = rows.flatMap(row => columns.map(col => row[col]));
      const conflictSql = action === 'upsert' && onConflict && isIdentifier(onConflict)
        ? ` ON CONFLICT (${onConflict}) DO UPDATE SET ${columns.map(col => `${col} = EXCLUDED.${col}`).join(', ')}`
        : '';
      const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${valuesSql}${conflictSql} RETURNING *`;
      console.log(`[/api/db] SQL:`, sql);
      console.log(`[/api/db] Params:`, valueParams);
      const result = await pool.query(sql, valueParams);
      console.log(`[/api/db] Result rows:`, result.rows.length);
      if (action === 'insert') {
        result.rows.forEach(row => broadcastChange(table, 'INSERT', { new: row }));
      } else {
        result.rows.forEach(row => broadcastChange(table, 'UPDATE', { new: row }));
      }
      res.json({ data: Array.isArray(data) ? result.rows : result.rows[0], error: null });
      return;
    }

    if (action === 'update') {
      console.log(`[/api/db] UPDATE ${table}:`, JSON.stringify(data).substring(0, 200));
      if (!data || typeof data !== 'object') {
        res.status(400).json({ error: 'Invalid update data' });
        return;
      }
      const columns = Object.keys(data);
      if (!columns.length || !columns.every(isIdentifier)) {
        res.status(400).json({ error: 'Invalid update columns' });
        return;
      }
      const setSql = columns.map((col, idx) => `${col} = $${idx + 1}`).join(', ');
      const valueParams = columns.map(col => data[col]);
      // Re-number WHERE clause placeholders to account for SET params offset
      const offset = columns.length;
      const offsetWhere = whereSql.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + offset}`);
      const sql = `UPDATE ${table} SET ${setSql}${offsetWhere} RETURNING *`;
      console.log(`[/api/db] SQL:`, sql);
      console.log(`[/api/db] Params:`, [...valueParams, ...params]);
      const result = await pool.query(sql, [...valueParams, ...params]);
      console.log(`[/api/db] Result rows:`, result.rows.length);
      result.rows.forEach(row => broadcastChange(table, 'UPDATE', { new: row }));
      res.json({ data: result.rows, error: null });
      return;
    }

    if (action === 'delete') {
      if (!whereSql) {
        res.status(400).json({ error: 'Delete requires filters' });
        return;
      }
      const sql = `DELETE FROM ${table}${whereSql} RETURNING *`;
      const result = await pool.query(sql, params);
      result.rows.forEach(row => broadcastChange(table, 'DELETE', { old: row }));
      res.json({ data: result.rows, error: null });
      return;
    }

    res.status(400).json({ error: 'Unsupported action' });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Database error' });
  }
});

app.post('/api/rpc/:fn', async (req, res) => {
  const fn = String(req.params.fn || '').trim();
  if (!isIdentifier(fn)) {
    res.status(400).json({ error: 'Invalid function name' });
    return;
  }
  const args = req.body || {};
  const keys = Object.keys(args);
  const params = keys.map(key => args[key]);
  const sqlArgs = keys.map((key, idx) => `${key} => $${idx + 1}`).join(', ');
  try {
    const authUser = readAuthUser(req);
    if (authUser?.id) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [authUser.id]);
        const result = await client.query(`SELECT * FROM ${fn}(${sqlArgs})`, params);
        await client.query('COMMIT');
        res.json({ data: result.rows, error: null });
      } catch (error: any) {
        await client.query('ROLLBACK');
        console.error(`[/api/rpc/${fn}] Auth path error:`, error?.message);
        res.status(500).json({ error: error?.message || 'RPC error' });
      } finally {
        client.release();
      }
      return;
    }
    const result = await pool.query(`SELECT * FROM ${fn}(${sqlArgs})`, params);
    res.json({ data: result.rows, error: null });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'RPC error' });
  }
});

// ── Webhook helpers ──
async function sendToWebhook(webhookUrl: string, message: unknown, label: string) {
  const resp = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(10000)
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${label} webhook ${resp.status}: ${text}`);
  }
  return resp;
}

async function getEnabledWebhooks(platform: string) {
  const { rows } = await pool.query(
    `SELECT webhook_url FROM webhook_config
     WHERE platform = $1 AND enabled = true
       AND webhook_url IS NOT NULL AND webhook_url != ''`,
    [platform]
  );
  return rows as { webhook_url: string }[];
}

async function fanOutWebhook(platform: string, message: unknown) {
  const configs = await getEnabledWebhooks(platform);
  if (configs.length === 0) return;
  console.log(`Sending to ${configs.length} ${platform} webhook(s)`);
  const results = await Promise.allSettled(
    configs.map((c, i) => sendToWebhook(c.webhook_url, message, `${platform}-${i + 1}`))
  );
  const ok = results.filter(r => r.status === 'fulfilled').length;
  const fail = results.length - ok;
  console.log(`${platform} webhooks: ${ok} ok, ${fail} failed`);
}

async function handleScoreWebhook(body: Record<string, any>) {
  // Get rank position
  let position = 1;
  try {
    const { rows } = await pool.query(
      `SELECT score FROM scores WHERE game_id = $1 ORDER BY score DESC`,
      [body.game_id]
    );
    position = (rows.filter((r: any) => r.score > body.score).length) + 1;
  } catch (e) { console.error('Rank query failed:', e); }

  // Get clear logo URL
  let clearLogoUrl: string | null = null;
  try {
    const { rows } = await pool.query(`SELECT name FROM games WHERE id = $1`, [body.game_id]);
    if (rows[0]?.name) {
      const safe = rows[0].name.replace(/[^a-zA-Z0-9\-_\s]/g, '').replace(/\s+/g, '-').toLowerCase();
      clearLogoUrl = `${PUBLIC_BASE_URL}/api/clear-logos/${safe}.webp`;
    }
  } catch (e) { /* ignore */ }

  const teamsMessage = {
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        type: 'AdaptiveCard', version: '1.5',
        body: [
          ...(clearLogoUrl ? [{
            type: 'Image', url: clearLogoUrl, size: 'Medium',
            horizontalAlignment: 'Center', spacing: 'Small'
          }] : []),
          { type: 'TextBlock', text: 'NEW HIGHSCORE ALERT!', wrap: true, style: 'heading',
            size: 'ExtraLarge', horizontalAlignment: 'Center', color: 'Accent' },
          { type: 'Container', horizontalAlignment: 'Center', items: [
            { type: 'TextBlock', text: `🏆 #${position} ${body.player_name}`, wrap: true,
              size: 'Large', weight: 'Bolder', color: 'Accent', horizontalAlignment: 'Center' },
            { type: 'TextBlock', text: `Score: ${Number(body.score).toLocaleString()}`, wrap: true,
              size: 'Medium', weight: 'Bolder', color: 'Good', horizontalAlignment: 'Center' },
            { type: 'TextBlock', text: `Game: ${body.game_name}`, wrap: true,
              size: 'Medium', color: 'Default', horizontalAlignment: 'Center' }
          ]}
        ]
      }
    }]
  };

  const discordMessage = {
    embeds: [{
      title: 'NEW HIGHSCORE ALERT!',
      description: `🏆 **#${position} ${body.player_name}**\nScore: ${Number(body.score).toLocaleString()}\nGame: ${body.game_name}`,
      color: 0x7c3aed
    }]
  };

  const slackMessage = {
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '🎮 NEW HIGHSCORE ALERT!' } },
      { type: 'section', text: { type: 'mrkdwn',
        text: `🏆 *#${position} ${body.player_name}*\nScore: ${Number(body.score).toLocaleString()}\nGame: ${body.game_name}` } }
    ]
  };

  await Promise.allSettled([
    fanOutWebhook('teams', teamsMessage),
    fanOutWebhook('discord', discordMessage),
    fanOutWebhook('slack', slackMessage)
  ]);
}

async function handleCompetitionWebhook(body: Record<string, any>) {
  const { event_type, competition_name, games = [], timestamp, total_scores, winner } = body;
  const isStarted = event_type === 'competition_started';
  const siteUrl = PUBLIC_BASE_URL;

  const cardBody: any[] = [
    { type: 'TextBlock', text: isStarted ? '🎮 Competition Started!' : '🏁 Competition Ended!',
      weight: 'Bolder', size: 'Large', color: isStarted ? 'Good' : 'Warning' },
    { type: 'TextBlock', text: competition_name || 'Arcade High Score Challenge',
      weight: 'Bolder', size: 'Medium' },
    { type: 'TextBlock', wrap: true, text: isStarted
        ? `🎯 ${games.length} games selected for this competition!`
        : `📊 Competition completed with ${total_scores || 0} total scores submitted` },
    { type: 'TextBlock', text: `🕐 ${new Date(timestamp).toLocaleString()}`, size: 'Small', color: 'Light' }
  ];
  if (!isStarted && winner) {
    cardBody.push({ type: 'TextBlock', weight: 'Bolder', color: 'Accent',
      text: `🏆 Winner: ${winner.player_name} with ${Number(winner.total_score).toLocaleString()} points!` });
  }
  if (games.length > 0) {
    cardBody.push({ type: 'TextBlock', wrap: true, size: 'Small',
      text: `🎮 Games: ${games.map((g: any) => g.name).join(', ')}` });
  }

  const teamsMessage = {
    type: 'message',
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        type: 'AdaptiveCard', version: '1.3', body: cardBody,
        actions: [{ type: 'Action.OpenUrl', title: 'View Leaderboard', url: siteUrl }]
      }
    }]
  };

  const discordFields: any[] = [
    { name: isStarted ? 'Games Selected' : 'Final Stats', inline: true,
      value: isStarted ? `${games.length} games ready!` : `📊 ${total_scores || 0} total scores` },
    { name: 'Timestamp', value: new Date(timestamp).toLocaleString(), inline: true }
  ];
  if (!isStarted && winner) {
    discordFields.push({ name: '🏆 Winner', inline: false,
      value: `${winner.player_name} - ${Number(winner.total_score).toLocaleString()} points` });
  }
  if (games.length > 0) {
    discordFields.push({ name: '🎮 Games', inline: false,
      value: games.map((g: any) => g.name).join(', ') });
  }
  const discordMessage = {
    embeds: [{
      title: isStarted ? '🎮 Competition Started!' : '🏁 Competition Ended!',
      description: competition_name || 'Arcade High Score Challenge',
      color: isStarted ? 0x00ff00 : 0xffaa00,
      fields: discordFields,
      footer: { text: 'RetroRanks' }
    }]
  };

  const slackBlocks: any[] = [
    { type: 'header', text: { type: 'plain_text',
      text: isStarted ? '🎮 Competition Started!' : '🏁 Competition Ended!' } },
    { type: 'section', text: { type: 'mrkdwn',
      text: `*${competition_name || 'Arcade High Score Challenge'}*\n${isStarted
        ? `🎯 ${games.length} games selected!` : `📊 ${total_scores || 0} total scores`}` } },
    { type: 'context', elements: [{ type: 'mrkdwn',
      text: `🕐 ${new Date(timestamp).toLocaleString()}` }] }
  ];
  if (!isStarted && winner) {
    slackBlocks.push({ type: 'section', text: { type: 'mrkdwn',
      text: `🏆 *Winner:* ${winner.player_name} with ${Number(winner.total_score).toLocaleString()} points!` } });
  }
  if (games.length > 0) {
    slackBlocks.push({ type: 'section', text: { type: 'mrkdwn',
      text: `🎮 *Games:* ${games.map((g: any) => g.name).join(', ')}` } });
  }
  slackBlocks.push({ type: 'actions', elements: [{ type: 'button',
    text: { type: 'plain_text', text: 'View Leaderboard' }, url: siteUrl }] });
  const slackMessage = { blocks: slackBlocks };

  await Promise.allSettled([
    fanOutWebhook('teams', teamsMessage),
    fanOutWebhook('discord', discordMessage),
    fanOutWebhook('slack', slackMessage)
  ]);
}

async function handleAchievementWebhook(body: Record<string, any>) {
  const { player_name, achievements = [], game_name, score } = body;
  const totalPoints = achievements.reduce((sum: number, a: any) => sum + (a.points || 0), 0);
  const headerText = achievements.length === 1
    ? '🏆 ACHIEVEMENT UNLOCKED!' : `🏆 ${achievements.length} ACHIEVEMENTS UNLOCKED!`;

  const cardBody: any[] = [
    { type: 'TextBlock', text: headerText, wrap: true, style: 'heading',
      size: 'ExtraLarge', horizontalAlignment: 'Center', color: 'Good' },
    { type: 'TextBlock', text: `🎯 ${player_name}`, wrap: true,
      size: 'Large', weight: 'Bolder', color: 'Accent', horizontalAlignment: 'Center' }
  ];
  achievements.forEach((a: any, i: number) => {
    cardBody.push({
      type: 'Container', horizontalAlignment: 'Center', separator: i > 0, items: [
        { type: 'TextBlock', text: `🏅 ${a.name}`, wrap: true, size: 'Medium',
          weight: 'Bolder', color: 'Good', horizontalAlignment: 'Center' },
        { type: 'TextBlock', text: `📝 ${a.description}`, wrap: true, size: 'Small',
          color: 'Default', horizontalAlignment: 'Center' },
        { type: 'TextBlock', text: `⭐ +${a.points} Points`, wrap: true, size: 'Small',
          weight: 'Bolder', color: 'Accent', horizontalAlignment: 'Center' }
      ]
    });
  });
  if (achievements.length > 1) {
    cardBody.push({ type: 'TextBlock', text: `🎊 Total: +${totalPoints} Points`, wrap: true,
      size: 'Large', weight: 'Bolder', color: 'Accent', horizontalAlignment: 'Center', separator: true });
  }
  if (game_name && score) {
    cardBody.push({
      type: 'Container', horizontalAlignment: 'Center', separator: true, items: [
        { type: 'TextBlock', text: `🎮 Earned in: ${game_name}`, wrap: true, size: 'Small',
          color: 'Default', horizontalAlignment: 'Center' },
        { type: 'TextBlock', text: `🎯 Score: ${Number(score).toLocaleString()}`, wrap: true,
          size: 'Small', color: 'Default', horizontalAlignment: 'Center' }
      ]
    });
  }

  const teamsMessage = {
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: { type: 'AdaptiveCard', version: '1.5', body: cardBody }
    }]
  };

  const discordMessage = {
    embeds: [{
      title: headerText,
      description: `🎯 **${player_name}**\n${achievements.map((a: any) =>
        `🏅 ${a.name} — ${a.description} (+${a.points})`).join('\n')}`,
      color: 0x00ff00
    }]
  };

  const slackMessage = {
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: headerText } },
      { type: 'section', text: { type: 'mrkdwn',
        text: `🎯 *${player_name}*\n${achievements.map((a: any) =>
          `🏅 *${a.name}* — ${a.description} (+${a.points})`).join('\n')}` } }
    ]
  };

  await Promise.allSettled([
    fanOutWebhook('teams', teamsMessage),
    fanOutWebhook('discord', discordMessage),
    fanOutWebhook('slack', slackMessage)
  ]);
}

// ── Clear-logos proxy (ported from Vercel serverless function) ──
const CLEAR_LOGO_R2_DOMAIN = process.env.CLOUDFLARE_R2_DOMAIN ||
  process.env.VITE_CLOUDFLARE_R2_DOMAIN ||
  'pub-1a84b69be18749cc982661f2fd3478b2.r2.dev';

const PLACEHOLDER_SVG = `<svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
  <rect width="64" height="64" fill="#374151"/>
  <text x="32" y="20" text-anchor="middle" fill="#9CA3AF" font-family="Arial" font-size="10">No Logo</text>
  <text x="32" y="35" text-anchor="middle" fill="#6B7280" font-family="Arial" font-size="8">Available</text>
</svg>`;

app.get('/api/clear-logos/:filename', async (req, res) => {
  const { filename } = req.params;
  if (!filename) {
    res.status(400).json({ error: 'Filename required' });
    return;
  }
  const logoUrl = `https://${CLEAR_LOGO_R2_DOMAIN}/clear-logos/${filename}`;
  try {
    const response = await fetch(logoUrl);
    if (!response.ok) {
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.send(PLACEHOLDER_SVG);
      return;
    }
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.send(imageBuffer);
  } catch {
    res.status(500).json({ error: 'Failed to fetch logo' });
  }
});

app.post('/api/functions/:name', async (req, res) => {
  const name = String(req.params.name || '');
  const user = readAuthUser(req);
  const body = req.body || {};

  if (name === 'invite-user') {
    if (!user || !(await isAdmin(user.id))) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const email = String(body.email || '').trim().toLowerCase();
    const role = String(body.role || 'user');
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }
    const tempPassword = Math.random().toString(36).slice(-10);
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const userId = uuidv4();
    await pool.query(
      `INSERT INTO auth.users (id, email, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())`,
      [userId, email, passwordHash]
    );
    await pool.query(
      `INSERT INTO profiles (id, user_id, email, display_name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email`,
      [userId, userId, email, null]
    );
    await pool.query(
      `INSERT INTO user_roles (id, user_id, role, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())`,
      [uuidv4(), userId, role]
    );
    res.json({ success: true, user: { id: userId, email, password: tempPassword } });
    return;
  }

  if (name === 'manage-users') {
    if (!user || !(await isAdmin(user.id))) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const action = String(body.action || 'list');
    if (action === 'health') {
      res.json({ success: true });
      return;
    }
    if (action === 'list') {
      const result = await pool.query(
        `SELECT u.id, u.email, u.created_at, u.last_sign_in_at, ur.role
         FROM auth.users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         ORDER BY u.created_at DESC`
      );
      res.json({ success: true, users: result.rows });
      return;
    }
    if (action === 'delete') {
      const userId = String(body.user_id || '');
      await pool.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
      await pool.query('DELETE FROM profiles WHERE id = $1', [userId]);
      await pool.query('DELETE FROM auth.users WHERE id = $1', [userId]);
      res.json({ success: true });
      return;
    }
    if (action === 'create-test') {
      const tempEmail = `test-${Math.random().toString(36).slice(2, 8)}@retroranks.local`;
      const tempPassword = Math.random().toString(36).slice(-10);
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      const userId = uuidv4();
      await pool.query(
        `INSERT INTO auth.users (id, email, password_hash, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [userId, tempEmail, passwordHash]
      );
      res.json({ success: true, user: { id: userId, email: tempEmail, password: tempPassword } });
      return;
    }
  }

  if (name === 'manage-player-achievements') {
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (body.action === 'delete') {
      await pool.query('DELETE FROM player_achievements WHERE id = $1', [body.player_achievement_id]);
      res.json({ success: true, message: 'Player achievement deleted.' });
      return;
    }
  }

  if (name === 'clone-tournament') {
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const tournamentId = String(body.tournament_id || '');
    const { rows } = await pool.query('SELECT * FROM tournaments WHERE id = $1 LIMIT 1', [tournamentId]);
    if (!rows.length) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }
    const original = rows[0];
    const newId = uuidv4();
    await pool.query(
      `INSERT INTO tournaments (id, name, slug, description, is_public, is_active, is_default, scores_locked, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, false, false, false, $6, NOW(), NOW())`,
      [
        newId,
        `${original.name} (Copy)`,
        `${original.slug}-copy-${newId.slice(0, 6)}`,
        original.description,
        original.is_public,
        user.id
      ]
    );
    await pool.query(
      `INSERT INTO games (id, name, description, logo_url, include_in_challenge, is_active, tournament_id, created_at, updated_at)
       SELECT gen_random_uuid(), name, description, logo_url, include_in_challenge, is_active, $1, NOW(), NOW()
       FROM games WHERE tournament_id = $2`,
      [newId, tournamentId]
    );
    res.json({ success: true, tournament_id: newId });
    return;
  }

  if (name === 'reset-achievements') {
    if (!user || !(await isAdmin(user.id))) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    await pool.query('DELETE FROM player_achievements');
    res.json({ success: true });
    return;
  }

  if (name === 'reset-competition-scores') {
    if (!user || !(await isAdmin(user.id))) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    await pool.query('DELETE FROM scores');
    res.json({ success: true });
    return;
  }

  if (
    name === 'send-score-webhook' ||
    name === 'send-competition-webhook' ||
    name === 'achievement-webhook-simple' ||
    name === 'send-test-failure-report' ||
    name === 'webhook-trigger'
  ) {
    // Dispatch to the appropriate handler in the background
    const handler =
      name === 'send-score-webhook' ? handleScoreWebhook :
      name === 'send-competition-webhook' ? handleCompetitionWebhook :
      name === 'achievement-webhook-simple' ? handleAchievementWebhook :
      null;

    if (handler) {
      handler(body).catch(err => console.error(`${name} failed:`, err));
    }

    res.json({ success: true });
    return;
  }

  res.status(404).json({ error: 'Function not found' });
});

// ── Serve static frontend (production) ──
const distDir = path.join(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('{*path}', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[api] Server running on http://0.0.0.0:${PORT}`);
});
