# 0008.7.2.1 Sprite Tree Ownership Hotfix — Validation

## Reported regressions

1. Compatibility child nodes appeared under the active Sprite after switching scenes.
2. A newly created Sprite appeared twice: once as `Scratch Sprite · Native` and once as the legacy `Sprite` row.
3. Deleting a Sprite did not reliably delete its Runtime adapter node or the compatibility subtree formerly parented to the legacy row.

## Root causes

### Dual tree ownership

Project Explorer rendered all Runtime SceneRoot children and then rendered every Scratch entity target again. The adapter and legacy target node therefore represented the same Sprite simultaneously.

### Missing-section retention

Project persistence restored only project sections present in the incoming scene snapshot. If a blank or older scene omitted `ngvge-node-tree`, the in-memory node database from the previous scene remained active and was rebound by target order.

### Target child promotion

`nodeDatabase.syncTargets()` removed a missing target node but reparented its children to the target node's parent. For root Sprite targets, this promoted Physics/Collider/Node2D children to the scene root.

### Incomplete event bridge

The adapter listened to Runtime `TARGETS_UPDATE`, while the GUI's standard target lifecycle also exposes the public VM `targetsUpdate` event.

## Implemented corrections

- Bound Sprite target rows are filtered from the legacy entity list.
- The Runtime Scratch Sprite Adapter Node is the canonical visible row.
- The legacy compatibility subtree remains stored by `project-nodes`, but is projected beneath the canonical adapter row.
- Editing-target selection resolves to the adapter Runtime Node.
- Activating the canonical row also selects its current Scratch target.
- Search and visible keyboard order bridge compatibility children through the adapter row.
- Project sections may declare `clearOnMissing: true`.
- `ngvge-node-tree` opts into that contract and resets when omitted by a loaded scene.
- Missing Scratch targets now cause recursive compatibility-subtree deletion instead of child promotion.
- The adapter listens to both lifecycle event surfaces and continues using its existing single-flight scheduler.
- Scene System version is `0.7.2.1`; node database runtime version is `3`.

## Static checks

Passed:

```text
node --check project-persistence.js
node --check node-database.js
node --check scratch-sprite-node-adapter-service.js
node --check scene-system/module-definition.js
tsc JSX parse: project-explorer.jsx
tsc JSX parse: project-explorer.test.jsx
```

## Behavioral smoke checks

Passed:

1. Public VM `targetsUpdate` deletes the stable binding and Runtime adapter node.
2. Runtime native children beneath the adapter node are recursively destroyed with the Sprite.
3. Removing a Scratch target deletes its compatibility target root, PhysicsBody2D child and Collider2D descendant.
4. Compatibility children are not promoted to scene root.
5. Loading project data without an opt-in scene-local section calls its deserializer with `null`, clearing previous scene state.

Smoke output:

```text
adapter lifecycle smoke passed
node database target subtree deletion smoke passed
project persistence clear-on-missing smoke passed
syntax checks passed
```

## Added regression coverage

- Project Explorer: one row for an adapter-bound Scratch Sprite.
- Project persistence: `clearOnMissing` section reset.
- Project node database: recursive target subtree removal.
- Scratch Sprite Adapter: public VM `targetsUpdate` deletion.

## Compatibility and migration

The persisted node-tree schema remains readable. The database runtime version is bumped so a newly loaded editor installs the corrected implementation.

Nodes already promoted to the scene root by 0008.7.2 no longer retain enough ownership information for safe automatic deletion. They should be removed manually once. Newly deleted Sprites and newly loaded scenes use the corrected ownership behavior.

## Environment limitation

The supplied project does not contain root `node_modules`, so the complete Jest, ESLint and Webpack suites were not executed. The modified JSX was parsed with TypeScript, CommonJS files passed Node syntax checks, and focused behavioral smoke tests were executed independently.
