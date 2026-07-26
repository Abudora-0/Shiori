import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Shiori - Anime & Manga Tracker",
    short_name: "Shiori",
    description:
      "Local-first tracker for anime, manga, manhwa and manhua.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0b12",
    theme_color: "#0b0b12",
    icons: [
      { src: "/icons/ink.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
