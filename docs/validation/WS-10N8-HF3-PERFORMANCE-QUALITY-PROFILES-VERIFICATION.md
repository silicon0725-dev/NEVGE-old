# WS-10N8-HF3 Verification

Current state: MACHINE VERIFIED / BROWSER EVIDENCE INSUFFICIENT / SUPERSEDED FOR ROOT-CAUSE DIAGNOSIS BY HF4.

## Machine evidence

- HF3 Conformance: **13/13 PASS**.
- HF3 focused: **8 suites / 31 tests PASS**.
- Full Unit Node: **212/212 suites / 1094/1094 tests PASS**.
- Full Unit DOM: **3/3 suites / 33/33 tests PASS**.
- Integration: **12/12 suites / 13/13 tests PASS**.
- Smoke: **1/1 PASS**.
- Permanent Regression: **37/37 PASS**.
- TypeScript scope validation: **PASS**.
- TypeScript `tsconfig.02agent.json`: **PASS**.
- ESLint correctness source/tooling + tests: **PASS**. Legacy style-debt lint is not claimed.
- ARC-C001.1 Minimum Baseline: **7/7 PASS, 0 waivers, 0 blockers**.
- 0009 Transform2D A/B/C/D/E + DoD: **PASS**.
- LRC-G1: **PASS**.
- LPL-G1: **PASS**.
- LEX-G1: **19/19 PASS**.
- LSC-G1: **19/19 PASS**.
- COL-0: **15/15 PASS**.
- Production Node Explorer Webpack: **PASS, 0 errors / 0 warnings**.
- Full Editor Webpack: **BLOCKED / NOT CERTIFIED in this validation container** because N8 declares `@dimforge/rapier2d-compat` but the inherited validation `node_modules` does not contain that package. Webpack reports `Can't resolve '@dimforge/rapier2d-compat'`. Apply N8/N8-HF1/HF2/HF3 to a normal source checkout and run `bun install` before browser/production verification.

## Verified behavior

- Render quality presets mutate independently and expose 50%/75%/100% NGVGE canvas scale with 20/30/60 Hz refresh budgets.
- Physics quality changes the live Physics2D fixed step between 30/45/60 Hz and catch-up budget between 2/4/8 without mutating authored RigidBody2D data.
- The default Physics quality is Precise/60 Hz, preserving pre-HF3 N8 behavior.
- Debug detail limits are forwarded before Collider/TileMap collision projection materialization (`300 / 1000 / 5000`).
- TileMap AABB collision providers obey `maxResults` and stop generating extra projections after the requested budget.
- Collision Debug, passive TileMap rendering and TileMap authoring canvases consume Render Quality.
- HF1/HF2 collision/TileMap/Physics optimization contracts remain green in the permanent regression layer.

## Browser evidence result

Browser validation was performed on the previously lagging large TileMap / Physics workload. Even with the lowest tested combination — Render `Performance`, Physics `Performance`, Debug `Light` — visible frame drops remained. Therefore HF3 quality scaling is verified as functional but **insufficient to identify or remove the dominant browser hotspot**.

HF3 is not a Freeze gate for N8. Root-cause isolation continues in **WS-10N8-HF4｜Frame-Time Profiler & Root-Cause Isolation**.

## Original browser acceptance checklist

1. Quality panel is visible in editor Stage.
2. Render `Performance` visibly lowers NGVGE TileMap/Collision Debug canvas resolution and refresh load while Scratch authored content remains intact.
3. Render `Quality` restores full-resolution / 60 Hz NGVGE overlay policy.
4. Physics `Performance` reports/behaves at 30 Hz; `Balanced` at 45 Hz; `Precise` restores 60 Hz.
5. Switching Physics Quality does not move authored nodes or rewrite RigidBody2D/Collider2D/TileMap data.
6. Debug `Light` limits dense collision-shape visualization and improves large-map responsiveness relative to Balanced/Full.
7. `Collision Shapes Off / Selected / All` and `Contacts` preserve their independent behavior under every quality profile.
8. Compare the same large TileMap + active RigidBody workload at Render Performance/Balanced/Quality and Physics Performance/Balanced/Precise; record whether frame drops become acceptable on the target machine.
9. Direct Collider/TileMap editing remains responsive despite background refresh throttling.
10. Reload/stop the project and confirm quality switching did not persist unintended gameplay state.
