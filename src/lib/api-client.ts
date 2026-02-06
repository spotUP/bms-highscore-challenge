const API_URL = (import.meta as any)?.env?.VITE_API_URL || '';
const WS_URL = (import.meta as any)?.env?.VITE_WS_URL || (API_URL ? API_URL.replace(/^http/, 'ws') : '');

export type AuthUser = {
  id: string;
  email: string;
  display_name?: string | null;
};

export type AuthSession = {
  access_token: string;
  user: AuthUser;
};

const REMEMBER_ME_KEY = 'auth_remember_me';
const TOKEN_KEY = 'rr_token';
const USER_KEY = 'rr_user';

const getStorage = () => {
  try {
    const remember = localStorage.getItem(REMEMBER_ME_KEY) !== 'false';
    return remember ? localStorage : sessionStorage;
  } catch {
    return localStorage;
  }
};

const listeners = new Set<(event: string, session: AuthSession | null) => void>();
let cachedSession: AuthSession | null = null;
let pendingResetToken: string | null = null;

const emitAuth = (event: string, session: AuthSession | null) => {
  listeners.forEach(listener => listener(event, session));
};

const saveSession = (session: AuthSession | null) => {
  cachedSession = session;
  const storage = getStorage();
  if (!session) {
    storage.removeItem(TOKEN_KEY);
    storage.removeItem(USER_KEY);
  } else {
    storage.setItem(TOKEN_KEY, session.access_token);
    storage.setItem(USER_KEY, JSON.stringify(session.user));
  }
  emitAuth(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
};

const loadSession = (): AuthSession | null => {
  if (cachedSession) return cachedSession;
  try {
    const storage = getStorage();
    const token = storage.getItem(TOKEN_KEY);
    const userRaw = storage.getItem(USER_KEY);
    if (!token || !userRaw) return null;
    const user = JSON.parse(userRaw) as AuthUser;
    cachedSession = { access_token: token, user };
    return cachedSession;
  } catch {
    return null;
  }
};

const apiRequest = async (path: string, options: RequestInit = {}) => {
  const session = loadSession();
  const headers = new Headers(options.headers || {});
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(data?.error || data?.message || response.statusText);
  }
  return data;
};

type DbFilter = {
  column: string;
  op: string;
  value: any;
  operator?: string;
};

type OrCondition = {
  column: string;
  op: string;
  value: any;
  operator?: string;
};

const splitTopLevel = (input: string, delimiter: string) => {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let inQuotes = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === '"' && input[i - 1] !== '\\') {
      inQuotes = !inQuotes;
    }
    if (!inQuotes) {
      if (ch === '(') depth += 1;
      if (ch === ')') depth = Math.max(0, depth - 1);
    }
    if (ch === delimiter && !inQuotes && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
};

const parseOrCondition = (raw: string): OrCondition | null => {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('and(')) return null;
  const firstDot = trimmed.indexOf('.');
  const secondDot = trimmed.indexOf('.', firstDot + 1);
  if (firstDot === -1 || secondDot === -1) return null;
  const column = trimmed.slice(0, firstDot);
  let op = trimmed.slice(firstDot + 1, secondDot);
  let valueRaw = trimmed.slice(secondDot + 1);
  if (op === 'not') {
    const nextDot = valueRaw.indexOf('.');
    if (nextDot === -1) return null;
    const operator = valueRaw.slice(0, nextDot);
    const value = valueRaw.slice(nextDot + 1);
    return { column, op: 'not', operator, value };
  }
  if (valueRaw.startsWith('"') && valueRaw.endsWith('"')) {
    valueRaw = valueRaw.slice(1, -1).replace(/\\"/g, '"');
  }
  return { column, op, value: valueRaw };
};

class QueryBuilder {
  private table: string;
  private action: string | null = null;
  private selectColumns: string | undefined;
  private filters: DbFilter[] = [];
  private orFilters: OrCondition[] = [];
  private orderBy?: { column: string; ascending?: boolean };
  private rangeValue?: { from: number; to: number };
  private limitValue?: number;
  private singleValue = false;
  private maybeSingleValue = false;
  private payload: any = null;
  private onConflict?: string;

  constructor(table: string) {
    this.table = table;
  }

  select(columns = '*') {
    this.action = 'select';
    this.selectColumns = columns;
    return this;
  }

  insert(values: any) {
    this.action = 'insert';
    this.payload = values;
    return this;
  }

  update(values: any) {
    this.action = 'update';
    this.payload = values;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  upsert(values: any, options?: { onConflict?: string }) {
    this.action = 'upsert';
    this.payload = values;
    this.onConflict = options?.onConflict;
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ column, op: 'eq', value });
    return this;
  }

  gt(column: string, value: any) {
    this.filters.push({ column, op: 'gt', value });
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push({ column, op: 'gte', value });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push({ column, op: 'neq', value });
    return this;
  }

  lt(column: string, value: any) {
    this.filters.push({ column, op: 'lt', value });
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push({ column, op: 'lte', value });
    return this;
  }

  in(column: string, value: any[]) {
    this.filters.push({ column, op: 'in', value });
    return this;
  }

  is(column: string, value: any) {
    this.filters.push({ column, op: 'is', value });
    return this;
  }

  not(column: string, operator: string, value: any) {
    this.filters.push({ column, op: 'not', operator, value });
    return this;
  }

  like(column: string, value: any) {
    this.filters.push({ column, op: 'like', value });
    return this;
  }

  ilike(column: string, value: any) {
    this.filters.push({ column, op: 'ilike', value });
    return this;
  }

  contains(column: string, value: any) {
    this.filters.push({ column, op: 'contains', value });
    return this;
  }

  or(expression: string) {
    const parts = splitTopLevel(expression, ',');
    const parsed = parts.map(parseOrCondition).filter(Boolean) as OrCondition[];
    this.orFilters = this.orFilters.concat(parsed);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending }; 
    return this;
  }

  range(from: number, to: number) {
    this.rangeValue = { from, to };
    return this;
  }

  limit(count: number) {
    this.limitValue = count;
    return this;
  }

  single() {
    this.singleValue = true;
    return this;
  }

  maybeSingle() {
    this.maybeSingleValue = true;
    return this;
  }

  async execute() {
    try {
      const result = await apiRequest('/api/db', {
        method: 'POST',
        body: JSON.stringify({
          table: this.table,
          action: this.action,
          select: this.selectColumns,
          data: this.payload,
          filters: this.filters,
          orFilters: this.orFilters,
          order: this.orderBy,
          range: this.rangeValue,
          limit: this.limitValue,
          onConflict: this.onConflict,
          single: this.singleValue,
          maybeSingle: this.maybeSingleValue,
        })
      });
      return { data: result.data ?? null, error: result.error ?? null };
    } catch (error: any) {
      return { data: null, error: { message: error.message || 'Request failed' } };
    }
  }

  then(resolve: any, reject: any) {
    return this.execute().then(resolve, reject);
  }

  catch(reject: any) {
    return this.execute().catch(reject);
  }

  finally(handler: any) {
    return this.execute().finally(handler);
  }
}

class RealtimeChannel {
  private name: string;
  private handlers: Array<(payload: any) => void> = [];
  private filter: any = null;

  constructor(name: string) {
    this.name = name;
  }

  on(_type: string, filter: any, callback: (payload: any) => void) {
    this.filter = filter;
    this.handlers.push(callback);
    return this;
  }

  subscribe() {
    realtimeClient?.subscribe(this.name, this.filter, this.handlers);
    return this;
  }

  unsubscribe() {
    realtimeClient?.remove(this);
  }
}

class RealtimeClient {
  private socket: WebSocket | null = null;
  private subscriptions: Array<{ channel: string; filter: any; handlers: Array<(payload: any) => void> }> = [];

  constructor() {
    if (!WS_URL) return;
    this.socket = new WebSocket(WS_URL);
    this.socket.onmessage = event => {
      try {
        const message = JSON.parse(event.data);
        if (message.type !== 'postgres_changes') return;
        const payload = message.payload || message;
        this.subscriptions.forEach(sub => {
          if (sub.filter?.table && sub.filter.table !== message.table) return;
          if (sub.filter?.event && sub.filter.event !== message.event) return;
          sub.handlers.forEach(handler => handler(payload));
        });
      } catch {
        // ignore malformed messages
      }
    };
  }

  subscribe(channel: string, filter: any, handlers: Array<(payload: any) => void>) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      setTimeout(() => this.subscribe(channel, filter, handlers), 200);
      return;
    }
    this.subscriptions.push({ channel, filter, handlers });
    this.socket.send(JSON.stringify({ type: 'subscribe', channel, filter }));
  }

  remove(channel: RealtimeChannel) {
    this.subscriptions = this.subscriptions.filter(sub => sub.channel !== (channel as any).name);
  }
}

const realtimeClient = WS_URL ? new RealtimeClient() : null;

export function setRememberMe(remember: boolean) {
  try {
    localStorage.setItem(REMEMBER_ME_KEY, remember ? 'true' : 'false');
  } catch {
    // ignore
  }
}

export const api = {
  auth: {
    onAuthStateChange(callback: (event: string, session: AuthSession | null) => void) {
      listeners.add(callback);
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
    },
    async getSession() {
      return { data: { session: loadSession() }, error: null };
    },
    async refreshSession() {
      return { data: { session: loadSession() }, error: null };
    },
    async getUser() {
      const session = loadSession();
      return { data: { user: session?.user || null }, error: null };
    },
    async signUp({ email, password, options }: any) {
      try {
        const result = await apiRequest('/api/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ email, password, username: options?.data?.username })
        });
        if (result?.session) {
          saveSession(result.session);
        }
        return { data: result, error: null };
      } catch (error: any) {
        return { data: null, error: { message: error.message } };
      }
    },
    async signInWithPassword({ email, password }: any) {
      try {
        const result = await apiRequest('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        if (result?.session) {
          saveSession(result.session);
        }
        return { data: result, error: null };
      } catch (error: any) {
        return { data: null, error: { message: error.message } };
      }
    },
    async signOut() {
      saveSession(null);
      return { error: null };
    },
    async resetPasswordForEmail(email: string) {
      try {
        const result = await apiRequest('/api/auth/reset', {
          method: 'POST',
          body: JSON.stringify({ email })
        });
        return { data: result, error: null };
      } catch (error: any) {
        return { data: null, error: { message: error.message } };
      }
    },
    async verifyOtp({ email, token }: { email: string; token: string }) {
      try {
        const result = await apiRequest('/api/auth/verify-otp', {
          method: 'POST',
          body: JSON.stringify({ email, token })
        });
        pendingResetToken = result?.resetToken || null;
        return { data: result, error: null };
      } catch (error: any) {
        return { data: null, error: { message: error.message } };
      }
    },
    async updateUser({ password }: { password: string }) {
      try {
        const result = await apiRequest('/api/auth/update-user', {
          method: 'POST',
          body: JSON.stringify({ password, resetToken: pendingResetToken })
        });
        pendingResetToken = null;
        return { data: result, error: null };
      } catch (error: any) {
        return { data: null, error: { message: error.message } };
      }
    },
    async setSession({ access_token, user }: any) {
      if (access_token && user) {
        saveSession({ access_token, user });
      }
      return { data: { session: loadSession() }, error: null };
    }
  },
  from(table: string) {
    return new QueryBuilder(table);
  },
  rpc(name: string, args?: Record<string, any>) {
    return apiRequest(`/api/rpc/${name}`, {
      method: 'POST',
      body: JSON.stringify(args || {})
    }).then((result: any) => ({ data: result.data ?? null, error: result.error ?? null }))
      .catch((error: any) => ({ data: null, error: { message: error.message } }));
  },
  functions: {
    invoke(name: string, options?: { body?: any }) {
      return apiRequest(`/api/functions/${name}`, {
        method: 'POST',
        body: JSON.stringify(options?.body || {})
      }).then((result: any) => ({ data: result, error: null }))
        .catch((error: any) => ({ data: null, error: { message: error.message } }));
    }
  },
  storage: {
    from(bucket: string) {
      return {
        async upload(path: string, file: File) {
          try {
            const form = new FormData();
            form.append('bucket', bucket);
            form.append('path', path);
            form.append('file', file);
            const result = await apiRequest('/api/storage/upload', {
              method: 'POST',
              body: form
            });
            return { data: { path: result.data?.path }, error: null };
          } catch (error: any) {
            return { data: null, error: { message: error.message } };
          }
        },
        getPublicUrl(path: string) {
          return { data: { publicUrl: `${API_URL}/media/${bucket}/${path}` } };
        },
        async createSignedUrl(path: string, expiresIn?: number) {
          try {
            const result = await apiRequest('/api/storage/signed-url', {
              method: 'POST',
              body: JSON.stringify({ bucket, path, expiresIn })
            });
            return { data: { signedUrl: result.signedUrl }, error: null };
          } catch (error: any) {
            return { data: null, error: { message: error.message } };
          }
        },
        async download(path: string) {
          try {
            const response = await fetch(`${API_URL}/api/storage/download`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bucket, path })
            });
            if (!response.ok) throw new Error('Download failed');
            return { data: await response.blob(), error: null };
          } catch (error: any) {
            return { data: null, error: { message: error.message } };
          }
        }
      };
    }
  },
  channel(name: string) {
    return new RealtimeChannel(name);
  },
  removeChannel(channel: RealtimeChannel) {
    realtimeClient?.remove(channel);
  }
};
