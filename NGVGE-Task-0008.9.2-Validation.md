# NGVGE Task 0008.9.2 Validation Report

## Task

`0008.9.2 | Runtime Node Lifecycle Conformance`

## Status

```text
Implementation: Passed
Lifecycle Contract: Frozen
Cross-Runtime Event Boundary: Passed
Portable Public API Change: None
Persistent Format Change: None
Ready For: 0008.9.3 Component Boundary Freeze
```

## Baseline

```text
scratch-gui-main-task-0008.9.1.1-runtime-node-public-boundary-cleanup.zip
```

The baseline has no root `node_modules` directory. Full Jest, ESLint and Webpack execution is therefore not claimed. The new Jest suite is included for execution in a dependency-complete development environment.

## Version result

```text
Scene System: 0.8.9.2
Runtime Node persistent format: 1
Runtime Node portable public API: ngvge.runtime-node-model@1.2
Runtime Node public surface: 45 registered own keys
Lifecycle Contract: ngvge.runtime-node-lifecycle@1
```

The portable Runtime Node method surface and project persistence format remain unchanged.

## Frozen lifecycle semantics

### Node

```text
Created → Attached → Ready → Active / Disabled
                    ↘               ↓
                      Destroyed   Detached → Attached
```

Global and Scene Roots are the parentless special case and may move directly from `created` to `ready`.

### Component

```text
Created → Attached → Ready → Active / Disabled
                               ↓
                            Detached → Destroyed
```

### Ready

`Ready` is one-shot for each Runtime Node and Runtime Component instance. Reparenting never repeats Node or Component Ready.

### Reparent

```text
Component disable → Node disable
→ active descendants disable
→ Node detach → Node attach
→ Node enable-or-disable → Component enable-or-disable
→ descendants refresh
```

Components remain owned by the same Node during Reparent. They are not detached, reattached or made Ready again.

### Reorder

Same-parent reordering emits only `reorder`. It does not change parent identity, lifecycle state, Component ownership or Ready state.

### Destruction

Subtrees are destroyed child-first. For each attached Node:

```text
Disable Components
→ Disable Node
→ Detach Node
→ Detach Components
→ Destroy Components
→ Destroy Node
→ Remove Node identity from the active Graph
```

`dispose()` is idempotent.

## Error isolation

Local JavaScript lifecycle Hooks are Local Provider Bindings and are not portable protocol callbacks. Hook exceptions use the frozen `isolate-and-report` policy:

- the transition continues to a legal terminal state;
- a portable `lifecycle:error` event is emitted;
- cleanup of Components and descendants continues;
- `lifecycleHookErrorCount` is incremented.

Subscriber exceptions cannot veto a mutation, block another subscriber or interrupt lifecycle cleanup.

## Event and persistence boundaries

Lifecycle events are normalized portable plain data. They contain stable IDs and scalar lifecycle metadata only—never Runtime Node instances, Components, Scratch Targets, Backend Handles, callbacks or Graph references.

Lifecycle state remains derived and is excluded from project persistence:

```text
state
activeInHierarchy
Ready flags
Lifecycle Trace and sequence
Hook/listener diagnostics
Hook functions
```

Restore reconstructs lifecycle from semantic Node records and active Scene selection. Serialized lifecycle-looking fields are not accepted as authority and are removed on the next export.

The local diagnostic lifecycle Trace retains only the latest 512 records.

## Implemented files

```text
New files: 4
Modified files: 11
Removed files: 0
Total changed project files: 15
Changed JavaScript files syntax-checked: 11
```

### New files

- `docs/TASK-0008.9.2-RUNTIME-NODE-LIFECYCLE-CONFORMANCE.md`
- `scripts/validate-ngvge-task-0008.9.2.js`
- `src/lib/runtime-nodes/runtime-node-lifecycle.js`
- `test/unit/lib/runtime-nodes/runtime-node-lifecycle-conformance.test.js`

### Modified files

- `docs/ngvge/runtime-node-model.md`
- `docs/ngvge/scene-system-first-party-module.md`
- `docs/ngvge/scratch-sprite-node-adapter.md`
- `src/lib/runtime-nodes/component-container.js`
- `src/lib/runtime-nodes/constants.js`
- `src/lib/runtime-nodes/index.js`
- `src/lib/runtime-nodes/runtime-node-api-contract.js`
- `src/lib/runtime-nodes/runtime-node-graph.js`
- `src/lib/runtime-nodes/runtime-node-model-service.js`
- `src/lib/runtime-nodes/runtime-node.js`
- `src/lib/scene-system/module-definition.js`

## Executed validation

The following commands were actually executed and passed in the work tree:

```text
node --check (all 11 changed JavaScript files)
node scripts/check-runtime-node-public-boundary.js
node scripts/validate-ngvge-task-0008.9.1.1.js
node scripts/validate-ngvge-task-0008.9.1.js
node scripts/validate-ngvge-task-0008.8.js
node scripts/validate-ngvge-task-0008.7.3.js
node scripts/validate-ngvge-foundation-extensions.js
node scripts/validate-ngvge-task-0008.9.2.js
```

The 0008.9.2 smoke validation covers:

- legal transition tables and invalid transition rejection;
- canonical Node and Component creation order;
- detached construction followed by first Attach;
- Ready exactly once;
- Reparent order and stable Component ownership;
- active descendant disable before ancestor detach;
- same-parent Reorder without lifecycle restart;
- active/inactive Scene propagation;
- inactive Scene restore;
- child-first subtree destruction;
- Component destruction before owner Node destruction;
- Hook and subscriber exception isolation;
- portable lifecycle transition and error events;
- persistence exclusion and restore re-derivation;
- 512-record Trace retention;
- idempotent Graph disposal;
- unchanged Runtime Node portable public surface;
- retention of the three EXT-0001 foundation extensions.

## Dependency-limited validation

Not executed because root dependencies are absent:

```text
Jest
ESLint
Webpack / browser build
Browser interaction test
```

`test/unit/lib/runtime-nodes/runtime-node-lifecycle-conformance.test.js` has been added but was not falsely reported as executed.

## Definition of Done

- [x] Node and Component lifecycle states are explicit.
- [x] Legal transitions are machine-readable and enforced.
- [x] Ready is one-shot.
- [x] Reparent does not repeat Ready or Component ownership events.
- [x] Descendants are disabled before an ancestor emits Detach.
- [x] Reorder does not restart lifecycle.
- [x] Scene activation derives Active/Disabled state.
- [x] Destruction is child-first.
- [x] Components detach and destroy before their owner Node.
- [x] Hook exceptions are isolated and reported.
- [x] Subscriber exceptions cannot interrupt mutations.
- [x] Lifecycle events are portable plain data.
- [x] Trace retention is bounded.
- [x] Lifecycle state is not persisted or trusted on restore.
- [x] Public API shape remains `1.2`.
- [x] Persistent format remains `1`.
- [x] Scene System is version `0.8.9.2`.


## Artifact validation

```text
Incremental patch ZIP entries: 18
Full project ZIP entries: 3250
ZIP CRC test: Passed
Patch applied to 0008.9.1.1 baseline: Byte-identical to work tree
Full project re-extraction: Byte-identical to work tree
All smoke and regression validators rerun from re-extracted full project: Passed
```

## Final result

`0008.9.2 Runtime Node Lifecycle Conformance` satisfies its scoped freeze requirements and is ready for `0008.9.3 Component Boundary Freeze`.
