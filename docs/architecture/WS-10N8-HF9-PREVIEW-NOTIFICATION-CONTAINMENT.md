# WS-10N8-HF9｜Preview Notification Containment & Lightweight Collider Status

**Status:** IMPLEMENTED / MACHINE VERIFIED / BROWSER RE-TEST REQUIRED

## Trigger evidence

HF8 moved high-frequency Collider authoring from the React `pointermove` event phase into one `requestAnimationFrame` flush per frame, but the browser retest remained at roughly 21 FPS. The profiler then attributed the dominant tracked work directly to `Collider Authoring Preview`: average ~25.6 ms, P50 ~38.1 ms, P95 ~51.1 ms, max ~111.7 ms. LoAF simultaneously moved from `#document.onpointermove` to the HF8 `FrameRequestCallback`.

This proves HF8 coalescing worked as designed but only relocated the remaining synchronous preview cost.

## Root cause

`patchAuthoringPreview()` emits `authoring-preview-patch` synchronously. `Collider2DDebugToolbar` subscribed to every Collider runtime event and called `setState()` for preview events. In React 16, this update can synchronously render from the rAF callback. Toolbar render then calls `colliderRuntime.getStatus()`.

Before HF9, `getStatus()` performed:

```text
getStatus()
→ listColliders()
→ listNativeColliders()
→ build world geometry
→ listExternalColliders()
→ TileMap / other projection enumeration
```

Therefore one transient handle preview could synchronously pull a scene-wide Collider geometry/status path into the authoring frame.

## HF9 changes

### 1. Preview notification containment

`Collider2DDebugToolbar` ignores:

```text
authoring-preview-begin
authoring-preview-patch
authoring-preview-cancel
```

These events do not change the number of colliders, so they must not trigger toolbar status rerenders.

### 2. Lightweight status path

`getStatus()` no longer calls `listColliders()`.

Native Collider status counts components without projecting world geometry. External providers may expose `getColliderCount()`. Providers marked `containsSensors: false` can therefore contribute counts without `listColliders()` at all. This is particularly important for TileMap collision providers.

### 3. Runtime Node snapshot elimination in preview patch

`beginAuthoringPreview()` caches the Collider component identity. Repeated `patchAuthoringPreview()` calls reuse:

```text
nodeId → componentId
nodeId → transient config
```

instead of requesting a fresh Runtime Node snapshot every animation frame.

## Architecture invariants

HF9 does **not** change:

- Collider2D canonical semantics
- persistent command authority
- Transform2D authority
- Physics2D semantics
- Circle/Capsule tessellation constants
- `.ne` serialization
- HF6 release-once commit
- HF8 one-preview-per-animation-frame scheduling

All new caches are execution-only.
