"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowDownToLine,
  BarChart3,
  BookLock,
  CalendarDays,
  ChevronRight,
  Home,
  Layers,
  Settings,
} from "lucide-react";
import { KanjiHeading } from "@/components/ui/KanjiHeading";
import { db } from "@/lib/db";

const ROWS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/lists", label: "Lists", icon: Layers },
  { href: "/calendar", label: "Airing calendar", icon: CalendarDays },
  { href: "/import", label: "Import", icon: ArrowDownToLine },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Mobile-only overflow menu (Mihon's "More" tab) for destinations that
 * don't fit in the bottom nav. Desktop users have the full Sidebar instead. */
export default function MorePage() {
  const annexEnabled = useLiveQuery(
    async () => !!(await db.settings.get("annexPinHash")),
    []
  );

  return (
    <div className="mx-auto max-w-lg px-4 py-6 md:hidden">
      <KanjiHeading kanji="他" title="More" />
      <div className="overflow-hidden rounded-xl border border-line">
        {ROWS.map(({ href, label, icon: Icon }, i) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-ink-800 ${
              i % 2 ? "bg-ink-900/60" : "bg-ink-850/60"
            } ${i > 0 ? "border-t border-line" : ""}`}
          >
            <Icon size={18} className="shrink-0 text-muted" />
            <span className="flex-1 text-sm font-medium">{label}</span>
            <ChevronRight size={16} className="shrink-0 text-faint" />
          </Link>
        ))}
        {annexEnabled && (
          <Link
            href="/annex"
            className="flex items-center gap-3 border-t border-line bg-ink-850/60 px-4 py-3.5 transition-colors hover:bg-ink-800"
          >
            <BookLock size={18} className="shrink-0 text-muted" />
            <span className="flex-1 text-sm font-medium">Annex</span>
            <ChevronRight size={16} className="shrink-0 text-faint" />
          </Link>
        )}
      </div>
    </div>
  );
}
