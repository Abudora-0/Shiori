import { describe, expect, it } from "vitest";
import { classifyKind } from "./anilist";

describe("classifyKind", () => {
  it("classifies anime regardless of country", () => {
    expect(classifyKind({ type: "ANIME", countryOfOrigin: "JP" })).toBe("ANIME");
  });

  it("splits Korean manga into Manhwa vs Pornhwa by the isAdult flag", () => {
    expect(classifyKind({ type: "MANGA", countryOfOrigin: "KR" })).toBe("MANHWA");
    expect(
      classifyKind({ type: "MANGA", countryOfOrigin: "KR", isAdult: true })
    ).toBe("PORNHWA");
  });

  it("classifies Chinese/Taiwanese manga as Manhua", () => {
    expect(classifyKind({ type: "MANGA", countryOfOrigin: "CN" })).toBe("MANHUA");
    expect(classifyKind({ type: "MANGA", countryOfOrigin: "TW" })).toBe("MANHUA");
  });

  it("defaults to Manga for Japan or unknown origin", () => {
    expect(classifyKind({ type: "MANGA", countryOfOrigin: "JP" })).toBe("MANGA");
    expect(classifyKind({ type: "MANGA" })).toBe("MANGA");
  });
});
