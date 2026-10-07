# 0009-E｜Transform DoD Certification / Browser Verify

**Parent:** 0009 Transform System  
**Authority:** ARC-0001 Kernel Independence Contract  
**Baseline:** 0009-D Editor PatchComponent Compatibility Bridge  
**Date:** 2026-08-12  
**Status:** **COMPLETE / CERTIFIED — MACHINE DoD 12/12 + BROWSER PASS**

## Decision

0009-E introduces no new Transform semantic model. Its purpose is to certify the twelve 0009 Transform System Definition-of-Done requirements as one cumulative executable contract, then close the milestone only after the planned real-browser verification is available.

Machine certification is **PASS 12/12**. The planned real-browser verification subsequently passed in the user-local Windows Chrome environment after the browser harness exposed and drove fixes for Service Facade target-array handling in the Scratch Sprite Adapter and Transform Projection Service.

Therefore:

```text
0009 Transform System
COMPLETE / CERTIFIED

0009-E machine DoD
12 / 12 PASS

0009-E browser verification
PASS

0009 final closure
COMPLETE
```

## Machine-certified Definition of Done

The active certificate is `0009-E-TRANSFORM-DOD-CERTIFICATE.json` and the cumulative entrypoint is:

```text
npm run test:conformance:0009-e
```

It certifies:

1. Transform2D has a versioned Schema.
2. Transform2D ownership is keyed by stable semantic NodeId.
3. Scratch Target representation does not enter Transform component records.
4. The current Writer is Scratch Compatibility Authority.
5. Projection is one-way Scratch → NGVGE.
6. Editor Transform mutation is expressible as a portable `PatchComponent` command.
7. Transform persistent state passes the Core Persistent DTO gate.
8. Scratch representation remains confined to the Compatibility Adapter boundary.
9. Transform semantic/runtime/projection layers do not import Scratch Renderer private objects.
10. The current one-way projection and replaceable command bridge preserve the future Authority-reversal seam.
11. Runtime Transform and Persistent Transform are separate states.
12. A 240-update high-frequency projection burst performs zero Project Source writes and leaves persistent Runtime Node export unchanged.

The 240-update proof is deliberately behavioral. It asserts the project object, project write count, Persistent Transform and exported Runtime Node persistent state remain unchanged while Runtime Transform follows Scratch Authority.

## Browser verification contract

The repository now contains:

```text
npm run test:browser:0009-e
```

implemented by `tools/browser/verify-0009-transform-browser.js`.

The browser contract launches Chromium through CDP, loads the configured NGVGE editor URL, waits for `window.vm`, enables `ngvge.scene-system`, and requires all of the following from the actual browser runtime:

- `ngvge.transform2d-runtime` is published;
- `ngvge.transform2d-command` is published;
- a real Scratch sprite binding exposes an NGVGE stable `NodeId`;
- Runtime Transform is readable through the backend-independent Transform capability.

This is intentionally stronger than a static bundle-load smoke test.

## Browser verification result

The original managed Chromium environment produced an external navigation-policy evidence hold before application JavaScript could execute. That hold is preserved as historical evidence in `0009-E-BROWSER-EVIDENCE-HOLD.json`.

The closure run was then executed in a user-local Windows Chrome environment through:

```text
npm run test:browser:0009-e
```

and returned `status: PASS`. The browser proof established all of the following in one live editor session:

- Scene System enabled successfully;
- `ngvge.transform2d-runtime` was published;
- `ngvge.transform2d-command` was published;
- a generated Scratch probe sprite reconciled to exactly one bound adapter record;
- the stable `BindingId` and `NodeId` remained unchanged across reconcile;
- Scratch runtime identity remained separate from semantic NodeId;
- the runtime Transform read through the semantic capability was `position [37, -23]`, `rotation 45`, `scale [1.25, 1.25]`.

Machine-readable closure evidence is stored in `0009-E-BROWSER-VERIFICATION-PASS.json`.

## Governance consequence

The twelve Master Plan Transform DoD requirements are machine-certified and the required real-browser verification is PASS. The prior browser-policy hold is resolved without an Architecture Waiver.

Current governance state:

```text
0009-A COMPLETE
0009-B COMPLETE
0009-C COMPLETE
0009-D COMPLETE
0009-E COMPLETE / CERTIFIED
0009   COMPLETE / CERTIFIED
```

ARC-0001 and the C001.1-H certified entry baseline remain authoritative.

## Explicit deferrals remain unchanged

0009-E does not claim the later ARC-C001.3 / ARC-0003 work:

- generic Mutation Context;
- generic Projection Loop Prevention;
- generic command transaction / rollback infrastructure;
- transactional Authority Switch;
- NGVGE-owned Transform Writer Authority.

Those are not silently introduced by the 0009 DoD certificate.

## Final regression evidence

```text
ARC-C001.1 minimum baseline                     7/7 PASS
0009-A cumulative semantic gate                 PASS
0009-B cumulative Runtime/Persistent gate       PASS
0009-C cumulative Scratch projection gate      PASS
0009-D cumulative Editor command bridge gate   PASS
0009-E machine DoD certificate                 12/12 PASS
Active Architecture Waivers                    0
0009 structural blockers                        0

Permanent Regression                           19/19 PASS
Unit / Node environment                         72 suites / 383 tests PASS
Unit / DOM harness                               3 suites / 21 tests PASS
Unit total                                      75 suites / 404 tests PASS
Smoke                                             1 suite / 1 test PASS
Integration                                       3 suites / 4 tests PASS
Scene lifecycle --detectOpenHandles               1 suite / 2 tests PASS
Architecture package entrypoints                 12/12 PASS
Import Boundary                                  PASS (15 Core files / 17 dependency refs)
Scratch Adapter Boundary                         PASS (39 sensitive source files; 3 suites / 20 tests)
Runtime Component Boundary                       PASS
ESLint correctness                               PASS
TypeScript strict/noEmit                         PASS
R6 package-manager authority                     PASS
R8 smoke/integration gate integrity              PASS
```

Existing Scratch VM `Central dispatch replacing existing service provider` warnings and Signature Injector logging were observed in existing tests and did not fail the suites.

## Production build evidence

A production build attempt entered the normal Webpack/Babel compilation path. The existing `scratch-render/src/spine_runtime/spine-webgl.js` greater-than-500-KB Babel de-optimization note and the existing Tapable deprecation warning were observed. The build remained in compilation beyond the execution window. The container timeout wrapper did not fully reap descendant compiler processes, so they were terminated explicitly afterward. No compiler error was observed before termination.

Result: **INCONCLUSIVE — execution/harness timeout; no compiler error observed.**

This is not represented as PASS and is not converted into an Architecture Waiver.
