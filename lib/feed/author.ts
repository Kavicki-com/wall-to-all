import type { FeedAuthor } from '../services/feedTypes';

/** "@" + camelCase sem acento do nome da loja ("Ana Cabelos" vira "@anaCabelos"). */
export function buildHandle(name: string): string {
  const words = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '@loja';
  const [first, ...rest] = words;
  const tail = rest.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('');
  return `@${first.toLowerCase()}${tail}`;
}

/** Autor do post a partir do perfil do negócio (`useBusinessProfile()`). */
export function toFeedAuthor(profile: {
  id: number;
  business_name: string;
  logo_url: string | null;
}): FeedAuthor {
  return {
    businessId: profile.id,
    name: profile.business_name,
    handle: buildHandle(profile.business_name),
    logoUrl: profile.logo_url,
  };
}
