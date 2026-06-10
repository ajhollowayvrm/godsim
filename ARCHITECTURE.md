# ARCHITECTURE — the deep rebuild

How godsim goes from independent dice rolls to a living world: **agents with
interiority pursuing goals against material and social constraints**, on a real
map, with cross-system feedback. Everything below is deterministic: one mulberry32
stream, fixed iteration orders, no clock, no network.

## Module layout

```
src/engine/
  rng.ts          one PRNG + helpers (chance/pick/weightedPick/shuffle — all seeded)
  types.ts        World model + stable Engine/EngineView contract (extended, not reshaped)
  names.ts        culture-driven generation: people, houses, regions, faiths, artifacts
  world.ts        World construction helpers: event(), relationships, grudges, LOD, queries
  systems/
    worldgen.ts   boot-time: hex map, cultures, houses, founding families, artifacts
    economy.ts    regional output, treasuries, famine/plague/bounty shocks
    demography.ts births/deaths/aging, population growth, migration along the map
    agents.ts     THE HEART: every tracked adult scores candidate actions and acts
    politics.ts   succession, legitimacy, marriages, factions, schemes, the Crown
    war.ts        wars with aims, campaigns over adjacency, conquest/rebellion/peace
    faith.ts      spatial religion: spread, doctrine, schism, reform, crusade, grace
    artifacts.ts  relic ecology: custody, wills/wants, quests, cults, reforging
    culture.ts    value drift, borrowing, divergence; tech emergence + diffusion
    memory.ts     inherited grudges, prophecies, legacies, era moods (ages)
    adversary.ts  optional rival deity / mortal god-slayer (run-start option)
  divine.ts       the player-god API: ~25 powers, the Vow, Incarnation, journal
  view.ts         World -> EngineView (pure derivation)
  index.ts        boot(seed, options?) -> Engine; advance() = ordered pipeline
```

`legacy.mjs` remains in-tree as reference but is no longer imported.

## The world model (what's new)

- **Regions.** A hex map (~40 regions, axial coords, edge = sea). Terrain decides
  output (`food/wealth/manpower/ore/lore`), capacity, and defense. Regions carry
  population, prosperity, devastation, culture, faith share, sacred sites, plague.
  Adjacency drives war fronts, migration, conversion, tech diffusion, trade.
- **People.** Tracked nobles get capability (prowess/guile/acumen/zeal), weighted
  `drives` (security, status, wealth, faith, love, vengeance, legacy, knowledge,
  freedom), 1–3 `traits`, a `wound` (formed from real events when possible), and a
  derived `desire`. The masses are region population numbers; individuals are
  *promoted* to tracked when events need them (a usurper rises, a prophet appears).
- **Relationships.** Weighted person↔person edges (affection/trust/rivalry/debt),
  updated by events, read by the decision loop. House↔house standing + a separate
  **grudge memory** with provenance that decays slowly and is inherited.
- **Houses.** Own regions (geography replaces the `holdings` scalar, which now
  mirrors region count), keep treasuries (food/wealth/manpower), prestige, grudges.
- **Faiths.** Doctrines (tenet list), sacred regions, per-region share, a creed
  *about the god* that reacts to what the player actually does.
- **Artifacts.** 4–6 relics with power tags, will, wants, attunement, custody
  chains, cult pressure. The strongest-legend relic backs the legacy `sword` view.
- **Deity.** Vow (breakable, descriptive only), incarnation avatar, adversary
  state, journal of every divine act (enables deterministic replay/rewind).

## The agent decision loop (heart of dynamism)

Each era, every tracked adult builds a candidate action list *from their actual
situation* — scheme, court, marry, build, declare war, raid, convert, found faith,
go on quest (lost relics), endow, flee, betray, reconcile, tutor heir — and scores
each: `Σ driveWeight × expectedSatisfaction + traitBias − risk × caution`, with a
small seeded jitter. The argmax becomes an **intent**; the owning system resolves
it in its phase (wars in `war`, marriages/schemes in `politics`, conversions in
`faith`...). So every event has *who wanted what, with what, against whom* — and
events write `ChronicleEvent{actors, motive, causedBy}` so the chain is traceable.

## Pipeline order and the feedback couplings

`advance()` runs: **economy → demography → agents → politics → war → faith →
artifacts → culture → memory → adversary → divine-resolution**.

Couplings wired on purpose:
- economy → agents (scarcity raises ambition/desperation), → war (aims: grain,
  gold, land), → politics (prosperity feeds legitimacy), → demography (food sets
  growth; famine drives migration), → faith (distress converts).
- war → economy (devastation, treasury drain), → memory (grudges), → politics
  (victory legitimizes; defeat invites factions), → demography (casualties,
  refugees), → culture (tech diffuses along conquest).
- faith → politics (sanction/denounce the Crown), → war (crusades, holy aims),
  → culture (values bend toward doctrine), → economy (endowments, grace mercy).
- culture/tech → economy (multipliers), → war (arms), → faith (writing hardens
  doctrine and slows the god's fading memory).
- memory → agents (inherited grudges & prophecies bias choices — the paranoid
  king hunts the foretold child and *creates* his own enemy).

Thresholds, not drift: golden ages, dark ages, collapses and recoveries are
emergent labels computed from prosperity/peace/faith tension crossing tipping
points, with hysteresis so ages persist.

## The god (player levers)

All powers are engine methods that record a `DivineMark` + journal entry; the
narrator never decides anything. Existing levers keep their exact signatures
(`nameChosen/bestowSword/bless/reclaimSword/listLiving`). New: smite, curse,
whisper (re-weight a soul's drives), ordain marriage, bless/blight land, send
plague/bounty, hallow a sacred site, incite war / impose peace, favor a house,
kindle faith / spark schism / embolden / wither, forge & bestow & reclaim relics,
speak prophecy — plus the **Vow** (chosen at run start or any time; powers carry
tags; a tagged power breaks it — purely descriptive fallout: faith creeds shift,
never a power gate), **Incarnation** (descend as an un-killable but humble-able
avatar with authored backstory), and **adversary modes** (none / rival deity /
mortal god-slayer) chosen at boot via `boot(seed, options)` (backward-compatible
second arg). The journal + determinism give **rewind**: replay seed + journal to
any era.

## Level of detail & performance

Tracked people are bounded (~180 alive): houses keep lords, spouses, heirs and
notable kin fully simulated; the rest of a house and all commons live in region
population aggregates. Promotion on significance (office, artifact, prophecy,
divine touch, faction leadership); demotion of the never-notable dead to lineage
stubs. ~40 regions × ~10 systems is trivially under the per-era compute budget
(< 50ms/era measured target; tests assert a 30-era run stays well under budget).

## Determinism

One RNG stream owned by the pipeline; systems receive it in fixed order. All
collection iteration is insertion-ordered or sorted by id before use. Divine
powers consume RNG only when invoked and are journaled (era + order), so replaying
the journal reproduces the run bit-for-bit — that's also the save/rewind format.
`view()` is a pure function of `World`. The determinism test (same seed twice ⇒
identical JSON view) stays green; a replay test asserts journal playback matches.

## Risks: runaway & stall — and the dampers

- **Snowball empire** → coalition fear (houses ally against the hegemon),
  overextension (legitimacy and vassal loyalty fall with size), succession crises
  scale with realm size.
- **Extinction spiral** → new houses rise from prosperous regions (gentry
  promotion), fertility floors, refugees refound fallen seats.
- **Forever war** → war exhaustion (treasury/manpower drain forces peace),
  weariness events, benevolent-faith mediation.
- **Faith monoculture** → schism pressure scales with span + wealth-vs-asceticism
  strain; tolerance doctrines lower conversion pressure.
- **Chronicle spam** → every event carries `importance`; the UI surfaces majors
  and folds minors behind drill-down; per-system per-era event caps.

## UI (kept: illuminated chronicle; added: a living atlas)

SVG hex **map** with overlays (realms / faith / prosperity / culture), war and
plague markers, sacred sites; click anything → an **inspector** (a soul's drives,
wound, bonds and deeds; a house's lineage, grudges, treasury; a faith's doctrine
and creed-of-the-god; a relic's custody saga). Chronicle lines carry their causal
chain (click → "because…"). The Divine Hand becomes a full panel of powers over
souls, lands, houses, faiths, relics and heaven (vow, incarnation, rewind). The
per-era facts ledger stays and grows (population, wealth, tech, age/mood).
