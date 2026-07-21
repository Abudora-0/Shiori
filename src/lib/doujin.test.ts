import { describe, expect, it } from "vitest";
import { parseDoujinUrl } from "./doujin";

describe("parseDoujinUrl", () => {
  it("recognizes nhentai gallery links and bare ids", () => {
    expect(parseDoujinUrl("https://nhentai.net/g/123456/")).toEqual({
      source: "nhentai",
      id: "123456",
    });
    expect(parseDoujinUrl("123456")).toEqual({ source: "nhentai", id: "123456" });
  });

  it("recognizes HentaiFox and HentaiEra links", () => {
    expect(parseDoujinUrl("https://hentaifox.com/gallery/9999/")).toEqual({
      source: "hentaifox",
      id: "9999",
    });
    expect(parseDoujinUrl("https://hentaiera.com/gallery/9999/")).toEqual({
      source: "hentaiera",
      id: "9999",
    });
  });

  it("recognizes Hitomi gallery links across content types", () => {
    expect(
      parseDoujinUrl("https://hitomi.la/galleries/1234567.html")
    ).toEqual({ source: "hitomi", id: "1234567" });
    expect(
      parseDoujinUrl("https://hitomi.la/manga/some-title-english-1234567.html")
    ).toEqual({ source: "hitomi", id: "1234567" });
  });

  it("returns null for unrecognized input", () => {
    expect(parseDoujinUrl("https://example.com/not-a-gallery")).toBeNull();
    expect(parseDoujinUrl("")).toBeNull();
  });
});
