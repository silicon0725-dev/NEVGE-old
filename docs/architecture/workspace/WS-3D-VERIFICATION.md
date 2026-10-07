# WS-3D Verification | Dock Organization

**Status:** COMPLETE / VERIFIED
**Date:** 2026-08-13

## Focused evidence

```text
npm run test:workspace-shell:ws3d:focused
```

Result:

```text
WS-3D Machine Gate: 45/45 PASS
Focused Jest: 2 suites / 16 tests PASS
```

The focused tests cover stable organization identity, schema validation, one-container-per-Tool membership, Group/Folder creation, membership movement, dissolve, labels, Separator projection, transient Folder expanded state, user-facing organization menu, and preservation of ToolId/WindowManager authority boundaries.

## Workspace cumulative evidence

```text
npm run test:workspace-shell:ws3d
```

Result: **exit 0 / PASS**.

This cumulatively preserves RE-3 → RE-5 and WS-0 → WS-3C before running WS-3D.

## Cross-stage evidence

The following gates were independently executed on the WS-3D final production code tree and passed:

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
105 suites / 578 tests PASS

Unit / DOM
3 suites / 26 tests PASS

Unit total
108 suites / 604 tests PASS

Integration
4 suites / 5 tests PASS

Smoke
1 suite / 1 test PASS

TypeScript
PASS

ESLint correctness
source/tooling PASS
tests PASS
```

## Real Webpack evidence

Dock production entry:

```text
npm run test:workspace-shell:ws3d-webpack

entry: src/components/workspace-dock/workspace-dock.jsx
webpack.config.js[0]
exit code: 0
errors: 0
warnings: 0
PASS
```

Full production Editor entry:

```text
npm run test:workspace-shell:ws3d-webpack-editor

entry: src/playground/editor.jsx
webpack.config.js[0]
exit code: 0
errors: 0
warnings: 0
PASS
```

The full Editor entry is important because WS-3D adds production `gui.jsx` construction/wiring for `DockOrganizationModel`; the Dock-only entry does not by itself prove that GUI integration resolves.

## Architecture assertions

1. Group/Folder/Separator are Dock metadata identities, not ToolIds.
2. One ToolId has at most one Group/Folder membership.
3. Global Tool order remains owned by DockRuntimeModel.
4. Window lifecycle/geometry/focus remains owned by WindowManager.
5. Folder expanded state is transient runtime state, not preference v1 data.
6. Organization preference is runtime-only until WS-4.
7. No Scratch/renderer/backend identity enters organization preference.
8. WS-3E Launchpad and WS-3F animation remain deferred.
