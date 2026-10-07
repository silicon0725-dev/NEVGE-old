# NGVGE Task 0008.9.3.1 Validation

Amendment: the Descriptor transition gap discovered after this validation is closed by `0008.9.3.1.1`. The final Scene System version is `0.8.9.3.1.1`; see `NGVGE-Task-0008.9.3.1.1-Validation.md`.

## Task

`0008.9.3.1 | Component Identity, Cardinality and Persistence Closure`

## Result

```text
Implementation:                         Passed
Component Type Cardinality Authority:   Passed
Canonical Persistence Round-trip:       Passed
Component Identity Immutability:        Passed
Public Persistence Boundary:            Passed
Atomic Component Data Patch:            Passed
Historical Architecture Regression:     Passed
Component Contract Freeze:              Passed
```

## Version state

```text
Scene System:                    0.8.9.3.1
Runtime Node public API:         1.3.1
Runtime Component contract:     ngvge.runtime-component@1
Runtime Node persistent format:  1
Public Runtime Node own keys:    45
Declared public surface keys:    45
```

The public method surface and Runtime Node persistent format were not changed. The restricted Type Registration capability was extended with Component Type Descriptor operations.

## Implemented closure

### Type-authoritative cardinality

Component cardinality is now owned by `RuntimeComponentTypeDescriptor.cardinality`:

```text
one  -> at most one instance of the type on a Node
many -> multiple ComponentIds of the type may coexist on a Node
```

Format-v1 `allowMultiple` remains only as a derived compatibility projection. Public component creation cannot supply it.

Import behavior:

- registered Component Type descriptors are authoritative;
- unregistered legacy types receive an inferred compatibility descriptor;
- conflicting `allowMultiple` projections for one `typeId` are rejected before Shadow Graph commit;
- `cardinality: one` records with multiple instances on one Node are rejected before commit;
- canonical Export -> Import -> Export is deeply equal.

### Machine-enforced identity

`RuntimeComponent` now enforces:

- non-writable, non-configurable `id`;
- non-writable, non-configurable `typeId`;
- non-writable, non-configurable `schemaVersion`;
- privately stored, getter-only `ownerId`;
- sealed Runtime Component instances.

Direct assignment, deletion, `defineProperty`, and prototype replacement cannot desynchronize the Component Container index from the Component identity.

### Canonical persistence boundary

Canonical Component records contain only:

```text
id
typeId
schemaVersion
allowMultiple
enabled
data
extensionData (optional)
```

Unknown legacy top-level fields are normalized once into:

```text
extensionData.ngvge.compat.legacy-component-record
```

Public `addComponent` and `createNode.components` reject:

- `allowMultiple`;
- `persistentExtras`;
- arbitrary top-level fields;
- public `extensionData` injection.

### Atomic data patch

`patchData()` now follows:

```text
Clone current data
-> Normalize and validate patch
-> Build candidate without Object.assign prototype setters
-> Validate complete candidate
-> Replace live data once
```

`__proto__`, `prototype`, and `constructor` keys are rejected recursively. Failed patches leave Runtime data and persisted data unchanged.

## Destructive validation performed

The dedicated `scripts/validate-ngvge-task-0008.9.3.1.js` covered:

- `allowMultiple: false` Export -> Import -> Export stability;
- registered `cardinality: many` with multiple instances;
- one-sided instance `allowMultiple` bypass rejection;
- conflicting legacy cardinality projections;
- registered Descriptor versus legacy projection conflict;
- missing legacy `schemaVersion` normalization to version 1;
- one-time legacy top-level field normalization into `extensionData`;
- direct mutation of `id`, `typeId`, `schemaVersion`, and `ownerId`;
- `defineProperty`, property deletion, and prototype replacement attacks;
- Container Map key and Component identity consistency;
- public `persistentExtras`, `allowMultiple`, and `extensionData` rejection;
- nested public `createNode.components` escape-hatch rejection;
- prototype-pollution patch rejection before mutation;
- implicit compatibility Descriptor promotion to an explicit host Descriptor.

## Executed regression suite

```text
Runtime Node first-party alias gate                         PASS
0008.7.3 Scratch Adapter conformance                        PASS
0008.8 Scene Graph persistence                              PASS
0008.9.1 Runtime Node API Freeze                            PASS
0008.9.1.1 Public Boundary Cleanup                          PASS
0008.9.2 Lifecycle Conformance                              PASS
0008.9.2.1 Reentrancy / Generation Closure                  PASS
0008.9.2.2 Observation Boundary Closure                     PASS
0008.9.2.2.1 Local Host Dispose Preflight                   PASS
0008.9.3 Component Boundary                                 PASS
0008.9.3.1 Identity / Cardinality / Persistence Closure     PASS
EXT-0001 Foundation Extension validation                    PASS
```

## Static validation

```text
Changed/new JavaScript files:  18
node --check:                  18 / 18 PASS
package.json parse:            PASS
Deleted baseline files:        0
```

A Jest regression file was added at:

```text
test/unit/lib/runtime-nodes/
runtime-component-identity-cardinality-persistence.test.js
```

The project archive does not contain root `node_modules`, so full Jest, ESLint, Webpack, and browser integration runs were not executed and are not claimed here.

## Freeze declaration

```text
TASK 0008.9.3
Implemented / Component Boundary Frozen

Next stage
0008.9.4 | Graph Validation Freeze
```
