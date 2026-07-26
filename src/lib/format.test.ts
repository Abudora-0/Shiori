import { describe, expect, it } from "vitest";
import {
  displayTitle,
  formatRating,
  progressUnit,
  statusKanji,
  statusLabel,
  statusShort,
  stripHtml,
  subTitle,
} from "./format";

describe("displayTitle", () => {
  it("prefers english, then romaji, then native", () => {
    expect(displayTitle({ english: "Frieren", romaji: "Sousou no Frieren" })).toBe(
      "Frieren"
    );
    expect(displayTitle({ romaji: "Sousou no Frieren" })).toBe("Sousou no Frieren");
    expect(displayTitle({ native: "葬送のフリーレン" })).toBe("葬送のフリーレン");
  });

  it("falls back to Untitled when nothing is set", () => {
    expect(displayTitle({})).toBe("Untitled");
  });
});

describe("subTitle", () => {
  it("shows native when it differs from the main display title", () => {
    expect(subTitle({ english: "Frieren", native: "葬送のフリーレン" })).toBe(
      "葬送のフリーレン"
    );
  });

  it("returns undefined when there is nothing distinct to show", () => {
    expect(subTitle({ english: "Only Title" })).toBeUndefined();
  });
});

describe("statusKanji / statusLabel / statusShort", () => {
  it("distinguishes watching vs reading by kind", () => {
    expect(statusKanji("current", "ANIME")).toBe("視聴中");
    expect(statusKanji("current", "MANGA")).toBe("読書中");
    expect(statusLabel("current", "ANIME")).toBe("Watching");
    expect(statusLabel("current", "MANGA")).toBe("Reading");
  });

  it("statusShort stays terse for card chips", () => {
    expect(statusShort("completed", "MANGA")).toBe("Done");
    expect(statusShort("planning", "MANGA")).toBe("Plan");
  });
});

describe("formatRating", () => {
  it("converts the internal 0-100 scale to a 10-point display string", () => {
    expect(formatRating(85)).toBe("8.5");
    expect(formatRating(70)).toBe("7");
  });

  it("shows an em dash for unrated entries", () => {
    expect(formatRating(undefined)).toBe("-");
    expect(formatRating(0)).toBe("-");
  });
});

describe("progressUnit", () => {
  it("is episodes for anime and chapters for everything else", () => {
    expect(progressUnit("ANIME")).toBe("ep");
    expect(progressUnit("MANGA")).toBe("ch");
    expect(progressUnit("PORNHWA")).toBe("ch");
  });
});

describe("stripHtml", () => {
  it("converts <br> to newlines and unescapes entities", () => {
    expect(stripHtml("Line one<br>Line two")).toBe("Line one\nLine two");
    expect(stripHtml("Tom &amp; Jerry &quot;show&quot;")).toBe('Tom & Jerry "show"');
  });

  it("strips remaining tags and handles missing input", () => {
    expect(stripHtml("<i>emphasis</i> plain")).toBe("emphasis plain");
    expect(stripHtml(undefined)).toBe("");
  });
});
