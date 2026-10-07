# WS-10N8-HF1｜Physics & Collision Debug Performance

Status: **IMPLEMENTED / MACHINE VERIFIED / BROWSER EVIDENCE INSUFFICIENT / SUPERSEDED BY WS-10N8-HF2**

WS-10N8-HF1 closes performance defects discovered after N7 TileMap collision and N8 Physics2D were combined in a real editor workload. The hotfix does not change Collider2D, TileMapLayer2D, RigidBody2D, PhysicsMaterial2D or Physics2D persistent semantics.

## Root causes

The measured slowdown was not dominated by one SAT call or one Rapier step. Three amplification paths existed:

1. `Collider2DGizmo` asked `getOverlaps(nodeId)` once for every visible collider. Each query rebuilt/enumerated scene collision geometry again. Dense native-collider debug therefore approached repeated O(N²) work before SVG rendering even began.
2. scene-wide collision debug emitted one SVG polygon plus two center-mark lines for every collider, including off-screen TileMap collision projections. A selected TileMapLayer2D also made every tile projection look selected because all projections share the layer NodeId.
3. TileMapLayer2D listened to every Transform2D runtime update in the scene. Dynamic RigidBody2D motion therefore invalidated/reprojected the full TileMap collision set even though the TileMap hierarchy had not moved. Physics2D also rebuilt/synchronized every fixed/static body descriptor every fixed step.

## Runtime optimization contract

### Collider debug snapshot

`ngvge.collider2d-runtime` now exposes a read-only debug snapshot:

```text
getDebugSnapshot()
├─ colliders[]
├─ geometryRevision
└─ collider.overlapping
```

Overlap state is computed once per geometry revision. The debug broad phase sorts by world-AABB min-X, terminates candidate scanning when X ranges no longer intersect, checks Y/AABB and collision filters before SAT, then runs SAT narrow phase only for remaining pairs.

This is editor diagnostic data only. It does not become gameplay collision authority.

### Collision refresh batching

Physics2D may bracket a fixed-step Runtime Transform writeback with:

```text
beginRefreshBatch()
... dynamic Transform2D runtime writes ...
endRefreshBatch('physics-step')
```

The batch only coalesces expensive collision refresh/listener work. It does not defer the Transform2DRuntimeStore writes themselves and does not change persistent authority.

### TileMap projection cache

TileMap collision projections are cached independently from full visual layer views. They are invalidated only by:

- TileMapLayer2D authoring/lifecycle changes;
- TileSet resource changes;
- Transform changes that actually affect the TileMapLayer2D semantic hierarchy.

Unrelated Sprite2D/CharacterBody2D/RigidBody2D Transform updates must not invalidate TileMap collision projections.

The internal TileMap collision provider publishes frozen stable snapshots so Collider2D Runtime does not JSON-clone thousands of unchanged tile projections every dynamic-body step.

### Physics descriptor synchronization

Physics2D keeps a descriptor snapshot after a successful backend `syncBodies()` call. Stable fixed bodies, sensors, TileMap collision and unchanged dynamic definitions are not resynchronized every 1/60-second step.

The descriptor set becomes dirty on semantic topology/configuration/collider/kinematic changes. Physics-originated Transform writeback (`reason = physics-step`) does not mark static descriptors dirty again.

This preserves:

```text
NodeId / ColliderId / RigidBodyId
!= backend handle
```

and only changes execution scheduling/caching.

## Collision debug rendering

The Stage collision overlay now has three rendering levels:

1. **Viewport culling** — world AABBs outside the current Camera/Stage view are skipped before point projection.
2. **Detailed selected collider** — the authored selected Collider2D keeps its polygon, handles, center, label and direct editing path.
3. **Batched scene debug** — when visible debug collider count exceeds the threshold, unselected colliders are merged into a small number of SVG `<path>` batches grouped by overlap/sensor presentation state.

A TileMap collision projection is never treated as an individually selected Collider2D merely because its owner TileMapLayer2D is selected.

Unselected colliders no longer receive per-collider center-cross DOM nodes.

## Synthetic performance evidence

The benchmark fixtures are deterministic development diagnostics, not browser/FPS claims.

### Unrelated Transform with a 1024-cell collidable TileMap

20 unrelated Character Transform updates:

```text
N8 baseline: 2367.922 ms
HF1:            0.379 ms
```

Baseline rebuilt 20 TileMap collision projections (20,480 projected tile colliders). HF1 rebuilt zero because the changed Character is not in the TileMap hierarchy.

### Collider debug overlap preparation with 300 native colliders

```text
N8 baseline per-collider getOverlaps path: 6375.775 ms
HF1 one debug snapshot + broad phase:         27.949 ms
```

This benchmark isolates debug-state preparation and does not include browser SVG paint/composition.

### Physics descriptors with 1000 fixed colliders + 1 dynamic body

60 fixed steps with a no-op conforming backend adapter:

```text
N8 baseline: 24.666 ms, listColliders=60, syncBodies=60
HF1:          5.454 ms, listColliders=1,  syncBodies=1
```

This isolates NGVGE descriptor/synchronization overhead and does not claim Rapier solve time.

## Non-goals

- no Collider2D schema change;
- no Physics2D schema change;
- no backend-handle persistence;
- no gameplay collision approximation for performance;
- no disabling collision debug to hide the cost;
- no claim that browser FPS is verified by Node synthetic benchmarks;
- no replacement of the planned World View / Stage spatial separation work.


## Browser follow-up

Real browser testing on 2026-08-18 showed that HF1 reduced redundant collision preparation but did **not** remove the observable frame drop. HF1 therefore remains a valid machine-verified optimization layer but is not frozen as sufficient browser-performance evidence; WS-10N8-HF2 supersedes its Stage hot path without changing the frozen gameplay semantics.
