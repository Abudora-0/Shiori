"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { db, logActivity } from "@/lib/db";
import { useReviews } from "@/lib/hooks";
import { formatDate } from "@/lib/format";
import type { Review } from "@/lib/types";

export function ReviewSection({ seriesId }: { seriesId: number }) {
  const reviews = useReviews(seriesId);
  const [editing, setEditing] = useState<Review | "new" | null>(null);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold">Reviews</h2>
        <button
          onClick={() => setEditing("new")}
          className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-ink-800 px-3 py-1.5 text-sm text-muted transition-colors hover:border-vermillion/60 hover:text-text"
        >
          <Plus size={14} /> Write review
        </button>
      </div>

      {!reviews?.length ? (
        <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-faint">
          No reviews yet - what did you think of it?
        </p>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <article
              key={r.id}
              className="rounded-xl border border-line bg-ink-850 p-4"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-semibold">{r.title}</h3>
                  <div className="text-[11px] text-faint">
                    {formatDate(r.updatedAt)}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => setEditing(r)}
                    className="rounded-md p-1.5 text-faint hover:bg-ink-700 hover:text-text"
                    aria-label="Edit review"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm("Delete this review?")) await db.reviews.delete(r.id!);
                    }}
                    className="rounded-md p-1.5 text-faint hover:bg-vermillion/10 hover:text-vermillion"
                    aria-label="Delete review"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="prose-ink space-y-2 text-sm leading-relaxed text-text/85 [&_h1]:font-display [&_h2]:font-display [&_h1]:text-lg [&_h2]:text-base [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-vermillion [&_blockquote]:pl-3 [&_blockquote]:text-muted [&_code]:rounded [&_code]:bg-ink-700 [&_code]:px-1">
                <ReactMarkdown>{r.body}</ReactMarkdown>
              </div>
            </article>
          ))}
        </div>
      )}

      <ReviewEditor
        seriesId={seriesId}
        editing={editing}
        onClose={() => setEditing(null)}
      />
    </section>
  );
}

function ReviewEditor({
  seriesId,
  editing,
  onClose,
}: {
  seriesId: number;
  editing: Review | "new" | null;
  onClose: () => void;
}) {
  const isNew = editing === "new";
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState(false);
  const [loadedFor, setLoadedFor] = useState<Review | "new" | null>(null);

  // Sync form when target changes (render-time state sync, no effect needed)
  if (editing !== loadedFor) {
    setLoadedFor(editing);
    setPreview(false);
    if (editing && editing !== "new") {
      setTitle(editing.title);
      setBody(editing.body);
    } else {
      setTitle("");
      setBody("");
    }
  }

  async function save() {
    const now = Date.now();
    if (!title.trim() && !body.trim()) return;
    if (isNew) {
      await db.reviews.add({
        seriesId,
        title: title.trim() || "Untitled review",
        body,
        createdAt: now,
        updatedAt: now,
      });
    } else if (editing && typeof editing === "object") {
      await db.reviews.update(editing.id!, {
        title: title.trim() || "Untitled review",
        body,
        updatedAt: now,
      });
    }
    await logActivity();
    onClose();
  }

  return (
    <Modal
      open={editing !== null}
      onClose={onClose}
      title={isNew ? "Write a review" : "Edit review"}
      wide
    >
      <div className="space-y-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Review title"
          className="w-full rounded-lg border border-line-strong bg-ink-900 px-3 py-2 font-display text-base outline-none focus:border-vermillion"
        />
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-faint">Markdown supported</span>
            <button
              onClick={() => setPreview((p) => !p)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs ${
                preview ? "bg-ink-700 text-text" : "text-faint hover:text-text"
              }`}
            >
              <Eye size={13} /> Preview
            </button>
          </div>
          {preview ? (
            <div className="prose-ink min-h-48 space-y-2 rounded-lg border border-line bg-ink-900 px-4 py-3 text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5">
              <ReactMarkdown>{body || "*Nothing yet…*"}</ReactMarkdown>
            </div>
          ) : (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder="Your thoughts…"
              className="w-full resize-y rounded-lg border border-line-strong bg-ink-900 px-3 py-2 text-sm leading-relaxed outline-none focus:border-vermillion"
            />
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-muted hover:text-text">
            Cancel
          </button>
          <button
            onClick={save}
            className="rounded-lg bg-vermillion px-5 py-2 text-sm font-semibold text-white hover:bg-vermillion-bright"
          >
            Save review
          </button>
        </div>
      </div>
    </Modal>
  );
}
