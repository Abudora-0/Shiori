import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowDownToLine,
  BarChart3,
  BellRing,
  CalendarDays,
  Compass,
  Layers,
  LibraryBig,
  Monitor,
  Palette,
  Smartphone,
} from "lucide-react";
import { KanjiHeading } from "@/components/ui/KanjiHeading";
import { InstallButton } from "@/components/marketing/InstallButton";
import { InstallCard, InstallSteps } from "@/components/marketing/InstallCard";

export const metadata: Metadata = {
  title: "Install Shiori",
  description: "Add Shiori to your desktop or your phone and open it like any other app.",
};

const FEATURES = [
  {
    icon: ArrowDownToLine,
    title: "Import",
    text: "Pull in your lists from AniList, MyAnimeList, Kitsu, or a Mihon backup file.",
  },
  {
    icon: LibraryBig,
    title: "Library",
    text: "Grid or list view, status filters, sorting, quick progress, and favorites.",
  },
  {
    icon: BarChart3,
    title: "Stats",
    text: "Totals, score distribution, genre breakdowns, and an activity heatmap.",
  },
  {
    icon: Layers,
    title: "Custom lists",
    text: "Curated shelves, plus smart lists that update themselves from filters.",
  },
  {
    icon: BellRing,
    title: "Updates feed",
    text: "Tracks new chapters for what you're reading, with one-click catch-up.",
  },
  {
    icon: Compass,
    title: "Discover",
    text: "This season's airing anime and what's trending, added to your shelf in a tap.",
  },
  {
    icon: CalendarDays,
    title: "Airing calendar",
    text: "Day-by-day air times with countdowns for what's in your library.",
  },
  {
    icon: Palette,
    title: "Six themes",
    text: "From a dark vermillion default to a warm paper look and a pastel palette.",
  },
];

export default function DownloadPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-16">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[6px] border-vermillion bg-paper font-display text-3xl font-bold text-[#16161f] shadow-[0_0_28px_rgba(230,57,70,0.5)]">
          栞
        </div>
        <h1 className="mt-6 font-display text-3xl font-bold tracking-wide md:text-5xl">
          Install Shiori
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted md:text-base">
          Add it to your desktop or your phone and open it like any other app.
          No sign-up, no server, no tracking. Your library stays on your own device,
          exactly where you left it.
        </p>
        <div className="torii-rule mx-auto mt-6 w-32 md:w-44" />
      </div>

      <div className="mt-10 grid gap-5 md:mt-14 md:grid-cols-2">
        <div className="order-2 md:order-1">
          <InstallCard
            icon={Monitor}
            title="Desktop"
            description="Windows, macOS, or Linux, in Chrome or Edge."
          >
            <InstallSteps
              steps={[
                "Open Shiori in Chrome or Edge.",
                'Click the install icon at the right of the address bar (or open the browser menu and choose "Install Shiori").',
                "Confirm. Shiori now opens in its own window from your dock or start menu.",
              ]}
            />
            <div className="mt-6">
              <InstallButton label="Install for desktop" />
            </div>
          </InstallCard>
        </div>

        <div className="order-1 md:order-2">
          <InstallCard
            icon={Smartphone}
            title="Mobile"
            description="Android or iPhone, straight from the browser."
          >
            <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-faint">
              Android (Chrome)
            </p>
            <InstallSteps
              steps={[
                "Open Shiori in Chrome.",
                'Tap the menu (three dots) and choose "Add to Home screen" or "Install app".',
                "Confirm. Shiori now opens full screen, just like a native app.",
              ]}
            />
            <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-faint">
              iPhone (Safari)
            </p>
            <InstallSteps
              steps={[
                "Open Shiori in Safari.",
                'Tap the Share icon, then "Add to Home Screen".',
                "Confirm. It opens without Safari's toolbar, just like a native app.",
              ]}
            />
            <div className="mt-6">
              <InstallButton label="Install for phone" />
            </div>
          </InstallCard>
        </div>
      </div>

      <section className="mt-14 md:mt-20">
        <KanjiHeading
          kanji="読"
          title="What you get"
          subtitle="The same shelf, whichever way you open it."
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-xl border border-line bg-ink-850 px-4 py-3.5">
              <Icon size={18} strokeWidth={1.8} className="text-vermillion-bright" />
              <div className="mt-2 font-display text-sm font-bold">{title}</div>
              <div className="mt-1 text-[11px] leading-relaxed text-faint">{text}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-14 text-center md:mt-20">
        <Link
          href="/"
          className="text-sm text-faint underline decoration-line-strong underline-offset-4 transition-colors hover:text-vermillion-bright"
        >
          Prefer the browser? Use the web version instead.
        </Link>
      </div>
    </div>
  );
}
