# WS-10N8-HF12｜CharacterController Collision Broad Phase & Runtime Refresh Containment

**Status:** IMPLEMENTED / MACHINE VERIFIED / BROWSER RE-TEST REQUIRED

## Evidence

HF11 browser verification showed authoring drag is no longer the performance blocker (~59.5 FPS, no LoAF, no long tasks). A separate runtime collision capture still fell to ~14.4 FPS with repeated `FrameRequestCallback` stalls reaching ~347 ms while the existing `Physics2D` profiler category remained at 0 ms.

The source contains an independent CharacterController2D editor Test Drive `requestAnimationFrame` loop. Its fixed step calls `moveUsingVelocity → moveAndSlide`, which was previously outside profiler attribution.

## Root Cause Structure

Before HF12, CharacterController collision checks used:

```text
findEarliestCollision
→ solidCandidates
→ colliderRuntime.listColliders(scene)
→ all native colliders
→ all external TileMap collision projections
→ filter candidates
→ continuous SAT
```

`moveAndSlide` can invoke this path repeatedly for:

- safe-placement validation
- primary sweep
- step-up test
- forward step
- floor descent
- floor snap
- recovery validation

For a large TileMap this means rebuilding/enumerating many collision projections multiple times inside one logical controller step.

Runtime Transform patches also requested Collider2D overlap refreshes during the same logical move. Solid-only scenes do not require global Area2D overlap reconstruction, but the old refresh path still performed geometry work before proving that no sensor overlap state existed.

## HF12 Changes

### 1. Collider2D world-AABB query capability

`Collider2D Runtime Service` now exposes:

```text
queryCollidersInAABB(worldAABB, options)
```

Native colliders are filtered by AABB. External providers use their spatial query when available. TileMapLayer2D already provides `queryCollidersInAABB`, so large sparse TileMaps no longer need full collision projection enumeration for local CharacterController sweeps.

### 2. Swept broad phase

CharacterController computes a conservative swept AABB from the moving collider's start/end bounds:

```text
start collider AABB
union
translated end AABB
+ contact slop
```

Only candidates intersecting this broad-phase box enter exact collision filtering and continuous SAT.

### 3. Logical-move refresh batching

`moveAndCollide` and `moveAndSlide` now bracket runtime Transform mutations with Collider2D refresh batching. Multiple internal position patches produce at most one collision refresh at the end of the logical move.

### 4. Solid-only overlap refresh fast path

When there are no native Area2D sensors, no external sensor providers, and no existing Area overlap state, Collider2D refresh:

- advances `geometryRevision`
- emits one `collision:refresh`
- does not rebuild global collider geometry solely to discover there are no sensor overlaps

### 5. Character Controller profiler attribution

The Test Drive fixed step is now measured as:

```text
Character Controller
```

and increments:

```text
characterControllerSteps
```

The next browser capture can therefore distinguish CharacterController runtime work from residual browser/untracked work.

### 6. Narrow-phase cleanup

`convexPolygonPenetration` now performs its own AABB rejection before one penetration SAT pass rather than first invoking another complete convex-overlap SAT pass.

## Semantics Unchanged

HF12 does not change:

- ARC-0001 ownership boundaries
- 0009 Transform2D Authority
- Collider2D identity/schema
- CharacterController2D movement semantics
- continuous SAT collision semantics
- Circle tessellation = 32 segments
- Capsule arc tessellation = 16 segments
- Physics2D backend contract
- `.ne` persistence semantics
- TileMap authored data
