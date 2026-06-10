/**
 * Sweep seeds 1..20 for both adversary modes, 30 eras each, and report how the
 * sagas actually play out: when they start, how far they progress, how/whether
 * they resolve, and the longest silent gap between visible adversary events.
 *
 * Run: npx tsx scripts/playtest-adversary-sweep.mjs
 */
import { boot } from "../src/engine/index.ts";

function sweep(kind, seeds, eras) {
  const rows = [];
  for (const seed of seeds) {
    const g = boot(seed, { adversary: kind });
    let defeatedAt = null;
    for (let e = 1; e <= eras; e++) {
      g.advance();
      if (defeatedAt === null && g.view().deity.adversaryDefeated) defeatedAt = e;
    }
    const v = g.view();
    const advEvents = v.events.filter((x) => x.kind === "godslayer" || x.kind === "adversary");
    const erasWith = [...new Set(advEvents.map((x) => x.era))].sort((a, b) => a - b);
    let maxGap = 0;
    const marks = [0, ...erasWith, defeatedAt === null ? eras : defeatedAt];
    for (let i = 1; i < marks.length; i++) maxGap = Math.max(maxGap, marks[i] - marks[i - 1]);
    const text = advEvents.map((x) => x.text).join(" || ");
    const row = {
      seed,
      events: advEvents.length,
      firstEra: erasWith[0] ?? null,
      lastEra: erasWith[erasWith.length - 1] ?? null,
      defeatedAt,
      maxGap,
    };
    if (kind === "god-slayer") {
      const relicGrabs = (text.match(/relics in one fist|comes for .* and takes it/g) || []).length;
      row.relics = relicGrabs;
      row.sundered = /SUNDERS/.test(text);
      row.hunted = /rides out to end/.test(text);
      row.shrineBurns = (text.match(/burns the shrine/g) || []).length;
      // how did the slayer die? find the kill cause in the chronicle
      const dead = v.events.find((x) => /is dead, and the relics scatter/.test(x.text));
      if (dead) {
        const slayerName = dead.text.split(" is dead")[0];
        const death = v.events.filter((x) => x.era <= dead.era && x.text.includes(slayerName)
          && /dies of old age|slain|cut down|falls at|struck down|murdered|dies of/.test(x.text)).pop();
        row.death = death ? death.text.replace(/\s+/g, " ").slice(0, 90) : "(no death line found)";
      } else row.death = row.sundered ? "(sundered, lived)" : "(alive at era 30)";
    } else {
      row.curses = (text.match(/A shadow passes/g) || []).length;
      row.cult = /new whisper spreads/.test(text);
      row.corrupts = (text.match(/speaks to the keepers/g) || []).length;
      row.champions = (text.match(/has found a champion/g) || []).length;
      row.tempts = (text.match(/three promises|better offer/g) || []).length;
    }
    rows.push(row);
  }
  return rows;
}

const seeds = Array.from({ length: 20 }, (_, i) => i + 1);

console.log("── god-slayer, seeds 1-20, 30 eras ──");
for (const r of sweep("god-slayer", seeds, 30)) console.log(JSON.stringify(r));
console.log("\n── rival-deity, seeds 1-20, 30 eras ──");
for (const r of sweep("rival-deity", seeds, 30)) console.log(JSON.stringify(r));
