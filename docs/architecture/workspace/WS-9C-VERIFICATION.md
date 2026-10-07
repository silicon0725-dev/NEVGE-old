# WS-9C Verification

Status: COMPLETE / VERIFIED

## Focused evidence

Final post-quarantine verification:

- WS-9C machine gate: `12/12 PASS`
- Runtime/Context/Window focused Jest: `3 suites / 21 tests PASS`
- Project Explorer + Asset Manager DOM focused Jest: `2 suites / 24 tests PASS`
- WS-9C real Webpack production-source entries: `0 errors / 0 warnings`

The Webpack entry gate compiles:

- `src/lib/editor-shell/workspace-context-runtime.js`
- `src/components/project-explorer/project-explorer.jsx`
- `src/components/project-assets/project-asset-manager.jsx`

## Full Unit evidence

Final unit run after the project-load quarantine race fix:

- Node environment: `129 suites / 686 tests PASS`
- DOM harness: `3 suites / 27 tests PASS`
- Total: `132 suites / 713 tests PASS`

## Cross-domain evidence

Final post-quarantine checks:

- TypeScript scope/typecheck: PASS
- correctness ESLint source/tooling + tests: PASS
- Integration: `4 suites / 5 tests PASS`
- Smoke: `1 suite / 1 test PASS`
- Permanent Regression: `19/19 PASS`

Containment / semantic boundary certification was also rerun after the lifecycle quarantine change:

- LSC-G1 Credentials & Unsafe Agent Containment: PASS (`19/19` machine + `7/7` certification tests)
- LRC-G1 Runtime Policy Containment: PASS
- LPL-G1 Project Lifecycle Consolidation: PASS
- LEX-G1 Extension/Addons Containment: PASS
- COL-0 Stable Semantic Collaboration Boundary: PASS (`15/15` machine + `4 suites / 12 tests`)
- ARC-C001.1 minimum baseline remains covered by Permanent Regression: PASS (`7` baseline requirements)

## Lifecycle/race evidence

WS-9C explicitly tests the root project-load boundary:

```text
root load start
    ↓
projectBoundaryActive = true
    ↓
clear Project / Scene / Node / Resource Context
    ↓
ignore Scene/Node/Resource republish attempts while load is in-flight
    ↓
root load settle
    ↓
projectBoundaryActive = false
    ↓
reproject Project generation + active Scene
```

This prevents stale events from the previous project from racing back into Workspace Context during a project switch.

A failed load restores the unchanged Project Lifecycle generation identity and current Scene projection, while stale Node/Resource selections remain cleared.

## Identity evidence

Current project serialization still has no persistent canonical Project Model ProjectId suitable for this Context contract. WS-9C therefore uses:

```text
ProjectLifecycleHost.projectGeneration = N
    ↓
ngvge.project-context.gN
```

This is explicitly **session-scoped Context identity**, not the future persistent ProjectId and not a Redux/server/Scratch/backend ID.

## Full Editor Webpack note

`test:workspace-shell:ws8-webpack-editor` was invoked during WS-9C verification. The large full Editor Babel/Webpack compile exceeded the execution environment's 120-second command limit before a terminal result was emitted. No compile error was emitted before timeout.

This result is recorded as **INCONCLUSIVE**, not PASS and not FAIL.

Unlike WS-9B, WS-9C does enter GUI production bootstrap, so this verification debt is kept explicit. The changed runtime binding and the two changed production UI source entries do have an explicit real Webpack `0 errors / 0 warnings` result, and TypeScript/ESLint/Unit/Integration/Smoke all pass.

## Behavioral freeze evidence

- Context is projection-only and owns no Project/Scene/Node/Resource/Window mutation authority.
- WindowManager remains the Window runtime authority.
- root Project load establishes a Context quarantine before dependent semantic projection resumes.
- Agent still uses `getCurrentNodeId()`; direct Context Service migration is intentionally deferred.
- future Tool consumers must receive Context through WS-9A capability admission rather than importing the service as a privileged shortcut.
