# ARC-C001 Conformance Directory

This directory is the repository entrypoint for machine-enforced ARC-0001 conformance.

## Current phase

**ARC-C001.1-H｜Minimum Baseline Certification — COMPLETE / CERTIFIED**

ARC-C001.0 is frozen. ARC-C001.1 minimum baseline certification is complete: A is browser validated, B through G are complete, all seven minimum requirements are covered, active Architecture Waivers are zero, and the H certification gate passes. `0009 Transform System` is unlocked for entry. Blocking CI remains inactive and belongs to later ARC-C001.6 work.

## Parent authority

All conformance rules are subordinate to `../ARC-0001-kernel-independence-contract.md`. Conformance rules may clarify or mechanize ARC-0001 but may not weaken it.

## Planned domains

```text
identity.md
schema.md
authority.md
protocol.md
lifecycle.md
serialization.md
compatibility.md
```

Domain files are created only when their corresponding executable foundation exists. `import-boundaries.md`, `stable-identity.md`, `persistent-dto.md`, `schema.md`, `authority.md`, `protocol.md` and `compatibility.md` are now active.

## Formal conformance specification

See `ARC-C001-arc-0001-conformance-suite.md`.

## Existing Gate Inventory

C001.0-B found:

- 12 `test:architecture:*` package entrypoints;
- 27 unique active architecture validators;
- 3 historical standalone validators not wired into current architecture entrypoints;
- 6 permanent regression contracts, 5 with direct ARC-0001 value;
- 0 architecture entrypoints wired into aggregate `test` or the current CI workflow.

Therefore the existing validators are strong executable evidence, but they are **not yet Blocking Conformance authority**.

See:

- `EXISTING-GATE-INVENTORY.md`
- `EXISTING-GATE-INVENTORY.json`

## Activation policy

ARC-C001's final merge policy is Blocking. C001.0-A does not activate that policy. The staged path is:

```text
Repository Baseline ✓
→ Existing Gate Inventory ✓
→ Legacy Waiver / Debt Baseline ✓
→ Coverage Matrix ✓
→ Core Boundary Foundation (C001.1-A ✓ browser validated; B ✓; C ✓; D ✓; E ✓; F ✓; G ✓; H ✓ certified)
→ 0009 Transform System READY
→ Later Blocking CI / Waiver Governance (C001.6)
```

Before 0009 Transform System starts, ARC-C001.1 must establish at least:

- Import Boundary Gate;
- Persistent DTO Validator;
- Stable Identity Types;
- Authority Registry;
- Protocol Command foundation;
- Schema Registry foundation;
- Scratch Adapter Boundary Test.


## Waiver / debt baseline

C001.0-C established:

- `../LEGACY-WAIVERS.md` / `.json`;
- `../TECHNICAL-DEBT-BASELINE.md` / `.json`;
- `WAIVER-BASELINE.md`.

Current active Architecture Waivers: **0**.

`ARC-DEBT-0001` was explicitly non-waivable and is **resolved by C001.1-B**. Historical target-derived ids remain migration-only input. `GOV-DEBT-0002` is **resolved by C001.1-G** because Scratch Adapter/BindingId semantics now have an active/manual gate.


## Formal coverage matrix

C001.0-D supplied the frozen baseline for `CONFORMANCE-STATUS-MATRIX.md` / `.json`; the matrix is now updated by execution phases. No whole domain is declared Covered merely because C001.1 is certified. All seven minimum requirements are implemented and the H certification unlocks 0009 for entry; later ARC-C001 phases continue strengthening the partial domains.


## Active C001 foundation gates

### Import Boundary

- specification: `import-boundaries.md`;
- policy: `../../../tools/conformance/import-boundary-policy.json`;
- implementation: `../../../tools/conformance/check-import-boundaries.js`;
- self-test: `../../../tools/conformance/check-import-boundaries.self-test.js`;
- entrypoint: `test:conformance:import-boundary`;
- enforcement: **active/manual**, not yet aggregate-test or blocking-CI authority.


### Stable Identity

- specification: `stable-identity.md`;
- Core contract: `../../../src/core/identity/stable-identity.js`;
- host factory: `../../../src/lib/identity/host-stable-id-factory.js`;
- gate: `../../../tools/conformance/check-stable-identities.js`;
- entrypoint: `test:conformance:stable-identity`;
- enforcement: **active/manual**.


### Persistent DTO

- specification: `persistent-dto.md`;
- Core contract: `../../../src/core/persistent/persistent-dto.js`;
- legacy facade: `../../../src/lib/persistence/persistent-data.js`;
- gate: `../../../tools/conformance/check-persistent-dto.js`;
- self-test: `../../../tools/conformance/check-persistent-dto.self-test.js`;
- entrypoint: `test:conformance:persistent-dto`;
- enforcement: **active/manual**.


### Schema Registry

- specification: `schema.md`;
- Core contract: `../../../src/core/schema/schema-contract.js`;
- Core Registry: `../../../src/core/schema/schema-registry.js`;
- gate: `../../../tools/conformance/check-schema-registry.js`;
- self-test: `../../../tools/conformance/check-schema-registry.self-test.js`;
- entrypoint: `test:conformance:schema-registry`;
- enforcement: **active/manual**.

### Authority Registry

- specification: `authority.md`;
- Core contract: `../../../src/core/authority/authority-contract.js`;
- Core Registry: `../../../src/core/authority/authority-registry.js`;
- gate: `../../../tools/conformance/check-authority-registry.js`;
- self-test: `../../../tools/conformance/check-authority-registry.self-test.js`;
- entrypoint: `test:conformance:authority-registry`;
- enforcement: **active/manual**.


### Protocol DTO

- specification: `protocol.md`;
- Core portable value contract: `../../../src/core/protocol/portable-value.js`;
- Core DTO contract: `../../../src/core/protocol/protocol-dto.js`;
- gate: `../../../tools/conformance/check-protocol-dto.js`;
- self-test: `../../../tools/conformance/check-protocol-dto.self-test.js`;
- entrypoint: `test:conformance:protocol-dto`;
- enforcement: **active/manual**.


### Scratch Adapter Boundary

- specification: `compatibility.md`;
- gate: `../../../tools/conformance/check-scratch-adapter-boundary.js`;
- self-test: `../../../tools/conformance/check-scratch-adapter-boundary.self-test.js`;
- historical behavior corpus: `../../../scripts/validate-ngvge-task-0008.7.3.js`;
- permanent regression: `../../../test/regression/contracts/scratch-adapter-boundary.js`;
- entrypoint: `test:conformance:scratch-adapter-boundary`;
- enforcement: **active/manual**.


### C001.1 Minimum Baseline Certification

- certificate: `../ARC-C001.1-H-MINIMUM-BASELINE-CERTIFICATE.json`;
- specification/decision: `../ARC-C001.1-H-MINIMUM-BASELINE-CERTIFICATION.md`;
- checker: `../../../tools/conformance/check-c0011-minimum-baseline.js`;
- self-test: `../../../tools/conformance/check-c0011-minimum-baseline.self-test.js`;
- entrypoint: `test:conformance:c001.1-h`;
- enforcement: **certified/manual baseline**; Blocking Merge Policy remains deferred to C001.6;
- 0009 decision: **READY / UNLOCKED FOR ENTRY**.
