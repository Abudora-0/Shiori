import { describe, expect, it } from "vitest";
import {
  kitsuAnimeFallbackId,
  kitsuMangaFallbackId,
  localFallbackId,
  malAnimeFallbackId,
  malMangaFallbackId,
  stableHash,
} from "./ids";

describe("stableHash", () => {
  it("is deterministic for the same input", () => {
    expect(stableHash("mihon:1:foo")).toBe(stableHash("mihon:1:foo"));
  });

  it("produces different hashes for different input", () => {
    expect(stableHash("a")).not.toBe(stableHash("b"));
  });

  it("always returns a non-negative 32-bit integer", () => {
    const h = stableHash("some fairly long series title with unicode 漫画");
    expect(h).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(h)).toBe(true);
  });
});

describe("per-source id namespaces never collide", () => {
  it("keeps MAL anime/manga, Kitsu anime/manga and local ids in disjoint ranges", () => {
    const id = 12345;
    const ranges = [
      malAnimeFallbackId(id),
      malMangaFallbackId(id),
      kitsuAnimeFallbackId(id),
      kitsuMangaFallbackId(id),
      localFallbackId(`key-${id}`),
    ];
    // all negative (never collide with a real positive AniList id)
    for (const r of ranges) expect(r).toBeLessThan(0);
    // all distinct from each other
    expect(new Set(ranges).size).toBe(ranges.length);
  });

  it("localFallbackId is deterministic for the same key", () => {
    expect(localFallbackId("mihon:1:/manga/foo")).toBe(
      localFallbackId("mihon:1:/manga/foo")
    );
  });
});
