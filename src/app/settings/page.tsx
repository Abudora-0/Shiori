"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BookLock,
  Download,
  ImageOff,
  KeyRound,
  Loader2,
  Tags,
  Trash2,
  Upload,
} from "lucide-react";
import { KanjiHeading } from "@/components/ui/KanjiHeading";
import { db, getSetting, setSetting } from "@/lib/db";
import { lockAnnex, setPin, verifyPin } from "@/lib/annex";
import { fixMissingCovers, reclassifyLibrary } from "@/lib/maintenance";
import {
  autoBackupStatus,
  autoBackupSupported,
  chooseBackupFolder,
  disableAutoBackup,
} from "@/lib/autobackup";
import { formatDate } from "@/lib/format";
import { DupeSection } from "@/components/settings/DupeSection";
import {
  clearAllData,
  downloadBackup,
  exportBackup,
  importBackup,
} from "@/lib/backup";

export default function SettingsPage() {
  const [malClientId, setMalClientId] = useState("");
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSetting<string>("malClientId").then((v) => v && setMalClientId(v));
  }, []);

  async function saveClientId() {
    await setSetting("malClientId", malClientId.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function onExport() {
    downloadBackup(await exportBackup());
  }

  async function onImportFile(file: File) {
    try {
      const json = JSON.parse(await file.text());
      await importBackup(json);
      setMessage("Backup restored successfully.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Import failed.");
    }
  }

  async function onClear() {
    if (
      confirm(
        "Delete ALL local data — library, ratings, reviews, notes? This cannot be undone. Export a backup first!"
      )
    ) {
      await clearAllData();
      setMessage("All data cleared.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8">
      <KanjiHeading
        kanji="設定"
        title="Settings"
        subtitle="Keys, backups and the danger zone. All data lives in this browser."
      />

      <div className="space-y-6 pb-16">
        <ThemeSection />

        {/* MAL Client ID */}
        <section className="rounded-xl border border-line bg-ink-850 p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <KeyRound size={17} className="text-gold" /> MyAnimeList Client ID
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            Needed to import from MAL. Register a free API client at{" "}
            <a
              href="https://myanimelist.net/apiconfig"
              target="_blank"
              rel="noreferrer"
              className="text-sakura underline"
            >
              myanimelist.net/apiconfig
            </a>{" "}
            (App Type: <span className="text-text">other</span>), then paste the
            Client ID here. It is stored only in this browser.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              value={malClientId}
              onChange={(e) => setMalClientId(e.target.value)}
              placeholder="e.g. 6114d00ca681b7701d1e15fe11a4987e"
              className="flex-1 rounded-lg border border-line-strong bg-ink-900 px-3 py-2 font-mono text-sm outline-none focus:border-vermillion"
            />
            <button
              onClick={saveClientId}
              className="rounded-lg bg-ink-700 px-4 py-2 text-sm font-medium transition-colors hover:bg-ink-600"
            >
              {saved ? "Saved ✓" : "Save"}
            </button>
          </div>
        </section>

        {/* Backup */}
        <section className="rounded-xl border border-line bg-ink-850 p-5">
          <h2 className="font-display text-lg font-semibold">Backup &amp; restore</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            Your library lives in this browser&apos;s IndexedDB. Export regularly —
            clearing browser data would erase it.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={onExport}
              className="flex items-center gap-2 rounded-lg bg-vermillion px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-vermillion-bright"
            >
              <Download size={15} /> Export JSON backup
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 rounded-lg border border-line-strong px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:border-vermillion/60 hover:text-text"
            >
              <Upload size={15} /> Restore from backup
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImportFile(f);
                e.target.value = "";
              }}
            />
          </div>
          <AutoBackupRow />
        </section>

        <MaintenanceSection />

        <DupeSection />

        <AnnexSection />

        {/* Danger zone */}
        <section className="rounded-xl border border-vermillion/30 bg-vermillion/[0.04] p-5">
          <h2 className="font-display text-lg font-semibold text-vermillion-bright">
            Danger zone
          </h2>
          <p className="mt-1.5 text-xs text-muted">
            Wipe the entire local database. Reviews, notes and ratings included.
          </p>
          <button
            onClick={onClear}
            className="mt-4 flex items-center gap-2 rounded-lg border border-vermillion/50 px-4 py-2.5 text-sm font-medium text-vermillion-bright transition-colors hover:bg-vermillion hover:text-white"
          >
            <Trash2 size={15} /> Delete everything
          </button>
        </section>

        {message && (
          <p className="rounded-lg border border-line bg-ink-850 px-4 py-3 text-sm text-matcha">
            {message}
          </p>
        )}

        <p className="text-center text-xs text-faint">
          栞 Shiori — a bookmark between worlds. Local-first, no accounts, no cloud.
        </p>
      </div>
    </div>
  );
}

function AutoBackupRow() {
  const [status, setStatus] = useState<{
    enabled: boolean;
    folder?: string;
    last?: number;
  } | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    autoBackupStatus().then(setStatus);
  }, []);

  async function enable() {
    try {
      const folder = await chooseBackupFolder();
      setMsg(`Auto-backup enabled — wrote a backup to "${folder}" just now.`);
      setStatus(await autoBackupStatus());
    } catch (e) {
      if ((e as Error)?.name !== "AbortError")
        setMsg("Couldn't set up the folder — permission denied.");
    }
  }

  async function disable() {
    await disableAutoBackup();
    setStatus(await autoBackupStatus());
    setMsg("Auto-backup disabled.");
  }

  if (!autoBackupSupported()) {
    return (
      <p className="mt-4 border-t border-line pt-4 text-xs text-faint">
        Automatic backups need the File System Access API, which this browser
        doesn&apos;t expose (Brave disables it by default — enable it in
        brave://flags, or use another Chromium browser). Manual export above works
        everywhere.
      </p>
    );
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-faint">
          Auto-backup
        </span>
        {status?.enabled ? (
          <>
            <span className="text-xs text-matcha">
              On → “{status.folder}” · last {formatDate(status.last)}
            </span>
            <button
              onClick={disable}
              className="rounded-lg px-3 py-1.5 text-xs text-vermillion transition-colors hover:bg-vermillion/10"
            >
              Disable
            </button>
          </>
        ) : (
          <button
            onClick={enable}
            className="rounded-lg bg-ink-700 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-ink-600"
          >
            Choose folder &amp; enable
          </button>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-faint">
        Writes shiori-auto-backup.json to your folder about once a day when the
        app opens.
      </p>
      {msg && <p className="mt-1.5 text-xs text-muted">{msg}</p>}
    </div>
  );
}

const THEMES = [
  {
    id: "ink",
    name: "Midnight Ink",
    kanji: "夜",
    desc: "The original — dark indigo, vermillion glow, serif elegance.",
    swatches: ["#0b0b12", "#1a1a28", "#e63946", "#f4a7b9", "#d4af37"],
  },
  {
    id: "washi",
    name: "Washi Paper",
    kanji: "紙",
    desc: "Warm daylight paper, sumi ink text, hanko red. Calm study vibes.",
    swatches: ["#f4efe4", "#dfd6c0", "#c1272d", "#b85c6c", "#8f7420"],
  },
  {
    id: "panel",
    name: "Manga Panel",
    kanji: "漫",
    desc: "Printed page: stark B/W, square panels, halftone dots, SHOUTY CAPS.",
    swatches: ["#ffffff", "#0d0d0d", "#e60012", "#b0b0b0", "#c2185b"],
  },
  {
    id: "sakura",
    name: "Sakura Dream",
    kanji: "桜",
    desc: "Pastel pink haze, extra-round corners, soft petal glow. Shoujo soft.",
    swatches: ["#fdf2f5", "#f4d4dd", "#e64980", "#b08968", "#74a57f"],
  },
  {
    id: "neon",
    name: "Neon Tokyo",
    kanji: "電",
    desc: "Cyberpunk night — cyan & magenta neon, scanlines, techy gothic type.",
    swatches: ["#05060f", "#131730", "#ff2d78", "#00e5ff", "#ffe14d"],
  },
  {
    id: "zen",
    name: "Zen Garden",
    kanji: "庭",
    desc: "Deep moss green, sand and gold accents. Quiet, grounded, unhurried.",
    swatches: ["#101510", "#222b21", "#6f9e55", "#d9c8a9", "#c9a227"],
  },
] as const;

function ThemeSection() {
  const [theme, setTheme] = useState<string>("ink");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme || "ink");
  }, []);

  function apply(id: string) {
    if (id === "ink") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = id;
    // matching favicon
    let link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = `/icons/${id}.svg`;
    try {
      localStorage.setItem("shiori-theme", id);
    } catch {
      /* private mode — theme just won't persist */
    }
    setTheme(id);
  }

  return (
    <section className="rounded-xl border border-line bg-ink-850 p-5">
      <h2 className="font-display text-lg font-semibold">Theme</h2>
      <p className="mt-1.5 text-xs text-muted">
        Changes apply instantly and are remembered on this device.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => apply(t.id)}
            className={`rounded-xl border p-4 text-left transition-colors ${
              theme === t.id
                ? "border-vermillion bg-vermillion/10"
                : "border-line-strong bg-ink-900 hover:border-vermillion/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-base font-semibold">{t.name}</span>
              <span className="font-display text-sm text-sakura">{t.kanji}</span>
            </div>
            <div className="mt-2.5 flex gap-1.5">
              {t.swatches.map((c) => (
                <span
                  key={c}
                  className="h-5 w-5 rounded-full border border-black/20"
                  style={{ background: c }}
                />
              ))}
            </div>
            <p className="mt-2.5 text-[11px] leading-relaxed text-faint">{t.desc}</p>
            {theme === t.id && (
              <p className="mt-2 text-[11px] font-semibold text-vermillion-bright">
                ● Active
              </p>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

function MaintenanceSection() {
  const [coverState, setCoverState] = useState<string | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [typeState, setTypeState] = useState<string | null>(null);
  const [typeBusy, setTypeBusy] = useState(false);

  async function runCoverFix() {
    setCoverBusy(true);
    setCoverState("Checking which covers actually load…");
    try {
      const result = await fixMissingCovers((p) =>
        setCoverState(
          p.phase === "checking"
            ? `Testing stored covers ${p.count}/${p.total} for dead links…`
            : `Searching covers ${p.count}/${p.total} (${p.fixed} found so far): ${p.current}`
        )
      );
      setCoverState(
        result.scanned === 0
          ? "All covers load fine — nothing to fix."
          : `Done — ${result.fixed} covers replaced, ${result.failed} still missing (no source had a match).`
      );
    } catch (e) {
      setCoverState(e instanceof Error ? e.message : String(e));
    }
    setCoverBusy(false);
  }

  async function runReclassify() {
    setTypeBusy(true);
    setTypeState("Re-checking types…");
    try {
      const result = await reclassifyLibrary((p) =>
        setTypeState(
          p.phase === "anilist"
            ? `Refreshing ${p.total} series from AniList (takes ~2s per 50)…`
            : `Checking ${p.total} local entries…`
        )
      );
      setTypeState(
        `Done — ${result.updated} types changed, ${result.pornhwa} moved to Pornhwa.`
      );
    } catch (e) {
      setTypeState(e instanceof Error ? e.message : String(e));
    }
    setTypeBusy(false);
  }

  return (
    <section className="rounded-xl border border-line bg-ink-850 p-5">
      <h2 className="font-display text-lg font-semibold">Maintenance</h2>

      <div className="mt-4 space-y-5">
        <div>
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs leading-relaxed text-muted">
              <span className="font-semibold text-text">Fix covers</span> — tests
              every stored cover for dead links, then hunts across MangaDex,
              Anime-Planet, MangaKatana, WeebCentral, MangaFire, KaliScan,
              KingofShojo, MangaK, MangaFox, MadaraDex, ManhwaBuddy, Kagane and
              (last, VPN-dependent) Comick. Pornhwa tries ManhwaBuddy &amp;
              MadaraDex first.
            </p>
            <button
              onClick={runCoverFix}
              disabled={coverBusy}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-ink-700 px-4 py-2 text-sm font-medium transition-colors hover:bg-ink-600 disabled:opacity-50"
            >
              {coverBusy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ImageOff size={14} />
              )}
              Run
            </button>
          </div>
          {coverState && <p className="mt-2 text-xs text-sakura">{coverState}</p>}
        </div>

        <div className="border-t border-line pt-4">
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs leading-relaxed text-muted">
              <span className="font-semibold text-text">Re-classify types</span> —
              refreshes manga-side series from AniList (adult manhwa → Pornhwa) and
              applies adult-tag detection to local entries. Overwrites manual type
              changes on AniList-known series.
            </p>
            <button
              onClick={runReclassify}
              disabled={typeBusy}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-ink-700 px-4 py-2 text-sm font-medium transition-colors hover:bg-ink-600 disabled:opacity-50"
            >
              {typeBusy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Tags size={14} />
              )}
              Run
            </button>
          </div>
          {typeState && <p className="mt-2 text-xs text-sakura">{typeState}</p>}
        </div>
      </div>
    </section>
  );
}

function AnnexSection() {
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    getSetting<string>("annexPinHash").then((v) => setHasPin(!!v));
  }, []);

  async function changePin() {
    if (!(await verifyPin(currentPin))) return setMsg("Current PIN is wrong.");
    if (newPin.length < 4) return setMsg("New PIN needs at least 4 digits.");
    await setPin(newPin);
    setCurrentPin("");
    setNewPin("");
    setMsg("PIN changed.");
  }

  async function forgetPin() {
    if (!(await verifyPin(currentPin))) return setMsg("Enter your current PIN first.");
    if (
      confirm(
        "Remove the PIN? The annex stays but anyone opening /annex will be asked to create a new PIN (your entries are kept)."
      )
    ) {
      await db.settings.delete("annexPinHash");
      lockAnnex();
      setHasPin(false);
      setMsg("PIN removed.");
    }
  }

  return (
    <section className="rounded-xl border border-line bg-ink-850 p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        <BookLock size={17} className="text-sakura" /> Annex
      </h2>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">
        A PIN-gated shelf for doujins (nhentai favorites import, add-by-link for
        nhentai / HentaiFox / Hitomi). Hidden from the sidebar until set up; locks
        when the browser closes.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href="/annex"
          className="rounded-lg bg-vermillion px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-vermillion-bright"
        >
          {hasPin ? "Open annex" : "Set up annex"}
        </Link>
      </div>

      {hasPin && (
        <div className="mt-4 border-t border-line pt-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-faint">
            Change / remove PIN
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="password"
              inputMode="numeric"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
              placeholder="Current PIN"
              className="w-32 rounded-lg border border-line-strong bg-ink-900 px-3 py-2 text-sm outline-none focus:border-vermillion"
            />
            <input
              type="password"
              inputMode="numeric"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              placeholder="New PIN"
              className="w-32 rounded-lg border border-line-strong bg-ink-900 px-3 py-2 text-sm outline-none focus:border-vermillion"
            />
            <button
              onClick={changePin}
              className="rounded-lg bg-ink-700 px-4 py-2 text-sm font-medium hover:bg-ink-600"
            >
              Change
            </button>
            <button
              onClick={forgetPin}
              className="rounded-lg px-3 py-2 text-sm text-vermillion transition-colors hover:bg-vermillion/10"
            >
              Remove PIN
            </button>
          </div>
          {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
        </div>
      )}
    </section>
  );
}
