import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api-client';

const lastRequestBody = () => {
  const [, init] = (globalThis.fetch as any).mock.calls.at(-1);
  return JSON.parse(init.body);
};

describe('api query builder', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: [{ id: 'a' }, { id: 'b' }] }),
    })) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is awaitable and reports how many rows came back', async () => {
    const { data, error, count } = await api.from('scores').select('*');

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect(count).toBe(2);
  });

  it('keeps the database error code, so callers can spot a duplicate slug', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        error: 'duplicate key value violates unique constraint "tournaments_slug_key"',
        code: '23505',
        constraint: 'tournaments_slug_key',
      }),
    })) as any;

    const { data, error } = await api.from('tournaments').insert({ slug: 'test' });

    expect(data).toBeNull();
    expect(error.code).toBe('23505');
    expect(error.constraint).toBe('tournaments_slug_key');
  });

  it('turns match() into one equality filter per key', async () => {
    await api.from('scores').delete().match({ player_name: 'Ada', tournament_id: 't1' });

    expect(lastRequestBody().filters).toEqual([
      { column: 'player_name', op: 'eq', value: 'Ada' },
      { column: 'tournament_id', op: 'eq', value: 't1' },
    ]);
  });
});

describe('api auth', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true }),
    })) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('forwards the redirect target of a password reset', async () => {
    await api.auth.resetPasswordForEmail('player@example.com', {
      redirectTo: 'https://example.test/auth',
    });

    expect(lastRequestBody()).toEqual({
      email: 'player@example.com',
      redirect_to: 'https://example.test/auth',
    });
  });

  it('forwards the verification type', async () => {
    await api.auth.verifyOtp({ email: 'player@example.com', token: '123456', type: 'recovery' });

    expect(lastRequestBody()).toEqual({
      email: 'player@example.com',
      token: '123456',
      type: 'recovery',
    });
  });
});

describe('realtime channel', () => {
  it('reports subscription status to the caller', () => {
    const statuses: string[] = [];
    const channel = api.channel('test-channel');

    channel.subscribe(status => statuses.push(status));

    expect(statuses).toHaveLength(1);
    expect(['SUBSCRIBED', 'CHANNEL_ERROR']).toContain(statuses[0]);
  });
});
