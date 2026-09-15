import { getSetting, setSetting } from "./db";

/**
 * Whether Hentai/Pornhwa show their real names instead of a vague "18+"
 * label. Persists across sessions (unlike the Annex PIN unlock, which resets
 * when the browser closes) since confirming your age once shouldn't need
 * repeating - actually opening that content still goes through the Annex
 * PIN separately, this only controls what the label says.
 */
const KEY = "matureLabelsRevealed";

export async function getMatureRevealed(): Promise<boolean> {
  return (await getSetting<boolean>(KEY)) ?? false;
}

export async function setMatureRevealed(value: boolean): Promise<void> {
  await setSetting(KEY, value);
}
