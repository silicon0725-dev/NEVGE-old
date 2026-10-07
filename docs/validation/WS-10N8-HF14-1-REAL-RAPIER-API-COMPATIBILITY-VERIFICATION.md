# WS-10N8-HF14.1｜Real Rapier API Compatibility Verification

Machine verification:

- HF14 Shape-Aware conformance: 12/12 PASS.
- HF14.1 real API conformance: 4/4 PASS.
- Focused Rapier/Physics/Character tests: 6 suites / 18 tests PASS.
- Permanent regression: 47/47 PASS.
- Full Unit Node: 217 suites / 1115 tests PASS.
- Full Unit DOM: 3 suites / 33 tests PASS.
- Integration: 12 suites / 13 tests PASS.
- Smoke: 1/1 PASS.
- TypeScript scope/compiler: PASS.
- ESLint correctness source/tooling + tests: PASS.

Browser re-test gate:

1. Production report must contain `diagnosticsVersion: "WS-10N8-HF14.1"`.
2. Clicking the green flag must start Physics2D motion normally.
3. Rectangle/Circle/Capsule runtime behavior must remain functional before evaluating performance.
4. Only after functional start passes should Circle/Capsule performance be compared with the HF13 baselines.
