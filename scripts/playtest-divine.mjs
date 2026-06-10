/**
 * Playtest harness: boot seed 5, advance 3 eras, exercise EVERY divine method
 * with valid ids from view()/listLiving(), advance 5 more eras, and verify
 * nothing throws, every act journals, and the chronicle records divine events.
 *
 * Run: npx tsx scripts/playtest-divine.mjs
 */
import { boot } from "../src/engine/index.ts";

const g = boot(5);
const results = [];
const eraErrors = [];

function snap() {
  return { events: g.view().events.length, journal: g.journal().length };
}
function call(name, ...args) {
  const before = snap();
  let threw = null;
  try {
    const fn = g[name];
    if (typeof fn !== "function") threw = `NOT A FUNCTION (typeof ${typeof fn})`;
    else fn(...args);
  } catch (e) {
    threw = (e && e.stack) ? String(e.stack).split("\n").slice(0, 4).join(" | ") : String(e);
  }
  const after = snap();
  results.push({
    name, args,
    threw,
    journaled: after.journal - before.journal,
    events: after.events - before.events,
  });
}
function advanceEras(n, label) {
  for (let i = 0; i < n; i++) {
    try { g.advance(); } catch (e) {
      eraErrors.push({ phase: label, era: g.view().era, error: String(e && e.stack || e).split("\n").slice(0, 6).join(" | ") });
      break;
    }
  }
}

/* ── warm up: 3 eras ── */
advanceEras(3, "warmup");

/* ── gather valid ids ── */
const v = g.view();
const living = g.listLiving();              // sorted by renown desc
const A = living[0];                        // hero: chosen, sword, bless, whisper
const B = living.find((p) => p.id !== A.id);
const adults = living.filter((p) => p.age >= 16 && !p.spouse && p.id !== A.id && p.id !== B.id);
const C = adults[0];
const D = adults.find((p) => p && C && p.houseId !== C.houseId) ?? adults[1];
const E = [...living].reverse().find((p) => ![A, B, C, D].some((x) => x && x.id === p.id)); // smite victim
const regions = v.regions.map((r) => r.id);
const housesUp = v.houses.filter((h) => !h.fallen).map((h) => h.id);

console.log(`era=${v.era} living=${living.length} regions=${regions.length} houses=${housesUp.length} faiths=${v.faiths.length} artifacts=${v.artifacts.length}`);
console.log(`A=${A?.name}(${A?.id}) B=${B?.name} C=${C?.name} D=${D?.name} E=${E?.name}`);

/* ── exercise every divine method ── */
call("setVow", "no-blood");                       // vow first; blightLand below must BREAK it
call("nameChosen", A.id);
call("bestowSword", A.id);
call("reclaimSword");
call("bless", A.id);
call("whisper", A.id, "legacy");
call("curse", B.id);
call("ordainMarriage", C.id, D.id);
call("blessLand", regions[0]);
call("blightLand", regions[1]);                   // expect VOW BROKEN event (+2 events)
call("sendPlague", regions[2]);
call("sendBounty", regions[3]);
call("kindleFaith", "god");
const faithId = g.view().faiths.at(-1)?.id;       // the faith just kindled
call("hallow", regions[4], faithId);
call("emboldenFaith", faithId);
call("sparkSchism", faithId);
call("witherFaith", faithId);
call("inciteWar", housesUp[0], housesUp[1]);
call("imposePeace", housesUp[0], housesUp[1]);
call("favorHouse", housesUp[2]);
call("forgeArtifact");
const forgedId = g.view().artifacts.at(-1)?.id;   // the artifact just forged
call("bestowArtifact", forgedId, A.id);
call("reclaimArtifact", forgedId);
call("speakProphecy", B.id);
call("smite", E.id);
call("incarnate", housesUp[0], "Walker", "A stranger with road-dust that smells of rain.");
const incarnation = g.view().deity.incarnation;
call("ascend");

/* ── 5 more eras ── */
advanceEras(5, "after-divine");

/* ── report ── */
const fin = g.view();
const divineEvents = fin.events.filter((e) => e.divine);
const journalOps = g.journal().map((j) => j.op);

console.log("\n── per-method results (threw / journaled / chronicle events appended) ──");
for (const r of results) {
  const flag = r.threw ? "THREW" : r.journaled === 0 ? "NO-OP (not journaled)" : "ok";
  console.log(`${flag.padEnd(22)} ${r.name.padEnd(16)} journal+${r.journaled} events+${r.events}${r.threw ? "  :: " + r.threw : ""}`);
}
console.log("\n── era advance errors ──");
console.log(eraErrors.length ? JSON.stringify(eraErrors, null, 2) : "none — all 8 eras advanced cleanly");
console.log("\n── world state checks ──");
console.log(`final era            : ${fin.era} (expect 8)`);
console.log(`vow                  : ${JSON.stringify(fin.deity.vow)}`);
console.log(`chosen               : ${JSON.stringify(fin.chosen)}`);
console.log(`incarnation (mid-run): ${incarnation ? incarnation.name + " of " + incarnation.house : "NULL — incarnate failed"}`);
console.log(`incarnation (final)  : ${JSON.stringify(fin.deity.incarnation)} (expect null after ascend)`);
console.log(`divine-flagged events: ${divineEvents.length}`);
console.log(`journal ops (${journalOps.length}): ${journalOps.join(", ")}`);
console.log(`faiths at end        : ${fin.faiths.map((f) => f.name + "/" + f.focus + "/" + f.creed).join(" ; ")}`);
console.log(`artifacts at end     : ${fin.artifacts.map((a) => a.name + ":" + a.state).join(" ; ")}`);
const threw = results.filter((r) => r.threw);
const noops = results.filter((r) => !r.threw && r.journaled === 0);
console.log(`\nSUMMARY: ${results.length} calls, ${threw.length} threw, ${noops.length} silent no-ops, ${eraErrors.length} era errors`);
