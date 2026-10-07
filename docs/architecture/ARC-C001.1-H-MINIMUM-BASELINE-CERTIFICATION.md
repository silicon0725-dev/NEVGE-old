# ARC-C001.1-H｜Minimum Baseline Certification

**Status:** Complete / Certified  
**Date:** 2026-08-11  
**Parent:** ARC-C001｜ARC-0001 Conformance Suite  
**Authority:** ARC-0001 Kernel Independence Contract  
**Decision:** `0009 Transform System` UNLOCKED FOR ENTRY

## 1. Purpose

ARC-C001.1-H is the certification closure for the Core Boundary Foundation. It does not add a new Core semantic subsystem. It proves that the seven minimum requirements defined for ARC-C001.1 exist together as executable, mutually consistent architecture gates and that no active waiver or unresolved architecture blocker prevents entry into `0009 Transform System`.

The certification is deliberately narrower than whole ARC-C001 completion. Identity, Schema, Authority, Protocol, Lifecycle, Serialization and Compatibility remain partially implemented domains, and Blocking Merge Policy remains assigned to ARC-C001.6.

## 2. Certified minimum baseline

```text
C001.1-A  Import Boundary Gate             COVERED
C001.1-B  Stable Identity Types            COVERED
C001.1-C  Persistent DTO Validator         COVERED
C001.1-D  Schema Registry Foundation       COVERED
C001.1-E  Authority Registry Foundation    COVERED
C001.1-F  Protocol DTO Foundation          COVERED
C001.1-G  Scratch Adapter Boundary Gate    COVERED

Minimum implementation coverage            7 / 7
Active Architecture Waivers                0
Unresolved C001.1 / 0009 blockers          0
Certification                              PASS
```

## 3. Certification gate

H adds an independent governance/certification checker:

```text
tools/conformance/check-c0011-minimum-baseline.js
tools/conformance/check-c0011-minimum-baseline.self-test.js
docs/architecture/ARC-C001.1-H-MINIMUM-BASELINE-CERTIFICATE.json
test/regression/contracts/c0011-minimum-baseline.js
```

Package entrypoints:

```text
test:conformance:c001.1-baseline
test:conformance:c001.1-baseline:self-test
test:conformance:c001.1-h
```

`test:conformance:c001.1-h` first executes the cumulative A→G conformance path and then validates the H certificate and governance state. A document-only `7/7` declaration is therefore insufficient to certify the baseline.

## 4. Machine-enforced certification invariants

The H checker fails closed unless all of the following remain true:

1. all seven required long-term conformance entrypoints exist;
2. the committed H certificate declares exactly seven covered requirements;
3. the certificate records `7/7`, zero active Architecture Waivers and zero blocking findings;
4. `LEGACY-WAIVERS.json` actually contains zero active waivers;
5. no unresolved technical-debt item declares `blocksC0011: true` or `blocks0009: true`;
6. `ARC-STATUS-MATRIX.json` records H as `complete / certified`;
7. `ARC-STATUS-MATRIX.json` records `0009` as `ready / unlocked-by-arc-c001.1-h`;
8. `CONFORMANCE-STATUS-MATRIX.json` independently reports 7/7 with no missing, historical or blocked minimum requirement;
9. the Conformance matrix agrees that C001.1 is certified and 0009 is ready;
10. Blocking Merge Policy remains `false`, preventing H from silently claiming C001.6 authority.

## 5. Unlock decision

The minimum architecture prerequisite for `0009 Transform System` is now satisfied.

```text
ARC-C001.1 Minimum Baseline
        CERTIFIED
            │
            ▼
0009 Transform System
        READY / UNLOCKED FOR ENTRY
```

This means 0009 may begin. It does **not** mean future Transform implementation may bypass the certified gates. In particular, Transform2D must enter through stable NodeId, versioned Schema, explicit Authority and Protocol DTO boundaries, while Scratch remains a compatibility Authority/Adapter rather than semantic identity.

## 6. Explicit non-claims

H does not claim:

- whole ARC-C001 completion;
- whole-domain `Covered` status for the seven conformance domains;
- Projection Loop Prevention or Mutation Context completion;
- Schema Migration Graph completion;
- full Persistent Data / Runtime Brand enforcement;
- generic Lifecycle Harness completion;
- Semantic Trace / deterministic runtime completion;
- Blocking CI or Blocking Merge Policy activation;
- clean-install / full-production-build external evidence closure.

These remain assigned to later ARC-C001 phases and existing non-blocking evidence holds.

## 7. Remaining governance debt

`GOV-DEBT-0001` remains open by design: architecture validators are not yet aggregate-test / CI merge authority. Its resolution belongs to ARC-C001.6 and does not block 0009 according to the frozen debt baseline.

External evidence holds `EVIDENCE-HOLD-0001` and `EVIDENCE-HOLD-0002` remain release reproducibility evidence, not Architecture Waivers and not 0009 blockers.

## 8. Acceptance

ARC-C001.1-H is accepted when:

- cumulative `test:conformance:c001.1-g` passes;
- H self-test passes destructive certification cases;
- H baseline checker passes;
- permanent regression layer includes and passes `c0011-minimum-baseline`;
- repository unit/smoke/integration/lint/typecheck and architecture entrypoint baselines remain green;
- governance documents and machine-readable matrices agree on `CERTIFIED / 0009 READY`.

Once accepted, ARC-C001.1 is complete and the next Runtime milestone is `0009 Transform System`.

## 9. Automated verification result

```text
C001.1-H cumulative certification      PASS
Minimum Baseline self-test              8 / 8 PASS
Minimum requirements                    7 / 7 COVERED
Active Architecture Waivers             0
Unresolved C001.1 / 0009 blockers       0
Permanent Regression                   14 / 14 PASS
Unit / Node                             68 suites / 347 tests PASS
Unit / DOM                               3 suites / 21 tests PASS
Unit total                              71 suites / 368 tests PASS
Smoke                                    1 / 1 PASS
Integration                              3 suites / 4 tests PASS
Scene lifecycle --detectOpenHandles      2 / 2 PASS
Architecture entrypoints                12 / 12 PASS
ESLint correctness                       PASS
TypeScript strict / noEmit               PASS
R6 Package Authority                     PASS
R8 Gate Integrity                        PASS
Production build                         INCONCLUSIVE: harness timeout; no compiler error observed before termination
```

The production build remains `EVIDENCE-HOLD-0002`: Webpack/Babel entered the normal production compilation path, emitted only the existing `spine-webgl.js` >500KB deoptimisation note, and was terminated by the 180-second execution harness. H does not reinterpret missing completion evidence as either PASS or FAIL.
