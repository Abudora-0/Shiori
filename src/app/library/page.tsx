"use client";

import Link from "next/link";
import { LayoutGrid, List, Search as SearchIcon, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Pagination } from "@/components/ui/Pagination";
import { KanjiHeading } from "@/components/ui/KanjiHeading";
import { Chip } from "@/components/ui/Chip";
import { CardGridSkeleton } from "@/components/ui/Skeleton";
import { CoverCard } from "@/components/library/CoverCard";
import { EditEntryModal } from "@/components/library/EditEntryModal";
import { PinGate } from "@/components/annex/PinGate";
import { Cover } from "@/components/ui/Cover";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { useLibrary } from "@/lib/hooks";
import { useUiStore, type LibrarySort } from "@/lib/store";
import {
  ALL_KINDS,
  ALL_STATUSES,
  displayTitle,
  formatRating,
  isAdultKind,
  isWatched,
  KIND_KANJI,
  KIND_LABEL,
  maxProgress,
  progressUnit,
  statusLabel,
  STATUS_COLOR,
} from "@/lib/format";

/** Entries per page - small pages keep big libraries snappy. */
const PER_PAGE = 30;

const SORTS: { value: LibrarySort; label: string }[] = [
  { value: "updated", label: "Last updated" },
  { value: "title", label: "Title" },
  { value: "rating", label: "Your rating" },
  { value: "progress", label: "Progress" },
  { value: "year", label: "Year" },
];

export default function LibraryPage() {
  const items = useLibrary();
  const ui = useUiStore();
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Back to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [ui.kindTab, ui.statusFilter, ui.genreFilter, ui.search, ui.sort, ui.view]);

  const genres = useMemo(() => {
    if (!items) return [];
    const counts = new Map<string, number>();
    for (const i of items)
      for (const g of i.series.genres) counts.set(g, (counts.get(g) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([g]) => g)
      .sort();
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return undefined;
    let out = items;
    if (ui.kindTab !== "ALL") out = out.filter((i) => i.series.kind === ui.kindTab);
    if (ui.statusFilter !== "all")
      out = out.filter((i) => i.entry.status === ui.statusFilter);
    if (ui.genreFilter !== "all")
      out = out.filter((i) => i.series.genres.includes(ui.genreFilter));
    if (ui.search.trim()) {
      const q = ui.search.trim().toLowerCase();
      out = out.filter((i) =>
        [i.series.title.romaji, i.series.title.english, i.series.title.native]
          .filter(Boolean)
          .some((t) => t!.toLowerCase().includes(q))
      );
    }
    const sorted = [...out];
    switch (ui.sort) {
      case "updated":
        sorted.sort((a, b) => b.entry.updatedAt - a.entry.updatedAt);
        break;
      case "title":
        sorted.sort((a, b) =>
          displayTitle(a.series.title).localeCompare(displayTitle(b.series.title))
        );
        break;
      case "rating":
        sorted.sort((a, b) => (b.entry.rating ?? -1) - (a.entry.rating ?? -1));
        break;
      case "progress":
        sorted.sort((a, b) => b.entry.progress - a.entry.progress);
        break;
      case "year":
        sorted.sort((a, b) => (b.series.year ?? 0) - (a.series.year ?? 0));
        break;
    }
    return sorted;
  }, [items, ui.kindTab, ui.statusFilter, ui.genreFilter, ui.search, ui.sort]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: items?.length ?? 0 };
    for (const k of ALL_KINDS) c[k] = 0;
    for (const i of items ?? []) c[i.series.kind]++;
    return c;
  }, [items]);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-8">
      <KanjiHeading
        kanji="書庫"
        title="Library"
        subtitle="Everything you watch and read, in one shelf."
      />

      {/* Kind tabs */}
      <div className="no-scrollbar -mx-1 mb-4 flex gap-1 overflow-x-auto border-b border-line px-1">
        {(["ALL", ...ALL_KINDS] as const).map((k) => (
          <button
            key={k}
            onClick={() => ui.setKindTab(k)}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
              ui.kindTab === k
                ? "brush-underline text-text"
                : "text-faint hover:text-muted"
            }`}
          >
            {k === "ALL" ? "All" : KIND_LABEL[k]}
            <span className="ml-1.5 text-xs text-faint">{counts[k] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Mobile: search + filter button share one row. Status/genre/sort/view
          all live in the filter sheet instead of cluttering the page. */}
      <div className="mb-6 flex items-center gap-2 md:hidden">
        <div className="relative flex-1">
          <SearchIcon
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            value={ui.search}
            onChange={(e) => ui.setSearch(e.target.value)}
            placeholder="Filter titles…"
            className="w-full rounded-full border border-line-strong bg-ink-800 py-2 pl-8 pr-3 text-sm outline-none focus:border-vermillion"
          />
        </div>
        <button
          onClick={() => setFiltersOpen(true)}
          aria-label="Filters"
          className="relative flex shrink-0 items-center gap-1.5 rounded-full border border-line-strong bg-ink-800 p-2.5 text-faint"
        >
          <SlidersHorizontal size={16} />
          {(ui.statusFilter !== "all" ||
            ui.genreFilter !== "all" ||
            ui.sort !== "updated") && (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-vermillion" />
          )}
        </button>
      </div>

      {/* Desktop: status chips + search/genre/sort/view, all inline */}
      <div className="mb-6 hidden items-center gap-2 md:flex">
        <div className="no-scrollbar flex flex-1 gap-1.5 overflow-x-auto">
          <Chip
            active={ui.statusFilter === "all"}
            onClick={() => ui.setStatusFilter("all")}
          >
            All statuses
          </Chip>
          {ALL_STATUSES.map((s) => (
            <Chip
              key={s}
              active={ui.statusFilter === s}
              onClick={() => ui.setStatusFilter(s)}
            >
              {statusLabel(
                s,
                ui.kindTab !== "ALL" && isWatched(ui.kindTab) ? "ANIME" : "MANGA"
              )}
            </Chip>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="relative">
            <SearchIcon
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
            />
            <input
              value={ui.search}
              onChange={(e) => ui.setSearch(e.target.value)}
              placeholder="Filter titles…"
              className="w-44 rounded-full border border-line-strong bg-ink-800 py-1.5 pl-8 pr-3 text-sm outline-none transition-all focus:w-56 focus:border-vermillion md:w-52"
            />
          </div>
          <Select
            value={ui.genreFilter}
            onChange={ui.setGenreFilter}
            options={[{ value: "all", label: "All genres" }, ...genres.map((g) => ({ value: g, label: g }))]}
            className="max-w-36 rounded-full border border-line-strong bg-ink-800 px-3 py-1.5 text-sm"
          />
          <Select
            value={ui.sort}
            onChange={(v) => ui.setSort(v as LibrarySort)}
            options={SORTS}
            className="rounded-full border border-line-strong bg-ink-800 px-3 py-1.5 text-sm"
          />
          <div className="flex overflow-hidden rounded-full border border-line-strong">
            <button
              onClick={() => ui.setView("grid")}
              aria-label="Grid view"
              className={`p-2 ${ui.view === "grid" ? "bg-ink-700 text-text" : "bg-ink-800 text-faint"}`}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => ui.setView("list")}
              aria-label="List view"
              className={`p-2 ${ui.view === "list" ? "bg-ink-700 text-text" : "bg-ink-800 text-faint"}`}
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile filter sheet - status, genre, sort, view */}
      <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
        <div className="space-y-5">
          <div>
            <div className="mb-1.5 text-xs font-medium text-faint">Status</div>
            <div className="flex flex-wrap gap-1.5">
              <Chip
                active={ui.statusFilter === "all"}
                onClick={() => ui.setStatusFilter("all")}
              >
                All statuses
              </Chip>
              {ALL_STATUSES.map((s) => (
                <Chip
                  key={s}
                  active={ui.statusFilter === s}
                  onClick={() => ui.setStatusFilter(s)}
                >
                  {statusLabel(
                    s,
                    ui.kindTab !== "ALL" && isWatched(ui.kindTab) ? "ANIME" : "MANGA"
                  )}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-medium text-faint">Genre</div>
            <Select
              value={ui.genreFilter}
              onChange={ui.setGenreFilter}
              options={[{ value: "all", label: "All genres" }, ...genres.map((g) => ({ value: g, label: g }))]}
              className="w-full rounded-lg border border-line-strong bg-ink-800 px-3 py-2.5 text-sm"
              panelClassName="w-full"
            />
          </div>
          <div>
            <div className="mb-1.5 text-xs font-medium text-faint">Sort by</div>
            <Select
              value={ui.sort}
              onChange={(v) => ui.setSort(v as LibrarySort)}
              options={SORTS}
              className="w-full rounded-lg border border-line-strong bg-ink-800 px-3 py-2.5 text-sm"
              panelClassName="w-full"
            />
          </div>
          <div>
            <div className="mb-1.5 text-xs font-medium text-faint">View</div>
            <div className="flex overflow-hidden rounded-lg border border-line-strong">
              <button
                onClick={() => ui.setView("grid")}
                className={`flex flex-1 items-center justify-center gap-2 py-2.5 text-sm ${ui.view === "grid" ? "bg-ink-700 text-text" : "bg-ink-800 text-faint"}`}
              >
                <LayoutGrid size={15} /> Grid
              </button>
              <button
                onClick={() => ui.setView("list")}
                className={`flex flex-1 items-center justify-center gap-2 py-2.5 text-sm ${ui.view === "list" ? "bg-ink-700 text-text" : "bg-ink-800 text-faint"}`}
              >
                <List size={15} /> List
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Content */}
      {ui.kindTab !== "ALL" && isAdultKind(ui.kindTab) && !ui.annexUnlocked ? (
        <PinGate
          title={`Unlock ${KIND_LABEL[ui.kindTab]}`}
          subtitle="This shelf hides behind the Annex PIN, same as the doujin shelf. It locks again when the browser closes."
          kanji={KIND_KANJI[ui.kindTab]}
        >
          {null}
        </PinGate>
      ) : !filtered ? (
        <CardGridSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState hasAny={(items?.length ?? 0) > 0} />
      ) : (
        <>
          {ui.view === "grid" ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
              {filtered
                .slice((page - 1) * PER_PAGE, page * PER_PAGE)
                .map((item) => (
                  <CoverCard key={item.series.id} item={item} />
                ))}
            </div>
          ) : (
            <ListView items={filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)} />
          )}
          <Pagination
            page={page}
            totalPages={Math.ceil(filtered.length / PER_PAGE)}
            onChange={setPage}
          />
        </>
      )}

      <EditEntryModal />
    </div>
  );
}

function ListView({
  items,
}: {
  items: NonNullable<ReturnType<typeof useLibrary>>;
}) {
  const openEdit = useUiStore((s) => s.openEdit);
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      {items.map(({ series, entry }, i) => {
        const total = maxProgress(series);
        return (
          <Link
            key={series.id}
            href={`/series/${series.id}`}
            className={`flex items-center gap-4 px-4 py-2.5 transition-colors hover:bg-ink-800 ${
              i % 2 ? "bg-ink-900/60" : "bg-ink-850/60"
            }`}
          >
            <Cover
              src={series.cover}
              alt=""
              className="h-14 w-10 shrink-0 rounded object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {displayTitle(series.title)}
              </div>
              <div className="text-xs text-faint">
                {KIND_LABEL[series.kind]}
                {series.year ? ` · ${series.year}` : ""}
              </div>
            </div>
            <span
              className="hidden text-xs sm:block"
              style={{ color: STATUS_COLOR[entry.status] }}
            >
              {statusLabel(entry.status, series.kind)}
            </span>
            <span className="w-20 text-right text-xs text-muted">
              {entry.progress}
              {total ? `/${total}` : ""} {progressUnit(series.kind)}
            </span>
            <span className="w-10 text-right font-display text-sm text-gold">
              {formatRating(entry.rating)}
            </span>
            <button
              onClick={(e) => {
                e.preventDefault();
                openEdit(series.id);
              }}
              className="rounded-md px-2 py-1 text-xs text-faint hover:bg-ink-700 hover:text-text"
            >
              Edit
            </button>
          </Link>
        );
      })}
    </div>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <div className="font-display text-7xl text-ink-600">空</div>
      <p className="mt-4 text-muted">
        {hasAny ? "Nothing matches these filters." : "Your shelf is empty."}
      </p>
      {!hasAny && (
        <Link
          href="/import"
          className="mt-6 rounded-lg bg-vermillion px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_16px_rgba(230,57,70,0.4)] hover:bg-vermillion-bright"
        >
          Import your lists
        </Link>
      )}
    </div>
  );
}
