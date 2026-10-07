# WS-10N8-HF8 | Pointer-Move Frame Coalescing Verification

Status: MACHINE VERIFIED / BROWSER RE-TEST REQUIRED

## Trigger evidence

HF7 Production active-drag captures show `Collider Pointer / Layout` at about 0.1 ms P95 while the ReactDOM document-level pointermove dispatch dominates LoAF script time: Rectangle 152.1 ms total, Capsule 1402 ms, Circle 1488.5 ms. HF8 therefore targets event-phase preview frequency, not layout or collision tessellation.

## Required machine invariants

- 120 pointer samples before one animation frame produce exactly one transient preview patch.
- The final release still produces exactly one persistent command.
- A pending final sample is flushed before persistent commit.
- React SyntheticEvent objects are not retained across rAF; only required fields are snapshotted.
- Existing three-sample world->node affine projector remains unchanged.
- HF7 LoAF diagnostics remain present.
- Pointer queue state remains execution-only.

## Machine evidence

- HF1-HF8 inherited machine conformance chain: PASS.
- HF8 Pointer-Move Frame Coalescing Conformance: 17/17 PASS.
- HF8 focused Jest: 2 suites / 13 tests PASS.
- 120 raw pointer samples before one rAF -> 1 transient preview patch.
- Final pointer release -> exactly 1 persistent Collider command.
- Full Unit Node: 215 suites / 1105 tests PASS.
- Full Unit DOM: 3 suites / 33 tests PASS.
- Integration: 12 suites / 13 tests PASS.
- Smoke: 1 suite / 1 test PASS.
- Permanent Regression: 42/42 PASS.
- TypeScript scope / compiler gate: PASS.
- ESLint correctness: PASS.

## Browser re-test

Use `START-EDITOR-PRODUCTION.bat`, then perform a 5 second active drag Capture for:

- Rectangle width / corner;
- Capsule radius / height;
- Circle radius.

Inspect:

```text
averageFps
frameP95Ms
untrackedAverageMs
browserMainThread.topScripts
browserMainThread.topFrames
counters.colliderPointerSamples
counters.colliderPointerFlushes
Collider Authoring Preview
Collider Pointer / Layout
```

The key question is whether the ReactDOM `#document.onpointermove` attribution collapses after preview work moves to one animation-frame flush.
