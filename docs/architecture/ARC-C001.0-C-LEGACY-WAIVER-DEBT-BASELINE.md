# ARC-C001.0-C｜Legacy Waiver / Debt Baseline

**Status:** COMPLETE
**Parent:** ARC-C001｜ARC-0001 Conformance Suite
**Baseline:** NGVGE 0008.9.7 Architecture Frozen + Scene System V2.1 + ARC-C001.0-B
**Date:** 2026-08-10

## Objective

Create a repository-authoritative distinction between:

1. ordinary technical debt;
2. conformance/governance debt;
3. external evidence holds;
4. legitimate Compatibility/Backend containment;
5. temporary Architecture Waivers;
6. non-waivable ARC conformance violations.

C001.0-C is documentation/governance work only. It does not change Runtime behavior, repair conformance findings, activate new gates or modify CI.

## Frozen baseline

```text
Active Architecture Waivers        0
Expired Architecture Waivers       0
Non-waivable findings               1
Accepted technical debt             5
Conformance governance debt         2
External evidence holds             2
```

## Critical finding

C001.0-C discovered that target-backed Project Node identities in `src/lib/project-nodes/node-database.js` are initially derived from Scratch `target.id` and then persisted in the `ngvge-node-tree` Project Model section.

Because the affected identity is Project Model data, the issue is not legally waivable under ARC-0001's waiver policy. It is registered as:

```text
ARC-DEBT-0001
Persistent target-backed Project Node identity derives from Scratch target.id
Status: OPEN / NON-WAIVABLE
Required resolution: ARC-C001.1 Stable Identity + Scratch Adapter Boundary
Blocks 0009 unlock: YES
```

The contract remains frozen; the implementation is explicitly recorded as partially conformant until remediation.

## Important non-waiver classifications

The following do **not** create architecture exceptions:

- 5683 legacy ESLint style/maintenance diagnostics;
- scoped TypeScript coverage;
- Scene performance profiling work;
- webpack 4 modernization;
- Git working-tree schema completeness debt;
- R10 clean-install/build evidence holds;
- Scratch objects inside the declared Scratch Compatibility Adapter;
- Host-local Scratch VM/JSZip/binary handling;
- read-only legacy Scene snapshot migration.

## Governance consequence

C001.1 may not “solve” `ARC-DEBT-0001` by adding a waiver. It must establish backend-independent stable identity and compatibility binding semantics while preserving existing project identity through migration.

## Scope isolation

This phase changes `docs/architecture/**` only.

It does not:

- modify `src/**`;
- modify tests/validators;
- change package scripts;
- change CI;
- add `src/core`;
- repair `ARC-DEBT-0001`;
- activate waiver-expiry enforcement.

## Evidence

- `LEGACY-WAIVERS.md` / `.json`
- `TECHNICAL-DEBT-BASELINE.md` / `.json`
- `conformance/WAIVER-BASELINE.md`
- `ARC-STATUS-MATRIX.md` / `.json`

## Next phase

```text
ARC-C001.0-D
Conformance Status Matrix Completion
```

C001.0-D will merge the Existing Gate Inventory with this waiver/debt baseline to assign formal per-domain coverage/gap status and the exact C001.1 promotion/remediation obligations.
