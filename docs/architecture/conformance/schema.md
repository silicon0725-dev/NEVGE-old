# Schema Conformance

**Phase:** ARC-C001.1-D｜Schema Registry Foundation
**Status:** Active / Manual
**Parent authority:** ARC-0001 / ARC-C001

## Core authority

`src/core/schema` owns the generic backend-independent schema vocabulary and Registry foundation.

Formal descriptor contract:

```text
ngvge-schema-descriptor/v1
```

A registered schema is identified by:

```text
typeId + version
```

where `version` is a positive integer and one `(typeId, version)` pair may be registered only once.

## Property metadata foundation

C001.1-D supports registration and validation of the ARC-0001 minimum schema metadata:

- `type`;
- `default`;
- `nullable`;
- `minimum` / `maximum`;
- `unit`;
- `resourceType`;
- `persistence: persistent | runtime-only`;
- portable `validation` metadata.

Schema/default/validation metadata must itself satisfy the Core Persistent DTO contract. Runtime functions, backend objects, accessors and other non-persistent values are rejected before registration.

## Registry authority

The generic Registry is append-only at the version-key level:

- multiple versions of one `typeId` may coexist;
- the highest registered version is the current query result;
- duplicate `(typeId, version)` registration fails closed;
- batch registration validates the whole batch before mutation;
- returned schemas and snapshots are immutable.

The existing `RuntimeComponentTypeRegistry` remains Runtime-specific. Its migration/cardinality/usage semantics are evidence and future integration input, not the generic Core Schema authority.

## Active entrypoints

```text
test:conformance:schema-registry
test:conformance:schema-registry:self-test
test:conformance:c001.1-d
```

Permanent regression:

```text
schema-registry-boundary
```

## Explicitly deferred

C001.1-D does not claim completion of:

- Schema Migration Graph;
- migration provider execution;
- irreversible migration policy/recovery points;
- complete schema-aware record validation;
- repository-wide requirement that every persistent record already references a registered schema;
- custom Inspector / Gizmo / Validator registration;
- final ARC-0004 Property Type System.

Those remain later ARC-C001 / ARC-0004 work.
