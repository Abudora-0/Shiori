import { create } from "zustand";
import type { EntryStatus, MediaKind } from "./types";

export type LibrarySort = "updated" | "title" | "rating" | "progress" | "year";
export type LibraryView = "grid" | "list";

interface UiState {
  kindTab: MediaKind | "ALL";
  statusFilter: EntryStatus | "all";
  genreFilter: string | "all";
  sort: LibrarySort;
  search: string;
  view: LibraryView;
  editSeriesId: number | null;
  setKindTab: (k: MediaKind | "ALL") => void;
  setStatusFilter: (s: EntryStatus | "all") => void;
  setGenreFilter: (g: string | "all") => void;
  setSort: (s: LibrarySort) => void;
  setSearch: (q: string) => void;
  setView: (v: LibraryView) => void;
  openEdit: (seriesId: number) => void;
  closeEdit: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  kindTab: "ALL",
  statusFilter: "all",
  genreFilter: "all",
  sort: "updated",
  search: "",
  view: "grid",
  editSeriesId: null,
  setKindTab: (kindTab) => set({ kindTab }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setGenreFilter: (genreFilter) => set({ genreFilter }),
  setSort: (sort) => set({ sort }),
  setSearch: (search) => set({ search }),
  setView: (view) => set({ view }),
  openEdit: (editSeriesId) => set({ editSeriesId }),
  closeEdit: () => set({ editSeriesId: null }),
}));
