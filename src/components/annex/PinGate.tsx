"use client";

import { useEffect, useState } from "react";
import { KeyRound, Lock, ShieldCheck } from "lucide-react";
import { getPinHash, markUnlocked, setPin, verifyPin } from "@/lib/annex";
import { useUiStore } from "@/lib/store";

type GateState = "loading" | "setup" | "locked";

/**
 * Gates its children behind the Annex PIN. Reused both for the whole Annex
 * page and inline, in place, for Hentai/Pornhwa content elsewhere in the app
 * (Library tab, series detail, Discover tab, ...) - same PIN, same session
 * unlock, just applied to more surfaces than the doujin shelf alone.
 */
export function PinGate({
  children,
  title,
  subtitle,
  kanji = "別館",
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  /** Giant background watermark character - defaults to the Annex's own. */
  kanji?: string;
}) {
  const unlocked = useUiStore((s) => s.annexUnlocked);
  const [state, setState] = useState<GateState>("loading");

  useEffect(() => {
    if (unlocked) return;
    getPinHash().then((hash) => setState(!hash ? "setup" : "locked"));
  }, [unlocked]);

  if (unlocked) return <>{children}</>;
  if (state === "loading") return null;

  return (
    <div className="flex min-h-[70dvh] items-center justify-center px-4 py-10">
      <div className="relative w-full max-w-sm">
        <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-vermillion/15 opacity-60 blur-3xl" />
        <div className="seigaiha relative overflow-hidden rounded-2xl border border-line-strong bg-ink-850 p-8 shadow-2xl">
          <div className="ink-stroke absolute inset-x-0 top-0 h-[3px]" />
          <div className="pointer-events-none absolute inset-0 bg-ink-850/85" />
          <span className="kanji-watermark -right-6 -top-10 text-[10rem] leading-none">
            {kanji}
          </span>
          <div className="relative">
            {state === "setup" ? (
              <SetupForm title={title} subtitle={subtitle} />
            ) : (
              <UnlockForm title={title} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function GateIcon({ locked }: { locked: boolean }) {
  const Icon = locked ? Lock : KeyRound;
  return (
    <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
      <div className="absolute inset-0 animate-[pin-glow-pulse_2.6s_ease-in-out_infinite] rounded-full bg-vermillion/25" />
      <div className="absolute inset-1 rounded-full bg-vermillion/15 blur-md" />
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-vermillion/30 bg-ink-900/80 text-vermillion-bright shadow-[0_0_16px_rgba(230,57,70,0.35)]">
        <Icon size={24} />
      </div>
    </div>
  );
}

function SetupForm({ title, subtitle }: { title?: string; subtitle?: string }) {
  const setAnnexUnlocked = useUiStore((s) => s.setAnnexUnlocked);
  const [pin, setPinValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  async function submit() {
    if (pin.length < 4) {
      setError("Use at least 4 digits.");
      setAttempt((a) => a + 1);
      return;
    }
    if (pin !== confirm) {
      setError("PINs don't match.");
      setAttempt((a) => a + 1);
      return;
    }
    await setPin(pin);
    markUnlocked();
    setAnnexUnlocked(true);
  }

  return (
    <div className="text-center">
      <GateIcon locked={false} />
      <h1 className="mt-5 font-display text-2xl font-bold tracking-wide">
        {title ?? "Set up the Annex"}
      </h1>
      <p className="mx-auto mt-2.5 max-w-[24rem] text-xs leading-relaxed text-muted">
        {subtitle ??
          "This shelf hides behind a PIN and locks again when the browser closes."}
      </p>
      <div key={attempt} className={error ? "animate-[shake-x_0.4s_ease-in-out]" : ""}>
        <div className="mt-6 space-y-3">
          <PinInput value={pin} onChange={setPinValue} placeholder="Choose a PIN" autoFocus />
          <PinInput
            value={confirm}
            onChange={setConfirm}
            placeholder="Confirm PIN"
            onEnter={submit}
          />
        </div>
        {error && <p className="mt-3 text-xs text-vermillion-bright">{error}</p>}
      </div>
      <button
        onClick={submit}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-vermillion py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(230,57,70,0.45)] transition-colors hover:bg-vermillion-bright"
      >
        <KeyRound size={15} /> Create &amp; enter
      </button>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-faint">
        <ShieldCheck size={12} /> Local privacy screen, not encryption.
      </p>
    </div>
  );
}

function UnlockForm({ title }: { title?: string }) {
  const setAnnexUnlocked = useUiStore((s) => s.setAnnexUnlocked);
  const [pin, setPinValue] = useState("");
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  async function submit() {
    if (await verifyPin(pin)) {
      markUnlocked();
      setAnnexUnlocked(true);
    } else {
      setError(true);
      setPinValue("");
      setAttempt((a) => a + 1);
    }
  }

  return (
    <div className="text-center">
      <GateIcon locked />
      <h1 className="mt-5 font-display text-2xl font-bold tracking-wide">
        {title ?? "Annex"}
      </h1>
      <p className="mt-2.5 text-xs text-muted">Enter your PIN to open the shelf.</p>
      <div key={attempt} className={error ? "animate-[shake-x_0.4s_ease-in-out]" : ""}>
        <div className="mt-6">
          <PinInput
            value={pin}
            onChange={setPinValue}
            placeholder="PIN"
            onEnter={submit}
            autoFocus
          />
        </div>
        {error && <p className="mt-3 text-xs text-vermillion-bright">Wrong PIN - try again.</p>}
      </div>
      <button
        onClick={submit}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-vermillion py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(230,57,70,0.45)] transition-colors hover:bg-vermillion-bright"
      >
        <Lock size={15} /> Unlock
      </button>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-faint">
        <ShieldCheck size={12} /> Local privacy screen, not encryption.
      </p>
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
  const slots = Math.max(value.length, 4);
  return (
    <div>
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
        className="w-full rounded-xl border border-line-strong bg-ink-900 px-4 py-3.5 text-center font-display text-xl tracking-[0.6em] outline-none transition-colors focus:border-vermillion focus:shadow-[0_0_0_3px_rgba(230,57,70,0.15)]"
      />
      <div className="mt-2.5 flex justify-center gap-1.5">
        {Array.from({ length: slots }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full transition-colors ${
              i < value.length ? "bg-vermillion" : "bg-ink-700"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
