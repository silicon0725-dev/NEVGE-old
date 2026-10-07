# WS-10A｜Verification Record

**Stage:** `WS-10A | Better Paint Tool Admission & Resource Editing Session Foundation`  
**Status:** `COMPLETE / VERIFIED`  
**Baseline:** `WS-9 COMPLETE / CERTIFIED` + `WS9-POST-CERT-HF1`  

## Stage-specific evidence

```text
Machine admission / boundary gate
18 / 18 PASS

Focused Jest
Node: 5 suites / 31 tests PASS
DOM:  3 suites / 15 tests PASS
Total: 8 suites / 46 tests PASS

WS-10A production Webpack entries
src/lib/editor-shell/paint-tool-runtime.js
src/components/workspace-paint/workspace-paint.jsx
src/lib/editor-shell/tool-capability-descriptors.js
0 errors / 0 warnings PASS

Full Editor Webpack
src/playground/editor.jsx
0 errors / 0 warnings PASS
```

The complete Editor entry initially exceeded synchronous command windows while Babel compiled the large renderer dependency. The same validator was then allowed to complete without changing source; it finished with `0 errors / 0 warnings`. The completed result is the verification evidence.

## Full regression evidence

```text
Full Unit
Node: 139 suites / 760 tests PASS
DOM:    3 suites / 27 tests PASS
Total: 142 suites / 787 tests PASS

Integration
4 suites / 5 tests PASS

Smoke
1 suite / 1 test PASS

TypeScript
PASS

ESLint correctness
PASS

Permanent Regression
19 / 19 PASS
```

## Frozen architecture / containment evidence

```text
ARC-C001.1 baseline
7 / 7 PASS

LSC-G1 machine certification
19 / 19 PASS

LRC-G1 machine certification
15 / 15 PASS

LPL-G1 machine certification
17 / 17 PASS

LEX-G1 machine certification
19 / 19 PASS

COL-0 machine DoD
15 / 15 PASS
```

## Workspace cumulative evidence

WS-7's historical validator contained a source-layout-specific assertion for the Agent bootstrap. WS-10A inserted the Paint session in the same GUI bootstrap region, exposing that the validator was checking obsolete adjacency/legacy callback text rather than the already-certified Agent semantics. The permanent assertion was corrected to require exactly one Agent runtime composed over the shared Workspace Node boundary and admitted Context capability; the Agent production/runtime behavior was not changed by this correction.

After the correction:

```text
WS-7 focused
29 / 29 machine PASS
7 suites / 34 tests PASS

WS-8
28 / 28 machine PASS
6 suites / 22 tests PASS

WS-9A
12 / 12 machine PASS

WS-9B
12 / 12 machine PASS

WS-9C
12 / 12 machine PASS

WS-9D
13 / 13 machine PASS

WS-9E
14 / 14 machine PASS

WS-9F
15 / 15 machine PASS

WS-9G
16 / 16 machine PASS

WS-9H
17 / 17 machine PASS

WS-9I
18 / 18 machine PASS

WS-9 Aggregate Certification
20 / 20 PASS
```

Historical WS-9 certification still records that Paint was not activated *at the time WS-9 was certified*. WS-10A does not rewrite that historical statement; it proves that the already-certified infrastructure can subsequently admit an approved high-capability tool.

## Verified authority properties

- `ngvge.tool.paint` is a managed Workspace Tool, not an independent DOM application.
- Paint does not own WindowManager, Dock, Context, Resource, Project or persistence authority.
- Paint consumes canonical `ngvge:resource:*` identity through `resource-read#query`.
- Paint has no `resource-command#mutate` surface.
- Paint metadata commit is `Proposal -> Review -> fresh Evidence -> Project transaction`.
- Rollback requires fresh rollback Review Evidence.
- The WS-10A Paint runtime does not call raw Scratch VM/renderer/costume mutation APIs.
- `scratch-paint@2.1.61` is approved only behind the replaceable adapter seam documented by `ADR-WS10A-SCRATCH-PAINT-INTAKE`.
- Better Terminal remains `PLANNED` and absent from ToolRegistry.

## Result

`WS-10A` satisfies its current Definition of Done and is frozen as `COMPLETE / VERIFIED`.
