/**
 * godsim engine — public surface.
 *
 * Today this re-exports the working baseline in `legacy.mjs` (your current
 * deterministic sim). The deep rebuild (see /CLAUDE.md) replaces legacy.mjs with
 * a composed tick pipeline under ./systems, while KEEPING THIS SURFACE STABLE:
 *
 *   boot(seed) -> Engine   and   Engine.view() -> EngineView
 *
 * The UI and tests depend only on this contract, so you can rebuild the internals
 * freely as long as boot()/view() keep their shape.
 */
import { boot as _boot } from "./legacy.mjs";
import type { Engine } from "./types";

export const boot = _boot as unknown as (seed: number) => Engine;
export * from "./types";
