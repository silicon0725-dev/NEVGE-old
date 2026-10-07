# WS-9B | Workspace Context Service

Status: COMPLETE / VERIFIED  
Authority: ARC-0001  
Baseline: WS-9A COMPLETE / VERIFIED

## Purpose

WS-9B establishes one portable Workspace Context projection for tools without creating a new Project, Scene, Node, Resource, or Window authority.

Before WS-9B, context facts were available through unrelated seams: Node selection writers, Scene/runtime surfaces, Resource/asset UI state, WindowManager active state, and Agent-specific `getCurrentNodeId()` callbacks. That is acceptable for existing tools but does not scale to Browser, Paint, IDE, Office, Terminal, or richer Agent tooling.

WS-9B therefore answers a narrow question:

> What stable semantic identities are currently relevant to the Workspace, and how may an admitted Tool query that projection without reaching into Redux, React, Scratch VM, Renderer, or backend objects?

## Stable identities

- `ngvge.workspace-context@1`
- Workspace Context Snapshot schema v1
- Workspace Context Writer Lease schema v1
- `ngvge.workspace-context-read-capability@1`
- `ngvge.workspace-capability.context-read`

## Snapshot contract

```text
WorkspaceContextSnapshot v1
├── serviceId
├── revision
├── projectId?
├── sceneId?
├── selectedNodeIds[]
├── primaryNodeId?
├── resourceId?
├── activeToolId?
└── activeWindowId?
```

The snapshot contains only portable identity values. It cannot contain Scratch Target, VM, Renderer, Redux store, React component, DOM node, backend resource handle, process handle, or implementation-library identity.

## Context domains

WS-9B separates projection ownership by domain:

```text
project
scene
node-selection
resource
window
```

Each domain can have at most one active Context writer source. This is not semantic writer authority over the underlying object. The writer is an adapter from the real authority into a read-only Workspace projection.

Example:

```text
WindowManager
    │ owns window runtime state
    ▼
Window Context source
    │ projects active ToolId / WindowId only
    ▼
WorkspaceContextService
```

The Context Service never becomes the owner of Window visibility, focus, z-order, geometry, Project lifecycle, Scene lifecycle, Node selection semantics, or Resource mutation.

## Writer lease

A Context source must claim one domain through a stable source identity:

```text
ngvge.workspace-context-source.*
```

A writer lease can update only its claimed domain. Competing writers fail closed with `NGVGE_WORKSPACE_CONTEXT_WRITER_CONFLICT`.

Releasing the writer clears its projected domain by default and invalidates stale writer references. Stale writes fail with `NGVGE_WORKSPACE_CONTEXT_WRITER_REVOKED`.

This avoids an implicit last-writer-wins context model.

## WindowManager binding

WS-9B includes the first concrete source adapter:

`bindWindowManagerToWorkspaceContext(...)`

It observes WindowManager and projects only:

- `activeWindowId`
- `activeToolId`

It does not copy Window state authority and does not expose WindowManager through the snapshot.

The adapter is implemented and unit verified, but WS-9B does not switch the production Workspace bootstrap to the new Context Service yet.

## Tool Capability integration

WS-9B extends WS-9A with:

```text
ngvge.workspace-capability.context-read
access = query only
scope = workspace
privilege = standard
```

The capability is compatible with Workspace-only, Project-read, Project-command, and Resource-command ecosystem authorities because reading Workspace context does not grant the underlying semantic authority.

A Tool must still explicitly declare `context-read/query` in its Tool Capability Descriptor. There is no implicit context access.

`createWorkspaceContextReadCapability(...)` verifies the Tool capability lease at construction and on every read. A revoked Tool lease cannot continue querying the Context Service. Existing subscriptions stop delivering future Context events after revocation.

## Tool Ecosystem integration

WS-9B adds the service identity:

```text
workspace.context
```

to `TOOL_ECOSYSTEM_SERVICES`, allowing future Tool ecosystem manifests to declare Context as an explicit dependency.

No current Tool manifest is broadened merely because the service exists.

## Current production behavior

WS-9B intentionally does not migrate existing product paths yet.

In particular:

- Node Explorer / Inspector selection behavior is unchanged;
- Agent still uses its existing `getCurrentNodeId()` context callback;
- SceneSelector is unchanged;
- Asset/Resource selection is unchanged;
- Todo does not gain context-read permission;
- Terminal and Paint remain planned;
- no new Context Service instance is installed into React/Redux/VM bootstrap.

This preserves the WS-9A rule that foundation stages must not silently reassign established authority.

## Non-goals

WS-9B does not:

- become Project/Scene/Node/Resource/Window authority;
- define Project or Resource mutation providers;
- migrate Agent production context consumption;
- wire Node Explorer selection into Context in production;
- wire Scene lifecycle or Resource selection in production;
- expose context to every Tool automatically;
- add filesystem/process/browser authority;
- activate Terminal or Paint;
- persist Context as Project or Workspace state.

Context is ephemeral projection state, not persistence identity.

## WS-9B completion definition

WS-9B is complete when:

1. Workspace Context Service and Snapshot identities are versioned.
2. Project, Scene, Node selection, Resource, and Window domains are explicit.
3. Snapshot data is immutable and portable.
4. One domain cannot have competing writer sources.
5. Writer leases can be released and stale writers fail closed.
6. WindowManager can project active WindowId/ToolId without losing Window authority.
7. `context-read` is explicit and query-only.
8. Tool Context access is capability-lease gated.
9. Revoked Tool leases cannot continue reading or observing Context.
10. no VM/Renderer/Scratch/Redux/React/backend identity enters Context schema.
11. no existing production selection/Agent behavior is silently switched.
12. focused Unit and machine gates pass.
13. real Webpack Context entry passes.
14. existing Workspace constituent gates remain green.
15. Unit, Integration, Smoke, TypeScript, and correctness ESLint remain green.
