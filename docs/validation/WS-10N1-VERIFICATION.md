# WS-10N1 Verification

**Stage:** Node-scoped Transform Writer Routing  
**Status:** MACHINE VERIFIED / BROWSER N/A (non-presentation stage)

## Stage-specific evidence

```text
npm run test:node-plan:ws10n1:focused
```

Covers:

- WS-10N0 foundation inheritance;
- 17-point N1 machine conformance gate;
- native/unbound route;
- Scratch bound/offline/missing routes;
- volatile Scratch target recreation;
- native non-uniform/negative XY scale;
- native persistent commit;
- component identity failure containment;
- inherited 0009-D Scratch command bridge.

## Permanent regression

`test/regression/contracts/transform2d-writer-routing.js` permanently checks:

```text
unbound NodeId → ngvge.native.transform
Scratch binding → scratch.compat.transform
runtime target recreation → no ownership change
volatile target identity → does not escape route view
```

## Required inherited gates

The stage must not be called verified unless these continue to pass:

```text
0009-E Transform2D DoD
ARC-C001.1 baseline
WS-10N0 machine/focused
Permanent regression
Integration
Smoke
TypeScript
ESLint correctness
LRC-G1
LPL-G1
LEX-G1
LSC-G1
COL-0
```

A command timeout before a final aggregate is recorded as `INCONCLUSIVE`, never PASS.

## Browser evidence

No production presentation/UI behavior is introduced in N1. Browser evidence is therefore not an exit requirement. Browser evidence becomes mandatory again when N2/N3 exposes node creation, Inspector editing, viewport transforms, or Camera presentation.
