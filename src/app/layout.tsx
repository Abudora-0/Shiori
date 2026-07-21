import type { Metadata, Viewport } from "next";
import { Inter, Shippori_Mincho, Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Sidebar } from "@/components/nav/Sidebar";
import { MobileNav } from "@/components/nav/MobileNav";
import { CommandPalette } from "@/components/CommandPalette";

const shippori = Shippori_Mincho({
  weight: ["500", "600", "700", "800"],
  preload: false,
  variable: "--font-shippori",
});

const zen = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700", "900"],
  preload: false,
  variable: "--font-zen",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Shiori 栞 — Anime & Manga Tracker",
  description:
    "Local-first tracker for anime, manga, manhwa and manhua — imports from AniList, MyAnimeList and more.",
};

export const viewport: Viewport = {
  themeColor: "#0b0b12",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${shippori.variable} ${zen.variable} ${inter.variable}`}
    >
      <body className="antialiased">
        {/* Apply saved theme + matching favicon before paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("shiori-theme")||"ink";if(t!=="ink")document.documentElement.dataset.theme=t;var l=document.querySelector("link[rel*='icon']");if(!l){l=document.createElement("link");l.rel="icon";document.head.appendChild(l)}l.href="/icons/"+t+".svg";}catch(e){}`,
          }}
        />
        <Providers>
          <div className="noise-overlay" aria-hidden />
          <CommandPalette />
          <Sidebar />
          <MobileNav />
          <main className="min-h-dvh pb-24 md:pb-0 md:pl-20">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
