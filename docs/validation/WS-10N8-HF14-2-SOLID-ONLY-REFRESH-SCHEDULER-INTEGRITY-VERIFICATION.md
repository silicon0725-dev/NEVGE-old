# WS-10N8-HF14.2 Verification

Status: MACHINE VERIFIED / BROWSER RE-TEST REQUIRED

## Machine evidence

- HF1 → HF14.2 inherited conformance chain: PASS
- HF14.2 conformance: 12/12 PASS
- HF14.2 focused: 5 suites / 24 tests PASS
- Permanent regression: 48/48 PASS
- Full Unit Node: 217 suites / 1115 tests PASS
- Full Unit DOM: 3 suites / 33 tests PASS
- Integration: 12 suites / 13 tests PASS
- Smoke: 1 suite / 1 test PASS
- TypeScript scope/compiler: PASS
- ESLint correctness source/tooling + tests: PASS

The real Rapier 0.19.3 compatibility test remains included and passes. Its upstream deprecated-init warning remains advisory and is not a test failure.

## Browser gate

Run the same Production runtime scene for Rectangle, Circle, and Capsule. A valid HF14.2 capture must show:

- `diagnosticsVersion = WS-10N8-HF14.2`
- `runtimeSchedulerInstrumentationV2 > 0`
- `runtimeSchedulerTicks > 0` while scheduler work is active

For a scene without Area2D/sensor colliders, expect:

- `colliderSolidOnlyRefreshSkips > 0`
- `Collider Runtime Refresh` near zero / low cost

The remaining long callback must then be attributable through `Runtime Scheduler One-Shot · ...` or `Runtime Scheduler Frame · ...`. If these categories are still absent while `runtimeSchedulerInstrumentationV2 > 0`, the profiler attribution implementation itself requires further inspection.

## Performance baseline before HF14.2

HF14.1 Production captures:

- Rectangle: 60 FPS, frame P95 ~17.1 ms
- Circle: ~22.3 FPS, frame P95 ~116.6 ms
- Capsule: ~12.5 FPS, frame P95 ~500 ms

HF14.2 is not frozen until Circle/Capsule runtime captures are reviewed.
