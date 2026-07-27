"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Heart, Lock, Search as SearchIcon, X } from "lucide-react";
import { db } from "@/lib/db";
import { lockAnnex } from "@/lib/annex";
import { useUiStore } from "@/lib/store";
import { formatRating } from "@/lib/format";
import { KanjiHeading } from "@/components/ui/KanjiHeading";
import { Cover } from "@/components/ui/Cover";
import { Chip } from "@/components/ui/Chip";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { PinGate } from "@/components/annex/PinGate";
import { ImportPanel } from "@/components/annex/ImportPanel";
import { DoujinModal } from "@/components/annex/DoujinModal";
import type { DoujinEntry, DoujinSource } from "@/lib/types";

type AnnexSort = "added" | "rating" | "title" | "pages";

const PER_PAGE = 30;

export default function AnnexPage() {
  return (
    <PinGate>
      <AnnexLibrary />
    </PinGate>
  );
}

function AnnexLibrary() {
  const setAnnexUnlocked = useUiStore((s) => s.setAnnexUnlocked);
  const doujins = useLiveQuery(() => db.doujins.toArray(), []);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<DoujinSource | "all">("all");
  const [sort, setSort] = useState<AnnexSort>("added");
  const [favOnly, setFavOnly] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [artistFilter, setArtistFilter] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [search, source, sort, favOnly, tagFilter, artistFilter]);

  const filtered = useMemo(() => {
    if (!doujins) return undefined;
    let out = doujins;
    if (source !== "all") out = out.filter((d) => d.source === source);
    if (favOnly) out = out.filter((d) => d.favorite);
    if (tagFilter) out = out.filter((d) => d.tags.includes(tagFilter));
    if (artistFilter) out = out.filter((d) => d.artists.includes(artistFilter));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.titleNative?.toLowerCase().includes(q) ||
          d.artists.some((a) => a.toLowerCase().includes(q)) ||
          d.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    const sorted = [...out];
    switch (sort) {
      case "added":
        sorted.sort((a, b) => b.addedAt - a.addedAt);
        break;
      case "rating":
        sorted.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
        break;
      case "title":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "pages":
        sorted.sort((a, b) => (b.pages ?? 0) - (a.pages ?? 0));
        break;
    }
    return sorted;
  }, [doujins, search, source, sort, favOnly, tagFilter, artistFilter]);

  const stats = useMemo(() => {
    if (!doujins) return undefined;
    const tags = new Map<string, number>();
    for (const d of doujins)
      for (const t of d.tags) tags.set(t, (tags.get(t) ?? 0) + 1);
    return {
      total: doujins.length,
      favorites: doujins.filter((d) => d.favorite).length,
      topTags: [...tags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
    };
  }, [doujins]);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-8">
      <div className="flex items-start justify-between">
        <KanjiHeading
          kanji="別館"
          title="Annex"
          subtitle="The shelf behind the curtain. Locks when the browser closes."
        />
        <button
          onClick={() => {
            lockAnnex();
            setAnnexUnlocked(false);
          }}
          className="mt-8 flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-2 text-xs text-muted transition-colors hover:border-vermillion/60 hover:text-text"
        >
          <Lock size={13} /> Lock now
        </button>
      </div>

      <ImportPanel />

      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <SearchIcon
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, artist, tag…"
            className="w-56 rounded-full border border-line-strong bg-ink-800 py-1.5 pl-8 pr-3 text-sm outline-none transition-all focus:w-72 focus:border-vermillion"
          />
        </div>
        <Select
          value={source}
          onChange={(v) => setSource(v as DoujinSource | "all")}
          options={[
            { value: "all", label: "All sources" },
            { value: "nhentai", label: "nhentai" },
            { value: "hentaifox", label: "HentaiFox" },
            { value: "hentaiera", label: "HentaiEra" },
            { value: "hitomi", label: "Hitomi" },
          ]}
          className="rounded-full border border-line-strong bg-ink-800 px-3 py-1.5 text-sm"
        />
        <Select
          value={sort}
          onChange={(v) => setSort(v as AnnexSort)}
          options={[
            { value: "added", label: "Recently added" },
            { value: "rating", label: "Your rating" },
            { value: "title", label: "Title" },
            { value: "pages", label: "Pages" },
          ]}
          className="rounded-full border border-line-strong bg-ink-800 px-3 py-1.5 text-sm"
        />
        <Chip active={favOnly} onClick={() => setFavOnly((f) => !f)}>
          ♥ Favorites
        </Chip>
        {stats && (
          <span className="ml-auto text-xs text-faint">
            {stats.total} works · {stats.favorites} favorites
          </span>
        )}
      </div>

      {/* Active filter chips */}
      {(tagFilter || artistFilter) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {tagFilter && (
            <FilterChip label={`tag: ${tagFilter}`} onClear={() => setTagFilter(null)} />
          )}
          {artistFilter && (
            <FilterChip
              label={`artist: ${artistFilter}`}
              onClear={() => setArtistFilter(null)}
            />
          )}
        </div>
      )}

      {/* Top tags quick filter */}
      {!!stats?.topTags.length && !tagFilter && (
        <div className="no-scrollbar mb-5 flex gap-1.5 overflow-x-auto pb-1">
          {stats.topTags.map(([tag, count]) => (
            <Chip key={tag} onClick={() => setTagFilter(tag)}>
              {tag} <span className="text-faint">{count}</span>
            </Chip>
          ))}
        </div>
      )}

      {/* Grid */}
      {!filtered ? null : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="font-display text-7xl text-ink-600">空</div>
          <p className="mt-4 text-sm text-muted">
            {doujins?.length
              ? "Nothing matches these filters."
              : "The annex is empty - open Import & add above to fill the shelf."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:gap-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
            {filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE).map((d) => (
              <DoujinCard key={d.id} doujin={d} onOpen={() => setOpenId(d.id!)} />
            ))}
          </div>
          <Pagination
            page={page}
            totalPages={Math.ceil(filtered.length / PER_PAGE)}
            onChange={setPage}
          />
        </>
      )}

      <DoujinModal
        doujinId={openId}
        onClose={() => setOpenId(null)}
        onPickFilter={(kind, value) => {
          if (kind === "tag") setTagFilter(value);
          else setArtistFilter(value);
        }}
      />
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-vermillion bg-vermillion/15 px-3 py-1 text-xs text-vermillion-bright">
      {label}
      <button onClick={onClear} aria-label="Clear filter" className="hover:text-white">
        <X size={12} />
      </button>
    </span>
  );
}

function DoujinCard({
  doujin,
  onOpen,
}: {
  doujin: DoujinEntry;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="group block text-left [content-visibility:auto] [contain-intrinsic-size:auto_280px]"
    >
      <div className="card-glow relative aspect-[2/3] overflow-hidden rounded-lg border border-line bg-ink-800">
        <Cover
          src={doujin.cover}
          alt=""
          className="h-full w-full object-cover text-3xl transition-transform duration-500 group-hover:scale-105"
        />
        {doujin.favorite && (
          <span className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1 text-vermillion-bright backdrop-blur-sm">
            <Heart size={11} fill="currentColor" />
          </span>
        )}
        {doujin.rating != null && doujin.rating > 0 && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 font-display text-[11px] text-gold backdrop-blur-sm">
            {formatRating(doujin.rating)}
          </span>
        )}
        {doujin.language && (
          <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white/70 backdrop-blur-sm">
            {doujin.language.slice(0, 2)}
          </span>
        )}
      </div>
      <div className="mt-1.5 line-clamp-2 text-[12px] font-medium leading-snug text-text/90 group-hover:text-white">
        {doujin.title}
      </div>
      <div className="truncate text-[10px] text-faint">
        {doujin.artists[0] ?? ""}
        {doujin.pages ? ` · ${doujin.pages}p` : ""}
      </div>
    </button>
  );
}
