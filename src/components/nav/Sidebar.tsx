"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowDownToLine,
  BarChart3,
  BellRing,
  BookLock,
  CalendarDays,
  Compass,
  Home,
  Layers,
  LibraryBig,
  Search,
  Settings,
} from "lucide-react";
import { db } from "@/lib/db";
import { unreadUpdateCount } from "@/lib/updates";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/library", label: "Library", icon: LibraryBig },
  { href: "/updates", label: "Updates", icon: BellRing },
  { href: "/lists", label: "Lists", icon: Layers },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/search", label: "Search", icon: Search },
  { href: "/calendar", label: "Airing", icon: CalendarDays },
  { href: "/import", label: "Import", icon: ArrowDownToLine },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  // The Annex link only appears once a PIN has been set up
  const annexEnabled = useLiveQuery(
    async () => !!(await db.settings.get("annexPinHash")),
    []
  );
  const unread = useLiveQuery(() => unreadUpdateCount(), []);

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-dvh w-20 flex-col items-center border-r border-line bg-ink-900/80 backdrop-blur-md md:flex">
      {/* Ring-badge logo */}
      <Link
        href="/"
        className="mt-5 flex h-11 w-11 items-center justify-center rounded-full border-[5px] border-vermillion bg-paper font-display text-xl font-bold text-[#16161f] shadow-[0_0_18px_rgba(230,57,70,0.45)] transition-transform hover:scale-105"
        title="Shiori — 栞"
      >
        栞
      </Link>

      <nav className="no-scrollbar mt-6 flex flex-1 flex-col items-center gap-1.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`group relative flex h-12 w-12 flex-col items-center justify-center rounded-lg transition-colors ${
                active
                  ? "bg-ink-700 text-vermillion-bright"
                  : "text-faint hover:bg-ink-800 hover:text-text"
              }`}
            >
              <span className="relative">
                <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
                {href === "/updates" && !!unread && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-vermillion px-1 text-[9px] font-bold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </span>
              <span
                className={`mt-0.5 text-[8px] font-medium tracking-wide ${
                  active ? "text-sakura" : "text-faint group-hover:text-muted"
                }`}
              >
                {label}
              </span>
              {active && (
                <span className="absolute -left-[13px] h-7 w-1 rounded-r bg-vermillion shadow-[0_0_8px_rgba(230,57,70,0.8)]" />
              )}
            </Link>
          );
        })}
      </nav>

      {annexEnabled && (
        <Link
          href="/annex"
          title="Annex — 別館"
          className={`mb-4 flex h-11 w-11 flex-col items-center justify-center rounded-lg transition-colors ${
            pathname.startsWith("/annex")
              ? "bg-ink-700 text-vermillion-bright"
              : "text-faint/60 hover:bg-ink-800 hover:text-muted"
          }`}
        >
          <BookLock size={18} strokeWidth={1.8} />
          <span className="mt-0.5 text-[8px] tracking-wide">Annex</span>
        </Link>
      )}

      {/* Vertical wordmark */}
      <div className="vertical-text mb-6 select-none font-display text-[11px] tracking-[0.4em] text-faint">
        しおり
      </div>
    </aside>
  );
}
