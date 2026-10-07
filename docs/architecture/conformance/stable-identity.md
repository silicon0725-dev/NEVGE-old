# ARC-C001 Stable Identity Foundation

**Introduced:** ARC-C001.1-B  
**Parent:** ARC-0001 Stable Identity / No Backend Leakage  
**Status:** Active / Manual Conformance Foundation

## Invariant

Persistent NGVGE semantic identity must be owned by NGVGE and remain independent of backend execution identity. Scratch `target.id`, ECS entity handles, renderer IDs, DOM references and native handles are not Stable IDs.

## Canonical identity form

C001.1-B establishes schema `ngvge-stable-identity/v1` and the canonical string form:

```text
ngvge:<kind>:<opaque-token>
```

Kinds currently reserved by Core:

```text
node
scene
resource
module
component-type
binding
transaction
```

The token is intentionally opaque. A Host adapter supplies entropy; `src/core/identity` does not access `crypto`, clocks, Scratch or other platform APIs.

## Project Node ownership

New Project Nodes, including Stage/Sprite-backed editor nodes, receive a canonical NGVGE NodeId at creation time. Scratch `target.id` is retained only as transient runtime binding state and is deleted before Node Tree persistence.

`ngvge-node-tree` persistence is version 4.

## Legacy migration

Historical Project Node records may contain:

```text
target-node:<historical Scratch target.id>
```

Those values are accepted only as migration input. During project extraction/restore, C001.1-B:

1. allocates a new canonical NGVGE NodeId for every legacy target-derived node;
2. creates one alias map for the migration transaction;
3. remaps Node Tree parent/child, target binding and editor-state references;
4. applies the same aliases across all NGVGE project sections before section deserialization;
5. leaves the source snapshot immutable;
6. never writes `target-node:*` from current Project Node code.

Legacy Scene snapshots may carry historical project payloads as compatibility input. When that payload enters VM Project restore, the Project Persistence boundary applies the same migration before registered project sections deserialize.

## R9 TypeScript boundary

The repository currently has a frozen strict TypeScript trust boundary limited to `src/addons/addons/02agent`. C001.1-B does not widen it. Stable identity semantic aliases are therefore expressed in Core JavaScript/JSDoc plus executable runtime validation. Repository-wide compile-time branded TypeScript types are deferred until TypeScript governance is explicitly superseded or expanded; this does not permit backend-derived IDs.

## Executable evidence

```text
test:conformance:stable-identity
test:conformance:c001.1-b
test/regression/contracts/project-node-stable-identity.js
test/unit/core/identity/stable-identity.test.js
test/unit/lib/project-nodes/legacy-node-identity-migration.test.js
test/unit/lib/project-nodes-node-database.test.js
test/unit/lib/project-inspector-persistence.test.js
```

## Scope not claimed by C001.1-B

C001.1-B does not complete:

- generic Identity Registry collision/ownership tracking;
- Scratch BindingId persistence/adapter conformance;
- Persistent DTO repository authority;
- Schema/Authority/Protocol foundations.

Those remain assigned to later ARC-C001 phases.
