"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileUp, Loader2, XCircle } from "lucide-react";
import { KanjiHeading } from "@/components/ui/KanjiHeading";
import { fetchAniListUserList } from "@/lib/anilist";
import { fetchMalUserList } from "@/lib/importers/mal";
import { fetchKitsuUserList } from "@/lib/importers/kitsu";
import { importMihonBackup } from "@/lib/importers/mihon";
import { mergeImport, type ImportResult, type MergeStrategy } from "@/lib/merge";
import { getMalClientId, getSetting, setSetting } from "@/lib/db";

type Phase = "idle" | "working" | "done" | "error";

interface RunState {
  phase: Phase;
  message: string;
  result?: ImportResult & { total: number };
}

const IDLE: RunState = { phase: "idle", message: "" };

export default function ImportPage() {
  const [strategy, setStrategy] = useState<MergeStrategy>("skip");

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8">
      <KanjiHeading
        kanji="取込"
        title="Import"
        subtitle="Pull your lists in from the trackers you already use. Your local edits, reviews and notes are never overwritten."
      />

      {/* Merge strategy */}
      <div className="mb-8 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-ink-850 px-4 py-3">
        <span className="text-sm font-medium text-muted">If an entry already exists:</span>
        {(
          [
            ["skip", "Keep my local version"],
            ["overwrite", "Update from tracker"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="strategy"
              checked={strategy === value}
              onChange={() => setStrategy(value)}
              className="accent-[var(--vermillion)]"
            />
            {label}
          </label>
        ))}
      </div>

      <div className="space-y-5 pb-16">
        <AniListCard strategy={strategy} />
        <MalCard strategy={strategy} />
        <KitsuCard strategy={strategy} />
        <MihonCard strategy={strategy} />
      </div>
    </div>
  );
}

/* ----- Shared bits ----- */

function StatusLine({ run }: { run: RunState }) {
  if (run.phase === "idle") return null;
  return (
    <div className="mt-4 flex items-start gap-2 rounded-lg border border-line bg-ink-900 px-3 py-2.5 text-sm">
      {run.phase === "working" && (
        <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin text-sakura" />
      )}
      {run.phase === "done" && (
        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-matcha" />
      )}
      {run.phase === "error" && (
        <XCircle size={16} className="mt-0.5 shrink-0 text-vermillion" />
      )}
      <div>
        <div className={run.phase === "error" ? "text-vermillion-bright" : ""}>
          {run.message}
        </div>
        {run.result && (
          <div className="mt-1 text-xs text-muted">
            {run.result.total} fetched · {run.result.added} added ·{" "}
            {run.result.updated} updated · {run.result.skipped} kept as-is -{" "}
            <Link href="/library" className="text-sakura underline">
              open library
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function CardShell({
  name,
  note,
  badge,
  badgeClass,
  children,
}: {
  name: string;
  note: string;
  badge: string;
  badgeClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-ink-850 p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-xl font-semibold">{name}</div>
          <div className="mt-0.5 text-xs text-faint">{note}</div>
        </div>
        <span className={`rounded px-2 py-1 text-[11px] font-semibold ${badgeClass}`}>
          {badge}
        </span>
      </div>
      {children}
    </div>
  );
}

function UsernameRow({
  value,
  onChange,
  onStart,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onStart: () => void;
  disabled: boolean;
  placeholder: string;
}) {
  return (
    <div className="mt-4 flex gap-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onStart()}
        placeholder={placeholder}
        className="flex-1 rounded-lg border border-line-strong bg-ink-900 px-3 py-2 text-sm outline-none focus:border-vermillion"
      />
      <button
        onClick={onStart}
        disabled={disabled || !value.trim()}
        className="rounded-lg bg-vermillion px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-vermillion-bright disabled:opacity-40"
      >
        Import
      </button>
    </div>
  );
}

/* ----- AniList ----- */

function AniListCard({ strategy }: { strategy: MergeStrategy }) {
  const [username, setUsername] = useState("");
  const [run, setRun] = useState<RunState>(IDLE);

  useEffect(() => {
    getSetting<string>("anilistUsername").then((v) => v && setUsername(v));
  }, []);

  async function start() {
    if (!username.trim()) return;
    setSetting("anilistUsername", username.trim());
    try {
      setRun({ phase: "working", message: "Fetching anime list…" });
      const anime = await fetchAniListUserList(username.trim(), "ANIME");
      setRun({
        phase: "working",
        message: `Anime: ${anime.length} entries. Fetching manga list…`,
      });
      const manga = await fetchAniListUserList(username.trim(), "MANGA");
      const all = [...anime, ...manga];
      setRun({ phase: "working", message: `Merging ${all.length} entries…` });
      const result = await mergeImport(all, strategy);
      setRun({
        phase: "done",
        message: "AniList import complete.",
        result: { ...result, total: all.length },
      });
    } catch (e) {
      setRun({ phase: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <CardShell
      name="AniList"
      note="Public profile - anime + manga, no login needed."
      badge="GraphQL API"
      badgeClass="bg-[#152238] text-[#3db4f2]"
    >
      <UsernameRow
        value={username}
        onChange={setUsername}
        onStart={start}
        disabled={run.phase === "working"}
        placeholder="AniList username"
      />
      <StatusLine run={run} />
    </CardShell>
  );
}

/* ----- MyAnimeList ----- */

function MalCard({ strategy }: { strategy: MergeStrategy }) {
  const [username, setUsername] = useState("");
  const [clientId, setClientId] = useState<string | undefined>();
  const [run, setRun] = useState<RunState>(IDLE);

  useEffect(() => {
    getSetting<string>("malUsername").then((v) => v && setUsername(v));
    getMalClientId().then(setClientId);
  }, []);

  async function start() {
    if (!username.trim() || !clientId) return;
    setSetting("malUsername", username.trim());
    try {
      setRun({ phase: "working", message: "Fetching MAL anime list…" });
      const anime = await fetchMalUserList(username.trim(), clientId, "ANIME", (p) =>
        setRun({
          phase: "working",
          message:
            p.phase === "fetching"
              ? `Anime list: ${p.count} fetched…`
              : "Matching anime against AniList…",
        })
      );
      setRun({ phase: "working", message: "Fetching MAL manga list…" });
      const manga = await fetchMalUserList(username.trim(), clientId, "MANGA", (p) =>
        setRun({
          phase: "working",
          message:
            p.phase === "fetching"
              ? `Manga list: ${p.count} fetched…`
              : "Matching manga against AniList…",
        })
      );
      const all = [...anime, ...manga];
      setRun({ phase: "working", message: `Merging ${all.length} entries…` });
      const result = await mergeImport(all, strategy);
      setRun({
        phase: "done",
        message: "MyAnimeList import complete.",
        result: { ...result, total: all.length },
      });
    } catch (e) {
      setRun({ phase: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <CardShell
      name="MyAnimeList"
      note="Public list via the official API - needs a free Client ID."
      badge="Official API"
      badgeClass="bg-[#2e51a2]/25 text-[#7da2e3]"
    >
      {clientId === "" ? (
        <div className="mt-4 rounded-lg border border-gold/30 bg-gold/5 px-3 py-2.5 text-sm text-muted">
          Add your MAL Client ID in{" "}
          <Link href="/settings" className="text-gold underline">
            Settings
          </Link>{" "}
          first - register one free at{" "}
          <span className="text-text">myanimelist.net/apiconfig</span> (choose
          &quot;other&quot; app type).
        </div>
      ) : (
        <UsernameRow
          value={username}
          onChange={setUsername}
          onStart={start}
          disabled={run.phase === "working"}
          placeholder="MAL username"
        />
      )}
      <StatusLine run={run} />
    </CardShell>
  );
}

/* ----- Kitsu ----- */

function KitsuCard({ strategy }: { strategy: MergeStrategy }) {
  const [username, setUsername] = useState("");
  const [run, setRun] = useState<RunState>(IDLE);

  useEffect(() => {
    getSetting<string>("kitsuUsername").then((v) => v && setUsername(v));
  }, []);

  async function start() {
    if (!username.trim()) return;
    setSetting("kitsuUsername", username.trim());
    try {
      setRun({ phase: "working", message: "Fetching Kitsu anime library…" });
      const anime = await fetchKitsuUserList(username.trim(), "anime", (p) =>
        setRun({
          phase: "working",
          message:
            p.phase === "fetching"
              ? `Anime: ${p.count} fetched…`
              : "Resolving anime against AniList…",
        })
      );
      setRun({ phase: "working", message: "Fetching Kitsu manga library…" });
      const manga = await fetchKitsuUserList(username.trim(), "manga", (p) =>
        setRun({
          phase: "working",
          message:
            p.phase === "fetching"
              ? `Manga: ${p.count} fetched…`
              : "Resolving manga against AniList…",
        })
      );
      const all = [...anime, ...manga];
      setRun({ phase: "working", message: `Merging ${all.length} entries…` });
      const result = await mergeImport(all, strategy);
      setRun({
        phase: "done",
        message: "Kitsu import complete.",
        result: { ...result, total: all.length },
      });
    } catch (e) {
      setRun({ phase: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <CardShell
      name="Kitsu"
      note="Public library via the Kitsu API - username or profile slug."
      badge="JSON:API"
      badgeClass="bg-[#3b1f2b] text-[#f75239]"
    >
      <UsernameRow
        value={username}
        onChange={setUsername}
        onStart={start}
        disabled={run.phase === "working"}
        placeholder="Kitsu username / slug"
      />
      <StatusLine run={run} />
    </CardShell>
  );
}

/* ----- Mihon backup ----- */

function MihonCard({ strategy }: { strategy: MergeStrategy }) {
  const [run, setRun] = useState<RunState>(IDLE);
  const [matchByTitle, setMatchByTitle] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    let stage = "parsing";
    try {
      setRun({ phase: "working", message: `Parsing ${file.name}…` });
      const buffer = await file.arrayBuffer();
      const items = await importMihonBackup(buffer, { matchByTitle }, (p) => {
        stage = p.phase;
        setRun({
          phase: "working",
          message:
            p.phase === "parsing"
              ? `Found ${p.count} library manga in backup…`
              : p.phase === "resolving"
                ? "Resolving tracked entries (AniList / MAL links)…"
                : `Matching untracked titles on AniList (${p.count}/${p.total})…`,
        });
      });
      setRun({ phase: "working", message: `Merging ${items.length} entries…` });
      const result = await mergeImport(items, strategy);
      setRun({
        phase: "done",
        message: "Mihon backup imported.",
        result: { ...result, total: items.length },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setRun({
        phase: "error",
        message:
          stage === "parsing"
            ? `Couldn't parse backup: ${msg}`
            : `Backup parsed fine, but AniList matching failed: ${msg}`,
      });
    }
  }

  return (
    <CardShell
      name="Mihon / Tachiyomi backup"
      note="Upload a .tachibk or .proto.gz backup - parsed entirely in your browser."
      badge=".tachibk"
      badgeClass="bg-[#2b2440] text-[#a996f2]"
    >
      <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={matchByTitle}
          onChange={(e) => setMatchByTitle(e.target.checked)}
          className="accent-[var(--vermillion)]"
        />
        Match untracked manga on AniList by title (slower on big libraries, better metadata)
      </label>
      <div className="mt-3">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={run.phase === "working"}
          className="flex items-center gap-2 rounded-lg bg-vermillion px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-vermillion-bright disabled:opacity-40"
        >
          <FileUp size={15} /> Choose backup file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".tachibk,.gz,.proto.gz,application/octet-stream"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </div>
      <StatusLine run={run} />
    </CardShell>
  );
}
