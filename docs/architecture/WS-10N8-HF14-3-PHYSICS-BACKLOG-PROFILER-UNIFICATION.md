# WS-10N8-HF14.3｜Physics Fixed-Step Backlog Containment & Profiler Store Unification

Status: IMPLEMENTED / MACHINE VERIFIED / BROWSER RE-TEST REQUIRED

## Motivation

HF14.2 browser evidence showed that Rectangle reached ~60 FPS while Circle and Capsule improved to ~32.8 FPS and ~23.4 FPS respectively. The remaining stalls were concentrated in `Runtime Phase Scheduler.runTick`, with repeated 90–113 ms callbacks. Because the runtime scheduler's only persistent frame phase is Physics2D, the remaining shape-sensitive stall is consistent with fixed-step catch-up amplification after a slow frame.

## Runtime policy

The Physics2D fixed step and explicit `advance()` contract are unchanged. HF14.3 only adds a scheduler execution budget:

- Runtime Scheduler Physics phase budget: 12 ms per animation-frame tick.
- At least one fixed step is allowed when backlog exists.
- If catch-up work reaches the CPU budget while full fixed steps remain in the accumulator, only the accumulated backlog is dropped; the fractional remainder is preserved.
- Explicit/manual `advance(delta)` calls remain unbudgeted unless an execution option explicitly supplies `timeBudgetMs`.

This is execution scheduling policy, not project persistence or Collider/RigidBody semantics.

## Profiler store unification

Frame-profiler stores are now shared through `globalThis[Symbol.for('ngvge.frame-time-profiler.stores.v1')]`. This prevents duplicated webpack/module instances from creating separate profiler stores for the same Scratch runtime object.

New attribution categories:

- Physics Descriptor Sync
- Physics Backend Step
- Physics Transform Writeback

New counters:

- `physicsFixedSteps`
- `physicsBacklogDrops`
- `physicsDroppedBacklogSteps`
- `physicsSchedulerBudgetExhaustions`

HF14 Shape-Aware primitive mapping remains intact: Cuboid / Ball / Capsule / Convex fallback.
