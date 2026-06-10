# godsim

A deterministic, seeded **god-simulation** in the spirit of WorldBox. Dynasties,
religions, wars, and legends unfold on their own across centuries; you watch as a
deity and occasionally intervene. Same seed → same history, every time. An optional
AI narrator turns each era's events into chronicle prose — but the engine, never the
model, decides what happens.

> Building the deep version with **Claude Code**? Start with **[`CLAUDE.md`](./CLAUDE.md)** —
> it's the operational brief (invariants, target architecture, workflow). The fuller
> design rationale is in [`docs/REBUILD_PROMPT.md`](./docs/REBUILD_PROMPT.md).

## Quickstart

```bash
npm install
npm run dev            # http://localhost:5173
```

Other commands:

```bash
npm run sim -- 25 18   # headless: run seed 25 for 18 eras, print the chronicle
npm test               # determinism + smoke tests
npm run build          # production build → dist/
npm run preview        # serve the production build
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
    index.ts        # public surface: boot(seed) -> Engine; view() -> EngineView
    types.ts        # core + target data model
    rng.ts          # deterministic PRNG (the core invariant)
    legacy.mjs      # the current working engine (the rebuild replaces this)
    systems/        # deterministic phases for the deep rebuild (see its README)
  narrator/         # optional AI voice (engine owns truth, AI owns voice)
  ui/GodSim.jsx     # the illuminated-chronicle interface
tests/              # determinism + smoke tests
scripts/run.mjs     # headless runner for the verification loop
docs/               # rebuild prompt + data-model reference
```

## License

MIT — see [`LICENSE`](./LICENSE).
