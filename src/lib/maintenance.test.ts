import { describe, expect, it } from "vitest";
import { looksAdult, looksKorean, titlesMatch, titleVariants } from "./maintenance";
import type { Series } from "./types";

describe("titlesMatch", () => {
  it("matches exact and substring titles", () => {
    expect(titlesMatch("Solo Leveling", "Solo Leveling")).toBe(true);
    expect(titlesMatch("Solo Leveling: Ragnarok", "Solo Leveling")).toBe(true);
  });

  it("matches scanlation renames via word overlap", () => {
    expect(
      titlesMatch(
        "The Chairman's Wife (Official) [Mature]",
        "The Chairman's Wife"
      )
    ).toBe(true);
  });

  it("rejects unrelated titles", () => {
    expect(titlesMatch("One Piece", "Solo Leveling")).toBe(false);
  });

  it("rejects empty input", () => {
    expect(titlesMatch("", "Solo Leveling")).toBe(false);
  });
});

describe("titleVariants", () => {
  it("strips bracketed noise and decoration words", () => {
    const s: Series = {
      id: 1,
      kind: "MANGA",
      title: { romaji: "The Villainess (Official) [Uncensored]" },
      genres: [],
      tags: [],
      cachedAt: Date.now(),
    };
    const variants = titleVariants(s);
    expect(variants[0]).toBe("The Villainess (Official) [Uncensored]");
    expect(variants).toContain("The Villainess");
  });

  it("includes the pre-colon title as a variant", () => {
    const s: Series = {
      id: 1,
      kind: "MANGA",
      title: { romaji: "Solo Leveling: Ragnarok" },
      genres: [],
      tags: [],
      cachedAt: Date.now(),
    };
    expect(titleVariants(s)).toContain("Solo Leveling");
  });

  it("caps at 3 variants and de-duplicates", () => {
    const s: Series = {
      id: 1,
      kind: "MANGA",
      title: { romaji: "Same Title", english: "Same Title" },
      genres: [],
      tags: [],
      cachedAt: Date.now(),
    };
    expect(titleVariants(s).length).toBeLessThanOrEqual(3);
  });
});

describe("looksAdult / looksKorean", () => {
  it("requires an explicit adult marker, not just mature/gore", () => {
    expect(looksAdult(["Mature", "Gore", "Action"])).toBe(false);
    expect(looksAdult(["Adult"])).toBe(true);
    expect(looksAdult(["Smut"])).toBe(true);
    expect(looksAdult(["18+"])).toBe(true);
  });

  it("detects Korean-origin hints", () => {
    expect(looksKorean(["Manhwa"])).toBe(true);
    expect(looksKorean(["Webtoon"])).toBe(true);
    expect(looksKorean(["Shounen"])).toBe(false);
  });
});
