# NGVGE Architecture Record Index

**Baseline:** 0009-E｜Transform DoD Certification / Browser Verify
**Updated:** 2026-08-12
**Highest authority:** ARC-0001｜Kernel Independence Contract

## Active / frozen records

| ID | Title | Parent | Status | Enforcement / next action |
|---|---|---|---|---|
| ARC-0001 | Kernel Independence Contract | — | Architecture Frozen | Highest Architecture Constraint; formal freeze completed by R10 |
| ARC-C001 | ARC-0001 Conformance Suite | ARC-0001 | Approved / Active | C001.1 minimum baseline certified; 0009 unlocked; Blocking merge policy not yet activated |

## Planned subordinate ARCs

These records are roadmap entries from the ARC Master Plan; C001.0-A/B do not activate or author their normative specifications.

| ID | Title | Planned relationship / timing |
|---|---|---|
| ARC-0002 | Engine Protocol Model | Parent ARC-0001; proposed after ARC-C001 Phase 1 |
| ARC-0003 | Authority and Projection Model | Parent ARC-0001 |
| ARC-0004 | Component Schema and Migration Contract | Parent ARC-0001 |
| ARC-0005 | Module Lifecycle Contract | Parent ARC-0001 |
| ARC-0006 | Deterministic Runtime Profile | Parent ARC-0001 |
| ARC-0007 | Persistent Identity and Resource Identity | Parent ARC-0001 |
| ARC-0008 | Scratch Compatibility Boundary | Parent ARC-0001 |
| ARC-0009 | Project Source, Import Cache and Runtime Packaging | Suggested long-term ARC; Parent ARC-0001 |
| ARC-0010 | Backend Capability Negotiation | Suggested long-term ARC; Parent ARC-0001 |
| ARC-0011 | Native Module ABI | Suggested long-term ARC; Parent ARC-0001 |
| ARC-0012 | Transactional Hot Reload and Runtime Replacement | Suggested long-term ARC; Parent ARC-0001 |

## Repository authority order

```text
ARC-0001
↓
Other Architecture Records
↓
Conformance Specifications
↓
Subsystem Specifications
↓
Task Designs
↓
Implementation
```

A permanent change to ARC-0001 requires a formal Superseding ARC. Task documents, implementation notes and waivers cannot weaken ARC-0001.

## Current execution

```text
ARC-C001.0    Documentation Freeze & Baseline         COMPLETE
ARC-C001.1-A  Semantic Ownership / Import Boundary    BROWSER VALIDATED / COMPLETE
ARC-C001.1-B  Stable Identity Foundation              COMPLETE
ARC-C001.1-C  Persistent DTO Foundation               COMPLETE
ARC-C001.1-D  Schema Registry Foundation              COMPLETE
ARC-C001.1-E  Authority Registry Foundation           COMPLETE
ARC-C001.1-F  Protocol DTO Foundation                 COMPLETE
ARC-C001.1-G  Scratch Adapter Boundary Gate           COMPLETE
ARC-C001.1-H  Minimum Baseline Certification          COMPLETE / CERTIFIED
0009          Transform System                        COMPLETE / CERTIFIED
0009-A        Transform2D Semantic Contract Foundation COMPLETE
0009-B        Runtime / Persistent Component Wiring    COMPLETE
0009-C        Scratch Compatibility Projection          COMPLETE
0009-D        Editor PatchComponent Compatibility Bridge COMPLETE
0009-E        Transform DoD Certification / Browser Verify COMPLETE / CERTIFIED
```


## 0009 execution evidence

| ID | Title | Status | Evidence |
|---|---|---|---|
| 0009-A | Transform2D Semantic Contract Foundation | Complete | `0009-A-TRANSFORM2D-SEMANTIC-CONTRACT-FOUNDATION.md` |
| 0009-B | Runtime / Persistent Component Wiring | Complete | `0009-B-TRANSFORM2D-RUNTIME-PERSISTENT-COMPONENT-WIRING.md` |
| 0009-C | Scratch Compatibility Transform Projection | Complete | `0009-C-SCRATCH-COMPATIBILITY-TRANSFORM-PROJECTION.md` |
| 0009-D | Editor PatchComponent Compatibility Bridge | Complete | `0009-D-EDITOR-PATCHCOMPONENT-COMPATIBILITY-BRIDGE.md` |
| 0009-E | Transform DoD Certification / Browser Verify | Complete / Certified — Machine 12/12 + Browser PASS | `0009-E-BROWSER-VERIFICATION-PASS.json` |

## Waiver / debt baseline

C001.0-C establishes `LEGACY-WAIVERS.*` and `TECHNICAL-DEBT-BASELINE.*`. C001.0-D freezes `conformance/CONFORMANCE-STATUS-MATRIX.*` and converts the inventory/debt findings into the exact C001.1 implementation inputs. Active Architecture Waivers are zero. `ARC-DEBT-0001` was non-waivable and is resolved by C001.1-B. `GOV-DEBT-0002` is resolved by C001.1-G now that Scratch Adapter boundary semantics have an active/manual Conformance Gate. C001.1-H is complete: the seven minimum gates are certified together and 0009 is unlocked for entry. `GOV-DEBT-0001` remains later C001.6 governance work and is not a 0009 blocker.
