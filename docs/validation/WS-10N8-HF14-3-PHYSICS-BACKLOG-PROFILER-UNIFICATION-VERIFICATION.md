# WS-10N8-HF14.3 Verification

Status: MACHINE VERIFIED / BROWSER RE-TEST REQUIRED

Machine evidence:

- HF14.3 conformance: 9/9 PASS
- HF14.3 focused: 5 suites / 16 tests PASS
- Permanent regression: 49/49 PASS
- Full Unit Node: 217 suites / 1117 tests PASS
- Full Unit DOM: 3 suites / 33 tests PASS
- Integration: 12 suites / 13 tests PASS
- Smoke: 1/1 PASS
- TypeScript scope/compiler: PASS
- ESLint correctness source/tooling + tests: PASS

Browser re-test requirements:

1. Confirm `diagnosticsVersion: WS-10N8-HF14.3`.
2. Run the same Circle and Capsule physics/collision scenarios used for HF14.2.
3. Inspect `Runtime Scheduler Frame · physics2d`, `Physics2D`, `Physics Backend Step`, `Physics Descriptor Sync`, and `Physics Transform Writeback`.
4. Inspect `physicsFixedSteps`, `physicsBacklogDrops`, `physicsDroppedBacklogSteps`, and `physicsSchedulerBudgetExhaustions`.
5. Compare FPS, frame P95, LoAF P95, and `runTick` duration against HF14.2 baselines.

HF14.2 browser baselines with corrected shape order:

- Circle: ~32.8 FPS, frame P95 ~100 ms, runTick max ~113 ms.
- Capsule: ~23.4 FPS, frame P95 ~83.2 ms, runTick max ~103.6 ms.
