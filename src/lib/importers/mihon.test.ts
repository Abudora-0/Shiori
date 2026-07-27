import { describe, expect, it } from "vitest";
import {
  guessKind,
  readProgress,
  readEpisodeProgress,
  HARD_ADULT_SOURCES,
  type RawBackupManga,
  type RawBackupAnime,
} from "./mihon";

describe("guessKind", () => {
  it("classifies hard-adult sources as Pornhwa regardless of genre tags", () => {
    expect(guessKind([], "Manhwa18")).toBe("PORNHWA");
    expect(guessKind(["Action"], "ManyToon")).toBe("PORNHWA");
  });

  it("does not treat mixed Korean sites as adult without an explicit tag", () => {
    // Toonily/Hiperdex/NewToki host plenty of ordinary manhwa - regression
    // guard for the false-positive bug reported against the Pornhwa shelf.
    expect(guessKind(["Action", "Gore", "Mature"], "Toonily")).toBe("MANHWA");
    expect(guessKind(["Romance"], "Hiperdex")).toBe("MANHWA");
  });

  it("still classifies a mixed site as Pornhwa when the genre says so", () => {
    expect(guessKind(["Adult", "Romance"], "Toonily")).toBe("PORNHWA");
  });

  it("falls back to genre-only detection with no source name", () => {
    expect(guessKind(["Manhwa"], undefined)).toBe("MANHWA");
    expect(guessKind(["Manhua"], undefined)).toBe("MANHUA");
    expect(guessKind([], undefined)).toBe("MANGA");
  });

  it("HARD_ADULT_SOURCES matches the sites guessKind relies on", () => {
    expect(HARD_ADULT_SOURCES.test("Manhwa18")).toBe(true);
    expect(HARD_ADULT_SOURCES.test("Toonily")).toBe(false);
  });
});

describe("readProgress", () => {
  it("takes the highest read chapter number", () => {
    const m: RawBackupManga = {
      chapters: [
        { read: true, chapterNumber: 5 },
        { read: true, chapterNumber: 12 },
        { read: false, chapterNumber: 20 },
      ],
    };
    expect(readProgress(m)).toBe(12);
  });

  it("takes the maximum lastChapterRead across ALL trackers, not just the first", () => {
    // Regression test: a naive .find() would stop at the first tracker
    // whose lastChapterRead exceeds the chapter-derived max and silently
    // ignore a later, higher tracker value.
    const m: RawBackupManga = {
      chapters: [],
      tracking: [{ lastChapterRead: 5 }, { lastChapterRead: 50 }, { lastChapterRead: 20 }],
    };
    expect(readProgress(m)).toBe(50);
  });

  it("combines chapter and tracker data, keeping the overall max", () => {
    const m: RawBackupManga = {
      chapters: [{ read: true, chapterNumber: 30 }],
      tracking: [{ lastChapterRead: 10 }],
    };
    expect(readProgress(m)).toBe(30);
  });

  it("floors fractional chapter numbers", () => {
    const m: RawBackupManga = { chapters: [{ read: true, chapterNumber: 12.5 }] };
    expect(readProgress(m)).toBe(12);
  });

  it("returns 0 when nothing is read", () => {
    expect(readProgress({})).toBe(0);
  });
});

describe("readEpisodeProgress (Aniyomi anime entries)", () => {
  it("takes the highest seen episode number", () => {
    const a: RawBackupAnime = {
      episodes: [
        { seen: true, episodeNumber: 5 },
        { seen: true, episodeNumber: 12 },
        { seen: false, episodeNumber: 20 },
      ],
    };
    expect(readEpisodeProgress(a)).toBe(12);
  });

  it("takes the maximum lastEpisodeSeen across all trackers", () => {
    const a: RawBackupAnime = {
      episodes: [],
      tracking: [{ lastEpisodeSeen: 5 }, { lastEpisodeSeen: 50 }, { lastEpisodeSeen: 20 }],
    };
    expect(readEpisodeProgress(a)).toBe(50);
  });

  it("returns 0 when nothing is watched", () => {
    expect(readEpisodeProgress({})).toBe(0);
  });
});
