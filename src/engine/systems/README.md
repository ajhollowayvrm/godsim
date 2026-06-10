# systems/

Deterministic simulation phases for the deep rebuild. Each is a pure `System`
(see `../types.ts`): it takes the `World` and the seeded `RNG`, mutates the world,
and records `ChronicleEvent`s with a causal trace. They are composed, in order,
into one era by the tick loop in `../index.ts`.

**Build order (suggested — see /CLAUDE.md):**

1. `world.ts` — procedural generation: cultures, regions (map), houses, founders, artifacts.
2. `agents.ts` — the decision loop: people evaluate options against drives/wound/traits. *The core of dynamism.*
3. `economy.ts` — regional output, prosperity/scarcity, famine/plague shocks.
4. `demography.ts` — births/deaths, migration along the region graph.
5. `politics.ts` — succession, legitimacy, marriages → alliances, factions.
6. `war.ts` — war aims from economy/grudges; campaigns over geography; conquest/rebellion.
7. `faith.ts` — emergent religions coupled to culture + geography; schism/spread/reform.
8. `artifacts.ts` — multiple relics with will/wants; custody, cults, legend.
9. `culture.ts` — value drift, tech emergence + diffusion along trade/conquest.
10. `memory.ts` — inherited grudges, prophecies, legacies → recurring motifs.

Keep `boot()`/`view()` in `../index.ts` stable so the UI and tests keep working.
