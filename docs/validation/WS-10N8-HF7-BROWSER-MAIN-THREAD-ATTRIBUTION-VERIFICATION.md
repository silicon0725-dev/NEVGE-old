# WS-10N8-HF7 | Browser Main-Thread Attribution Verification

Status: MACHINE VERIFIED / BROWSER CAPTURE REQUIRED

## Trigger evidence

HF6 production re-test:

- Rectangle: 47.841 FPS, 20.903 ms average frame, 33.4 ms P95, 0.441 ms tracked, 20.462 ms untracked.
- Circle: 28.573 FPS, 34.997 ms average frame, 183.3 ms P95, 0.735 ms tracked, 34.262 ms untracked.
- Capsule: 21.442 FPS, 46.638 ms average frame, 166.6 ms P95, 1.096 ms tracked, 45.542 ms untracked.

Collision Prepare remained only 0.419 / 0.724 / 1.073 ms average respectively. The remaining bottleneck is therefore browser main-thread work outside the old categories, with a strong shape-dependent signal.

## HF7 machine evidence

- HF7 Long Animation Frame observer is installed only while the profiler is active and is disconnected on stop.
- LoAF diagnostics are capped in memory and reset between captures.
- `browserMainThread` report aggregates LoAF duration, blocking time, approximate style/layout time, forced layout time and top script/invoker attribution.
- `Collider Pointer / Layout` measures the existing SVG `getBoundingClientRect()` read without changing pointer semantics.
- Unsupported browsers degrade to `loafSupported: false`; the profiler remains functional.
- HF1-HF7 machine conformance chain: PASS.
- HF7 conformance: 18/18 PASS.
- Focused Jest: 3 suites / 14 tests PASS.
- Full Unit Node: 215 suites / 1105 tests PASS.
- Full Unit DOM: 3 suites / 33 tests PASS.
- Permanent Regression: 41/41 PASS.
- ESLint correctness: PASS.
- HF6 transient Collider authoring behavior remains covered by its existing tests.

## Browser capture procedure

Use `START-EDITOR-PRODUCTION.bat` and the same scene/settings as the HF6 re-test.

Perform three separate 5-second captures:

1. Rectangle: continuously drag one size/corner handle during the capture.
2. Circle: continuously drag the radius handle during the capture.
3. Capsule: continuously drag radius or height during the capture.

For each report, preserve:

```text
averageFps
averageFrameMs
frameP95Ms
frameP99Ms
longTaskCount
trackedAverageMs
untrackedAverageMs
categories[]
browserMainThread
```

The most important new fields are:

```text
categories[Collider Pointer / Layout]

browserMainThread.loafSupported
browserMainThread.longAnimationFrameCount
browserMainThread.p95LoafMs
browserMainThread.totalForcedStyleAndLayoutMs
browserMainThread.averageStyleAndLayoutMsApprox
browserMainThread.topScripts[]
browserMainThread.topFrames[]
```

## Acceptance / next action

HF7 is a diagnostic gate, not an N8 freeze gate.

If Circle/Capsule reports show large `Collider Pointer / Layout` or forced style/layout attribution associated with pointer movement, proceed to the next hotfix that caches drag geometry/layout reads and decouples them from SVG writes.

If another script is dominant, follow the LoAF `sourceURL` / `sourceFunctionName` / `invoker` evidence instead.

Important: if the capture actually includes active handle dragging but `Collider Authoring Preview` remains exactly zero, treat that as an instrumentation anomaly and report it together with the HF7 JSON rather than assuming the preview path was inactive.
