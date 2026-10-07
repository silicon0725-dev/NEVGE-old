# WS-10N8-HF4｜Frame-Time Profiler Verification

Status: MACHINE VERIFIED / BROWSER CAPTURE REQUIRED

## Trigger evidence

Real browser testing after HF3 reported that the lowest tested Render / Physics / Debug quality combination still produced visible frame drops. HF3 therefore did not establish quality level as the root cause. HF4 adds measurement rather than another guessed optimization.

## HF4 focused evidence

- HF1 inherited conformance: 12/12 PASS.
- HF2 inherited conformance: 15/15 PASS.
- HF3 inherited conformance: 13/13 PASS.
- HF4 Frame-Time Profiler conformance: 15/15 PASS.
- HF4 focused Jest: 6 suites / 17 tests PASS.

## Full regression evidence

- Full Unit / Node: 214 suites / 1097 tests PASS.
- Full Unit / DOM: 3 suites / 33 tests PASS.
- Integration: 12 suites / 13 tests PASS.
- Smoke: 1 suite / 1 test PASS.
- Permanent Regression: 38/38 PASS.
- TypeScript scope + strict 02Agent noEmit: PASS.
- ESLint correctness: PASS.
- ARC-C001.1 minimum baseline: 7/7 PASS, 0 active waivers, 0 blockers.
- 0009-E Transform DoD: 12/12 PASS.
- LRC-G1: 15/15 PASS.
- LPL-G1: 17/17 PASS.
- LEX-G1: 19/19 PASS.
- LSC-G1: 19/19 PASS.
- COL-0: 15/15 PASS.
- Node Explorer real production Webpack entry: PASS, 0 errors / 0 warnings.

Full Editor Webpack is not certified in this verification container because the N8 production dependency `@dimforge/rapier2d-compat` is declared but absent from the inherited node_modules install. HF4 adds no dependency.

## Probe behavior verified

- Profiler is disabled by default.
- Start installs temporary RAF / Scratch renderer / Scratch VM probes.
- Stop restores the renderer and removes VM listeners.
- Frame interval aggregation exposes FPS, P50/P95/P99 and long-frame percentage.
- Subsystem spans are wired into Physics2D, TileMap passive render, TileMap editor render, Collider preparation, Collider Canvas and React Stage overlays.
- Scratch renderer and Scratch VM execution are measured without changing semantic authority.
- Profiler data is runtime/editor-only and does not dirty or persist project state.
- `Capture 5s` is an explicit bounded diagnostic action.

## Browser evidence

REQUIRED.

Run a 5-second capture in the actual lagging scene while reproducing the frame drop. Copy or screenshot the report. The next optimization must target the measured dominant P95 category (or the untracked budget if it dominates).

Do not claim Physics2D, Collision Debug, TileMap, React or Scratch Renderer is the dominant browser hotspot before that capture.
