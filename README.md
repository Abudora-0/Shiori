# 栞 Shiori - Anime / Manga / Manhwa / Manhua Tracker

**Shiori** (栞, "bookmark") is a local-first tracker for everything you watch and read.
It imports your existing lists from **AniList** and **MyAnimeList**, classifies your
library by kind (anime / hentai / manga / manhwa / pornhwa / manhua - with a manual
type override in the edit modal), and layers your own ratings, reviews and notes on
top - all stored in your browser, no account needed.

## Features

- **Import** - AniList (public GraphQL, just a username), MyAnimeList (official API
  with a free Client ID), Kitsu (public API) and **Mihon / Tachiyomi backups**
  (`.tachibk` / `.proto.gz`, parsed entirely in your browser, resolved via embedded
  tracker links) - including Aniyomi's anime entries alongside manga, from the
  same backup file. Cross-service dedupe via AniList↔MAL↔Kitsu id mapping. Doujin
  sources (nhentai / HentaiFox / HentaiEra / Hitomi) and booru/clip aggregators
  (Rule34 and similar) are excluded from the regular import - doujins belong in the
  Annex only, and booru clips aren't episodic series at all.
- **Library** - tabs per type, status filters, sorting, search, grid/list views,
  quick +1 progress, favorites
- **Series pages** - synopsis, genres/tags, characters with voice actors (click for
  full character details), related series, "Similar to this" recommendations,
  Anime-Planet extras (community rating, tags, content warnings), and chapter lists
  pulled from whichever of MangaKatana / KaliScan / WeebCentral / Kagane is most
  complete for that title (MangaUpdates as a last-resort fallback), plus mark-read-up-to
- **Your data** - 10-point ratings (with halves), markdown reviews, quick notes
- **Stats** - episodes/chapters totals, days watched, score distribution, genre and
  type breakdowns
- **Backup** - one-click JSON export/import of the entire database

- **Annex (別館)** - a PIN-gated doujin shelf, hidden from the sidebar until set up
  and locked whenever the browser closes. Import your nhentai favorites (with your
  own session cookies), add galleries by link from nhentai / HentaiFox / Hitomi, or
  upload a Tachiyomi / TachiyomiAZ / Mihon backup to extract just its doujin entries
  with fresh site metadata. Tag & artist browsing, favorites, ratings, private notes.
  The same PIN also gates your **Hentai** and **Pornhwa** shelves in place across the
  whole app (Library tab, Dashboard, Stats, Discover, Lists, Updates, quick search,
  direct links) - they stay in your regular Library, just hidden until unlocked.
- **Custom lists (選集)** - curated shelves with add-to-list from any series page,
  plus auto-updating **smart lists** built from filters (type/status/genre/rating)
- **Updates feed (更新)** - checks the chapter sites for everything you're reading
  and shows what has new chapters, with one-click catch-up; can also auto-check
  every ~12h on launch and fire a browser notification, with an unread badge on
  the nav item
- **AniList sync** - push-only, opt-in OAuth connection that sends your local
  status/progress/score/dates back up to AniList, either per-series or in bulk
  from Settings. Nothing syncs automatically.
- **Discover (発見)** - this anime season, trending anime/manga/manhwa (and
  pornhwa/hentai) from AniList, add straight to Planning
- **Quick search** - Ctrl+K command palette to jump to any series with inline +1
- **Airing calendar (放送)** - day-by-day air times with countdowns for the anime
  in your library
- **Activity heatmap + Year in review** - GitHub-style year grid plus yearly
  wrap-ups (completions by month, your scores vs community)
- **Maintenance** - cover repair across a dozen sources, Pornhwa/Hentai
  re-classification, duplicate merge, link-local-entries-to-AniList, doujin
  cleanup (removes stray doujin entries from an older backup import)
- **PWA + auto-backup** - installable, with optional daily JSON backups to a
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
