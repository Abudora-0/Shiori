"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellRing,
  Compass,
  Home,
  Layers,
  LibraryBig,
  Search,
  Settings,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/library", label: "Library", icon: LibraryBig },
  { href: "/updates", label: "Updates", icon: BellRing },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/search", label: "Search", icon: Search },
  { href: "/lists", label: "Lists", icon: Layers },
  { href: "/settings", label: "More", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-line bg-ink-900/90 backdrop-blur-md md:hidden">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[9px] ${
              active ? "text-vermillion-bright" : "text-faint"
            }`}
          >
            <Icon size={19} strokeWidth={active ? 2.4 : 1.8} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
