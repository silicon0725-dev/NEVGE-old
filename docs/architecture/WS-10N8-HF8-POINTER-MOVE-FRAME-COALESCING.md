# WS-10N8-HF8 | Pointer-Move Frame Coalescing & Event-Phase Decoupling

Status: IMPLEMENTED / MACHINE VERIFIED / BROWSER RE-TEST REQUIRED

## HF7 browser evidence

HF7 active-drag Production captures were supplied in Rectangle / Capsule / Circle order. The evidence rejects repeated `getBoundingClientRect()` forced layout as the dominant remaining stall.

- Rectangle: 32.187 FPS, 31.069 ms average frame, 50.1 ms frame P95, 1.712 ms tracked average, 29.357 ms untracked average.
- Capsule: 25.347 FPS, 39.453 ms average frame, 66.8 ms frame P95, 2.181 ms tracked average, 37.272 ms untracked average.
- Circle: 22.652 FPS, 44.146 ms average frame, 66.7 ms frame P95, 2.718 ms tracked average, 41.428 ms untracked average.

`Collider Pointer / Layout` remained negligible (P95 about 0.1 ms). LoAF instead attributed the dominant long-frame script to React 16's document-level `pointermove` dispatch (`Xt` in the ReactDOM production vendor bundle):

- Rectangle: 7 attributed pointermove LoAF scripts / 152.1 ms total / 32.9 ms max.
- Capsule: 34 / 1402 ms total / 50.2 ms max.
- Circle: 41 / 1488.5 ms total / 46.7 ms max.

Forced style/layout did not scale with the shape-dependent stall (13.8 / 5 / 10.5 ms total respectively), so HF8 does not change collider tessellation or collision semantics.

## Root-cause interpretation

The ReactDOM `Xt` symbol is the production user-blocking event dispatch wrapper. LoAF duration on that function includes synchronous work invoked through the React SyntheticEvent path. HF6 already made persistence transient, but every raw hardware/browser pointer sample still executed the full Collider preview path synchronously inside the event phase.

On high-rate pointer devices, many pointer samples can arrive before the next visual frame. Performing preview invalidation for each sample creates work that cannot become visible independently.

## HF8 rule

Raw pointer samples are input, not render commits.

```text
React pointermove event
  -> copy only portable pointer coordinates / pointer id / SVG reference
  -> replace pending sample with latest sample
  -> request at most one animation-frame flush
  -> return from React event phase

requestAnimationFrame
  -> consume latest sample
  -> pointer -> world conversion
  -> shape-handle math
  -> one transient Collider authoring preview patch
  -> one editor/debug geometry invalidation

pointerup
  -> synchronously flush final pending sample if necessary
  -> one persistent PatchCollider2D commit
```

Therefore multiple pointer samples within one animation frame collapse to one visible preview mutation.

## React 16 event safety

HF8 never stores the React SyntheticEvent object across the animation-frame boundary. React 16 historically pools SyntheticEvents. The handler snapshots only the required scalar fields and the stable SVG DOM reference before returning.

## Authority and semantics

No authority changes are introduced.

```text
pendingPointerMove / pointerMoveFrame
= editor execution state only
!= Collider2D persistent component data
!= Runtime Node authority
!= .ne project data
```

HF8 preserves:

- HF6 transient preview semantics;
- one persistent commit on pointer release;
- cancel restores persistent geometry;
- Collider2D shape semantics and tessellation;
- Transform2D authority;
- Physics2D scheduling and backend seam.

## Profiler counters

While the profiler is enabled, HF8 records two counters:

- `colliderPointerSamples`: raw pointer samples received;
- `colliderPointerFlushes`: samples actually applied to transient preview.

During high-frequency motion, `colliderPointerSamples` may exceed `colliderPointerFlushes`. The expected invariant is at most one preview flush per animation frame, plus an optional final synchronous release flush.

## Browser gate

Repeat Production active-drag captures for Rectangle, Capsule and Circle. HF8 is browser-accepted when:

1. handle feedback remains visually live and final release geometry is correct;
2. ReactDOM `#document.onpointermove` LoAF total/max duration materially falls for Capsule and Circle;
3. `colliderPointerSamples > colliderPointerFlushes` during sufficiently high-rate motion, proving coalescing is active;
4. no repeated persistent commit appears during movement;
5. frame P95 / subjective responsiveness materially improve.

If `pointermove` shrinks but `FrameRequestCallback` becomes the next dominant source, the next optimization should target the per-frame selected-collider React/SVG presentation path rather than return to Physics.
