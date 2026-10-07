# NGVGE Task 0008.6.4 Validation

## Scope

Validated the transactional Runtime Node import path, opaque missing-provider nodes, graph replacement, persistence and later provider recovery.

## Verified behavior

### Transactional import

- duplicate/cyclic parent relationships fail before replacing the active graph;
- missing parent references fail before replacing the active graph;
- invalid component data fails before replacing the active graph;
- a registered custom node constructor throwing during import leaves the current graph intact;
- the previous Runtime Node service remains usable after a failed import;
- existing service subscriptions continue receiving events after a successful graph swap.

### UnknownRuntimeNode

- an unregistered `typeId` imports as internal `ngvge.unknown-node`;
- the read view exposes `originalTypeId`, `missingProvider` and `missingVersion`;
- the persistent record continues to use the original third-party `typeId`;
- node metadata, components, component provider fields and arbitrary node provider fields survive import/save;
- opaque nodes can be renamed, reparented, duplicated and deleted;
- duplication generates new runtime IDs without losing original provider data;
- registering the missing type automatically attempts transactional reification;
- failed reification keeps the opaque graph active;
- successful reification persists the restored provider type without losing opaque fields.

### Editor integration

- missing nodes use a warning icon in Project Explorer;
- Project Explorer identifies the original missing type;
- Inspector identifies the missing provider and shows the original type ID.

## Checks executed

- `node -c` for all files under `src/lib/runtime-nodes/`;
- `node -c` for `src/lib/scene-system/module-definition.js`;
- Node parser checks for both modified Jest test files by checking temporary `.mjs` copies;
- custom Node smoke tests covering validation failure, constructor failure, opaque data preservation, copy/save and automatic reification;
- ZIP integrity tests for both generated archives.

The custom validation script completed with:

```text
0008.6.4 validation smoke tests passed
syntax checks passed
```

## Not executed

The uploaded source project does not contain root `node_modules`. A direct first-party module smoke run also stops at the missing dependency `@turbowarp/jszip`. Therefore the following were not executed in this environment:

- full Jest suite;
- ESLint;
- Webpack production build;
- interactive browser UI testing.

The Jest coverage for this task is included in the patch and should be run in the project's fully installed development environment.
