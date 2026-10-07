# WS-3F Verification | Minimize / Restore Animation

**Status:** COMPLETE / VERIFIED
**Date:** 2026-08-14

## Focused evidence

```text
npm run test:workspace-shell:ws3f:focused
```

Result:

```text
WS-3F Machine Gate: 26/26 PASS
WS-3 Dock Foundation DoD: 14/14 PASS
Focused Jest: 4 suites / 20 tests PASS
```

Focused tests cover post-commit minimize/restore observation, source and target geometry, missing-geometry soft skip, presentation-only completion, rapid supersede, disposal, controlled-window semantic ordering, transition-layer rendering and collapsed Folder target fallback.

## Workspace cumulative evidence

```text
npm run test:workspace-shell:ws3f
```

Result: **PASS** on the corrected WS-3E baseline.

This cumulatively preserves RE-3 → RE-5 and WS-0 → WS-3E before running WS-3F.

## Baseline reconstruction audit

During certification an earlier reconstruction was found to have applied the prefixed LRC-3 Overlay into a nested `NGVGE/NGVGE` directory. That tree was rejected as certification evidence.

The final baseline was rebuilt from the original source plus every certified/verified overlay with a normalized rule: one leading `NGVGE/` project prefix is stripped; already-rooted overlay paths remain rooted.

The corrected baseline independently passed:

```text
LRC-2 12/12
LRC-3 10/10
LRC-4 10/10
LRC-G1 15/15
WS-3C 43/43
WS-3D 45/45
WS-3E 41/41
```

Only then was the WS-3F delta applied and all final tests rerun.

## Cross-stage evidence

The following focused gates were independently executed on the corrected WS-3F production tree and passed:

```text
LSC-G1    19/19 Machine + 7/7 E2E
LRC-G1    15/15 Machine + 9/9 E2E
LPL-G1    17/17 Machine + 9/9 E2E
LEX-G1    19/19 Machine + 9/9 E2E
COL-0     15/15 Machine + 12/12 focused
0009-E    12/12
Permanent Regression 19/19
```

## Full regression evidence

```text
Unit / Node
110 suites / 601 tests PASS

Unit / DOM
3 suites / 26 tests PASS

Unit total
113 suites / 627 tests PASS

Integration
4 suites / 5 tests PASS

Smoke
1 suite / 1 test PASS

TypeScript
PASS

ESLint correctness
source/tooling PASS
tests PASS

Targeted full-rule ESLint for WS-3F source/tooling
PASS
```

## Real Webpack evidence

Transition production dependency graph:

```text
npm run test:workspace-shell:ws3f-webpack

entry: src/components/workspace-window-transition/workspace-window-transition.jsx
webpack.config.js[0]
exit code: 0
errors: 0
warnings: 0
PASS
```

Full production Editor entry:

```text
npm run test:workspace-shell:ws3f-webpack-editor

entry: src/playground/editor.jsx
webpack.config.js[0]
exit code: 0
errors: 0
warnings: 0
PASS
```

The full Editor entry proves the final GUI geometry providers, Dock target markers, TransitionModel construction/disposal and controlled DraggableWindow path compile together in the production dependency graph.

## Unified certification

```text
npm run test:workspace-shell:ws3f-certification
```

Final result on the corrected delivery tree:

```text
exit code: 0
WS-0 → WS-3F cumulative PASS
Transition production Webpack PASS
Full Editor production Webpack PASS
```

The aggregate wrapper itself returned successfully; no certification item remains pending.

## Architecture assertions

1. WindowManager commits minimize/restore semantic state before animation representation begins.
2. DockTransitionModel never mutates WindowManager.
3. Source geometry is derived from WindowManager state and Workspace viewport origin.
4. Target geometry is a Dock presentation projection keyed by stable ToolId.
5. Transition records contain no Scratch/backend identity.
6. Completion removes presentation state only.
7. Missing geometry skips animation without reverting semantic state.
8. Rapid opposite transitions supersede presentation records only.
9. Reduced-motion can skip animation without changing lifecycle semantics.
10. Restore hiding is a temporary presentation attribute, not Window state.
11. Animation introduces no persistence writer.
12. WS-3 overall DoD is independently machine-checked.
