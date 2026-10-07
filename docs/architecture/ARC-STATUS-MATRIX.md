# NGVGE ARC Status Matrix

**Schema:** `ngvge-arc-status-matrix/v1`
**Baseline phase:** 0009-E
**Updated:** 2026-08-12

| Record | Type | Status | Execution | Enforcement |
|---|---|---|---|---|
| ARC-0001 | Architecture Record | Architecture Frozen | Formal freeze complete | Highest Architecture Constraint |
| ARC-C001 | Conformance Specification | Approved / Active | C001.1 minimum baseline certified; 0009 unlocked | Seven minimum gates active/manual; Blocking CI not yet active |
| 0008 Runtime Scene Graph | Runtime Milestone | Architecture Frozen | Complete | Freeze baseline |
| Scene System V2.1 | Subsystem Baseline | Browser Validated / Freeze Baseline | Complete | Permanent regression protected |
| ARC-C001.0 | Execution Phase | Complete | A/B/C/D complete | Documentation/conformance baseline frozen |
| ARC-C001.1 | Execution Phase | Complete | Minimum baseline certified | Certified entry baseline for 0009 |
| ARC-C001.1-A | Execution Subphase | Browser Validated / Complete | Capability teardown hotfix revalidated | Active manual Import Boundary |
| ARC-C001.1-B | Execution Subphase | Complete | Stable Identity Foundation complete | Active manual Stable Identity Gate |
| ARC-C001.1-C | Execution Subphase | Complete | Persistent DTO Foundation complete | Active manual Persistent DTO Gate |
| ARC-C001.1-D | Execution Subphase | Complete | Schema Registry Foundation complete | Active manual Schema Registry Gate |
| ARC-C001.1-E | Execution Subphase | Complete | Authority Registry Foundation complete | Active manual Authority Registry Gate |
| ARC-C001.1-F | Execution Subphase | Complete | Protocol DTO Foundation complete | Active manual Protocol DTO Gate |
| ARC-C001.1-G | Execution Subphase | Complete | Scratch Adapter Boundary Gate complete | Active manual Scratch Adapter Boundary Gate |
| ARC-C001.1-H | Execution Subphase | Complete / Certified | Minimum Baseline Certification PASS | 0009 entry unlocked |
| 0009 Transform System | Runtime Milestone | Complete / Certified | 0009-E machine DoD 12/12 PASS; Browser Verify PASS | ARC-0001 + certified C001.1 baseline + active 0009-A/B/C/D/E gates |
| 0009-A | Execution Subphase | Complete | Transform2D Semantic Contract Foundation complete | Active manual Transform2D semantic gate |
| 0009-B | Execution Subphase | Complete | Runtime / Persistent Component Wiring complete | Active manual Runtime/Persistent Transform wiring gate |
| 0009-C | Execution Subphase | Complete | Scratch Compatibility Transform Projection complete | Active manual Scratch → NGVGE Transform projection gate |
| 0009-D | Execution Subphase | Complete | Editor PatchComponent Compatibility Bridge complete | Active manual Transform editor command bridge gate |
| 0009-E | Execution Subphase | Complete / Certified | Machine Transform DoD 12/12 PASS; Windows Chrome Browser Verify PASS | Active Transform DoD certificate + browser verification evidence |

## Current minimum readiness

```text
Import Boundary Gate          COVERED
Stable Identity Types         COVERED
Persistent DTO Validator      COVERED
Schema Registry Foundation    COVERED
Authority Registry            COVERED
Protocol Command Foundation   COVERED
Scratch Adapter Boundary      COVERED

Satisfied                     7 / 7
Certification                 PASS
0009                          COMPLETE / CERTIFIED / 0009-E DoD 12/12 + BROWSER PASS
```

## Conformance domain status

All seven ARC-C001 domains remain `Partial`; C001.1-B/C/D/E/F/G establish the minimum Identity, Persistence, Schema, Authority, Protocol and Scratch Compatibility foundations without claiming whole-domain completion.

| Domain | Coverage | Current generic foundation | 0009 blocker |
|---|---|---|---|
| Identity | Partial | Stable Identity active/manual | No active ARC debt |
| Schema | Partial | Schema Registry active/manual | No minimum blocker |
| Authority | Partial | Authority Registry active/manual | No minimum blocker |
| Protocol | Partial | Protocol DTO active/manual | No minimum blocker |
| Lifecycle | Partial | Partial | No direct minimum blocker |
| Serialization | Partial | Persistent DTO active/manual | No structural DTO minimum blocker |
| Compatibility | Partial | Scratch Adapter Boundary active/manual | No remaining C001.1 implementation blocker; semantic trace remains later work |

Active Architecture Waivers: **0**. `ARC-DEBT-0001` is **resolved** by C001.1-B and `GOV-DEBT-0002` is **resolved** by C001.1-G. The seven C001.1 minimum implementation requirements are satisfied and C001.1-H remains the certified 0009 entry baseline. 0009-A through 0009-D are complete; 0009-E machine DoD certification is 12/12 PASS and the real Windows Chrome Browser Verify is PASS. The previous external Chromium-policy evidence hold is resolved, so 0009 Transform System is Complete / Certified. `GOV-DEBT-0001` remains later C001.6 work and is not a 0009 blocker.

Machine-readable authority: `ARC-STATUS-MATRIX.json` and `conformance/CONFORMANCE-STATUS-MATRIX.json`.
