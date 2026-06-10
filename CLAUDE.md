# CLAUDE.md — godsim

Operational brief for Claude Code working in this repo. Read this fully before
making changes. The full design rationale lives in `docs/REBUILD_PROMPT.md`; the
target data model is sketched in `src/engine/types.ts` and
`docs/data-model.reference.ts`.

## What this is

A deterministic, seeded **god-simulation** in the spirit of WorldBox: civilizations,
dynasties, religions, wars, and legends unfold on their own across centuries. The
player is a deity who watches and occasionally intervenes — the world runs with or
without them. North star: **as organic as possible**; history *emerges*, and the
same seed always replays the same history.

## Your mission

The current simulation works but feels **barebones and undynamic** — its phases
fire as independent probability rolls rather than as the consequences of people
pursuing goals. Make it **deep and dynamic**.

**The core principle:** dynamism comes from **agents with interiority pursuing goals
against material and social constraints, producing causal chains and cross-system
feedback.** Every major event — a war, a schism, a murder, a coronation, a
migration, a golden age, a collapse — should be traceable to *who wanted what, what
they had to work with, and who stood in their way.* Depth = more legible causal
layers, not more random tables.

## Hard invariants — do NOT break these

1. **Determinism.** One seeded PRNG (`src/engine/rng.ts`, mulberry32). Identical
   seed ⇒ identical history, forever. No `Math.random`, no `Date`/clock, no network
   inside the engine. `tests/determinism.test.ts` must stay green at all times.
2. **Engine owns truth; AI owns voice.** The LLM narrator (`src/narrator/`) must
   never compute outcomes or sit in the causal loop. Every state transition is pure
   code. The narrator only renders already-decided events into prose. Do **not**
   "make it dynamic" by letting a model run the sim.
3. **Stable surface.** Keep `boot(seed): Engine` and `Engine.view(): EngineView`
   (`src/engine/types.ts`) backward-compatible so the UI and tests keep working as
   you rebuild the internals. Extend `EngineView`; don't reshape what exists.
4. **The player is an infinite god** bound only by a self-imposed, **breakable**
   per-run **Vow**. Faith is *descriptive* and must never gate divine power
   (apostasy never weakens the god). Preserve the existing player levers: Divine
   Hand interventions, naming a **Chosen**, bestowing/reclaiming **artifacts**,
   blessings — and build toward optional **Incarnation** (descend into a mortal,
   authored backstory, full memory, can be humbled but not killed) and run-start
   **adversary** modes (none / rival deity / mortal god-slayer).
5. **Performance + level-of-detail.** Must run smoothly in-browser for a
   multi-century saga. Fully simulate notable figures; aggregate the masses; promote
   individuals to full detail when they become significant. Target well under a
   second of compute per era for a 25–30 era run, with tracked-agent counts bounded.
6. **Legibility.** A bigger sim must not produce an unreadable wall. Surface the
   *significant* (notable agents, turning points, causal threads); make detail
   drillable, not dumped. Keep the illuminated-chronicle aesthetic and the per-era
   facts/stats ledger in the UI.

## Current state (the baseline you're inheriting)

- `src/engine/legacy.mjs` — the **working** deterministic engine. One seeded PRNG;
  per-era phases roughly: demography → diplomacy → artifacts → politics → war →
  faith → crown → intrigue → divine hand → chosen. Procedural: ~12 houses across 4
  cultures, generated names, one uniquely-named relic per realm. It already does
  emergent religions (schism/crusade/conversion/merger), succession/usurpation,
  conquest/vassalage/rebellion/empire, and intrigue (assassination/coups) — but all
  shallowly. **This is what you will progressively replace.**
- `src/engine/index.ts` — the public surface; today it re-exports `legacy.mjs`.
- `src/ui/GodSim.jsx` — the chronicle UI (kept as JS; not type-checked by the build).
- `src/narrator/` — the optional AI voice.

## Target architecture

Replace `legacy.mjs` with a composed **tick pipeline** in `src/engine/index.ts`:
`boot(seed)` builds a `World` (`types.ts`) and seeds the RNG; `advance()` runs the
ordered list of `System`s (`src/engine/systems/*`), each a pure
`run(world, rng)` that mutates the world and appends `ChronicleEvent`s **with a
causal trace** (`actors`, `motive`, `causedBy`). `view()` derives the serializable
`EngineView` from the `World`.

Suggested build order (also in `src/engine/systems/README.md`):

1. **world** — procedural generation: cultures, **regions (a map with adjacency)**,
   houses, founding families, artifacts.
2. **agents** — the decision loop: each tracked person evaluates available actions
   (scheme, marry, build, war, convert, flee, betray, endow) and picks the one best
   serving their `drives`/`wound`/`traits` given their situation. *This is the heart
   of dynamism.* Decisions are deterministic functions of state + traits + RNG.
   Realize the `Person` interiority and `Relationship` graph already typed in
   `types.ts` (they exist in the model but the legacy engine ignores them).
3. **economy** — regional output of food/wealth/manpower; prosperity & scarcity
   drive ambition, migration, revolt; famine/plague as shocks. Wars cost and are
   fought over something.
4. **demography** — births/deaths; migration along the region graph.
5. **politics** — succession, legitimacy, marriages → alliances, factions.
6. **war** — war aims from economy + grudges; campaigns over geography
   (adjacency/fronts); conquest, vassalage, rebellion.
7. **faith** — emergent religions coupled to material conditions, geography (sacred
   sites), and culture; doctrine mutation; reform vs orthodoxy; spatial spread.
8. **artifacts** — multiple relics with distinct powers/wills/wants; custody, cults,
   lost/reforged; compounding, intersecting legends.
9. **culture** — value drift, borrowing, divergence; tech emergence + diffusion
   along trade/conquest, reshaping what's possible.
10. **memory** — inherited grudges, prophecies that constrain later choices,
    legacies shaping descendants' standing → recurring motifs that fall out of
    mechanics, not authoring.

**Feedback is the goal:** wire systems so they push on each other (economy ↔ war ↔
legitimacy ↔ faith ↔ culture ↔ demography) with thresholds/tipping points — golden
ages, dark ages, collapses, recoveries arising from the loops themselves.

## Workflow

1. **First, write a short architecture plan** (an `ARCHITECTURE.md` or a PR
   description): the revised `World`/`Person` model, the agent decision loop, the
   phase order and the specific feedback couplings, the LOD strategy, and how each
   system stays deterministic. Flag where emergence might run away or stall. Don't
   write the full implementation before the plan.
2. **Implement incrementally**, one system at a time. After each, **verify headless**
   with `npm run sim -- <seed>` and read the causal chronicle; keep the determinism
   test green; add a focused test per system.
3. Integrate into the UI only once a system is verified headless. Update the per-era
   ledger to surface the new state.

## Commands

```bash
npm install          # install deps
npm run dev          # local dev server (HMR)
npm run sim -- 25 18 # headless: run seed 25 for 18 eras, print the chronicle
npm test             # run the suite (determinism + smoke); MUST stay green
npm run typecheck    # tsc --noEmit (UI .jsx is intentionally not type-checked)
npm run build        # production build to dist/ (what GitHub Pages deploys)
npm run preview      # serve the production build locally
```

## Deployment (GitHub Pages)

Static hosting via `.github/workflows/deploy.yml` (build with Actions → deploy to
Pages). One-time: repo **Settings → Pages → Source: "GitHub Actions"**. Push to
`main` to deploy.

- `vite.config.ts` sets `base: "./"` so assets resolve under the
  `https://<user>.github.io/<repo>/` subpath without hardcoding the repo name. If
  you add client-side routing later, switch `base` to `"/<repo>/"` and add a
  `404.html` SPA fallback.
- `public/.nojekyll` keeps Pages from running Jekyll over the build.

## Narrator

GitHub Pages has **no backend**, so there is nowhere safe for a secret key. The
narrator (`src/narrator/narrator.ts`) uses a **user-supplied** Anthropic API key
stored only in the visitor's `localStorage`, sent directly to the API with the
browser-access header. **Never commit a key or bake one into the build.** With no
key, narration is skipped and the deterministic templated lines show instead — the
simulation never depends on it. For a real public deployment, front this with your
own serverless proxy that holds the key, and have the client call the proxy.

## Definition of done

A 25–30 era run yields a chronicle where you can point at any war, schism,
assassination, golden age, or collapse and trace it back through agent goals and
material conditions — and where re-running the same seed reproduces it exactly,
while a fresh seed yields a genuinely different yet equally coherent world.
