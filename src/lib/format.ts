import type { EntryStatus, MediaKind, Series, SeriesTitle } from "./types";

export function displayTitle(title: SeriesTitle): string {
  return title.english || title.romaji || title.native || "Untitled";
}

export function subTitle(title: SeriesTitle): string | undefined {
  const main = displayTitle(title);
  if (title.native && title.native !== main) return title.native;
  if (title.romaji && title.romaji !== main) return title.romaji;
  return undefined;
}

export const KIND_LABEL: Record<MediaKind, string> = {
  ANIME: "Anime",
  MANGA: "Manga",
  MANHWA: "Manhwa",
  PORNHWA: "Pornhwa",
  MANHUA: "Manhua",
};

export const KIND_KANJI: Record<MediaKind, string> = {
  ANIME: "アニメ",
  MANGA: "漫画",
  MANHWA: "만화",
  PORNHWA: "19금",
  MANHUA: "漫畫",
};

export function statusKanji(status: EntryStatus, kind: MediaKind): string {
  switch (status) {
    case "current":
      return kind === "ANIME" ? "視聴中" : "読書中";
    case "completed":
      return "完";
    case "paused":
      return "中断";
    case "dropped":
      return "断念";
    case "planning":
      return "予定";
  }
}

/** Short English chip label for cards. */
export function statusShort(status: EntryStatus, kind: MediaKind): string {
  switch (status) {
    case "current":
      return kind === "ANIME" ? "Watching" : "Reading";
    case "completed":
      return "Done";
    case "paused":
      return "Paused";
    case "dropped":
      return "Dropped";
    case "planning":
      return "Plan";
  }
}

export function statusLabel(status: EntryStatus, kind: MediaKind): string {
  switch (status) {
    case "current":
      return kind === "ANIME" ? "Watching" : "Reading";
    case "completed":
      return "Completed";
    case "paused":
      return "Paused";
    case "dropped":
      return "Dropped";
    case "planning":
      return "Planning";
  }
}

export const STATUS_COLOR: Record<EntryStatus, string> = {
  current: "var(--mizu)",
  completed: "var(--matcha)",
  paused: "var(--gold)",
  dropped: "var(--vermillion)",
  planning: "var(--sakura)",
};

export const ALL_STATUSES: EntryStatus[] = [
  "current",
  "planning",
  "completed",
  "paused",
  "dropped",
];

export const ALL_KINDS: MediaKind[] = [
  "ANIME",
  "MANGA",
  "MANHWA",
  "PORNHWA",
  "MANHUA",
];

/** Internal 0–100 rating → "8.5" style 10-point string. */
export function formatRating(rating?: number): string {
  if (rating == null || rating <= 0) return "—";
  return (Math.round(rating / 5) * 5 / 10).toFixed(1).replace(/\.0$/, "");
}

export function maxProgress(series: Series): number | undefined {
  return series.kind === "ANIME"
    ? series.episodes ?? undefined
    : series.chapters ?? undefined;
}

export function progressUnit(kind: MediaKind): string {
  return kind === "ANIME" ? "ep" : "ch";
}

export function stripHtml(html?: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

export function formatDate(ts?: number | string): string {
  if (!ts) return "—";
  const d = typeof ts === "string" ? new Date(ts) : new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
