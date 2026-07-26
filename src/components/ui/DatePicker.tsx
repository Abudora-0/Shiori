"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function toIso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Custom calendar popup replacing native <input type="date"> - same reason
 * as Select: the native picker only gets a light/dark hint from color-scheme,
 * never the app's actual per-theme palette.
 */
export function DatePicker({
  value,
  onChange,
  className = "",
  placeholder = "Not set",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const parsed = value ? new Date(`${value}T00:00:00`) : null;
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? new Date().getMonth());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const p = value ? new Date(`${value}T00:00:00`) : new Date();
    setViewYear(p.getFullYear());
    setViewMonth(p.getMonth());
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, value]);

  function shiftMonth(delta: number) {
    let y = viewYear;
    let m = viewMonth + delta;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewYear(y);
    setViewMonth(m);
  }

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const todayIso = toIso(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  const label = parsed
    ? parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : placeholder;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center justify-between gap-2 text-left outline-none focus:border-vermillion ${className} ${
          !value ? "text-faint" : ""
        }`}
      >
        <span className="truncate">{label}</span>
        <CalendarDays size={14} className="shrink-0 text-faint" />
      </button>
      {open && (
        <div className="animate-[dropdown-in_0.12s_ease-out] absolute left-0 top-[calc(100%+6px)] z-30 w-64 rounded-lg border border-line-strong bg-ink-850 p-3 shadow-2xl">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="rounded-md p-1 text-muted transition-colors hover:bg-ink-700 hover:text-text"
              aria-label="Previous month"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-medium">
              {new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="rounded-md p-1 text-muted transition-colors hover:bg-ink-700 hover:text-text"
              aria-label="Next month"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-y-1 text-center">
            {WEEKDAYS.map((w, i) => (
              <span key={i} className="text-[10px] font-medium text-faint">
                {w}
              </span>
            ))}
            {cells.map((day, i) => {
              if (day == null) return <span key={i} />;
              const iso = toIso(viewYear, viewMonth, day);
              const isSelected = iso === value;
              const isToday = iso === todayIso;
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors ${
                    isSelected
                      ? "bg-vermillion text-white"
                      : isToday
                        ? "text-vermillion-bright"
                        : "text-text hover:bg-ink-700"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {value && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="mt-2 w-full rounded-md py-1.5 text-xs text-vermillion transition-colors hover:bg-vermillion/10"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
