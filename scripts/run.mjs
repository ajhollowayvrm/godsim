#!/usr/bin/env node
// Headless runner — the deterministic verification loop.
//   npm run sim            # seed 25, 16 eras
//   npm run sim -- 404 24  # seed 404, 24 eras
// Prints the chronicle era by era so you can trace cause -> consequence.
import { boot } from "../src/engine/legacy.mjs";

const seed = Number(process.argv[2] ?? 25);
const eras = Number(process.argv[3] ?? 16);

const g = boot(seed);
console.log(`\n  ✦ godsim — seed ${seed}, ${eras} eras\n  ${"─".repeat(40)}`);

for (let i = 0; i < eras; i++) {
  const before = g.view().log.length;
  g.advance();
  const v = g.view();
  const lines = v.log.slice(before);
  console.log(`\n  ── Era ${v.era} · ${v.year} AE ──`);
  for (const l of lines) console.log("   " + l);
  const alive = v.houses.filter((h) => h.living);
  const souls = alive.reduce((s, h) => s + h.living, 0);
  console.log(
    `   [souls ${souls} · houses ${alive.length} · relic "${v.sword?.name ?? "—"}"${
      v.empire ? ` · ${v.empire} Empire` : ""
    }]`
  );
}
console.log("");
