# WS-5 | Node Explorer Workspace Integration

**Status:** `COMPLETE / VERIFIED`
**Parent:** `ARC-0001 | Kernel Independence Contract`
**Predecessor:** `WS-4 | Workspace Persistence / Settings — COMPLETE / VERIFIED`

## Purpose

WS-5 closes the product-layer object-management boundary around Node Explorer. Node Explorer remains the primary Workspace object manager, while Legacy Sprites remains a default-hidden Compatibility Tool.

The stage establishes these stable identities:

- `ngvge.workspace-node-command-host@1`
- `ngvge.workspace-node-command-client@1`
- `ngvge.workspace-project-node-compatibility-adapter@1`
- Workspace Node Command Schema `v1`

The production path is:

```text
Node Explorer / Inspector Tool
        ↓ ToolId provenance
Workspace Node Command Client
        ↓ stable NodeId command
Workspace Node Command Host
        ├── Runtime Node domain
        │       ↓
        │   ngvge.runtime-node-command
        │       ↓ Engine Protocol
        │   Runtime Node authority
        │
        └── Project compatibility domain
                ↓ explicit quarantine
            Project Node compatibility adapter
                ↓
            historical Project NodeDatabase
```

The Workspace Host does not become Runtime Node authority. It is a product command router that preserves the existing Runtime Engine Protocol and isolates the historical Project Node writer behind an explicit compatibility adapter.

## Stable command contract

Workspace Node Command Schema v1 supports:

```text
SelectNode
CreateNode
DestroyNode
DuplicateNode
PatchNode
ReparentNode
```

Only these ToolIds may originate commands:

```text
ngvge.tool.node-explorer
ngvge.tool.inspector
```

Every semantic object identity carried by the command boundary is a stable NodeId. Commands fail closed if they contain backend/Scratch identity fields such as `targetId`, `scratchTargetId`, `runtimeId`, `backendId`, `editingTargetId`, `target` or `vm`, including nested payloads.

## Shared production host

The production GUI creates exactly one `WorkspaceNodeCommandHost` and derives two Tool-specific clients from it:

```text
WorkspaceNodeCommandHost
        ├── Node Explorer client
        │   ToolId = ngvge.tool.node-explorer
        │
        └── Inspector client
            ToolId = ngvge.tool.inspector
```

Classic and Custom Workspace presentations receive clients from the same Host. This prevents each component from creating a separate mutation authority or selection writer.

## Selection and Inspector target

Node Explorer selection writes use `SelectNode(NodeId)` through the Workspace client. Inspector receives the same `projectExplorerSelectedNodeId`, so Inspector target selection is a projection of the primary stable NodeId selection.

Scratch target activation remains a separate compatibility projection. A Scratch target echo may normalize back to its bound Runtime NodeId, but it cannot replace the primary NodeId identity.

## Mutation ownership

Node Explorer and Inspector no longer directly call Project NodeDatabase writer methods and no longer directly construct Runtime Node editor clients.

Runtime Node operations route through the existing `ngvge.runtime-node-command` capability and Engine Protocol. This includes create, destroy, duplicate, patch/rename/enable and reparent operations.

Historical Project Node operations route through `ngvge.workspace-project-node-compatibility-adapter@1`. The adapter owns no new semantic identity and rejects target-bound Project compatibility nodes as editable Project nodes.

Mixed Runtime/Project compatibility batches fail closed. Runtime command batches remain one stable NodeId per Engine Protocol command until a native batch contract exists.

## Context menu and drag/drop

Context-menu actions call the same Workspace Node client used by toolbar/dialog paths. There is no separate context-menu mutation API.

Drag/drop hierarchy mutations resolve to `ReparentNode` / `ReparentNodes` commands. Runtime drag/drop therefore reaches Runtime Node Authority through Engine Protocol; Project compatibility drag/drop remains quarantined behind the compatibility adapter.

## Scene hierarchy

Hierarchy presentation remains read-only projection from stable Node snapshots:

- Global Runtime root;
- Scene Runtime roots;
- Runtime Node parent/child snapshots;
- compatibility Project Node projections while that historical model remains supported.

Hierarchy writes never mutate the Runtime Node Model directly. Reparenting is command-driven.

## Legacy Sprites demotion

Tool Registry continues to define:

```text
Node Explorer
  source = first-party / ngvge.core
  role = Primary
  defaultVisible = true

Legacy Sprites
  source = compatibility / scratch.compatibility
  role = Compatibility
  defaultVisible = false
```

Legacy Sprites therefore cannot compete with Node Explorer for primary object-management authority.

## RE-3 successor closure

RE-3 originally certified the Runtime Node command boundary by requiring Project Explorer and Inspector source files to directly consume `RUNTIME_NODE_COMMAND_CAPABILITY_ID` and `createRuntimeNodeEditorClient`.

WS-5 deliberately removes that direct component coupling. The RE-3 validator is now successor-aware and accepts either:

```text
legacy certified path:
Component → Runtime Node command capability
```

or the stronger WS-5 path:

```text
Component
→ Workspace Node client
→ Workspace Node Host
→ Runtime Node command capability
→ Runtime Node editor client
```

Both paths continue to prohibit direct Runtime Node Model mutations. WS-5 additionally requires ToolId provenance and recursive backend-identity rejection.

## Persistence boundary

WS-5 creates no new Workspace persistence record and does not store Node command or selection state in `localStorage`.

Project serialization remains owned by Project Lifecycle / existing Project Node persistence. Workspace layout/preferences remain owned by WS-4. Session selection remains runtime UI state.

## Verification

See:

- `WS-5-VERIFICATION.md`
- `WS-5-CERTIFICATE.json`
- `WS-5-node-command-boundary-matrix.csv`
