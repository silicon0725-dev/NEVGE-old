# NGVGE Task 0008.7.3 Validation

## Task

**0008.7.3｜Scratch Adapter Boundary Stabilization**

## Baseline

- Input project: `scratch-gui-main-task-EXT-0001-community-extension-foundation-pack(1).zip`
- Baseline Scene System version: `0.7.2.2`
- Result Scene System version: `0.7.3`
- Root `node_modules`: absent

## Architecture result

The Scratch Sprite integration is now represented as:

```text
ngvge.sprite-node
└── ngvge.scratch-target-binding
```

`ngvge.sprite-node` is a backend-independent semantic Runtime Node. Scratch ownership and volatile Target identity remain in the compatibility adapter and binding component. The legacy `ngvge.scratch-sprite-node` type is retained only as a hidden migration reader.

## Implemented changes

### Semantic Sprite boundary

- Added built-in hidden Runtime type `ngvge.sprite-node`.
- Added backend-independent `SpriteRuntimeNode`.
- Moved Scratch binding detection from node `typeId` checks to `ngvge.scratch-target-binding` component ownership.
- Removed volatile Scratch Target identity from the persistent source descriptor.

### Legacy migration

- Legacy `ngvge.scratch-sprite-node` records migrate through Runtime state import.
- Migration preserves `NodeId`, `BindingId`, parent/child hierarchy, component identity and scene scope.
- Scratch binding sidecar schema upgrades from version 1 to version 2.
- Version 2 records include explicit `destroyPolicy` and do not persist `targetRuntimeId`.

### Scene isolation

- Scratch Target indexes now use a composite `(sceneId, targetRuntimeId)` key.
- Target lookup accepts an explicit scene scope.
- Inactive scene bindings remain offline and retain their semantic Runtime nodes.
- A volatile Scratch Target ID may be reused by another scene without cross-scene ownership conflict.

### Ownership and deletion

- `destroyBindingByNodeId()` is the public adapter-owned deletion path.
- Deleting a bound semantic Sprite removes its Scratch Target, persistent Sidecar record and complete Runtime subtree.
- Direct Runtime Node deletion is observed and completed through adapter ownership cleanup.
- Reconciliation suppresses a Target while adapter-owned deletion is in progress, preventing accidental recreation.

### Project Explorer projection

- Added `createScratchSpriteTreeProjection()`.
- Project Explorer identifies Scratch-backed rows from the binding projection instead of a backend-specific Runtime node type.
- One semantic Sprite owner produces one Explorer row.
- Stale bindings without a Runtime owner are ignored.
- Bound Sprite rename, duplicate and enabled-state mutation are disabled while Scratch remains the authority.
- Delete is routed through the adapter ownership API.
- Existing childless-row behavior continues to use normalized React children, so no false disclosure arrow is produced.

## Files added

- `src/lib/runtime-nodes/sprite-runtime-node.js`
- `src/lib/scratch-sprite-adapter/scratch-sprite-tree-projection.js`
- `test/unit/lib/scratch-sprite-adapter/scratch-sprite-tree-projection.test.js`
- `scripts/validate-ngvge-task-0008.7.3.js`
- `docs/TASK-0008.7.3-SCRATCH-ADAPTER-BOUNDARY-STABILIZATION.md`

## Validation performed

### JavaScript syntax

`node --check` passed for all changed CommonJS source files, changed JavaScript tests and the new validation script.

### JSX / TypeScript parser validation

The following command passed:

```bash
tsc --allowJs --checkJs false --jsx react --noEmit --noResolve --skipLibCheck \
  src/components/project-explorer/project-explorer.jsx \
  test/unit/components/project-explorer.test.jsx
```

### EXT-0001 preservation validation

```bash
node scripts/validate-ngvge-foundation-extensions.js
```

Result:

```text
NGVGE foundation extension validation passed.
```

This confirms the Motion Toolkit, Input Core and Data Toolkit files and extension catalog entries remain in the full project.

### 0008.7.3 conformance smoke

```bash
node scripts/validate-ngvge-task-0008.7.3.js
```

Result:

```text
NGVGE 0008.7.3 conformance smoke passed.
```

The smoke validates:

1. Legacy schema-v1 Sidecar and `ngvge.scratch-sprite-node` migration.
2. Stable `NodeId` and `BindingId` preservation.
3. Semantic `ngvge.sprite-node` creation and binding component schema v2.
4. Absence of persisted `targetRuntimeId`.
5. Scene A → Scene B transition while both scenes reuse the same volatile Scratch Target ID.
6. Offline inactive-scene ownership and scene-scoped target lookup.
7. One-row-per-owner Explorer projection and stale-binding rejection.
8. Adapter deletion of Target, Sidecar, owner node and Runtime child subtree.
9. Direct Runtime deletion interception and compatibility cleanup.
10. Final zero-binding status without adapter errors.

### Relative-diff review

The working tree differs from the baseline only in the documented 0008.7.3 source, tests, validation script and documentation. EXT-0001 extension files were not removed or modified by this task.

### ZIP validation

Both incremental and full-project ZIP archives are validated with `unzip -t` after packaging.

## Not executed

The supplied project has no root `node_modules` directory. Therefore the following full repository commands were not executed:

- Jest test suite
- ESLint repository pass
- Webpack production build

The added and updated Jest tests are included for execution in a dependency-complete checkout.

## Manual acceptance scenarios

1. Open a project containing legacy Scratch-bound nodes and verify the visible row remains a single Sprite row with the same hierarchy.
2. Create Scene A and Scene B sprites, switch repeatedly, and verify no child or binding crosses scene boundaries.
3. Delete a Scratch-backed Sprite from Project Explorer and verify both the Scratch sprite and Runtime subtree disappear.
4. Confirm a childless Scratch-backed Sprite has no disclosure arrow and clicking it does not crash.
5. Save and reopen the project; verify stable Node and Binding identities remain and the Sidecar reports schema version 2.

## Outcome

**Targeted validation: PASS**

0008.7.3 establishes the intended compatibility boundary for Scratch Sprite ownership. Full repository CI remains pending in an environment with installed dependencies.
