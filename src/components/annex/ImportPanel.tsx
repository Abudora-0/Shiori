"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, FileUp, Loader2, XCircle } from "lucide-react";
import { getSetting, setSetting } from "@/lib/db";
import { addDoujinByUrl, importNhentaiFavorites } from "@/lib/doujin";
import { DEFAULT_BACKUP_CONCURRENCY, importDoujinsFromBackup } from "@/lib/doujin-backup";
import { Select } from "@/components/ui/Select";

export function ImportPanel() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-xl border border-line bg-ink-850 px-4 py-3 transition-colors hover:border-line-strong"
      >
        <span className="font-display text-lg font-semibold">Import &amp; add</span>
        <ChevronDown
          size={18}
          className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <AddByUrl />
          <NhFavorites />
          <div className="lg:col-span-2">
            <BackupExtract />
          </div>
        </div>
      )}
    </div>
  );
}

function AddByUrl() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "busy" | "ok" | "err"; msg?: string }>({
    kind: "idle",
  });

  async function add() {
    if (!url.trim()) return;
    setState({ kind: "busy" });
    try {
      const cookie = await getSetting<string>("nhCookie");
      const { outcome, title } = await addDoujinByUrl(url, cookie);
      setState({ kind: "ok", msg: `${outcome === "added" ? "Added" : "Refreshed"}: ${title}` });
      setUrl("");
    } catch (e) {
      setState({ kind: "err", msg: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className="rounded-xl border border-line bg-ink-850 p-4">
      <div className="font-display text-base font-semibold">Add by link</div>
      <p className="mt-1 text-xs text-faint">
        Paste an nhentai / HentaiFox / HentaiEra / Hitomi gallery URL, or a bare
        nhentai id.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="https://nhentai.net/g/…"
          className="min-w-0 flex-1 rounded-lg border border-line-strong bg-ink-900 px-3 py-2 text-sm outline-none focus:border-vermillion"
        />
        <button
          onClick={add}
          disabled={state.kind === "busy" || !url.trim()}
          className="rounded-lg bg-vermillion px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-vermillion-bright disabled:opacity-40"
        >
          Add
        </button>
      </div>
      <Status state={state} />
    </div>
  );
}

function NhFavorites() {
  const [cookie, setCookie] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "busy" | "ok" | "err"; msg?: string }>({
    kind: "idle",
  });

  useEffect(() => {
    getSetting<string>("nhCookie").then((v) => v && setCookie(v));
  }, []);

  async function start() {
    if (!cookie.trim()) return;
    await setSetting("nhCookie", cookie.trim());
    setState({ kind: "busy", msg: "Reading favorites pages…" });
    try {
      const result = await importNhentaiFavorites(cookie.trim(), (p) =>
        setState({
          kind: "busy",
          msg:
            p.phase === "listing"
              ? `Found ${p.count} favorites so far…`
              : `Fetching details ${p.count}/${p.total}…`,
        })
      );
      setState({
        kind: "ok",
        msg: `Done - ${result.added} added, ${result.updated} refreshed${
          result.failed ? `, ${result.failed} failed` : ""
        }.`,
      });
    } catch (e) {
      setState({ kind: "err", msg: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className="rounded-xl border border-line bg-ink-850 p-4">
      <div className="font-display text-base font-semibold">nhentai favorites</div>
      <p className="mt-1 text-xs leading-relaxed text-faint">
        Needs your browser cookies: open nhentai logged in → DevTools → Network →
        copy the <span className="text-muted">Cookie</span> request header (must
        include <span className="text-muted">sessionid</span> and{" "}
        <span className="text-muted">cf_clearance</span>). Stored locally only.
      </p>
      <textarea
        value={cookie}
        onChange={(e) => setCookie(e.target.value)}
        rows={2}
        placeholder="csrftoken=…; sessionid=…; cf_clearance=…"
        className="mt-3 w-full resize-y rounded-lg border border-line-strong bg-ink-900 px-3 py-2 font-mono text-xs outline-none focus:border-vermillion"
      />
      <button
        onClick={start}
        disabled={state.kind === "busy" || !cookie.trim()}
        className="mt-2 rounded-lg bg-vermillion px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-vermillion-bright disabled:opacity-40"
      >
        Import favorites
      </button>
      <Status state={state} />
    </div>
  );
}

const CONCURRENCY_OPTIONS = [
  { value: "1", label: "1 - safest (serial, slowest)" },
  { value: "2", label: "2 - a bit faster" },
  { value: "3", label: "3 - faster, some risk" },
  { value: "5", label: "5 - fast, more sites may block" },
];

function BackupExtract() {
  const [state, setState] = useState<{ kind: "idle" | "busy" | "ok" | "err"; msg?: string }>({
    kind: "idle",
  });
  const [concurrency, setConcurrency] = useState(String(DEFAULT_BACKUP_CONCURRENCY));
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSetting<number>("doujinBackupConcurrency").then(
      (v) => v && setConcurrency(String(v))
    );
  }, []);

  async function onFile(file: File) {
    const n = Number(concurrency);
    await setSetting("doujinBackupConcurrency", n);
    setState({ kind: "busy", msg: `Scanning ${file.name}…` });
    try {
      const result = await importDoujinsFromBackup(
        await file.arrayBuffer(),
        { concurrency: n },
        (p) =>
          setState({
            kind: "busy",
            msg:
              p.phase === "scanning"
                ? `Found ${p.count} doujin entries among ${p.total} manga…`
                : `Fetching metadata ${p.count}/${p.total}: ${p.current ?? ""}`,
          })
      );
      setState({
        kind: "ok",
        msg:
          `Done - ${result.found} doujins found out of ${result.scanned} backup entries: ` +
          `${result.added} added, ${result.updated} refreshed` +
          (result.skipped ? `, ${result.skipped} already in your Annex (skipped)` : "") +
          (result.fallback ? `, ${result.fallback} imported with backup data only (site refused)` : "") +
          (result.failed ? `, ${result.failed} failed` : "") +
          ".",
      });
    } catch (e) {
      setState({ kind: "err", msg: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className="rounded-xl border border-line bg-ink-850 p-4">
      <div className="font-display text-base font-semibold">
        Tachiyomi / TachiyomiAZ / Mihon backup
      </div>
      <p className="mt-1 text-xs leading-relaxed text-faint">
        Upload a backup (.tachibk, .proto.gz, or legacy .json) and Shiori pulls out
        only the nhentai / HentaiFox / HentaiEra / Hitomi entries, fetching fresh
        tags, covers and artists from each site. Regular manga are ignored here -
        import those on the main Import page. For nhentai metadata, save your
        cookies in the card above first.{" "}
        <span className="text-gold">
          Legacy .json backups may include a few non-favorited (history-only)
          entries
        </span>{" "}
        - the newer .tachibk format filters those out precisely, the older JSON
        format doesn&apos;t reliably expose that flag, so extras just get pulled in
        for you to delete if unwanted.
      </p>

      <div className="mt-3">
        <label className="mb-1.5 block text-xs font-medium text-faint">
          Fetch speed
        </label>
        <Select
          value={concurrency}
          onChange={setConcurrency}
          options={CONCURRENCY_OPTIONS}
          className="w-full max-w-xs rounded-lg border border-line-strong bg-ink-900 px-3 py-2 text-sm"
          panelClassName="w-full max-w-xs"
        />
        <p className="mt-1.5 text-[11px] leading-relaxed text-faint">
          How many entries to fetch at once per site. Higher is faster, but sites
          like nhentai tend to Cloudflare-block bursts of requests - blocked
          entries still get added, just with backup-only data (no tags/artists)
          instead of fresh metadata. 1 is the only value confirmed not to trigger
          that on a large backup; anything higher is a real speed-for-completeness
          trade you&apos;re opting into.
        </p>
      </div>

      <button
        onClick={() => fileRef.current?.click()}
        disabled={state.kind === "busy"}
        className="mt-3 flex items-center gap-2 rounded-lg bg-vermillion px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-vermillion-bright disabled:opacity-40"
      >
        <FileUp size={14} /> Choose backup file
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".tachibk,.gz,.proto.gz,.json,application/octet-stream,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <Status state={state} />
    </div>
  );
}

function Status({ state }: { state: { kind: "idle" | "busy" | "ok" | "err"; msg?: string } }) {
  if (state.kind === "idle") return null;
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg border border-line bg-ink-900 px-3 py-2 text-xs">
      {state.kind === "busy" && (
        <Loader2 size={14} className="mt-0.5 shrink-0 animate-spin text-sakura" />
      )}
      {state.kind === "ok" && (
        <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-matcha" />
      )}
      {state.kind === "err" && (
        <XCircle size={14} className="mt-0.5 shrink-0 text-vermillion" />
      )}
      <span className={state.kind === "err" ? "text-vermillion-bright" : "text-muted"}>
        {state.msg}
      </span>
    </div>
  );
}
