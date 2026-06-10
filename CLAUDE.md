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

## Status: the deep rebuild is DONE

The agent-driven rebuild described below is implemented (see `ARCHITECTURE.md`).
`src/engine/legacy.mjs` remains in-tree as the historical baseline but is no
longer imported. When extending the sim, keep honoring the core principle:

**Dynamism comes from agents with interiority pursuing goals against material and
social constraints, producing causal chains and cross-system feedback.** Every
major event — a war, a schism, a murder, a coronation, a migration, a golden age,
a collapse — should be traceable to *who wanted what, what they had to work with,
and who stood in their way.* Depth = more legible causal layers, not more random
tables.

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

## Current architecture (implemented)

`boot(seed, options?)` in `src/engine/index.ts` builds a `World` (`types.ts`),
seeds the RNG, and composes the ordered pipeline of `System`s — each a pure
`run(world, rng)` that mutates the world and appends `ChronicleEvent`s **with a
causal trace** (`actors`, `motive`, `causedBy`, `importance`). `view()` derives
the serializable `EngineView`. Per-era order:

1. `economy` — regional output, treasuries, famine/plague/bounty shocks.
2. `demography` — masses grow/move along the map; the tracked cast is born/dies.
3. `agents` — **the heart**: every tracked adult scores candidate actions against
   their drives/wound/traits and emits intents (wars, marriages, schemes, quests,
   conversions, prophets) that later systems resolve the same era.
4. `politics` — marriages, succession by cultural law, plots, factions, the Crown,
   fallen houses replaced by rising stewards.
5. `war` — aims + fronts + truces; conquest/vassalage/independence/throne/holy/
   coalition resolutions; commanders die; grudges form.
6. `faith` — spatial spread, doctrine drift, schism, crusades, state sanction,
   creeds about the god that react to what the player actually does.
7. `artifacts` — custody, wills that bend bearers, quests, cults, reforging.
8. `culture` — value drift/borrowing/divergence; tech emergence + diffusion.
9. `memory` — grudge decay (writing slows it), prophecies that bend behavior,
   the Chosen's saga, era moods with hysteresis.
10. `adversary` — optional rival deity / god-slayer sagas.

`divine.ts` holds the player-god API (~25 powers + Vow + Incarnation), journaling
every act `{era, op, args}` — `rebuild(seed, options, journal, era)` deterministically
replays it, which is the save/rewind mechanism. `world.ts` holds shared helpers and
the perf-critical caches (living list, region map, per-phase might cache) — any new
death path MUST go through `kill()`/`departWorld()` so the living cache stays true.

## Workflow for changes

1. Keep the determinism + replay tests green at all times; add a focused test per
   new system or power.
2. **Verify headless first** with `npm run sim -- <seed> <eras> [adversary]` and
   read the causal chronicle before touching the UI.
3. The UI (`src/ui/`) reads only `EngineView` + `listLiving()` + `inspect(id)` —
   extend the view, don't reach into engine internals.
4. `node scripts/ui-smoke.mjs` (with `npm run preview` running) drives the real UI
   through setup → eras → inspectors → divine acts → rewind via Playwright.

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
