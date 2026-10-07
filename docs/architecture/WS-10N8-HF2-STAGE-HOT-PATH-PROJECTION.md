# WS-10N8-HF2｜Stage Hot-Path Projection & Debug Canvas

Status: **IMPLEMENTED / MACHINE VERIFIED / BROWSER EVIDENCE PENDING**

HF1 removed several whole-scene rebuilds, but real browser evidence still showed frame drops. HF2 therefore profiles the remaining Stage hot path rather than changing Physics2D gameplay semantics.

## Root causes

The remaining main-thread amplification paths were:

1. Camera2D `worldToScreen()` and TileMap `localPointToWorld()` were invoked through the Module Capability facade once per point/vertex. A dense TileMap or collision overlay could therefore cross the capability boundary thousands of times per frame.
2. Scene-wide collision debug still lived in the React/SVG tree. Updating large SVG path strings and React presentation state remained expensive even after HF1 batching.
3. Collider2D and TileMap Transform listeners still needed scene-wide membership scans to decide whether a dynamic Transform affected them.
4. Camera movement invalidated drawing, and selected TileMap drawing flattened the complete sparse map before discarding off-screen cells.
5. `getDebugViewportSnapshot()` still obtained every external TileMap collider before viewport filtering.

## Projection rule

Camera2D world→screen and semantic Node local→world point transforms are affine mappings. HF2 samples exactly three basis points per revision:

```text
P(0,0)
P(1,0)
P(0,1)
```

and derives a local 2D affine projector. Thousands of subsequent points are transformed by local multiply/add operations without repeated Capability calls.

The derived projector is **Editor execution cache only**. It is not Transform2D authority, is never serialized, and is rebuilt when Camera/semantic geometry revisions change.

## Collision debug rule

Scene-wide unselected collision debug is drawn by one imperative Canvas overlay. SVG remains only for the selected authored Collider2D and its interactive handles.

Overlap/contact highlighting is now explicit editor debug state (`Contacts`) and defaults OFF. Shape visualization therefore does not require an O(N log N / N² candidate) overlap pass unless requested.

`getDebugViewportSnapshot(worldAABB)` performs viewport filtering before portable DTO materialization where providers support spatial query. TileMapLayer2D now supplies a sparse-chunk AABB collision query so off-screen tile colliders are never prepared merely to draw the current viewport.

## Sparse TileMap rule

Selected TileMap rendering uses bounded sparse-chunk enumeration rather than flattening every chunk and then filtering. The TileMap collision provider also converts the viewport world AABB back into TileMap-local cell bounds and enumerates only intersecting sparse chunks, with a conservative shape-margin expansion.

## Transform dependency rule

Collider2D native transform dependencies and TileMap semantic transform dependencies are revision-scoped `Set<NodeId>` caches. Ordinary RigidBody2D/CharacterBody2D motion performs O(1) membership checks instead of scanning all nodes/colliders merely to decide whether static geometry should invalidate.

## Camera / TileMap renderer rule

Passive TileMap rendering separates `layerRevision` from `cameraRevision`. Camera changes redraw visible tiles but do not re-request/re-materialize the entire layer snapshot. Visible instances are viewport-culled before drawing.

## Authority boundaries

HF2 does not change:

```text
Transform2D authority
Collider2D gameplay semantics
TileMap sparse authoring source
Physics2D backend contract
RigidBody2D identity
.ne persistence
Scratch runtime semantics
```

Canvas, affine projectors, viewport snapshots, Contacts preference and dependency sets are editor/runtime execution optimizations only.
