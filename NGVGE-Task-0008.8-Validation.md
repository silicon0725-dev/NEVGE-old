# NGVGE Task 0008.8 Validation

## Task

`0008.8｜Scene Graph Persistence Review`

## Status

`Completed`

## Baseline

`scratch-gui-main-task-0008.7.3-scratch-adapter-boundary-stabilization.zip`

The baseline was extracted independently and compared against the completed working tree. The task contains 25 changed or new files and removes no baseline files.

## Scene System version

```text
0.8.0
```

## Scope completed

### Strict persistent data contract

Added:

```text
src/lib/persistence/index.js
src/lib/persistence/persistent-data.js
```

The validator traverses the complete persistent object graph and rejects:

- nested `undefined`;
- `Function`, `Symbol`, `BigInt` and Promise/class instances;
- non-finite numbers;
- non-plain objects;
- circular references;
- accessors and non-enumerable properties;
- custom array properties and sparse arrays.

Invalid values are rejected with a structured issue path instead of being silently removed or converted by `JSON.stringify()`.

### Scene project write gate

`SceneDataModelService.writeProject()` now executes:

```text
plain persistent-data validation
→ normalization
→ Scene Schema validation
→ module-data write
```

A failed validation does not modify the stored project. The service also exposes a combined `validatePersistentProject()` result.

### Runtime Node persistence

Runtime Node metadata, source descriptors, component data and provider-specific persistent records now use the strict persistent clone contract.

A future Runtime Node state version is preserved in persistence read-only mode:

```text
persistenceReadOnly: true
storedStateVersion: <future version>
```

Runtime mutation fails with `RUNTIME_NODE_STATE_READ_ONLY`, and `persistState()` refuses to overwrite the future payload.

The Runtime Node capability now exposes:

```js
validatePersistentState(snapshot)
```

### Scratch Binding persistence

The persisted `ngvge.scratch-target-binding` component no longer contains runtime-derived:

```text
lifecycle
targetRuntimeId
```

The binding sidecar validator detects unsupported versions, invalid records, duplicate `BindingId` or `NodeId`, orphaned Scene ownership and volatile Target IDs.

Deleting a Scene prunes its corresponding sidecar entry.

### Scene restore rollback

Before destructive restore, the Scene Snapshot Serializer attempts to prepare an in-memory rollback point from the currently loaded Scratch project.

If target deserialization or project-loaded processing fails, the serializer attempts to deserialize the rollback point and rethrows the original error with:

```js
error.rollback = {
    attempted,
    succeeded,
    error
};
```

The serializer status exposes `lastRollback`, and successful restores report `rollbackProtected`.

### Persistence Review capability

Added:

```text
ngvge.scene-persistence-review@1
```

The capability audits:

- Scene Project persistent-data validity;
- Scene Schema validity;
- Runtime Node snapshot validity;
- runtime-derived Node and Component fields in persistent records;
- Scratch Binding runtime leakage;
- snapshot metadata SceneId ownership;
- Scratch Binding sidecar validity.

## Reconstruction validation

The custom validation script performs a full persistence reconstruction sequence:

```text
create two Scenes
→ create active and offline Scratch bindings
→ persist Runtime Node records and sidecar
→ dispose Runtime Node Model and Adapter
→ recreate Scratch Target with a different target.id
→ recreate Runtime Node Model and Adapter
→ verify original NodeId and BindingId
```

Verified:

- active Scene `NodeId` and `BindingId` remain stable;
- offline Scene `NodeId` and `BindingId` remain stable;
- the new Scratch `target.id` is rebound only inside the Adapter;
- no volatile Target ID is written into project storage;
- deleting the offline Scene removes its sidecar entry;
- the resulting project passes the persistence review.

## Tests added or updated

Added:

```text
test/unit/lib/persistence/persistent-data.test.js
test/unit/lib/scene-system/scene-persistence-review.test.js
```

Updated:

```text
test/unit/lib/runtime-nodes/runtime-node-model-service.test.js
test/unit/lib/scene-system/scene-snapshot-serializer.test.js
test/unit/lib/scene-system/scene-system-module.test.js
test/unit/lib/scratch-sprite-adapter/scratch-sprite-node-adapter-service.test.js
```

The tests cover:

- strict persistent value acceptance and rejection;
- future Runtime Node payload preservation;
- Persistence Review leakage diagnostics;
- restore rollback success;
- Persistence Review capability registration and revocation;
- Scratch component runtime-field exclusion;
- orphan Sidecar pruning.

## Validation actually executed

### 0008.8 persistence smoke

Command:

```text
node scripts/validate-ngvge-task-0008.8.js
```

Result:

```text
NGVGE 0008.8 scene graph persistence smoke passed.
```

The script validates strict data rejection, future-version read-only protection, runtime-only leakage detection, service reconstruction, offline Scene restoration, sidecar pruning and restore rollback.

### 0008.7.3 regression smoke

Command:

```text
node scripts/validate-ngvge-task-0008.7.3.js
```

Result:

```text
NGVGE 0008.7.3 conformance smoke passed.
```

This confirms that legacy Scratch node migration, Scene-scoped Target indexing, Project Explorer projection and deletion ownership remain intact.

### EXT-0001 preservation smoke

Command:

```text
node scripts/validate-ngvge-foundation-extensions.js
```

Result:

```text
NGVGE foundation extension validation passed.
```

The Motion, Input and Data foundation extensions remain present in the extension registry and were not removed or reverted by 0008.8.

### JavaScript syntax validation

`node --check` was executed for persistence-related source, scripts and unit tests.

Result:

```text
passed
```

### TypeScript parser validation

The global TypeScript parser parsed all 20 changed JavaScript files using `ScriptTarget.Latest` and `ScriptKind.JS`.

Result:

```text
20 files parsed
0 parse diagnostics
```

### Baseline diff review

Result:

```text
25 changed or new files
0 removed files
```

No unrelated source area was modified.

## Validation not executed

The project archive does not contain a root `node_modules` directory. Therefore the following were not represented as executed:

```text
Jest unit test suite
ESLint
Webpack production build
```

The corresponding Jest cases are included in the project and should be run in a dependency-complete development environment.

## Acceptance checklist

```text
[x] Strict persistent data validation exists.
[x] Invalid writes leave stored Scene Project unchanged.
[x] Runtime-only Node and Component fields are audited.
[x] Scratch lifecycle state is not persisted.
[x] Scratch targetRuntimeId is not persisted.
[x] Binding Sidecar is validated and orphan Scene entries are pruned.
[x] Future Runtime Node state cannot be overwritten by an older runtime.
[x] Active and offline Scene stable identities survive service reconstruction.
[x] Restore failure attempts rollback to the previous loaded Scratch project.
[x] Scene Persistence Review capability is registered.
[x] 0008.7.3 regression smoke remains green.
[x] EXT-0001 foundation extension validation remains green.
[x] Changed JavaScript syntax and parser validation pass.
[ ] Full Jest suite — dependency environment unavailable.
[ ] Full ESLint — dependency environment unavailable.
[ ] Full Webpack build — dependency environment unavailable.
```

## Result

Task `0008.8 Scene Graph Persistence Review` is complete and ready to serve as the persistence baseline for:

```text
0008.9｜Runtime Node Model Freeze
```
