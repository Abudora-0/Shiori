import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Shiori - Anime & Manga Tracker",
    short_name: "Shiori",
    description:
      "Local-first tracker for anime, manga, manhwa and manhua.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    categories: ["entertainment"],
    background_color: "#0b0b12",
    theme_color: "#0b0b12",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/ink.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
