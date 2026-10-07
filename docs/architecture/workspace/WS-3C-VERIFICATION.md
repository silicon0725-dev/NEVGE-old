# WS-3C Verification

**Stage:** WS-3C | Dock Placement & Geometry
**Status:** COMPLETE / VERIFIED
**Date:** 2026-08-13

## Focused evidence

```text
WS-3C Machine Gate
43 / 43 PASS

Jest
2 suites / 13 tests PASS
```

Covered properties include:

- stable placement model and versioned preference identities;
- top / bottom / left / right;
- start / center / end;
- finite offsetX / offsetY with screen-axis semantics;
- horizontal/vertical orientation projection;
- fail-closed unknown preference fields;
- runtime-only preference state;
- no WindowManager/Scratch/backend identity in placement schema;
- data-driven CSS geometry;
- orientation-aware toolbar accessibility and keyboard reorder;
- no WS-3D/3E/3F behavior leakage.

## Workspace cumulative evidence

`npm run test:workspace-shell:ws3c` returned **exit 0**.

This cumulatively preserved:

```text
RE-3 → RE-5
WS-0
WS-1
WS-2
WS-3A
WS-3B
WS-3C
```

CSS/PostCSS compilation, WS-3A projection invariants and WS-3B interaction invariants remained PASS.

## Cross-stage containment evidence

On the same production tree:

```text
LSC-G1   PASS
LRC-G1   PASS
LPL-G1   PASS
LEX-G1   PASS
COL-0    PASS

0009-E               12 / 12 PASS
Permanent Regression 19 / 19 PASS
```

## General regression evidence

```text
Unit / Node
104 suites / 567 tests PASS

Unit / DOM
3 suites / 26 tests PASS

Total Unit
107 suites / 593 tests PASS

Integration
4 suites / 5 tests PASS

Smoke
1 suite / 1 test PASS

TypeScript
PASS

ESLint correctness
PASS
```

## Webpack evidence

```text
npm run test:workspace-shell:ws3c-webpack

entry:
src/components/workspace-dock/workspace-dock.jsx

webpack:
webpack.config.js[0]

exit code: 0
errors: 0
warnings: 0
PASS
```

This entry resolves the real WorkspaceDock JSX, CSS Modules, DockInteractionController, DockRuntimeModel and DockPlacementModel through the project production loader configuration.

## Persistence boundary

No localStorage/sessionStorage/windowStateStorage writer was added for placement. The preference schema is a runtime seam for WS-4 and is not yet Workspace persistence authority.
