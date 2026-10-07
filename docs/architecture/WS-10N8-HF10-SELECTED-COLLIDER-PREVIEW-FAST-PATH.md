# WS-10N8-HF10｜Selected Collider Preview Fast Path

**Status:** IMPLEMENTED / MACHINE VERIFIED / BROWSER RE-TEST REQUIRED

## Evidence entering HF10

HF9 browser capture still showed the selected Collider authoring path as the dominant tracked work:

- average FPS: ~30.994
- average frame: ~32.264 ms
- Collider Authoring Preview: ~11.922 ms/frame average, P95 ~28 ms
- Collision Prepare: ~3.247 ms/frame average, P95 ~10.1 ms
- tracked: ~15.545 ms/frame
- untracked: ~16.719 ms/frame

HF9 had already removed Debug Toolbar preview churn and repeated Runtime Node snapshot lookup inside `patchAuthoringPreview()`. Source inspection after that capture found two remaining fan-out paths:

1. `ProjectInspector` still refreshed on every `authoring-preview-*` event.
2. `Collider2DGizmo` still treated every transient preview event as a full Collider-world refresh, rebuilding the debug viewport snapshot.

## HF10 decision

Transient Collider authoring stays execution/editor-only and remains visible through the Collider Runtime contract, but presentation refresh is scoped:

```text
pointer sample
  -> patchAuthoringPreview(nodeId, patch)
  -> runtime transient preview remains authoritative
  -> Project Inspector ignores transient preview notification
  -> global Collider debug snapshot ignores transient preview notification
  -> getCollider(selectedNodeId) only
  -> local selected-gizmo preview state
  -> selected SVG presentation rerender

pointer release
  -> exactly one persistent PatchCollider2D command
  -> normal Collider runtime refresh resumes
```

## New profiler split

HF10 adds:

```text
Collider Authoring Preview
Collider Authoring Presentation
```

`Collider Authoring Preview` measures the Runtime transient patch. `Collider Authoring Presentation` measures the selected-only snapshot + React presentation update. This prevents future reports from combining runtime mutation cost and selected SVG presentation cost.

## Preserved contracts

HF10 does not change:

- ARC-0001 backend isolation;
- Transform2D authority;
- Collider2D schema or persistence;
- HF6 transient preview semantics (`getCollider()` still sees preview);
- HF8 rAF pointer coalescing;
- release-only persistent commit;
- Circle tessellation (`32` segments);
- Capsule tessellation (`16` arc segments);
- Physics2D semantics;
- `.ne` project data.

## Exit gate

Production browser retest the previously worst Circle or Capsule drag. HF10 is successful if:

- `Collider Authoring Preview` drops materially below HF9 P95 ~28 ms;
- `Collision Prepare` no longer tracks each transient preview frame;
- `Collider Authoring Presentation` exposes any remaining selected-SVG cost separately;
- FPS / frame P95 materially improve.
