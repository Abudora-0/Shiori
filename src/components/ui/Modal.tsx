"use client";

import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useEffect } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm md:items-center md:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={`seigaiha relative max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-line-strong bg-ink-850 [background-blend-mode:overlay] [background-color:var(--ink-850)] shadow-2xl md:rounded-2xl ${
              wide ? "md:max-w-3xl" : "md:max-w-lg"
            }`}
            style={{ backgroundSize: "80px 40px" }}
            initial={{ y: 48, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 32, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-0 rounded-t-2xl bg-ink-850/95 md:rounded-2xl" />
            <div className="relative">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <div className="font-display text-lg font-semibold">{title}</div>
                <button
                  onClick={onClose}
                  className="rounded-md p-1.5 text-muted transition-colors hover:bg-ink-700 hover:text-text"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="px-5 py-5">{children}</div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
