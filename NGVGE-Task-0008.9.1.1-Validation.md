# NGVGE Task 0008.9.1.1 Validation Report

## Task

`0008.9.1.1 | Runtime Node Public Boundary Cleanup`

## Status

```text
Implementation: Passed
Portable API Shape: Frozen
Cross-Runtime Boundary: Passed
Persistent Format Change: None
Lifecycle Semantics Change: None
Transaction Semantics: Provisional
Ready For: 0008.9.2 Lifecycle Conformance
```

## Baseline

```text
scratch-gui-main-task-0008.9.1-runtime-node-api-freeze.zip
```

The baseline contains no root `node_modules` directory. Full Jest, ESLint and Webpack execution was therefore not claimed for this validation run.

## Version result

```text
Scene System: 0.8.9.1
Runtime Node persistent format: 1
Runtime Node portable public API: 1.2
Runtime Node type registration capability: 1
Runtime Node persistence controller: 1, Scene System internal
Runtime Node local host: 1, local-only
```

The project persistence format remains version `1`; no Scene or Runtime Node data migration is required.

## Implemented boundary corrections

### 1. First-party compatibility-alias removal

Project Inspector and Project Explorer no longer call:

```text
getNode
getComponent
patchComponentData
renameNode
```

Runtime rename now uses `patchNode()`. First-party subtree expansion and collapse now use the serializable `querySubtree()` query instead of callback-based `traverse()`.

`scripts/check-runtime-node-public-boundary.js` scans first-party `src/` code. It supports AST mode when Babel dependencies are installed and a dependency-free fallback mode for source archives. Direct access, optional chaining, bracket access and destructuring of forbidden Runtime Node aliases are rejected.

### 2. Capability separation

The former mixed service is separated into:

```text
ngvge.runtime-node-model@1.2
Portable Query + Portable Mutation + local subscribe wrapper

ngvge.runtime-node-type-registration@1
Restricted portable descriptor + local provider binding

ngvge.runtime-node-persistence-controller@1
Internal import / persist / synchronize controller

ngvge.runtime-node-local-host@1
Local traverse(visitor) + dispose
```

The ordinary Runtime Node capability does not expose:

```text
importState
persistState
synchronizeScenes
registerNodeType
traverse
dispose
RuntimeNodeGraph
RuntimeNodeTypeRegistry
```

The persistence controller is not published in the generic module capability registry. Scene System injects it directly into the Scratch Compatibility Adapter.

### 3. Portable type descriptor and local provider split

Node type registration now separates:

```text
NodeTypeDescriptor
Portable typeId, version, label, scopes, schema and owner

Local Provider Binding
JavaScript ctor/create and unregister closure
```

Descriptor fields are normalized to an explicit portable schema. Invalid scopes, non-portable values and duplicate ownership conflicts are rejected.

The legacy local `registerNodeType()` compatibility facade still supports same-owner `replace: true`. A stale unregister closure cannot remove a newer replacement provider.

### 4. Portable subtree query

The public API now provides:

```js
querySubtree({
    rootNodeId,
    order: 'pre' | 'post' | 'breadth',
    maxDepth: number | null,
    includeRoot: boolean
});
```

It returns frozen entries containing `NodeSnapshot` and depth. No JavaScript visitor callback is required by the portable contract.

### 5. Structured mutation result

Every portable mutation returns:

```js
{
    applied: boolean,
    persisted: boolean,
    snapshot: PortableSnapshot | null,
    error: PortableError | null
}
```

Verified outcomes:

```text
Graph rejection
applied=false, persisted=false

Successful mutation and write
applied=true, persisted=true

Successful Runtime mutation with failed project write
applied=true, persisted=false
```

The third state is explicitly observable, so callers cannot safely retry an already-applied mutation under the assumption that an exception means no change occurred.

`assertRuntimeNodeMutationResult()` is used by first-party in-process integrations that require persisted success. Its thrown error retains the original structured `mutationResult`.

The API contract records transaction semantics as `provisional`; atomic rollback remains a later ARC-C001 responsibility.

### 6. Portable argument and result validation

All methods marked `portable` validate the complete provided argument list before Runtime access. Non-portable query arguments are rejected. Non-portable mutation arguments return `applied: false` before graph mutation.

The new Portable Data validator rejects:

```text
Function
Promise
Symbol
BigInt
Class instance
Map / Set
Circular reference
Non-finite number
Accessor property
Non-enumerable data property
Sparse array
Custom array property
```

A node creation payload containing JavaScript lifecycle hooks was explicitly verified to be rejected before node creation.

Portable Query results, mutation results, API contract records and type descriptors were validated as frozen plain data.

### 7. Exact public surface

The published Runtime Node Model capability contains exactly:

```text
45 own keys
22 portable query methods
14 portable mutation methods
1 local-only method: subscribe
4 compatibility aliases
4 metadata keys
```

`Reflect.ownKeys(runtimeNodeModel)` must match `getApiContract().publicSurfaceKeys`. Undeclared functions, symbols, getters, setters or host controllers fail validation.

### 8. Native Bridge suitability

Every portable method descriptor declares:

```text
acceptsCallback=false
returnsFunction=false
argumentsSerializable=true
resultSerializable=true
```

`subscribe()` is explicitly classified as a local-only event-subscription wrapper. Type provider factories and unregister closures are restricted-host objects, not portable protocol payloads.

## Changed files

```text
New files: 5
Modified files: 20
Deleted baseline files: 0
Total changed files: 25
```

Primary additions:

```text
docs/TASK-0008.9.1.1-RUNTIME-NODE-PUBLIC-BOUNDARY-CLEANUP.md
scripts/check-runtime-node-public-boundary.js
scripts/validate-ngvge-task-0008.9.1.1.js
src/lib/runtime-nodes/portable-data.js
test/unit/lib/runtime-nodes/runtime-node-public-boundary-cleanup.test.js
```

## Executed validation

### Syntax and parser validation

```text
node --check
17 changed JavaScript files passed

TypeScript parser
19 changed JavaScript / JSX files passed
0 parse diagnostics
```

### Architecture alias gate

```text
Runtime Node first-party alias gate passed (fallback mode).
```

The fallback checker was also probed with temporary optional-chain and bracket-access violations. Both were detected before the probe file was removed.

### Dedicated boundary smoke

```text
NGVGE 0008.9.1.1 Runtime Node Public Boundary Cleanup smoke passed.
```

This smoke validates:

- exact `Reflect.ownKeys` surface;
- no host/persistence methods on ordinary capability;
- portable method descriptors;
- frozen and portable Query outputs;
- `querySubtree()` ordering data;
- non-portable argument rejection before mutation;
- structured persistence-failure semantics;
- portable descriptor/local provider separation;
- internal persistence-controller publication boundary;
- Portable Data rejection cases;
- legacy same-owner Node Type replacement compatibility.

### Regression smoke

```text
NGVGE 0008.7.3 conformance smoke passed.
NGVGE 0008.8 scene graph persistence smoke passed.
NGVGE 0008.9.1 Runtime Node API Freeze smoke passed.
NGVGE foundation extension validation passed.
```

The EXT-0001 Motion, Input and Data extension files remain present in the full project.

## Added but not executed in this archive

Jest coverage was added or updated for:

```text
Runtime Node exact public boundary
Portable subtree Query
Native Bridge method descriptors
Portable argument rejection
Applied-versus-persisted mutation semantics
Descriptor/provider separation
Scratch Adapter host-controller injection
```

The root archive does not contain `node_modules`, so the following were not run and are not claimed:

```text
Full Jest unit suite
Full ESLint suite
Webpack production build
Browser integration tests
```

## Final review

```text
[PASS] First-party code no longer consumes Runtime Node compatibility aliases
[PASS] Portable API no longer exposes persistence, registration, traversal or disposal controls
[PASS] traverse(visitor) replaced by portable querySubtree() for Editor use
[PASS] NodeTypeDescriptor separated from local provider implementation
[PASS] Mutation result distinguishes applied and persisted
[PASS] Mutation transaction semantics explicitly remain provisional
[PASS] Exact public surface is machine checked
[PASS] Portable arguments and results are machine checked
[PASS] Scratch Adapter boundary and persistence regressions remain passing
[PASS] Persistent format remains unchanged
```

## Conclusion

`0008.9.1.1` completes the Runtime Node portable public-boundary cleanup. The API shape can now be treated as frozen for the purposes of the remaining `0008.9` work, while transaction rollback semantics remain intentionally provisional.

The project may proceed to:

```text
0008.9.2 | Lifecycle Conformance
```

## Packaged artifact verification

```text
Incremental patch ZIP: 28 entries, CRC passed
Full project ZIP: 3246 entries, CRC passed
Full project extraction: byte-for-byte match with validated worktree
Patch applied to pristine 0008.9.1 baseline: byte-for-byte match with validated worktree
Extracted-project changed-file parser: 19 files passed
Extracted-project architecture and regression smoke: all passed
```
