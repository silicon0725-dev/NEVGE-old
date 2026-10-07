# Authority Conformance

**Phase:** ARC-C001.1-E｜Authority Registry Foundation
**Status:** Active / Manual
**Parent authority:** ARC-0001 / ARC-C001

## Core authority

`src/core/authority` owns the generic backend-independent State Domain Authority vocabulary and Registry foundation.

Formal registration contract:

```text
ngvge-authority-registration/v1
```

A registration contains:

```text
domain: StateDomainId
authorityId: string
mode: writer | projection | observer
projectionDirection?: authority-to-projection | projection-to-authority
```

Projection direction is required only for `projection` registrations.

## Unique Writer rule

For one active State Domain:

```text
writer      <= 1
projection  >= 0
observer    >= 0
```

A second writer registration for the same domain fails closed with `NGVGE_AUTHORITY_REGISTRY_WRITER_CONFLICT`. Registration batches validate conflicts before mutation, so a failed writer registration cannot leave partial observer/projection state behind.

Different State Domains may each own an independent writer.

## Registry boundary

The generic Core Registry provides:

- explicit State Domain participation roles;
- immutable normalized registrations;
- deterministic listing/snapshots;
- duplicate participant rejection;
- single active writer enforcement;
- registration and explicit release (`unregister`).

The existing `ModuleCapabilityRegistry` remains Module/Runtime-specific. Capability provider ownership is evidence and a future consumer/integration point; it is not the generic State Domain Authority model.

## Active entrypoints

```text
test:conformance:authority-registry
test:conformance:authority-registry:self-test
test:conformance:c001.1-e
```

Permanent regression:

```text
authority-registry-boundary
```

## Explicitly deferred

C001.1-E does not implement:

- Projection Loop Prevention;
- Mutation Context and provenance propagation;
- transactional Authority Switch;
- write authorization / command admission;
- complete runtime ownership diagnostics;
- Transform2D authority wiring;
- complete ARC-0003 semantics.

Those remain C001.3 / ARC-0003 and 0009 work.
