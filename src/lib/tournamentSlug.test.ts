import { afterEach, describe, expect, it, vi } from 'vitest';
import { findAvailableSlug, generateSlug, isSlugTaken } from './tournamentSlug';

const respondWith = (data: any) => {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ data }),
  })) as any;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('generateSlug', () => {
  it('turns a name into an address', () => {
    expect(generateSlug('Summer  Arcade Night!')).toBe('summer-arcade-night');
  });
});

describe('findAvailableSlug', () => {
  it('keeps the name-derived address when nothing uses it', async () => {
    respondWith([]);

    expect(await findAvailableSlug('test')).toBe('test');
  });

  it('takes the next free address when the name is already used', async () => {
    // Another user already owns /t/test.
    respondWith([{ slug: 'test' }]);

    expect(await findAvailableSlug('test')).toBe('test-2');
  });

  it('skips past addresses that are also taken', async () => {
    respondWith([{ slug: 'test' }, { slug: 'test-2' }, { slug: 'test-3' }]);

    expect(await findAvailableSlug('test')).toBe('test-4');
  });

  it('ignores unrelated addresses that merely share the prefix', async () => {
    respondWith([{ slug: 'testing-times' }, { slug: 'test848484' }]);

    expect(await findAvailableSlug('test')).toBe('test');
  });
});

describe('isSlugTaken', () => {
  it('reports a free address', async () => {
    respondWith(null);

    expect(await isSlugTaken('brand-new')).toBe(false);
  });

  it('reports a used address', async () => {
    respondWith({ id: 'existing' });

    expect(await isSlugTaken('test')).toBe(true);
  });
});
