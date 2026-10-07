# WS-10N8-HF11｜Selected Collider DOM Presentation Fast Path

**Status:** IMPLEMENTED / MACHINE VERIFIED / BROWSER RE-TEST REQUIRED

## Problem Evidence

HF10 browser capture showed the earlier global refresh chain was successfully removed:

- average FPS: ~48.486
- Collider Authoring Preview P95: ~0.9 ms
- Collision Prepare: 0 ms
- Collider Authoring Presentation average: ~10.566 ms
- Collider Authoring Presentation P95: ~15.6 ms
- Collider Authoring Presentation max: ~21.3 ms

The remaining sustained authoring cost is therefore selected-gizmo presentation rather than Physics2D, Collision Prepare, Runtime preview mutation, or browser layout.

## Root Cause

HF10 still performed, once per drag animation frame:

```text
transient config patch
→ colliderRuntime.getCollider(nodeId)
→ materialize selected collider snapshot
→ setAuthoringPreviewGizmo(...)
→ legacy React reconciliation of Collider2DGizmo
→ recompute selected polygon / handles / label
```

This work is presentation-only and does not need to re-enter Runtime capability snapshots or parent React reconciliation every drag frame.

## HF11 Fast Path

During pointer-down, HF11 caches:

```text
base selected gizmo
selected SVG <g> DOM reference
node → world affine projector
world → node affine projector
```

During each coalesced drag frame:

```text
patchAuthoringPreview()
→ transient config remains Runtime-authoritative for editor execution
→ transformColliderPoints(config, identity)
→ cached node→world affine projection
→ cached stage projection
→ mutate only selected SVG presentation attributes
```

The direct DOM path updates only:

- selected polygon `points`
- authoring handle `cx/cy`
- rotation arm
- center mark
- selected label position/text

No persistent project state is written during drag.

## React Compatibility Fallback

If a real selected SVG DOM group is unavailable (for example react-test-renderer), HF11 retains the HF10 React state fallback. The browser profiler exposes counters:

```text
colliderPresentationDirectDom
colliderPresentationReactFallback
```

Production browser authoring should show the direct-DOM counter increasing while fallback remains near zero.

## Cancellation / Commit Semantics

Cancel:

```text
cancelAuthoringPreview()
→ restore base selected-gizmo DOM presentation
```

Release:

```text
final pending sample
→ transient preview
→ exactly one persistent PatchCollider2D
→ canonical Runtime event / React render resumes normal authority
```

## Architecture Boundaries

Unchanged:

- ARC-0001 Kernel Independence Contract
- 0009 Transform2D Authority
- Collider2D canonical schema and identity
- Physics2D backend contract
- `.ne` persistence semantics
- Circle tessellation = 32 segments
- Capsule arc tessellation = 16 segments
- HF6 transient authoring contract
- HF8 frame coalescing
- HF9 notification containment
- HF10 selected-only preview isolation
