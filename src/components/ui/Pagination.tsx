"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

/** Numbered pager: 1 … p-1 [p] p+1 … N */
export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages: (number | "…")[] = [];
  const radius = 1;
  let last = 0;
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= radius) {
      if (last && p - last > 1) pages.push("…");
      pages.push(p);
      last = p;
    }
  }

  function go(p: number) {
    onChange(Math.min(Math.max(1, p), totalPages));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="flex items-center justify-center gap-1.5 py-6">
      <button
        onClick={() => go(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
        className="rounded-lg border border-line-strong p-2 text-muted transition-colors hover:border-vermillion/60 hover:text-text disabled:opacity-30"
      >
        <ChevronLeft size={15} />
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="px-1.5 text-faint">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => go(p)}
            className={`min-w-9 rounded-lg border px-2.5 py-1.5 text-sm transition-colors ${
              p === page
                ? "border-vermillion bg-vermillion/15 font-semibold text-vermillion-bright"
                : "border-line-strong text-muted hover:border-vermillion/60 hover:text-text"
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => go(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
        className="rounded-lg border border-line-strong p-2 text-muted transition-colors hover:border-vermillion/60 hover:text-text disabled:opacity-30"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
}
