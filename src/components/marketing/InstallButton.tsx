"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallButton({ label }: { label: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferred(null);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <span className="inline-flex items-center gap-2 rounded-lg border border-line-strong px-6 py-2.5 text-sm font-medium text-muted">
        Shiori is already installed
      </span>
    );
  }

  if (!deferred) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        await deferred.prompt();
        const choice = await deferred.userChoice;
        if (choice.outcome === "accepted") setDeferred(null);
      }}
      className="rounded-lg bg-vermillion px-6 py-2.5 text-sm font-semibold text-white shadow-[0_0_16px_rgba(230,57,70,0.4)] transition-colors hover:bg-vermillion-bright"
    >
      {label}
    </button>
  );
}
