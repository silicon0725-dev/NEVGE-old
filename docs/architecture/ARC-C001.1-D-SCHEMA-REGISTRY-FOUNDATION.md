# ARC-C001.1-D｜Schema Registry Foundation

**Status:** Complete
**Date:** 2026-08-11
**Parent:** ARC-C001 / ARC-0001

## Objective

Promote schema/version metadata from Runtime-specific evidence into a generic NGVGE-owned Core Schema authority without importing Runtime Component execution semantics into `src/core`.

## Implemented

```text
src/core/schema/
├── schema-contract.js
├── schema-registry.js
├── index.js
└── README.md
```

The foundation defines `ngvge-schema-descriptor/v1`, validates schema/property metadata through Core Persistent DTO authority, and provides an immutable append-only version Registry.

## Key decisions

1. `RuntimeComponentTypeRegistry` remains Runtime-specific and is not renamed or moved into Core.
2. Schema Registry accepts multiple historical versions but rejects replacement of an existing `(typeId, version)`.
3. `registerMany()` validates collision/descriptor correctness before committing the batch.
4. Schema descriptors are immutable snapshots.
5. Full migration execution and schema-aware persistent-record validation are intentionally deferred.

## Conformance

Active/manual:

```text
test:conformance:schema-registry
test:conformance:schema-registry:self-test
test:conformance:c001.1-d
```

Permanent regression:

```text
schema-registry-boundary
```

## Minimum baseline effect

```text
Import Boundary Gate          COVERED
Stable Identity Types         COVERED
Persistent DTO Validator      COVERED
Schema Registry Foundation    COVERED
Authority Registry            MISSING
Protocol Command Foundation   MISSING
Scratch Adapter Boundary      HISTORICAL

Satisfied                     4 / 7
0009                          BLOCKED
```

## Next

`ARC-C001.1-E｜Authority Registry Foundation`.
