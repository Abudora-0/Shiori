"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, FileUp, Loader2, XCircle } from "lucide-react";
import { getSetting, setSetting } from "@/lib/db";
import { addDoujinByUrl, importNhentaiFavorites } from "@/lib/doujin";
import { importDoujinsFromBackup } from "@/lib/doujin-backup";

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

function BackupExtract() {
  const [state, setState] = useState<{ kind: "idle" | "busy" | "ok" | "err"; msg?: string }>({
    kind: "idle",
  });
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    setState({ kind: "busy", msg: `Scanning ${file.name}…` });
    try {
      const result = await importDoujinsFromBackup(await file.arrayBuffer(), (p) =>
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
