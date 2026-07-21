"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ListPlus, Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { db, logActivity } from "@/lib/db";

export function AddToListButton({ seriesId }: { seriesId: number }) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  // Smart lists compute their own membership — only manual lists are pickable
  const lists = useLiveQuery(
    async () =>
      (await db.lists.orderBy("updatedAt").reverse().toArray()).filter(
        (l) => !l.smart
      ),
    []
  );

  const memberCount = lists?.filter((l) => l.seriesIds.includes(seriesId)).length ?? 0;

  async function toggle(listId: number) {
    const list = await db.lists.get(listId);
    if (!list) return;
    const inList = list.seriesIds.includes(seriesId);
    await db.lists.update(listId, {
      seriesIds: inList
        ? list.seriesIds.filter((s) => s !== seriesId)
        : [...list.seriesIds, seriesId],
      updatedAt: Date.now(),
    });
    if (!inList) await logActivity();
  }

  async function createAndAdd() {
    const name = newName.trim();
    if (!name) return;
    const now = Date.now();
    await db.lists.add({
      name,
      seriesIds: [seriesId],
      createdAt: now,
      updatedAt: now,
    });
    await logActivity();
    setNewName("");
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-2 rounded-lg border border-line-strong px-3 py-2.5 text-sm transition-colors hover:border-vermillion/60 ${
          memberCount > 0 ? "text-sakura" : "text-faint hover:text-text"
        }`}
        title="Add to list"
      >
        <ListPlus size={16} />
        {memberCount > 0 && <span className="text-xs">{memberCount}</span>}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add to list">
        <div className="space-y-3">
          {!lists?.length && (
            <p className="text-sm text-muted">No lists yet — create your first below.</p>
          )}
          {lists?.map((list) => {
            const checked = list.seriesIds.includes(seriesId);
            return (
              <label
                key={list.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-ink-900 px-3 py-2.5 transition-colors hover:border-line-strong"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(list.id!)}
                  className="accent-[var(--vermillion)]"
                />
                <span className="flex-1 truncate text-sm">{list.name}</span>
                <span className="text-xs text-faint">{list.seriesIds.length}</span>
              </label>
            );
          })}
          <div className="flex gap-2 border-t border-line pt-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createAndAdd()}
              placeholder="New list…"
              className="flex-1 rounded-lg border border-line-strong bg-ink-900 px-3 py-2 text-sm outline-none focus:border-vermillion"
            />
            <button
              onClick={createAndAdd}
              disabled={!newName.trim()}
              className="flex items-center gap-1 rounded-lg bg-vermillion px-3 py-2 text-sm font-semibold text-white hover:bg-vermillion-bright disabled:opacity-40"
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
