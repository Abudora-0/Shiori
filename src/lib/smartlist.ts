import type { SmartFilter } from "./types";
import type { LibraryItem } from "./hooks";
import { KIND_LABEL, statusLabel } from "./format";

export function matchSmart(filter: SmartFilter, item: LibraryItem): boolean {
  if (filter.kinds?.length && !filter.kinds.includes(item.series.kind)) return false;
  if (filter.statuses?.length && !filter.statuses.includes(item.entry.status))
    return false;
  if (filter.genre && !item.series.genres.includes(filter.genre)) return false;
  if (filter.minRating != null && (item.entry.rating ?? 0) < filter.minRating)
    return false;
  if (filter.favorite && !item.entry.favorite) return false;
  return true;
}

export function describeSmart(filter: SmartFilter): string {
  const parts: string[] = [];
  if (filter.kinds?.length)
    parts.push(filter.kinds.map((k) => KIND_LABEL[k]).join("/"));
  if (filter.statuses?.length)
    parts.push(filter.statuses.map((s) => statusLabel(s, "MANGA")).join("/"));
  if (filter.genre) parts.push(filter.genre);
  if (filter.minRating != null) parts.push(`rated ≥ ${filter.minRating / 10}`);
  if (filter.favorite) parts.push("favorites");
  return parts.length ? `Auto: ${parts.join(" · ")}` : "Auto: everything";
}
