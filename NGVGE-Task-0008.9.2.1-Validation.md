# NGVGE TASK 0008.9.2.1 Validation Report

## Task

`0008.9.2.1｜Runtime Lifecycle Reentrancy and Generation Closure`

## Result

```text
Implementation: Passed
Lifecycle Contract: Frozen
Hook Reentrancy Policy: Frozen
Runtime Generation Ordering: Frozen
Observer Diagnostics: Passed
Same-state Transition Closure: Passed
Persistent Format Change: None
Portable Runtime Node API Change: None
Ready For: 0008.9.3 Component Boundary Freeze
```

## Baseline

`scratch-gui-main-task-0008.9.2-runtime-node-lifecycle-conformance.zip`

## Frozen versions

```text
Scene System:                    0.8.9.2.1
Runtime Node Capability:         ngvge.runtime-node-model@1.2
Runtime Node public own keys:    45
Runtime Node persistent format:  1
Lifecycle Contract:              ngvge.runtime-node-lifecycle@1
```

## Closure implemented

### Lifecycle Hook reentrancy

Lifecycle Hooks may read Runtime state and manage provider-owned external resources. Synchronous Runtime semantic Graph mutation is rejected with `RUNTIME_LIFECYCLE_REENTRANT_MUTATION`.

The policy applies to direct Graph methods, Node and Component convenience methods, Public Capability mutations, restricted Node Type registration, Persistence Controller import, Scene synchronization and Shadow Graph import construction. Active and Shadow graphs share one lifecycle mutation guard.

A rejected nested mutation is emitted as `lifecycle:error`; the original transition continues to a legal final state. Lifecycle v1 does not define an implicit deferred mutation queue.

### Runtime generation

Lifecycle ordering identity is now:

```text
(runtimeGeneration, sequence)
```

A successful Runtime Graph replacement increments `runtimeGeneration`, resets the sequence and Trace, then publishes `runtime:replaced` as sequence 1. A failed import changes neither generation nor sequence. Shadow Graph lifecycle Trace is not exposed as committed Runtime Trace.

`runtimeGeneration` is Runtime-only and is not written into the project persistence record.

### Subscriber diagnostics

Status now distinguishes:

```text
graphListenerErrorCount
observerErrorCount
listenerErrorCount = graphListenerErrorCount + observerErrorCount
```

Public Capability subscriber exceptions are counted, do not interrupt other subscribers and do not veto the mutation.

### Same-state and Ready closure

Same-state Node and Component transitions return `false` before validation, Hook invocation, Trace append or sequence increment. This includes Active → Active and Destroyed → Destroyed.

First attachment cannot transition directly from Attached to Active or Disabled. The only conditional edge is reattachment of a Node whose Ready Hook has already completed, preserving one-time Ready semantics during Reparent.

### Detach semantics

Node Detach removes the parent/hierarchy relationship. Component Detach removes Component ownership from its Node. `detachNode()` disables owned Components but does not emit `component:detach`, does not destroy them and does not clear `component.ownerId`.

## Concrete regressions validated

```text
onDisable → setEnabled(true)
Result: nested mutation rejected; final state Disabled; final lifecycle event Disable.

onAttach → destroyNode(self)
Result: nested destroy rejected; Node completes Attach / Ready / Active; no Destroy → Attach inversion.

Provider Hook → captured Public Capability mutation
Result: nested node is not created; lifecycle:error records the rejection.

Shadow Import Hook → captured Public Capability mutation
Result: active Runtime is not mutated; import commits a new generation; Hook error diagnostic is retained.

Successful Import
Result: generation N → N+1; runtime:replaced is sequence 1.

Failed Import
Result: generation and sequence remain unchanged.

Public subscriber throws
Result: observerErrorCount and aggregate listenerErrorCount increase; other subscribers still receive events.
```

## Executed validation

```text
Runtime Node first-party alias gate passed (fallback mode).
NGVGE 0008.7.3 conformance smoke passed.
NGVGE 0008.8 scene graph persistence smoke passed.
NGVGE 0008.9.1 Runtime Node API Freeze smoke passed.
NGVGE 0008.9.1.1 Runtime Node Public Boundary Cleanup smoke passed.
NGVGE 0008.9.2 Runtime Node Lifecycle Conformance smoke passed.
NGVGE 0008.9.2.1 Runtime Lifecycle Reentrancy and Generation Closure smoke passed.
NGVGE foundation extension validation passed.
```

Additional checks:

```text
Changed/new JavaScript files: 9
node --check: 9 / 9 passed
package.json JSON parse: passed
Public own-key contract: 45 / 45 exact match
Removed baseline files: 0
Root node_modules: absent
```

The archive does not contain root `node_modules`. Full Jest, ESLint, Webpack and browser integration tests were therefore not executed. A dedicated Jest suite was added at:

`test/unit/lib/runtime-nodes/runtime-node-lifecycle-reentrancy-generation.test.js`

## Changed files

### Added (3)

- `docs/TASK-0008.9.2.1-RUNTIME-LIFECYCLE-REENTRANCY-GENERATION-CLOSURE.md`
- `scripts/validate-ngvge-task-0008.9.2.1.js`
- `test/unit/lib/runtime-nodes/runtime-node-lifecycle-reentrancy-generation.test.js`

### Modified (12)

- `docs/TASK-0008.9.2-RUNTIME-NODE-LIFECYCLE-CONFORMANCE.md`
- `docs/ngvge/runtime-node-model.md`
- `docs/ngvge/scene-system-first-party-module.md`
- `docs/ngvge/scratch-sprite-node-adapter.md`
- `package.json`
- `scripts/validate-ngvge-task-0008.9.2.js`
- `src/lib/runtime-nodes/component-container.js`
- `src/lib/runtime-nodes/runtime-node-graph.js`
- `src/lib/runtime-nodes/runtime-node-lifecycle.js`
- `src/lib/runtime-nodes/runtime-node-model-service.js`
- `src/lib/runtime-nodes/runtime-node.js`
- `src/lib/scene-system/module-definition.js`

### Removed (0)

None.

## Architecture status

```text
TASK 0008.9.2
Implemented / Lifecycle Contract Frozen

Next:
0008.9.3｜Component Boundary Freeze
```
