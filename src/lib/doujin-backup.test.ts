import { describe, expect, it } from "vitest";
import { detect } from "./doujin-backup";

describe("detect (Mihon backup doujin source detection)", () => {
  it("identifies nhentai from the /g/<id> URL shape", () => {
    expect(detect("/g/123456/", "NHentai")).toEqual({
      source: "nhentai",
      id: "123456",
    });
    // no source name at all - URL shape alone is enough for nhentai
    expect(detect("/g/123456/", undefined)).toEqual({
      source: "nhentai",
      id: "123456",
    });
  });

  it("disambiguates the shared /gallery/<id> shape by source name", () => {
    expect(detect("/gallery/999/", "HentaiFox")).toEqual({
      source: "hentaifox",
      id: "999",
    });
    expect(detect("/gallery/999/", "HentaiEra")).toEqual({
      source: "hentaiera",
      id: "999",
    });
  });

  it("requires a hitomi-named source for its ambiguous URL shapes", () => {
    expect(detect("/manga/some-title-1234.html", "Hitomi")).toEqual({
      source: "hitomi",
      id: "1234",
    });
    // same shape, unrelated source - must not be misdetected as hitomi
    expect(detect("/manga/some-title-1234.html", "SomeOtherSite")).toBeNull();
  });

  it("returns null for regular manga sources", () => {
    expect(detect("/manga/one-piece/chapter-1", "MangaDex")).toBeNull();
  });
});
