import { getSetting, setSetting } from "./db";

/**
 * Annex (別館) gate - a local PIN, not real security: it keeps the doujin
 * shelf out of casual sight on a personal machine. The PIN is stored as a
 * SHA-256 hash in IndexedDB; unlock state lives in sessionStorage so it
 * resets when the browser closes.
 */

const PIN_KEY = "annexPinHash";
const UNLOCK_KEY = "shiori-annex-unlocked";

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`shiori:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getPinHash(): Promise<string | undefined> {
  return getSetting<string>(PIN_KEY);
}

export async function setPin(pin: string): Promise<void> {
  await setSetting(PIN_KEY, await hashPin(pin));
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = await getPinHash();
  if (!stored) return false;
  return (await hashPin(pin)) === stored;
}

export function isUnlocked(): boolean {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

export function markUnlocked(): void {
  try {
    sessionStorage.setItem(UNLOCK_KEY, "1");
  } catch {
    /* private mode - unlock just won't persist across navigations */
  }
}

export function lockAnnex(): void {
  try {
    sessionStorage.removeItem(UNLOCK_KEY);
  } catch {
    /* ignore */
  }
}
