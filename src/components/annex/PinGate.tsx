"use client";

import { useEffect, useState } from "react";
import { KeyRound, Lock } from "lucide-react";
import { getPinHash, isUnlocked, markUnlocked, setPin, verifyPin } from "@/lib/annex";

type GateState = "loading" | "setup" | "locked" | "open";

export function PinGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GateState>("loading");

  useEffect(() => {
    getPinHash().then((hash) =>
      setState(!hash ? "setup" : isUnlocked() ? "open" : "locked")
    );
  }, []);

  if (state === "loading") return null;
  if (state === "open") return <>{children}</>;

  return (
    <div className="flex min-h-[70dvh] items-center justify-center px-4">
      <div className="seigaiha relative w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-ink-850 p-8">
        <div className="pointer-events-none absolute inset-0 bg-ink-850/95" />
        <div className="relative">
          {state === "setup" ? (
            <SetupForm onDone={() => setState("open")} />
          ) : (
            <UnlockForm onDone={() => setState("open")} />
          )}
        </div>
      </div>
    </div>
  );
}

function SetupForm({ onDone }: { onDone: () => void }) {
  const [pin, setPinValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    if (pin.length < 4) return setError("Use at least 4 digits.");
    if (pin !== confirm) return setError("PINs don't match.");
    await setPin(pin);
    markUnlocked();
    onDone();
  }

  return (
    <div className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-vermillion/15 text-vermillion-bright">
        <KeyRound size={22} />
      </div>
      <h1 className="mt-4 font-display text-xl font-bold">Set up the Annex</h1>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        Your doujin shelf hides behind a PIN. It locks again when the browser
        closes. (Local privacy screen, not encryption.)
      </p>
      <div className="mt-5 space-y-3">
        <PinInput value={pin} onChange={setPinValue} placeholder="Choose a PIN" autoFocus />
        <PinInput value={confirm} onChange={setConfirm} placeholder="Confirm PIN" onEnter={submit} />
      </div>
      {error && <p className="mt-3 text-xs text-vermillion-bright">{error}</p>}
      <button
        onClick={submit}
        className="mt-5 w-full rounded-lg bg-vermillion py-2.5 text-sm font-semibold text-white shadow-[0_0_16px_rgba(230,57,70,0.4)] transition-colors hover:bg-vermillion-bright"
      >
        Create &amp; enter
      </button>
    </div>
  );
}

function UnlockForm({ onDone }: { onDone: () => void }) {
  const [pin, setPinValue] = useState("");
  const [error, setError] = useState(false);

  async function submit() {
    if (await verifyPin(pin)) {
      markUnlocked();
      onDone();
    } else {
      setError(true);
      setPinValue("");
    }
  }

  return (
    <div className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-vermillion/15 text-vermillion-bright">
        <Lock size={22} />
      </div>
      <h1 className="mt-4 font-display text-xl font-bold">Annex</h1>
      <p className="mt-2 text-xs text-muted">Enter your PIN to open the shelf.</p>
      <div className="mt-5">
        <PinInput value={pin} onChange={setPinValue} placeholder="PIN" onEnter={submit} autoFocus />
      </div>
      {error && <p className="mt-3 text-xs text-vermillion-bright">Wrong PIN.</p>}
      <button
        onClick={submit}
        className="mt-5 w-full rounded-lg bg-vermillion py-2.5 text-sm font-semibold text-white shadow-[0_0_16px_rgba(230,57,70,0.4)] transition-colors hover:bg-vermillion-bright"
      >
        Unlock
      </button>
    </div>
  );
}

function PinInput({
  value,
  onChange,
  placeholder,
  onEnter,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onEnter?: () => void;
  autoFocus?: boolean;
}) {
  return (
    <input
      type="password"
      inputMode="numeric"
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 12))}
      onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
      placeholder={placeholder}
      autoComplete="off"
      data-lpignore="true"
      data-1p-ignore="true"
      data-bwignore="true"
      className="w-full rounded-lg border border-line-strong bg-ink-900 px-3 py-2.5 text-center font-display text-lg tracking-[0.5em] outline-none focus:border-vermillion"
    />
  );
}
