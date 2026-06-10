# systems/

The deterministic simulation pipeline. Each file is a pure `System`
(see `../types.ts`): it takes the `World` and the seeded `RNG`, mutates the world,
and records `ChronicleEvent`s with a causal trace (`actors`, `motive`, `causedBy`,
`importance`). They run, in order, once per era from `../index.ts`:

| order | system | owns |
|---|---|---|
| 0 | `worldgen.ts` | boot-time only: hex map, cultures, houses, founders, relics |
| 1 | `economy.ts` | regional output, treasuries, famine/plague/bounty shocks |
| 2 | `demography.ts` | population growth + migration; tracked births/deaths |
| 3 | `agents.ts` | **the heart** — every tracked adult scores actions vs drives/wound/traits and emits intents |
| 4 | `politics.ts` | marriages, succession, plots, factions, the Crown, new houses |
| 5 | `war.ts` | declared intents become wars with aims, fronts, truces, treaties |
| 6 | `faith.ts` | spatial spread, doctrine, schism, crusade, sanction, creeds |
| 7 | `artifacts.ts` | custody, willful relics, quests, cults, reforging |
| 8 | `culture.ts` | value drift/borrowing/divergence; tech emergence + diffusion |
| 9 | `memory.ts` | grudges, prophecies, the Chosen's saga, era moods |
| 10 | `adversary.ts` | optional rival-deity / god-slayer sagas |

Rules for new code here:

- Only the passed `rng` for randomness; iterate in insertion order or sort with a
  deterministic tie-breaker (usually `|| (a.id < b.id ? -1 : 1)`).
- Kill people only via `kill()` / `departWorld()` from `../world.ts` (keeps the
  living-list cache true) and look regions up via `regionOf()` (indexed).
- Intents written by `agents.ts` are consumed later the same era; intents written
  by later systems (e.g. crusades from `faith.ts`) resolve next era — both fine,
  both deterministic.
- Keep `boot()`/`view()` in `../index.ts` stable so the UI and tests keep working.
