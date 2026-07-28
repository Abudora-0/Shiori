"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BellRing,
  Compass,
  LibraryBig,
  MoreHorizontal,
  Search,
} from "lucide-react";
import { unreadUpdateCount } from "@/lib/updates";

/**
 * Five tabs, Mihon-style (Library / Updates / Browse / .. / More) - everything
 * else (Home, Lists, Airing, Import, Stats, Settings, Annex) lives one tap
 * away behind "More" instead of cramming 7+ tiny labels into the bar.
 */
const NAV = [
  { href: "/library", label: "Library", icon: LibraryBig },
  { href: "/updates", label: "Updates", icon: BellRing },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/search", label: "Search", icon: Search },
  { href: "/more", label: "More", icon: MoreHorizontal },
];

export function MobileNav() {
  const pathname = usePathname();
  const unread = useLiveQuery(() => unreadUpdateCount(), []);
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-line bg-ink-900/90 backdrop-blur-md md:hidden">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] ${
              active ? "text-vermillion-bright" : "text-faint"
            }`}
          >
            <span className="relative">
              <Icon size={21} strokeWidth={active ? 2.4 : 1.8} />
              {href === "/updates" && !!unread && (
                <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-vermillion px-1 text-[8px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
