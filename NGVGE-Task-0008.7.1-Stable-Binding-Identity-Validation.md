# NGVGE 0008.7.1 Validation Report

## Scope

Task: `0008.7.1 Stable Binding Identity`

Base project: `0008.6.5 Editor Integration Hardening`

Resulting Scene System version: `0.7.1`

## Acceptance results

### 1. Stable identity separation

The Adapter now separates three identities:

```text
Scratch target.id      volatile VM identity
bindingId              persistent adapter identity
Runtime Node id        persistent graph identity
```

A recreated Scratch Target with a different runtime ID was verified to reuse both the original `bindingId` and Runtime Node ID.

### 2. First-party Node and Capability registration

Scene System now provides:

```text
ngvge.scratch-sprite-node-adapter@1
```

The Adapter registers:

```text
ngvge.scratch-sprite-node
ngvge.scratch-target-binding
```

The Sprite node type is hidden from generic creation menus. Its constructor rejects direct creation unless a valid Adapter-managed source includes:

```js
{
    kind: 'scratch-target',
    role: 'sprite',
    bindingId
}
```

This prevents unbound fake Sprite nodes from entering the Runtime Graph.

### 3. Persistent Sidecar

Binding records are stored under:

```js
project.extensionData.scratchSpriteBindings
```

Each record contains only stable and serializable fields:

- `bindingId`;
- `nodeId`;
- `lastKnownName`;
- `role`;
- `serializedTargetIndex`.

The Adapter also stores stable binding metadata in the Runtime Node `source` and the `ngvge.scratch-target-binding` component.

Validation confirmed that neither the Sidecar nor `runtimeNodeModel` persistence contains the current Scratch `target.id`.

### 4. One-to-one indexes

The service maintains private indexes by:

- Runtime Node ID;
- stable binding ID;
- current Scratch Target runtime ID.

Duplicate Node, binding or Target identities are rejected with structured error codes. Query results are deeply frozen and never expose the mutable Scratch Target object.

### 5. Target filtering

The establishment scan includes only original non-Stage targets.

Verified exclusions:

- Stage;
- Scratch runtime Clones (`isOriginal === false`).

### 6. Stable matching and idempotence

Existing bindings are matched using:

1. serialized target index plus last-known name;
2. unique last-known name;
3. serialized target index;
4. new identity creation.

Repeated `establishBindings()` calls were verified not to create duplicate Runtime Nodes, components or Sidecar records.

### 7. Future schema protection

Binding Sidecars with a schema version newer than supported are not rewritten as version 1. The capability remains available in an error state so the project can still be inspected without silently destroying future data.

### 8. Module lifecycle

Verified:

- enabling Scene System provides the Adapter Capability;
- disabling Scene System revokes the Capability;
- Adapter disposal unregisters its Node Type before Runtime Node Model disposal;
- existing `0008.6.3` mutation boundaries and `0008.6.4` transactional import behavior remain untouched.

## Validation executed

Passed:

- Node syntax checks for all changed CommonJS files;
- syntax checks for changed Jest files;
- standalone stable-binding validation script;
- original Sprite versus Stage/Clone filtering test;
- stable binding and Runtime Node identity after Target runtime ID replacement;
- repeated establishment idempotence test;
- direct unbound Sprite Node creation rejection test;
- frozen view and no Target exposure test;
- volatile Target ID non-persistence test;
- Scene System Capability enable/disable smoke test;
- changed-file trailing-whitespace scan;
- incremental and full ZIP integrity checks.

Smoke result:

```text
0008.7.1 stable binding identity validation passed
```

## Added or updated tests

- `test/unit/lib/scratch-sprite-adapter/scratch-sprite-node-adapter-service.test.js`
- `test/unit/lib/scene-system/scene-system-module.test.js`

## Environment limitation

The supplied project does not contain a root `node_modules` directory. Therefore complete repository Jest, ESLint and Webpack commands were not executed in this environment.

The module-level smoke test used a minimal `@turbowarp/jszip` stub because archive serialization is outside the scope of this task. No archive method was invoked during the test.

All dependency-independent syntax and behavioral validation listed above passed.

## Deferred work

This task deliberately does not implement:

- automatic Scratch VM Target lifecycle subscriptions;
- Sprite creation, duplication, deletion or rename synchronization;
- inactive-scene Offline binding orchestration;
- automatic Rebind after Scene Runtime restore events;
- Project Explorer Sprite/Runtime Node de-duplication;
- Scratch binding Inspector controls;
- Stage adaptation;
- Scratch Clone persistence;
- Transform2D or Renderer ownership.

The next planned stage is `0008.7.2 Target Lifecycle Reconciliation`.
