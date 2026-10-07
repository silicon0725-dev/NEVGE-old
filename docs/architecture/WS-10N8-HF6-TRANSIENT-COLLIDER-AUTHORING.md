# WS-10N8-HF6 | Transient Collider Authoring & Pointer-Move Commit Decoupling

Status: IMPLEMENTED / MACHINE VERIFICATION IN PROGRESS / BROWSER RE-TEST REQUIRED

## Browser evidence that triggered HF6

Production-build captures after HF5 still showed large untracked main-thread stalls while the tracked collision work stayed small:

- Rectangle Collider2D: 26.479 average FPS, 216.6 ms frame P95, 0.391 ms average Collision Prepare, 37.36 ms average untracked time.
- Circle Collider2D: 35.471 average FPS, 150.0 ms frame P95, 0.337 ms average Collision Prepare, 27.847 ms average untracked time.
- Capsule Collider2D: 36.091 average FPS, 133.4 ms frame P95, 0.347 ms average Collision Prepare, 27.35 ms average untracked time.
- Browser authoring evidence additionally reported pronounced stalls while dragging Collider2D shape handles.

The evidence excludes collision debug drawing and narrow-phase math as the dominant authoring bottleneck. The authoring path itself was inspected.

## Root cause

`Collider2DGizmo` previously executed `PatchCollider2D` from every `pointermove` while a shape handle was dragged.

A persistent Runtime Node mutation performs substantially more than a geometry update:

1. semantic graph checkpoint;
2. component mutation;
3. Runtime Node graph export;
4. snapshot validation;
5. full graph JSON serialization;
6. project read/write persistence;
7. mutation-event flush.

Therefore a 120-event drag could create approximately 120 full persistent graph transactions.

Selected-handle rendering also projected every handle independently through the Module capability boundary. Rectangle has ten authoring handles, which amplified this cost relative to Circle and Capsule.

## Frozen HF6 authoring rule

Pointer movement is preview, not persistence.

```text
pointer down
  -> begin transient Collider2D authoring preview

pointer move
  -> update execution-only preview config
  -> invalidate editor/debug geometry
  -> NO Runtime Node persistence
  -> NO project write

pointer up
  -> one PatchCollider2D command
  -> one persistent Runtime Node mutation
  -> clear preview

pointer cancel
  -> clear preview
  -> persistent Collider2D remains unchanged
```

This mirrors the already established Transient Transform Drag Preview principle.

## Authority

The preview map is execution/editor state only.

```text
authoringPreviewConfigs
!= Collider2D persistent component data
!= .ne project data
!= Runtime Node semantic authority
```

`getCollider()` and collision debug projection may observe a preview while it exists so Stage feedback remains live. `getPersistentCollider()` continues to read only persistent component data.

Transient authoring preview must not emit Area enter/exit semantics. Area/contact semantic refresh occurs on the final persistent commit, not every pointer event.

## Point-projection optimization

HF6 also removes repeated per-handle capability projection.

World -> Node during one drag is sampled at three points to construct an affine projector:

```text
W(0,0)
W(1,0)
W(0,1)
```

Node -> World for selected authoring handles uses the same three-point affine strategy. Rectangle's ten handles therefore require three capability samples per render instead of ten independent shape-to-world calls.

The Collider runtime point helpers were also changed to resolve only Collider config + transform hierarchy rather than constructing a complete Collider world-geometry view merely to convert one point.

## Persistent commit refresh

The final persistent commit brackets Runtime Node mutation notifications in the Collider refresh batch. Runtime Node subscriber invalidation plus the explicit Collider patch therefore collapse to one collision refresh instead of duplicate refreshes.

## Profiler attribution

Two new categories are exposed:

- `Collider Authoring Preview`
- `Collider Authoring Commit`

This lets browser captures distinguish cheap transient pointer motion from the one persistent release commit.
