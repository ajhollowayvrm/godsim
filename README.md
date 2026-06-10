# godsim

A deterministic, seeded **god-simulation** in the spirit of WorldBox. A living
world — agents with drives and wounds, a hex-map economy, dynasties, emergent
religions, relic sagas, prophecies, plagues, golden ages and collapses — unfolds
on its own across centuries; you watch as a deity and intervene any way you like.
Same seed → same history, every time, **including your own divine acts** (which is
also how time-rewind works). An optional AI narrator turns each era's events into
chronicle prose — but the engine, never the model, decides what happens.

**Play it:** https://ajhollowayvrm.github.io/godsim/

## What's in the box

- **A real map.** ~40 hex regions with terrain, population, prosperity,
  devastation, culture, faith and sacred sites. Wars have fronts, famines drive
  migration, plagues spread along adjacency, tech diffuses across borders.
- **Agents with interiority.** Every tracked noble has drives (status, vengeance,
  faith, love, legacy…), traits, a formative wound and a current desire — and each
  era picks the action that best serves them: scheme, marry, build, declare war,
  quest for a lost relic, found a religion, reconcile, betray. Every major event
  traces back to *who wanted what*.
- **Cross-system feedback.** Economy ↔ war ↔ legitimacy ↔ faith ↔ culture ↔
  demography, with thresholds: golden ages, dark ages, ages of blood and faith
  emerge from the loops, not from scripts.
- **Memory.** Inherited grudges (written down, they last longer), prophecies that
  bend behavior (paranoid kings hunt the foretold child — and make their own
  enemies), legacies, namesakes, and relics whose legends outlive their bearers.
- **A full divine hand.** Bless, smite, curse, whisper new wants into a soul,
  ordain marriages, bless or blight lands, send plague or bounty, hallow ground,
  incite wars, impose peace, favor houses, kindle faiths, spark schisms, forge
  and bestow relics, speak prophecies, name a Chosen.
- **The Vow.** A self-imposed, breakable law (no blood, an even hand, one miracle
  per age, silence, mercy). Breaking it never weakens you — it only changes what
  the world's faiths believe about their god.
- **Incarnation.** Descend into a mortal body — unkillable, but humble-able.
- **Adversaries.** Start a run against a rival deity (curses, cults, champions,
  temptations) or a mortal god-slayer climbing toward heaven relic by relic.
- **Time itself.** Deterministic journal replay lets you unwind the years to any
  earlier era — your divine acts included — and play forward again.

## Quickstart

```bash
npm install
npm run dev            # http://localhost:5173
```

Other commands:

```bash
npm run sim -- 25 18             # headless: seed 25, 18 eras, print the chronicle
npm run sim -- 25 30 god-slayer  # ...with an adversary (none|rival-deity|god-slayer)
npm test                         # determinism + replay + systems tests
npm run typecheck                # tsc --noEmit
npm run build                    # production build → dist/
npm run preview                  # serve the production build
node scripts/ui-smoke.mjs        # Playwright UI smoke test (needs `npm run preview`)
```

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds and
   publishes to `https://<your-user>.github.io/<repo>/`.

Asset paths are relative (`base: "./"` in `vite.config.ts`), so it works under any
repo name without extra config.

## The AI narrator (optional)

The hosted site has no backend, so narration uses **your own** Anthropic API key,
stored only in your browser (`localStorage`) and sent directly to the Anthropic API.
Click **🔑 Key** in the app to set it, then toggle **✦ Narrator**. With no key, the
chronicle shows deterministic templated lines instead — the simulation doesn't need
the narrator. **Never commit an API key.** For a public deployment, put a serverless
proxy in front (see `CLAUDE.md` → Narrator).

## Project structure

```
src/
  engine/
    index.ts        # public surface: boot(seed, options?) -> Engine; rebuild() for rewind
    types.ts        # the World model + stable EngineView contract
    rng.ts          # deterministic PRNG (the core invariant)
    names.ts        # culture-driven naming: people, houses, regions, faiths, relics
    world.ts        # shared helpers: events, relationships, grudges, might, LOD
    divine.ts       # the god's powers, the Vow, Incarnation, the journal
    view.ts         # World -> EngineView (pure)
    systems/        # the deterministic pipeline, one file per phase
  narrator/         # optional AI voice (engine owns truth, AI owns voice)
  ui/               # the illuminated-chronicle interface: map, inspectors, chronicle
tests/              # determinism + replay + systems tests
scripts/run.mjs     # headless runner for the verification loop
docs/               # original rebuild prompt + data-model reference
ARCHITECTURE.md     # how the deep rebuild fits together
```

## License

MIT — see [`LICENSE`](./LICENSE).
