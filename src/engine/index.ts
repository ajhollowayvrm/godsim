/**
 * godsim engine — public surface of the deep rebuild.
 *
 *   boot(seed, options?) -> Engine     Engine.view() -> EngineView
 *
 * One seeded PRNG drives an ordered pipeline of deterministic Systems. The UI
 * and tests depend only on this contract. legacy.mjs remains in-tree as the
 * reference baseline but is no longer imported.
 */
import { mulberry32 } from "./rng";
import type { BootOptions, Engine, System, World } from "./types";
import { bumpPhase, clearIntents, pruneRels } from "./world";
import { ADVERSARY_NAMES } from "./names";
import { generateWorld } from "./systems/worldgen";
import { economy } from "./systems/economy";
import { demography } from "./systems/demography";
import { agents } from "./systems/agents";
import { politics } from "./systems/politics";
import { war } from "./systems/war";
import { faith } from "./systems/faith";
import { artifacts } from "./systems/artifacts";
import { culture } from "./systems/culture";
import { memory } from "./systems/memory";
import { adversary } from "./systems/adversary";
import { makeDivine, VOWS } from "./divine";
import { buildView, inspectPerson, listLivingView } from "./view";

export { VOWS };
export * from "./types";

const PIPELINE: System[] = [
  economy,     // material conditions first: output, shocks, prosperity
  demography,  // the masses grow and move; the cast is born and dies
  agents,      // THE HEART: everyone tracked decides what they want this era
  politics,    // marriages, succession, plots, factions, the Crown
  war,         // declared wants become campaigns over the map
  faith,       // creeds spread, fracture, crusade, sanctify
  artifacts,   // relics move, compel, gather legend and cults
  culture,     // values drift; innovation emerges and diffuses
  memory,      // grudges, prophecies, the Chosen, the mood of the age
  adversary,   // the rival deity / god-slayer, if chosen at boot
];

export function boot(seed: number, options: BootOptions = {}): Engine {
  const rng = mulberry32(seed);

  const w: World = {
    seed, options,
    era: 0, year: 1000,
    deity: {
      vow: null, incarnationId: null, incarnationBackstory: null,
      adversary: options.adversary ?? "none",
      marks: [], actsThisEra: 0, lastActEra: -1, humbled: false,
    },
    adversary: {
      name: ADVERSARY_NAMES[seed % ADVERSARY_NAMES.length],
      kind: options.adversary ?? "none",
      championId: null, cultName: null, power: 0, defeated: false,
    },
    cultures: [], houses: [], regions: [], people: {},
    rels: [], standing: {}, truces: {},
    artifacts: [], faiths: [], offices: {}, plots: [], wars: [], prophecies: [],
    crown: { houseId: null, holderId: null, legitimacy: 0.5, stateFaithId: null, since: 0 },
    chosen: null, empireHouseId: null, grace: 0,
    mood: { label: "the Founding", since: 0 },
    chronicle: [],
    intents: { wars: [], proposals: [], quests: [], conversions: [], prophets: [], builds: [], endowments: [] },
    journal: [],
    seq: {},
    perf: { lastEraMs: 0 },
  };

  generateWorld(w, rng);
  if (options.vow && options.vow !== "none") {
    w.deity.vow = { kind: options.vow, text: VOWS[options.vow].text, broken: false };
  }

  const divine = makeDivine(w, rng);

  function advance(): void {
    w.era++; w.year = 1000 + w.era * 25;
    w.deity.actsThisEra = 0;
    clearIntents(w);
    for (const system of PIPELINE) { bumpPhase(w); system.run(w, rng); }
    bumpPhase(w);
    pruneRels(w);
  }

  const engine: Engine = {
    advance,
    view: () => buildView(w),
    listLiving: () => listLivingView(w),
    inspect: (pid: string) => inspectPerson(w, pid),
    journal: () => w.journal.slice(),
    options: () => ({ ...options }),
    ...divine,
  } as unknown as Engine;
  return engine;
}

/**
 * Deterministic time travel: boot the same seed/options and replay the divine
 * journal up to (and including) acts made at `targetEra`. Because the engine is
 * deterministic, the result is the exact same world at that era.
 */
export function rebuild(
  seed: number, options: BootOptions,
  journal: { era: number; op: string; args: unknown[] }[],
  targetEra: number,
): Engine {
  const g = boot(seed, options) as Engine & Record<string, (...a: unknown[]) => unknown>;
  const apply = (era: number) => {
    for (const j of journal) {
      if (j.era !== era) continue;
      const fn = g[j.op];
      if (typeof fn === "function") fn(...j.args);
    }
  };
  apply(0);
  for (let e = 1; e <= targetEra; e++) { g.advance(); apply(e); }
  return g;
}
