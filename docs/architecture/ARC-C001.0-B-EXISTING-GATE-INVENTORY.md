# ARC-C001.0-B｜Existing Gate Inventory

**Status:** COMPLETE
**Parent:** ARC-C001｜ARC-0001 Conformance Suite
**Baseline:** NGVGE 0008.9.7 Architecture Frozen + Scene System V2.1 + ARC-C001.0-A
**Date:** 2026-08-10

## Objective

Inventory the frozen repository's existing architecture-oriented executable assets without migrating tests or changing Runtime behavior.

The output must distinguish:

1. active architecture entrypoints;
2. unique validators behind those entrypoints;
3. permanent regressions with direct ARC-0001 value;
4. historical validators that still contain useful semantics but are not active gate authority;
5. supporting correctness/CI gates;
6. missing generic ARC-C001 foundations.

## Frozen findings

```text
test:architecture:* entrypoints                 12
unique active architecture validators           27
historical standalone validators                 3
permanent regression contracts                   6
direct ARC-valued permanent regressions           5

architecture entrypoints in aggregate `test`      0
architecture entrypoints in CI workflow           0
```

The important governance finding is that the 0008 architecture validators are **executable evidence, not yet Blocking Conformance authority**. They can be invoked manually and were used during R10 certification, but the current aggregate test and Node CI workflow do not execute any `test:architecture:*` entrypoint.

## Domain result

| ARC-C001 domain | Existing coverage | C001.0-B status |
|---|---|---|
| Identity | Runtime Node/Component IDs, detached restore, Scene scope, historical Scratch Binding identity | Partial |
| Schema | Runtime Component schema/version/migration/cardinality/registry | Partial |
| Authority | Capability generation/revocation, host/client surfaces, revision/registry authority, mutation commit | Partial |
| Protocol | Portable Runtime Node API, sanitized errors, frozen snapshots, Scene JSON controller | Partial |
| Lifecycle | Runtime Node/Component/module lifecycle, reentrancy, provider lifetime, Scene disable/re-enable | Partial |
| Serialization | Persistent-data utility, Runtime persistence, Scene portable payload, SB3 reconstruction | Partial |
| Compatibility | Historical Scratch Adapter boundary, SB3 load/reconstruct, Scene binary boundary | Partial |

No domain is promoted to `Covered` because current evidence is 0008/subsystem-specific and is not yet a generic repository-wide ARC-C001 gate.

## C001.1 minimum-baseline assessment

| Required before 0009 | Current result |
|---|---|
| Import Boundary Gate | Missing |
| Persistent DTO Validator | Partial foundation |
| Stable Identity Types | Missing |
| Authority Registry | Missing |
| Protocol Command foundation | Missing |
| Schema Registry foundation | Partial foundation |
| Scratch Adapter Boundary Test | Historical, not active |

Therefore `0009 Transform System` remains **BLOCKED**.

## Reuse decisions

### Promote

- 0008.7.3 Scratch Adapter semantics → Scratch Adapter Boundary corpus.
- `persistent-data.js` + 0008.8 persistence semantics → Persistent DTO foundation.
- 0008.9.1.1 / 0008.9.5 / 0008.9.6* → Protocol portability/snapshot/error corpus.
- 0008.9.4.1.3–1.6 + capability validators → Authority/Lifecycle destructive corpus.
- Scene V2 boundary regressions → Backend Leakage / Capability Boundary destructive corpus.

### Do not relabel

- `git-myers-diff` remains product correctness regression.
- ordinary lint/typecheck remain quality gates.
- general Smoke remains supporting evidence unless a specific ARC invariant is encoded.

## Scope isolation

C001.0-B changes only `docs/architecture/**`.

It does not:

- move validator files;
- rename package scripts;
- wire architecture gates into CI;
- add `src/core`;
- alter Runtime behavior;
- change package manager/build configuration.

Those actions belong to later ARC-C001 phases.

## Evidence

- `docs/architecture/conformance/EXISTING-GATE-INVENTORY.md`
- `docs/architecture/conformance/EXISTING-GATE-INVENTORY.json`
- `docs/architecture/ARC-STATUS-MATRIX.md`
- `docs/architecture/ARC-STATUS-MATRIX.json`

## Next phase

```text
ARC-C001.0-C
Legacy Waiver / Debt Baseline
```

C001.0-C will distinguish ordinary technical debt from explicit architecture waivers, establish expiration/removal requirements, and prevent legacy exceptions from silently becoming permanent ARC semantics.
