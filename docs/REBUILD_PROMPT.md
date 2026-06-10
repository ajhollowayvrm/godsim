# Prompt — Make "godsim" deep and dynamic

*(Paste this into a conversation with Claude Fable 5. Attach the three files named in "What you're inheriting": `godsim.jsx`, `engine.mjs`, `godsim-data-model.ts`.)*

---

You are a simulation designer and systems engineer helping me evolve a game called **godsim**. I have a working foundation, but the simulation underneath feels **barebones and static** — I need you to make it genuinely **deep and dynamic**. Read this whole brief before responding, and respect the hard constraints at the end; they are not negotiable.

## What godsim is

A deterministic, seeded **god-simulation** in the spirit of WorldBox: civilizations, dynasties, religions, wars, and legends unfold on their own across centuries. The player is a deity who watches and occasionally intervenes — the world runs with or without them. The north star is **"as organic as possible"**: a wide possibility space where history *emerges* rather than being scripted, and where the same seed always replays the same history.

## What you're inheriting (the current build)

Three files are attached:

- **`godsim.jsx`** — a playable single-file React artifact: an "illuminated chronicle" UI (Cinzel/EB Garamond, parchment/gold/blood palette), era-by-era advancement, a per-era **facts/stats ledger**, player interventions (the Divine Hand), and an optional AI narrator toggle.
- **`engine.mjs`** — the headless simulation engine (run with `node engine.mjs <seed>`), the source of truth that the artifact embeds.
- **`godsim-data-model.ts`** — a richer TypeScript data model that *sketches* more depth than the running engine currently uses.

**Architecture today.** A single seeded PRNG (mulberry32) drives a fixed sequence of per-era phases — roughly: *demography → diplomacy → artifacts → politics → war → faith → crown → intrigue → divine hand → chosen*. Each era is ~25 years. The world is procedurally generated: ~12 houses across 4 cultures, generated names, and one uniquely-named relic per realm.

**Systems that already exist (shallowly):** births/deaths by age; marriages forming alliances; succession, usurpation, regencies, civil war; secular war with conquest → vassalage/annexation, rebellion, and empire snowballing; emergent religions with focuses/postures, schism, crusade, conversion, merger, persecution, and a "grace" stat; state-faith coupling; intrigue (assassination, coups, betrayal) driven by rivalry/grudge bonds; a player-named **Chosen** with prophecy fulfilment; and divine interventions.

**A crucial split:** the **engine owns truth, the AI owns voice.** All outcomes are computed in pure deterministic code. The optional narrator makes *one batched LLM call per era* purely to turn already-decided events into prose, and the result is cached. The language model is never in the causal loop.

## The problem to solve

The simulation feels barebones and undynamic, and I can diagnose why:

- **Events are independent dice rolls, not consequences.** Each phase fires probabilistically on its own. Things happen *to* the world on a timer; pressures don't build and release.
- **People are stat-thin.** Tracked persons have little more than prowess, guile, a name, and claims. They don't *want* anything or *act* to get it. (Notably, the TS data model already sketches `drive`/`wound`, traits, beliefs, and a level-of-detail scheme that the running engine ignores.)
- **There is no space.** Houses are abstract nodes; wars and alliances have no geography, borders, distance, or terrain.
- **There is no economy.** No resources, scarcity, prosperity, or famine — nothing material is being fought over.
- **Culture is cosmetic.** It only flavors names; it never evolves, diverges, diffuses, or clashes.
- **There is no technological or intellectual change** across centuries.
- **There is one relic** and a thin artifact ecology.
- **Memory is weak.** Grudges and legacies don't compound into recurring motifs across generations.

## What "deep and dynamic" means here

**The core principle: dynamism comes from agents with interiority pursuing goals against material and social constraints, producing causal chains and cross-system feedback.** Every major event — a war, a schism, a murder, a coronation, a migration, a golden age, a collapse — should be traceable to *who wanted what, what they had to work with, and who stood in their way.* Depth means more legible **causal layers**, not more random tables.

Build toward these systems, each kept fully deterministic:

1. **Agent interiority and agency.** Give every tracked person needs and drives (security, status, wealth, faith, love, vengeance, legacy), a defining wound and desire, and temperament traits — then add a per-tick **evaluation step** where they choose among available actions (scheme, marry, build, war, convert, flee, betray, endow) the one that best serves their goals given their situation. Decisions must be deterministic functions of state + traits + seed. Realize the interiority the data model already sketches.

2. **A real relationship graph.** Kinship, loyalty, debt, love, rivalry, and inherited grudge as weighted edges that *update from events* and *feed back into* future decisions.

3. **Economy and material conditions.** Holdings produce food, wealth, and manpower; prosperity and scarcity drive ambition, migration, revolt, and war aims. Famine, plague, and bumper years as endogenous and exogenous shocks. Wars should cost something and be fought over something.

4. **Geography and space.** A generated map of regions with terrain and adjacency. Territory is held, contested, and bordered; war, trade, alliance, plague, faith, and culture all obey distance. Heartlands versus frontier marches; chokepoints; coasts.

5. **Cultural and technological evolution.** Cultures drift, borrow, and diverge over centuries; customs and values mutate; innovations (agriculture, metallurgy, writing, fortification, seafaring) emerge and diffuse along trade and conquest, changing what is possible. Values can clash beyond religion.

6. **Richer faith and ideology.** Keep emergent religions, but couple them to material conditions, geography (sacred sites), and culture; let doctrines mutate and reform-vs-orthodoxy tensions arise; let faith spread spatially.

7. **Artifact ecology.** Multiple artifacts with distinct powers, wills, and wants; they change hands, inspire cults, are lost and reforged, and their legends compound and intersect. Treat artifacts as persistent protagonists with a material life (held/lost) and a mythic life (legend persists when absent).

8. **Narrative granularity and memory.** Model salient individual beats (feuds, friendships, oaths, betrayals, masterworks) and make the world *remember*: grudges inherited across generations, prophecies that constrain later choices, legacies that shape descendants' standing. Recurring motifs should fall out of the mechanics, not authoring.

9. **Feedback and emergence — the heart of it.** Wire the systems so they push on each other (economy ↔ war ↔ legitimacy ↔ faith ↔ culture ↔ demography), with thresholds and tipping points rather than only linear drift. The goal is golden ages, dark ages, sudden collapses, and recoveries that arise from the loops themselves.

## Hard constraints (do not break these)

- **Determinism.** One seeded PRNG (mulberry32 or equivalent). Identical seed ⇒ identical history, forever. No `Math.random`, no `Date`/clock, no network access inside the engine.
- **Engine owns truth; AI owns voice.** The LLM narrator must never compute outcomes or sit in the causal loop. Every state transition is pure code. The narrator only renders already-decided events into prose, one batched call per era, cached. Do **not** "make it dynamic" by letting a model run the simulation.
- **The player is an infinite god** bound only by a self-imposed, **breakable per-run Vow**. Faith is *descriptive* and must never gate divine power (apostasy never weakens the god). Preserve the existing player levers: Divine Hand interventions, naming a **Chosen**, bestowing/reclaiming **artifacts**, blessings, optional **Incarnation** (descend into a mortal body with authored backstory and full memory; can be humbled but not killed), and run-start adversary modes (none / rival deity / mortal god-slayer).
- **Performance.** It must run smoothly in-browser for a multi-century saga. Use a **level-of-detail** scheme: fully simulate notable figures, aggregate the masses statistically, and promote individuals to full detail when they become significant. Target well under a second of compute per era on a laptop for a 25–30 era run, with tracked-agent counts bounded.
- **Single-file React artifact rules.** Default-exported component; **Tailwind core utility classes only** (no config/compiler); **no `localStorage`/`sessionStorage`** (in-memory state only); external libraries only from an approved CDN set; fonts via `@import`. **Preserve the illuminated-chronicle aesthetic and the per-era facts/stats ledger.**
- **Legibility.** A bigger simulation must not produce an unreadable wall of text. Surface the *significant* (notable agents, turning points, causal threads) and make detail drillable, not dumped.

## Process and deliverables

1. **First, reply with an architecture plan — not code.** Cover: the revised data model; the agent decision loop; the new tick/phase ordering and the specific feedback couplings between systems; the level-of-detail strategy; and how each new system stays deterministic and performant. Flag risks, and note where emergence might run away or stall and how you'll damp or seed it.
2. After I approve the plan, **implement incrementally**, one system at a time. After each, verify it **headless against fixed seeds** — print the causal chain of a sample run (who did what, why, and with what consequence) — before integrating into the artifact.
3. Deliver **both**: an updated headless engine module runnable with `node`, and the updated single-file React artifact.

## Definition of done

A 25–30 era run should produce a chronicle where I can point at any war, schism, assassination, golden age, or collapse and trace it back through agent goals and material conditions — and where re-running the same seed reproduces that history exactly, while a fresh seed yields a genuinely different yet equally coherent world.

Begin with the architecture plan.
