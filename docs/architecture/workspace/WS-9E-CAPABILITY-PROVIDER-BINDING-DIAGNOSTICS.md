# WS-9E | Capability Provider Binding & Diagnostics

Status: COMPLETE / VERIFIED  
Authority: ARC-0001  
Baseline: WS-9D COMPLETE / VERIFIED

## Purpose

WS-9A established capability declarations and admission leases. WS-9D proved that a Tool can legally consume Workspace Context, but the first Context consumer still constructed its facade directly from the Context Service after admission.

WS-9E separates permission admission from runtime service resolution:

```text
Tool Ecosystem + Capability Descriptor
        ↓
WorkspaceToolCapabilityHost
        ↓
revocable admission lease
        ↓
WorkspaceCapabilityProviderRegistry
        ↓
Provider availability + binding
        ↓
scoped facade
        ↓
Tool consumer
```

The Capability Host answers **what a Tool may request**. The Provider Registry answers **whether a legal runtime provider currently exists, whether it is available, and which scoped facade the Tool may receive**.

Neither layer becomes Project, Resource, Context, Persistence, VM, Renderer, or backend authority.

## Stable identities

- `ngvge.workspace-capability-provider-registry@1`
- Provider descriptor schema v1
- Provider binding schema v1
- existing `ngvge.workspace-tool-capability-host@1`

Core production Provider identities:

- `ngvge.workspace-capability-provider.context-read`
- `ngvge.workspace-capability-provider.workspace-state.query`
- `ngvge.workspace-capability-provider.workspace-state.mutate`

## Provider descriptor

A Provider descriptor contains only portable metadata:

```text
schemaVersion
providerId
capabilityId
access
description
```

It does not contain a VM, Renderer, Scratch Target, backend handle, service object, Resource backend object, React component, Redux store, or DOM node.

A runtime registration separately supplies trusted `createFacade()` and `getAvailability()` callbacks. Runtime implementation objects therefore remain inside the provider closure rather than becoming Tool-visible DTO fields.

## One Provider per capability surface

The Registry keys Provider ownership by:

```text
CapabilityId + Access
```

For example:

```text
ngvge.workspace-capability.context-read#query
```

Only one active Provider may own one such surface. A second registration fails closed with `NGVGE_WORKSPACE_CAPABILITY_PROVIDER_CONFLICT`.

This is Provider-surface ownership only. It does not transfer the backing semantic writer authority from Workspace Context, Project Lifecycle, Resource authority, or Workspace Persistence.

## Binding lifecycle

A Tool can bind only after admission:

```text
capabilityLease.assert(capabilityId, access)
        ↓
find exact Provider surface
        ↓
check Provider availability
        ↓
create scoped facade
        ↓
wrap facade with Provider-binding guard
```

A binding is revoked when:

- the Tool capability lease is revoked;
- ToolRegistry unregister causes the admission lease to revoke;
- the Provider is unregistered;
- the Provider Registry is disposed;
- the consumer explicitly releases the binding.

Stale facade functions are guarded by the binding. Calling them after revocation fails closed with a Provider-binding revoked diagnostic even if the caller retained an old JavaScript reference.

## Dynamic Provider availability

Provider availability is queryable at bind time and after binding.

The facade wrapper re-checks availability on every Tool-visible function call:

```text
ready
  ↓
provider becomes unavailable
  ↓
old binding reference still exists
  ↓
next facade call
  ↓
fail closed with Provider diagnostic
```

A Tool therefore cannot continue silently through a provider outage merely because it bound earlier.

## Facade safety

Provider facades may expose functions and portable plain metadata. They may not expose raw authority/backend fields such as:

```text
vm
rawVM
renderer
Scratch Target
target
backend
backendHandle
handle
raw
```

The provider implementation may close over an internal service or authority object, but that object cannot cross the facade boundary as an enumerable Tool-visible field.

## Diagnostics

The Registry exposes two diagnostic views.

### Tool diagnostics

`diagnoseTool(toolId)` reports every declared Tool request with:

```text
capabilityId
access
required
state
providerId
diagnosticCode
diagnosticMessage
bindingCount
```

States are:

- `ready`
- `provider-missing`
- `provider-unavailable`

### Coverage diagnostics

`getCoverageDiagnostics()` compares all registered capability definitions with registered Provider surfaces. This makes missing Project/Resource providers explicit architecture state instead of implicit future work.

Diagnostics are query-only and do not mutate Provider, Tool, Project, Resource, or Context state.

## Core Provider bindings

### Context read

`context-read/query` is the first production semantic query Provider:

```text
admitted Tool lease
        ↓
Context Provider
        ↓
createWorkspaceContextReadCapability(...)
        ↓
portable Workspace Context facade
```

The Context Service remains hidden inside the trusted Provider closure.

### Workspace state

Workspace-state Providers are scoped to the admitted ToolId.

Query facade:

```text
getState(toolId)
```

Mutate facade:

```text
setState(toolId, state)
removeState(toolId)
```

No facade exposes the entire multi-Tool persistence snapshot, so one Tool cannot use this Provider to enumerate another Tool's Workspace state.

Todo production behavior is intentionally not migrated in WS-9E; the existing WS-8 Todo persistence path remains unchanged. WS-9E only establishes the legal Provider seam for later consumer migration.

## Intentionally missing Providers

WS-9E does **not** invent fake Project or Resource Providers merely to make the registry look complete.

The following surfaces remain explicit `provider-missing` diagnostics:

```text
project-read#query
project-command#propose
project-command#mutate
resource-read#query
resource-command#propose
resource-command#mutate
```

They will become `ready` only after a stable Project/Resource authority facade exists that can satisfy ARC-0001 without exposing Scratch/backend identity.

## Context consumer migration

`admitWorkspaceContextConsumer()` no longer accepts `WorkspaceContextService`.

Old WS-9D construction seam:

```text
Capability admission
  + raw Context Service passed to consumer helper
  ↓
construct Context facade
```

WS-9E seam:

```text
Capability admission
  ↓
Provider Registry bind context-read/query
  ↓
providerBinding.facade
```

The Agent runtime remains unchanged after the facade boundary and still receives only `contextReadCapability`.

## Production bootstrap

GUI owns:

```text
WorkspaceContextService
WorkspaceToolPersistenceService
WorkspaceToolCapabilityHost
WorkspaceCapabilityProviderRegistry
WorkspaceContextRuntimeBinding
Agent Context consumer
```

Construction order preserves the authority split:

```text
services/authorities exist
        ↓
Capability Host defines permission
        ↓
Provider Registry wraps legal service seams
        ↓
Tool consumer binds admitted facade
```

GUI teardown disposes Provider Registry and Capability Host. Both teardown paths are idempotent and active Tool bindings cannot survive either lifecycle.

## Non-goals

WS-9E does not:

- make Provider Registry a Project or Resource writer;
- add raw Project/Resource service locator access;
- create fake Project/Resource Providers;
- activate Terminal or Paint;
- add filesystem, process, network, browser, shell, credential, or device capabilities;
- migrate Todo production behavior to Capability Providers;
- expand Agent-visible Context beyond the WS-7 safe Node projection;
- bypass WS-7 Agent ChangeSet review/transaction authority;
- persist capability leases, Provider bindings, or Provider runtime objects;
- expose VM, Renderer, Scratch Target, backend/private objects through Provider facades.

## Definition of Done

1. Provider Registry has a stable versioned identity.
2. Provider descriptor and Provider binding schemas are versioned.
3. Provider registration validates capability identity and allowed access.
4. One capability/access surface has at most one active Provider.
5. Binding requires a valid admitted Tool capability lease.
6. Missing Provider fails closed before Tool service use.
7. Unavailable Provider fails closed with explicit diagnostic.
8. Bound facade re-checks dynamic Provider availability.
9. Tool lease revocation invalidates Provider binding.
10. Provider unregister invalidates existing Provider bindings.
11. Registry disposal invalidates existing Provider bindings.
12. Stale facade references cannot operate after binding revocation.
13. Provider facade rejects raw VM/Renderer/Scratch/backend authority fields.
14. Context read is resolved through Provider Registry in production.
15. Workspace-state Provider facade is scoped to admitted ToolId.
16. Project/Resource Provider absence is explicit diagnostics, not hidden fallback.
17. Agent receives no raw WorkspaceContextService.
18. Terminal/Paint remain planned and unadmitted.
19. WS-8 through WS-9D focused gates remain green.
20. Full Unit, Integration, Smoke, TypeScript, ESLint and permanent regression remain green.
21. LSC-G1 / LRC-G1 / LPL-G1 / LEX-G1 / COL-0 / ARC-C001.1 remain green.
