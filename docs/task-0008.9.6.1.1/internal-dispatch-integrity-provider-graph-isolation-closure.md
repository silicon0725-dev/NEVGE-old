# 0008.9.6.1.1 Internal Dispatch Integrity and Provider Graph Isolation Closure

Status: Architecture Frozen  
Scene System: `0.8.9.6.1.1`  
Parent: `0008.9.6.1 Runtime Revision Authority and Canonical Snapshot Closure`

## Single frozen boundary

This closure makes Engine-internal lifecycle dispatch and Model mutation ownership non-interceptable by Runtime Node or Component providers:

```text
Provider extension code
→ receives lifecycle snapshots, query facade and provider resource context
→ never receives RuntimeNodeGraph
→ cannot mutate a Model-managed live object outside Graph-owned mutation scope
```

The closure covers two directly related authority surfaces:

1. Engine-internal Node, Component and Component Container operations are captured once at module initialization and never dynamically resolved from a mutable prototype or provider instance.
2. A Graph owned by `RuntimeNodeModelHost` grants semantic-write authority only to its private Graph mutation scope. Retained live Node, Component and Container references are read-only outside that scope.

It does not introduce a general transaction system. Public mutation persistence, multi-command Commit/Rollback and transaction-wide revision remain deferred to ARC-C001.

## Fixed internal dispatch

The Runtime captures its base operations once after the base classes are defined. The captured function table is module-private and frozen.

### Runtime Node operations

```text
_bindGraph
_replaceGraphBinding
_invoke
_recordLifecycle
_transition
_markReady
_setActiveInHierarchy
addComponent
removeComponent
```

### Runtime Component operations

```text
_replaceGraphBinding
_invoke
_recordLifecycle
_transition
_create
_attach
_ready
_setActive
_setEnabled
_detach
_destroy
patchData
setData
```

### Runtime Component Container operations

```text
_replaceGraphBinding
_readyAll
_setActiveAll
_destroyAll
add
remove
```

The corresponding base-prototype descriptors are non-writable and non-configurable. Each instance receives final internal methods from the captured operation table before the object is sealed.

Engine code invokes only the captured base operations. It never performs provider virtual dispatch such as:

```text
node._bindGraph(...)
component._create(...)
component._attach(...)
component._destroy(...)
```

A provider may declare same-named subclass methods, but those methods are not selected for Engine lifecycle dispatch and cannot observe the raw Graph argument.

## Provider hook surface

Provider behavior remains available through the declared lifecycle hook table. Hooks receive a frozen context containing:

```text
readonly Node snapshot
readonly Component snapshot
readonly query facade
provider-owned resource context
lifecycle phase / reason / generation metadata
```

The context does not contain:

```text
RuntimeNodeGraph
raw Component Container
Graph binding authority
Model persistence authority
Registry authority
```

Provider hooks can observe lifecycle and maintain provider-owned Runtime-only resources, but cannot use lifecycle dispatch as a hidden Graph capability.

## Model-managed live-object authority

Standalone `RuntimeNodeGraph` retains its existing local mutation semantics for internal tests and explicitly local hosts.

A Graph created by `RuntimeNodeModelHost` is marked as Model-authority-managed. In that mode, direct semantic writes through retained live references reject before side effects unless the operation is currently executing inside the Graph's private mutation scope.

Node rejection:

```text
RUNTIME_NODE_MODEL_AUTHORITY_REQUIRED
```

Component or Container rejection:

```text
RUNTIME_COMPONENT_MODEL_AUTHORITY_REQUIRED
```

Covered paths include:

```text
Node scalar assignment
Node nested metadata / source / childIds writes
Node addComponent / removeComponent
Component scalar assignment
Component data / extensionData nested writes
Component patchData / setData
ComponentContainer add / remove
array push / splice / index write
delete / defineProperty / prototype mutation
```

Supported Runtime Node Model mutations enter the private Graph scope, mutate Runtime state, advance Revision authority and execute the existing persistence commit path. A retained provider reference cannot create Runtime-only state that is absent from Project Source.

## Graph binding bearer authority

Internal binding helpers are not part of the supported public `runtime-nodes` export surface. Directly importing an implementation file still does not grant binding authority.

A rebind operation must present the exact currently bound Graph as its bearer:

```text
current private binding === expectedCurrentGraph
```

Without that raw Graph identity, binding replacement rejects:

```text
RUNTIME_NODE_INTERNAL_AUTHORITY_REQUIRED
RUNTIME_COMPONENT_INTERNAL_AUTHORITY_REQUIRED
```

This applies to Node, Component and Component Container bindings. It prevents implementation-file imports from being used to detach a live object from Guard ownership.

During Graph adoption, the active Graph itself supplies the exact previous binding:

```text
active nodes:       active Graph → old cleanup Graph
replacement nodes: replacement Graph → active Graph
```

The transfer remains atomic with respect to the existing import/adoption boundary.

## Revision and persistence integrity

For Model-managed graphs:

```text
Provider-visible mutation
→ must use Runtime Node Model capability
→ Runtime mutation is applied under Graph authority
→ Graph Revision advances
→ persistence is attempted through Model Service
```

The following state is forbidden:

```text
Runtime contains bypass node/component
Project Source does not contain it
no persistence write occurred
```

Failed direct-provider mutation attempts leave Runtime export, Project Source, write count and Revision-equivalent semantic state unchanged.

## API and persistence compatibility

Unchanged:

```text
Runtime Node public API:         ngvge.runtime-node-model@1.3.1
Snapshot capability:             ngvge.runtime-node-snapshot@1
Revision contract:              ngvge.runtime-node-revision@1
Runtime Node persistent format:  1
```

The Model-authority marker, captured operation tables, mutation depths and Graph binding stores are Runtime-only private implementation state.

## Native Kernel equivalence

A Native Kernel may implement these rules using private class methods, sealed vtables, internal function tables, friend APIs, capability tokens or package-private operations. It must preserve:

```text
provider-defined virtual methods cannot intercept Kernel binding/lifecycle dispatch
provider callbacks never receive raw Kernel Graph mutation authority
live semantic objects owned by the Model are not directly writable by providers
internal rebinding requires possession of the exact current Kernel binding authority
all supported semantic writes pass through the Model persistence boundary
```

## Final state

```text
TASK 0008.9.6.1.1

Node Internal Dispatch Integrity:       Frozen
Component Internal Dispatch Integrity:  Frozen
Component Container Dispatch Integrity: Frozen
Prototype Replacement Resistance:       Frozen
Provider Raw Graph Isolation:           Frozen
Model-managed Live-object Authority:     Frozen
Internal Binding Bearer Authority:       Frozen
Persistence Boundary Preservation:      Frozen

TASK 0008.9.6
Runtime Revision / Snapshot Contract:    Frozen
```
