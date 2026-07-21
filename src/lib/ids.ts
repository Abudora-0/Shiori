/**
 * Series ids are AniList ids when resolvable. Entries that can't be resolved
 * get a negative id in a per-source namespace so they never collide:
 *   MAL anime      : -(id)                      (0 .. -1e9)
 *   MAL manga      : -(1e9 + id)
 *   Kitsu anime    : -(2e9 + id)
 *   Kitsu manga    : -(2.5e9 + id)
 *   Local (hashed) : -(3e9 + hash)              (Mihon/Anime-Planet fallbacks)
 */

export function stableHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const malAnimeFallbackId = (id: number) => -id;
export const malMangaFallbackId = (id: number) => -(1_000_000_000 + id);
export const kitsuAnimeFallbackId = (id: number) => -(2_000_000_000 + id);
export const kitsuMangaFallbackId = (id: number) => -(2_500_000_000 + id);
export const localFallbackId = (key: string) =>
  -(3_000_000_000 + (stableHash(key) % 999_999_999));
