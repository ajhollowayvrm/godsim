/**
 * Optional AI narrator for the chronicle.
 *
 * IMPORTANT — static hosting (GitHub Pages) has no backend, so there is nowhere
 * safe to keep a secret key. Each visitor supplies THEIR OWN Anthropic API key,
 * which is stored only in their browser's localStorage and sent directly to the
 * Anthropic API. NEVER commit a key or bake one into the build.
 *
 * If no key is set, `narrate()` returns null and the UI falls back to the
 * deterministic templated event lines — the simulation itself never needs this.
 *
 * (For a public deployment you'd front this with your own serverless proxy that
 * holds the key; see /CLAUDE.md "Narrator".)
 */
import { CHRONICLER_SYSTEM } from "./prompt";

const MODEL = "claude-opus-4-8";
const KEY = "godsim.anthropicKey";

export function getKey(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
export function setKey(k: string): void {
  try {
    const v = (k || "").trim();
    if (v) localStorage.setItem(KEY, v);
    else localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

export async function narrate(
  era: number,
  lines: string[],
  context: string
): Promise<string | null> {
  const key = getKey();
  if (!key) return null; // caller falls back to templated lines

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      // enables direct browser-side calls to the Anthropic API
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      system: CHRONICLER_SYSTEM,
      messages: [
        {
          role: "user",
          content: `The tale so far: ${context}\n\nEvents of era ${era}:\n${lines.join("\n")}`,
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`narrator request failed: ${res.status}`);
  const data = await res.json();
  return (data.content || [])
    .filter((b: { type?: string }) => b.type === "text")
    .map((b: { text?: string }) => b.text || "")
    .join("\n")
    .trim();
}
