"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CommandPalette } from "@/components/CommandPalette";
import { Sidebar } from "@/components/nav/Sidebar";
import { MobileNav } from "@/components/nav/MobileNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/download") {
    return (
      <>
        <div className="noise-overlay" aria-hidden />
        <main className="min-h-dvh">{children}</main>
      </>
    );
  }

  return (
    <>
      <div className="noise-overlay" aria-hidden />
      <CommandPalette />
      <Sidebar />
      <MobileNav />
      <main className="min-h-dvh pb-24 md:pb-0 md:pl-20">
        {children}
        <DownloadNudge />
      </main>
    </>
  );
}

function DownloadNudge() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-6 md:px-8">
      <Link
        href="/download"
        className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-lg border border-line px-4 py-3 text-center text-xs text-faint transition-colors hover:border-vermillion/60 hover:text-muted"
      >
        <span>Prefer an app?</span>
        <span className="font-medium text-text/90">
          <span className="hidden md:inline">Install Shiori for your desktop.</span>
          <span className="md:hidden">Install Shiori for your phone.</span>
        </span>
      </Link>
    </div>
  );
}
