# WS-10N8-HF7 | Browser Main-Thread Profiler & Long Animation Frame Attribution

Status: IMPLEMENTED / MACHINE VERIFIED / BROWSER CAPTURE REQUIRED

## Browser evidence that triggered HF7

HF6 production browser re-test materially improved Rectangle authoring but left Circle and Capsule with severe shape-dependent stalls:

- Rectangle: 47.841 average FPS, 20.903 ms average frame, 33.4 ms frame P95, 0.441 ms tracked average, 20.462 ms untracked average, 6 long tasks.
- Circle: 28.573 average FPS, 34.997 ms average frame, 183.3 ms frame P95, 0.735 ms tracked average, 34.262 ms untracked average, 28 long tasks.
- Capsule: 21.442 average FPS, 46.638 ms average frame, 166.6 ms frame P95, 1.096 ms tracked average, 45.542 ms untracked average, 26 long tasks.

Collision Prepare remained small relative to frame time:

- Rectangle: 0.419 ms average.
- Circle: 0.724 ms average.
- Capsule: 1.073 ms average.

Therefore Physics2D, collision narrow phase, Collision Canvas and the HF6 persistent-commit path do not explain the remaining frame time. N8 remains NOT FROZEN.

## Investigation target

The selected Collider2D authoring overlay still performs browser work outside the existing profiler categories. A particularly suspicious path is the pointer conversion sequence:

```text
pointermove
  -> SVG getBoundingClientRect()
  -> pointer coordinate conversion
  -> transient preview mutation
  -> React/SVG geometry update
```

Because `getBoundingClientRect()` is a layout-dependent read, reading it repeatedly after SVG geometry writes can force style/layout synchronization. Circle and Capsule are currently projected as 32/34-point SVG polygons while Rectangle uses four points, so browser geometry/layout/paint work can be shape dependent even when Collider runtime math remains cheap.

This is a hypothesis, not yet a frozen root cause. HF7 exists to attribute it before changing authoring semantics.

## HF7 diagnostic contract

HF7 adds two independent attribution paths.

### 1. Long Animation Frame attribution

When the browser supports the `long-animation-frame` PerformanceObserver entry type, the frame profiler records execution-only diagnostics for each LoAF:

```text
duration
blockingDuration
renderStart
styleAndLayoutStart
styleAndLayoutDurationApprox
scripts[]
  -> duration
  -> forcedStyleAndLayoutDuration
  -> invoker / invokerType
  -> sourceURL
  -> sourceFunctionName
  -> sourceCharPosition
```

The copied profiler report exposes an aggregated `browserMainThread` section containing:

```text
loafSupported
longAnimationFrameCount
averageLoafMs
p95LoafMs
maxLoafMs
averageBlockingMs
averageStyleAndLayoutMsApprox
totalScriptMs
totalForcedStyleAndLayoutMs
topScripts[]
topFrames[]
```

This data is diagnostic execution state only and never enters `.ne`, Runtime Node data, Collider2D data or project serialization.

### 2. Collider Pointer / Layout category

The existing Collider2D pointer conversion path now measures the synchronous `SVG.getBoundingClientRect()` read as:

```text
Collider Pointer / Layout
```

This category intentionally measures the layout-dependent read without changing behavior. If forced layout is the dominant remaining authoring stall, the next browser capture should move a material fraction of the previous untracked budget into this category and/or report non-zero `forcedStyleAndLayoutDuration` in LoAF script attribution.

## No authority change

HF7 adds observation only.

```text
Profiler state
!= Project Model
!= Runtime Node authority
!= Collider2D authority
!= Physics backend state
```

HF7 does not change:

- Collider2D shape semantics;
- Circle/Capsule tessellation used by collision geometry;
- HF6 transient-preview commit rules;
- Transform2D authority;
- Physics2D scheduling;
- `.ne` serialization.

## Browser decision tree after HF7

### Case A | Forced layout is confirmed

Typical evidence:

```text
Collider Pointer / Layout P95 is large
and/or
browserMainThread.totalForcedStyleAndLayoutMs is large
and top script/invoker resolves to Collider2D pointer movement
```

Next hotfix should cache the overlay client rect for the drag session, separate layout reads from SVG writes, and avoid repeated synchronous geometry reads during `pointermove`.

### Case B | Script duration is dominant without forced layout

Use `topScripts[]` source/invoker attribution to instrument the responsible React/Blockly/Scratch/NGVGE path instead of changing collision math.

### Case C | Style/layout time is large but script attribution is weak

Investigate SVG selected-shape presentation, including analytic/low-complexity authoring geometry that remains presentation-only and does not alter collision semantics.

### Case D | LoAF unsupported

Use the new `Collider Pointer / Layout` category plus Chrome DevTools Performance/Forced Reflow evidence. Do not block correctness or introduce browser-specific project semantics.
