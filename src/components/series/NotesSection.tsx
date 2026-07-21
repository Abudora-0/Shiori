"use client";

import { useState } from "react";
import { StickyNote, Trash2 } from "lucide-react";
import { db, logActivity } from "@/lib/db";
import { useNotes } from "@/lib/hooks";
import { formatDate } from "@/lib/format";

export function NotesSection({ seriesId }: { seriesId: number }) {
  const notes = useNotes(seriesId);
  const [draft, setDraft] = useState("");

  async function add() {
    if (!draft.trim()) return;
    await db.notes.add({ seriesId, body: draft.trim(), createdAt: Date.now() });
    await logActivity();
    setDraft("");
  }

  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-semibold">Notes</h2>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Quick note (where you stopped, thoughts, warnings…)"
          className="flex-1 rounded-lg border border-line-strong bg-ink-900 px-3 py-2 text-sm outline-none focus:border-vermillion"
        />
        <button
          onClick={add}
          disabled={!draft.trim()}
          className="rounded-lg bg-ink-700 px-4 py-2 text-sm font-medium hover:bg-ink-600 disabled:opacity-40"
        >
          Add
        </button>
      </div>
      {!!notes?.length && (
        <ul className="mt-3 space-y-2">
          {notes.map((n) => (
            <li
              key={n.id}
              className="group flex items-start gap-2.5 rounded-lg border border-line bg-ink-850 px-3 py-2.5 text-sm"
            >
              <StickyNote size={14} className="mt-0.5 shrink-0 text-gold" />
              <div className="flex-1">
                <div className="whitespace-pre-wrap text-text/90">{n.body}</div>
                <div className="mt-0.5 text-[10px] text-faint">
                  {formatDate(n.createdAt)}
                </div>
              </div>
              <button
                onClick={() => db.notes.delete(n.id!)}
                className="rounded p-1 text-faint opacity-0 transition-opacity hover:text-vermillion group-hover:opacity-100"
                aria-label="Delete note"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
