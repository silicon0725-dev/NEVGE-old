# NGVGE Task 0008.9.7 Validation

Task: `0008.9.7 Runtime Mutation Commit Boundary`  
Scene System: `0.8.9.7`  
Runtime Node public API: `ngvge.runtime-node-model@1.3.1`  
Persistent format: `1`  
Status: **Freeze Candidate / External Verification Pending**

## Frozen-candidate boundary

One portable Runtime Node mutation is atomic with Project Source persistence:

```text
checkpoint
→ prepare Runtime semantic mutation
→ persist authoritative Project Source
→ provider lifecycle hooks
→ observer events
→ committed result
```

Persistence failure:

```text
restore original live semantic state in place
→ discard provider lifecycle hooks
→ discard observer events
→ applied=false / persisted=false / snapshot=null
```

Multi-command transaction APIs, Undo and transaction-wide rollback remain deferred to ARC-C001.

## Additional defects found during real validation

Validation was performed against the aligned full project rather than only isolated architecture scripts. It exposed and fixed three additional defects:

1. Initial restore could dispatch a change before `getRegistryRevisionForGraph` was initialized, producing a JavaScript TDZ error and preventing later opaque-node reification.
2. `UnknownRuntimeNode.toPersistentRecord()` could materialize `missingProvider: undefined` / `missingVersion: undefined`; duplicating an opaque node then failed the Persistent Data Validator.
3. `reorderChild()` and explicit `detachNode()` state were not durably represented by the v1 persistence round trip. v1 now explicitly treats `parentId: null` as detached and uses relative persistent node-record order to preserve sibling order. No new persistent field or version was introduced.

## Architecture gates

PASS:

```text
Runtime Node first-party alias gate
0008.9.1.1 Runtime Node Public Boundary Cleanup
0008.9.2 Runtime Node Lifecycle Conformance
0008.9.2.1 Reentrancy / Generation Closure
0008.9.2.2 Observation Boundary Closure
0008.9.2.2.1 Dispose Preflight
0008.9.3 Component Boundary
0008.9.3.1 Identity / Persistence Closure
0008.9.3.1.1 Cardinality Authority Transition
0008.9.3.1.2 Registry Binding Ownership
0008.9.4 Schema / Migration Authority
0008.9.4.1 through 0008.9.4.1.6
0008.9.5 Runtime Error / Diagnostic Contract
0008.9.6 Revision / Snapshot Contract
0008.9.6.1 Revision Authority / Canonical Snapshot Closure
0008.9.6.1.1 Internal Dispatch / Provider Isolation
0008.9.7 Runtime Mutation Commit Boundary
Module Bootstrap Recovery Authority
Module Capability Publication Authority
```

## 0008.9.7 destructive matrix

All declared portable mutation methods are covered by forced persistence failure and exact persistent-semantic rollback checks:

```text
addComponent
createNode
destroyNode (subtree)
detachNode
duplicateNode (subtree)
patchComponent
patchNode
patchNodeMetadata
removeComponent
reorderChild
setComponentData
setComponentEnabled
setNodeEnabled
setParent
```

Compatibility mutation aliases additionally checked:

```text
patchComponentData
renameNode
```

Validated invariants:

```text
failed result: applied=false
failed result: persisted=false
failed result: snapshot=null
Runtime export equals pre-attempt semantic export
Runtime generation unchanged
no mutation observer event published
Graph / Registry revisions never rewind
failed-attempt Revision Token is never reused
implicit Component Descriptor created by failed add is removed
existing Node / Component identity restored in place
provider destroy hook does not run before persistence
successful provider destroy hook observes already-committed Project Source
write-then-throw backend is accepted only after exact authoritative read-back confirmation
sibling reorder survives persistence / restore
explicit detached parentId:null survives persistence / restore
```

## Jest

Focused real Jest execution:

```text
test/unit/lib/runtime-nodes
test/unit/lib/first-party-modules

29 suites passed
137 tests passed
0 failed
```

A repository-wide `test/unit` run progressed outside NGVGE Runtime and stopped in the existing `ProjectExplorer` React test because the packaged Jest 29 environment is Node and the component has an effect that directly accesses `document`. This is independent of `0008.9.7`; it is not counted as an NGVGE Runtime failure and was not silently modified in this task.

## JavaScript syntax

All changed/new JavaScript files relative to the aligned project baseline:

```text
23 / 23 node --check PASS
```

## Webpack / browser

Development Webpack compilation:

```text
webpack-dev-server: Compiled successfully
```

Fresh headless Chromium validation used a new browser profile and attached CDP Runtime/Log listeners before navigation:

```text
Page.loadEventFired: true
Runtime.exceptionThrown: 0
Log error entries: 0
console error/assert entries: 0
```

A production build was attempted twice. The available execution environment terminated it on timeout (first at 120 s, then at 240 s) while Babel/Webpack were still compiling; no compiler error was printed before termination. Production build is therefore **not claimed PASS**.

## Persistent compatibility

Unchanged identifiers:

```text
Runtime Node public API:         ngvge.runtime-node-model@1.3.1
Runtime Node persistent format:  1
Snapshot capability:             ngvge.runtime-node-snapshot@1
Revision contract:               ngvge.runtime-node-revision@1
```

Updated:

```text
Scene System: 0.8.9.7
mutation transactionSemantics: single-command-atomic
```

v1 hierarchy clarification:

```text
explicit parentId:null = detached
omitted legacy parentId = default scope root
relative node-array order among the same parent's children = persistent sibling order
```

## Freeze recommendation

Implementation and internal validation are complete enough to present `0008.9.7` as a freeze candidate. Formal Architecture Frozen status is intentionally left pending the user's external adversarial verification of the delivered full project package.

## Full built project delivery-copy verification

The final delivery tree containing the real project `node_modules` was validated independently after synchronization:

```text
Delivery tree node_modules:                           present
Stale project/ duplicate:                             absent
0008.9.7 dedicated validator:                         PASS
Runtime Node boundary Architecture Gate:              PASS
Runtime Node lifecycle Architecture Gate:             PASS
Runtime Component / Schema / Migration full chain:    PASS
Bootstrap Recovery Gate:                              PASS
Capability Publication Gate:                          PASS
Focused Runtime/First-party Jest:                     29 suites / 137 tests PASS
Verified working tree vs delivery tree (source):      byte/content equivalent
```

The delivery-copy validation does not change the freeze recommendation: `0008.9.7` remains **Freeze Candidate / External Verification Pending** until the delivered project is adversarially verified externally.
