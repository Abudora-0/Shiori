/**
 * Media classification. AniList "MANGA" is split by country of origin;
 * adult Korean webtoons get their own PORNHWA shelf, and adult anime gets
 * its own HENTAI shelf.
 */
export type MediaKind = "ANIME" | "HENTAI" | "MANGA" | "MANHWA" | "PORNHWA" | "MANHUA";

/** "current" means watching (anime) or reading (everything else). */
export type EntryStatus =
  | "current"
  | "completed"
  | "paused"
  | "dropped"
  | "planning";

export type ImportSource = "anilist" | "mal" | "kitsu" | "animeplanet" | "mihon" | "manual";

export interface SeriesTitle {
  romaji?: string;
  english?: string;
  native?: string;
}

export interface Series {
  /** AniList id; MAL-only entries use a negative id (-idMal). */
  id: number;
  idMal?: number;
  kind: MediaKind;
  title: SeriesTitle;
  cover?: string;
  coverColor?: string;
  banner?: string;
  synopsis?: string;
  genres: string[];
  tags: { name: string; rank?: number }[];
  format?: string;
  mediaStatus?: string;
  episodes?: number;
  chapters?: number;
  volumes?: number;
  /** Community mean score 0–100 */
  meanScore?: number;
  popularity?: number;
  year?: number;
  season?: string;
  studios?: string[];
  authors?: string[];
  countryOfOrigin?: string;
  /** Mihon extension name for local entries - used by re-classification. */
  sourceName?: string;
  cachedAt: number;
}

export interface LibraryEntry {
  seriesId: number;
  status: EntryStatus;
  progress: number;
  progressVolumes?: number;
  /** User rating 0–100 internal, rendered as a 10-point scale with halves. */
  rating?: number;
  startedAt?: string;
  finishedAt?: string;
  repeats: number;
  favorite: boolean;
  source: ImportSource;
  addedAt: number;
  updatedAt: number;
}

export interface Review {
  id?: number;
  seriesId: number;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

export interface Note {
  id?: number;
  seriesId: number;
  body: string;
  createdAt: number;
}

export interface CharacterInfo {
  id: number;
  name: string;
  nativeName?: string;
  image?: string;
  role: string;
  voiceActor?: { name: string; image?: string };
}

export interface RelatedSeries {
  id: number;
  relationType: string;
  kind: MediaKind;
  format?: string;
  title: SeriesTitle;
  cover?: string;
  coverColor?: string;
}

export interface RecommendedSeries {
  id: number;
  kind: MediaKind;
  format?: string;
  title: SeriesTitle;
  cover?: string;
  coverColor?: string;
  meanScore?: number;
  genres: string[];
  votes: number;
}

/** Cached per-series detail fetched from AniList on demand. */
export interface SeriesExtra {
  seriesId: number;
  characters: CharacterInfo[];
  relations: RelatedSeries[];
  recommendations: RecommendedSeries[];
  cachedAt: number;
}

/** Phase 3 - the Annex (別館). Doujin library entries. */
export type DoujinSource = "nhentai" | "hentaifox" | "hentaiera" | "hitomi" | "manual";

export interface DoujinEntry {
  id?: number;
  source: DoujinSource;
  sourceId: string;
  title: string;
  titleNative?: string;
  url?: string;
  cover?: string;
  tags: string[];
  artists: string[];
  groups?: string[];
  parodies?: string[];
  characters?: string[];
  language?: string;
  pages?: number;
  /** 0–100 internal, shown as 10-point like everything else */
  rating?: number;
  favorite: boolean;
  notes?: string;
  addedAt: number;
  updatedAt?: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

/** Criteria for a self-updating "smart" list. */
export interface SmartFilter {
  kinds?: MediaKind[];
  statuses?: EntryStatus[];
  genre?: string;
  /** 0–100 internal scale */
  minRating?: number;
  favorite?: boolean;
}

export interface CustomList {
  id?: number;
  name: string;
  description?: string;
  seriesIds: number[];
  /** When set, membership is computed from the filter, not seriesIds. */
  smart?: SmartFilter;
  createdAt: number;
  updatedAt: number;
}

/** Result of an update check against the chapter sources. */
export interface UpdateCheck {
  seriesId: number;
  /** latest chapter number found at the source */
  latest?: number;
  newCount: number;
  provider?: string;
  checkedAt: number;
}

/** One row per day, incremented on every library write - feeds the heatmap. */
export interface ActivityDay {
  /** YYYY-MM-DD (local) */
  date: string;
  count: number;
}

export interface BackupFile {
  app: "shiori";
  version: 1;
  exportedAt: string;
  data: {
    series: Series[];
    entries: LibraryEntry[];
    reviews: Review[];
    notes: Note[];
    extras: SeriesExtra[];
    doujins: DoujinEntry[];
    settings: Setting[];
    lists?: CustomList[];
    activity?: ActivityDay[];
    updates?: UpdateCheck[];
  };
}
