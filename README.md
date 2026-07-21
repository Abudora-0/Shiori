# 栞 Shiori — Anime / Manga / Manhwa / Manhua Tracker

**Shiori** (栞, "bookmark") is a local-first tracker for everything you watch and read.
It imports your existing lists from **AniList** and **MyAnimeList**, classifies manga
by origin (manga / manhwa / pornhwa / manhua / novel — with a manual type override in
the edit modal), and layers your own ratings, reviews and notes on top — all stored
in your browser, no account needed.

## Features

- **Import** — AniList (public GraphQL, just a username), MyAnimeList (official API
  with a free Client ID), Kitsu (public API), Anime-Planet (best-effort profile
  scrape with AniList title-matching) and **Mihon / Tachiyomi backups**
  (`.tachibk` / `.proto.gz`, parsed entirely in your browser, resolved via embedded
  tracker links). Cross-service dedupe via AniList↔MAL↔Kitsu id mapping.
- **Library** — tabs per type, status filters, sorting, search, grid/list views,
  quick +1 progress, favorites
- **Series pages** — synopsis, genres/tags, characters with voice actors (click for
  full character details), related series, "Similar to this" recommendations,
  Anime-Planet extras (community rating, tags, content warnings), and chapter lists
  with source fallbacks (MangaDex → Comick → MangaUpdates) plus mark-read-up-to
- **Your data** — 10-point ratings (with halves), markdown reviews, quick notes
- **Stats** — episodes/chapters totals, days watched, score distribution, genre and
  type breakdowns
- **Backup** — one-click JSON export/import of the entire database

- **Annex (別館)** — a PIN-gated doujin shelf, hidden from the sidebar until set up
  and locked whenever the browser closes. Import your nhentai favorites (with your
  own session cookies), add galleries by link from nhentai / HentaiFox / Hitomi, or
  upload a Tachiyomi / TachiyomiAZ / Mihon backup to extract just its doujin entries
  with fresh site metadata. Tag & artist browsing, favorites, ratings, private notes.
- **Custom lists (選集)** — curated shelves with add-to-list from any series page,
  plus auto-updating **smart lists** built from filters (type/status/genre/rating)
- **Updates feed (更新)** — checks the chapter sites for everything you're reading
  and shows what has new chapters, with one-click catch-up
- **Discover (発見)** — this anime season, trending anime/manga/manhwa (and
  pornhwa) from AniList, add straight to Planning
- **Quick search** — Ctrl+K command palette to jump to any series with inline +1
- **Airing calendar (放送)** — day-by-day air times with countdowns for the anime
  in your library
- **Activity heatmap + Year in review** — GitHub-style year grid plus yearly
  wrap-ups (completions by month, your scores vs community)
- **Maintenance** — cover repair across a dozen sources, Pornhwa re-classification,
  duplicate merge, link-local-entries-to-AniList
- **PWA + auto-backup** — installable, with optional daily JSON backups to a
  folder (File System Access API)

## Running

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # run the unit test suite (vitest)
```

Data lives in IndexedDB (per browser). Export a backup from Settings before clearing
browser storage.

### MyAnimeList import

Register a free API client at [myanimelist.net/apiconfig](https://myanimelist.net/apiconfig)
(App Type: *other*), paste the Client ID into **Settings**, then import from the
**Import** page.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Dexie (IndexedDB) ·
TanStack Query · Zustand · Motion (Framer Motion)
