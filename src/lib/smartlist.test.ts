import { describe, expect, it } from "vitest";
import { matchSmart } from "./smartlist";
import type { LibraryItem } from "./hooks";
import type { Series, LibraryEntry } from "./types";

function item(overrides: Partial<Series> & Partial<LibraryEntry> = {}): LibraryItem {
  const series: Series = {
    id: 1,
    kind: "MANHWA",
    title: { romaji: "Test Series" },
    genres: ["Action", "Fantasy"],
    tags: [],
    cachedAt: Date.now(),
    ...overrides,
  };
  const entry: LibraryEntry = {
    seriesId: 1,
    status: "current",
    progress: 10,
    repeats: 0,
    favorite: false,
    source: "manual",
    addedAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
  return { series, entry };
}

describe("matchSmart", () => {
  it("matches everything when the filter is empty", () => {
    expect(matchSmart({}, item())).toBe(true);
  });

  it("filters by kind", () => {
    expect(matchSmart({ kinds: ["MANHWA"] }, item({ kind: "MANHWA" }))).toBe(true);
    expect(matchSmart({ kinds: ["MANGA"] }, item({ kind: "MANHWA" }))).toBe(false);
  });

  it("filters by status", () => {
    expect(matchSmart({ statuses: ["current"] }, item({ status: "current" }))).toBe(
      true
    );
    expect(matchSmart({ statuses: ["completed"] }, item({ status: "current" }))).toBe(
      false
    );
  });

  it("filters by genre membership", () => {
    expect(matchSmart({ genre: "Action" }, item({ genres: ["Action"] }))).toBe(true);
    expect(matchSmart({ genre: "Romance" }, item({ genres: ["Action"] }))).toBe(false);
  });

  it("filters by minimum rating on the internal 0-100 scale", () => {
    expect(matchSmart({ minRating: 80 }, item({ rating: 85 }))).toBe(true);
    expect(matchSmart({ minRating: 80 }, item({ rating: 70 }))).toBe(false);
    expect(matchSmart({ minRating: 80 }, item({ rating: undefined }))).toBe(false);
  });

  it("filters by favorite", () => {
    expect(matchSmart({ favorite: true }, item({ favorite: true }))).toBe(true);
    expect(matchSmart({ favorite: true }, item({ favorite: false }))).toBe(false);
  });

  it("combines multiple criteria with AND semantics", () => {
    const filter = { kinds: ["MANHWA" as const], minRating: 80, favorite: true };
    expect(
      matchSmart(filter, item({ kind: "MANHWA", rating: 90, favorite: true }))
    ).toBe(true);
    expect(
      matchSmart(filter, item({ kind: "MANHWA", rating: 90, favorite: false }))
    ).toBe(false);
  });
});
