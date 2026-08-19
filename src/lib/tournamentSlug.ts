import { api } from '@/lib/api-client';

// Tournament names are free-form and may repeat; only the address (slug) is
// unique, so a shared name has to resolve to a distinct address.
export const generateSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

export const isSlugTaken = async (slug: string) => {
  const address = slug.trim().toLowerCase();
  if (!address) return false;

  const { data, error } = await api
    .from('tournaments')
    .select('id')
    .eq('slug', address)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
};

// First free address for a base: "arcade-night", then "arcade-night-2", …
export const findAvailableSlug = async (base: string) => {
  const address = generateSlug(base);
  if (!address) return '';

  const { data, error } = await api
    .from('tournaments')
    .select('slug')
    .like('slug', `${address}%`);

  if (error) throw error;

  const taken = new Set((data || []).map((row: { slug: string }) => row.slug));
  if (!taken.has(address)) return address;

  let suffix = 2;
  while (taken.has(`${address}-${suffix}`)) suffix += 1;
  return `${address}-${suffix}`;
};
