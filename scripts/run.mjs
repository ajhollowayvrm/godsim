#!/usr/bin/env node
// Headless runner — the deterministic verification loop.
//   npm run sim                       # seed 25, 16 eras
//   npm run sim -- 404 24             # seed 404, 24 eras
//   npm run sim -- 404 24 god-slayer  # with an adversary (none|rival-deity|god-slayer)
// Prints the chronicle era by era so you can trace cause -> consequence.
import { boot } from "../src/engine/index.ts";

const seed = Number(process.argv[2] ?? 25);
const eras = Number(process.argv[3] ?? 16);
const adversary = process.argv[4] ?? "none";

const g = boot(seed, { adversary });
console.log(`\n  ✦ godsim — seed ${seed}, ${eras} eras${adversary !== "none" ? `, adversary: ${adversary}` : ""}\n  ${"─".repeat(48)}`);

let t0 = performance.now();
for (let i = 0; i < eras; i++) {
  const before = g.view().log.length;
  g.advance();
  const v = g.view();
  const lines = v.log.slice(before);
  const evs = v.events.slice(before);
  console.log(`\n  ── Era ${v.era} · ${v.year} AE · ${v.mood} ──`);
  for (let k = 0; k < lines.length; k++) {
    const e = evs[k];
    const mark = e?.importance === 3 ? "★" : e?.importance === 2 ? "·" : " ";
    const why = e?.motive ? `  [${e.motive}]` : "";
    console.log(`   ${mark} ${lines[k].replace(/^Era \d+ \([^)]*\) — /, "")}${why}`);
  }
  const alive = v.houses.filter((h) => h.living);
  console.log(
    `   [pop ${v.stats.population}k · houses ${alive.length} · faiths ${v.faiths.length} · wars ${v.stats.activeWars}` +
    `${v.stats.plaguedRegions ? ` · plague ${v.stats.plaguedRegions}` : ""}` +
    `${v.empire ? ` · ${v.empire} Empire` : ""} · tech ${v.stats.techsKnown}]`
  );
}
const ms = performance.now() - t0;
console.log(`\n  ${eras} eras simulated in ${ms.toFixed(0)}ms (${(ms / eras).toFixed(1)}ms/era)\n`);
