import type { DoujinSource } from "./types";

/** Extension name substrings for the doujin sites - shared with maintenance's Library cleanup. */
export const DOUJIN_SOURCE_NAME_RE = /nhentai|hentaifox|hentaiera|hitomi/i;

/**
 * Shared by both import paths: the doujin-backup Annex importer (which keeps
 * a match) and the regular Mihon/Aniyomi importer (which excludes a match,
 * so nhentai/HentaiFox/HentaiEra/Hitomi entries only ever land in the Annex,
 * never in the main Library).
 */
export function detect(
  url: string | undefined,
  sourceName: string | undefined
): { source: DoujinSource; id: string } | null {
  const u = url ?? "";
  const name = (sourceName ?? "").toLowerCase();

  // "/g/<id>/" is nhentai's extension URL shape. No name confirmation
  // required - real-world Mihon backups routinely don't resolve a source
  // name at all, and requiring one here (tried once) produced false
  // negatives on entirely legitimate nhentai libraries.
  let m = /\/g\/(\d+)/.exec(u);
  if (m && (!name || name.includes("nhentai"))) return { source: "nhentai", id: m[1] };
  // "/gallery/<id>" is shared by the IMHentai family - name disambiguates
  m = /\/gallery\/(\d+)/.exec(u);
  if (m) {
    if (name.includes("hentaiera")) return { source: "hentaiera", id: m[1] };
    if (!name || name.includes("hentaifox")) return { source: "hentaifox", id: m[1] };
  }
  m = /(?:galleries|manga|doujinshi|cg|gamecg|reader)\/(?:[^/]*-)?(\d+)(?:\.html)?/.exec(u);
  if (m && name.includes("hitomi")) return { source: "hitomi", id: m[1] };

  // URL didn't match a known shape - fall back to the extension name + digits
  const digits = /(\d{3,})/.exec(u)?.[1];
  if (digits) {
    if (name.includes("nhentai")) return { source: "nhentai", id: digits };
    if (name.includes("hentaiera")) return { source: "hentaiera", id: digits };
    if (name.includes("hentaifox")) return { source: "hentaifox", id: digits };
    if (name.includes("hitomi")) return { source: "hitomi", id: digits };
  }
  return null;
}
