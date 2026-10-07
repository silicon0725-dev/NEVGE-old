# WS-3A | Dock Runtime Model

**Status:** COMPLETE / VERIFIED
**Architecture Parent:** ARC-0001 | Kernel Independence Contract
**Depends On:** WS-1 Tool Registry + Window Model, WS-2 Window Manager
**Gate Preconditions:** LSC-G1, LRC-G1, LPL-G1, LEX-G1 PASS / CERTIFIED; COL-0 COMPLETE / VERIFIED

## 1. Purpose

WS-3A establishes the runtime data model for the future Workspace Dock without introducing Dock presentation or interaction UI.

The frozen relationship is:

```text
ToolRegistry
    +
WindowManager
    ↓
DockRuntimeModel
    ↓
DockItem projection
```

The Dock is not a second Window Manager. Window visibility, minimize/restore, focus, active state, geometry and z-order remain owned by `ngvge.workspace-window-manager@1`.

## 2. Stable identity

```text
ngvge.workspace-dock-runtime-model@1
```

Schema versions:

```text
Dock Runtime State v1
Dock Item v1
```

## 3. Authority split

### Derived from Tool Registry

- ToolId
- title
- iconKey
- singleton / multi-instance identity

### Derived from Window Manager

- running
- minimized
- active
- active WindowId
- running WindowIds
- minimized WindowIds
- per-WindowId instance projection

### Owned by Dock Runtime Model

- pinned ToolIds
- ordering metadata
- group/folder organization metadata seam

### Explicitly not owned by Dock Runtime Model

- open / close
- minimize / restore
- activate / focus
- maximize
- position / size
- z-order
- Window persistence
- Project / Runtime semantic state
- Scratch Target or renderer identity

## 4. Running semantics

A registered WindowId is not automatically a running Dock instance.

The current GUI registers several singleton windows when the Workspace initializes, including windows which can be closed or hidden. Therefore WS-3A defines:

```text
running = visible || minimized
```

This prevents a registered but closed Inspector, Asset Workspace or Legacy Sprites window from being permanently reported as running.

## 5. ToolId / WindowId distinction

For singleton tools:

```text
ToolId
ngvge.tool.node-explorer

WindowId
project-explorer
```

For multi-instance tools:

```text
ToolId
ngvge.tool.editor

WindowIds
editor-1
editor-2
...
```

A DockItem is Tool-scoped while preserving the set of Window instances. WS-3B can therefore choose launch/focus/restore behavior without conflating Tool identity with Window identity.

## 6. Projection, not copied authority

`DockRuntimeModel` subscribes to WindowManager lifecycle events so consumers can refresh their projection, but it does not cache or own WindowManager geometry/focus/z-order state.

Dock instance projection intentionally excludes:

```text
zIndex
lastFocusedAt
position
size
normalPosition
normalSize
```

It also exposes no Scratch VM, renderer, ExtensionManager, drawable or Target identity.

## 7. Pinning / ordering / organization

WS-3A establishes runtime ownership seams for:

```text
pin(toolId)
unpin(toolId)
setOrder(toolIds)
setOrganizationMetadata(toolId, {groupId, folderId})
```

These are runtime-only in WS-3A.

The following remain deferred:

```text
WS-3B
click / launch / focus / restore
running / minimized / active indicators
user-facing drag reorder and pin/unpin interaction

WS-3C
placement / geometry / target geometry

WS-3D
separator / group / folder topology and UI

WS-4
versioned Workspace persistence / settings
```

## 8. Production integration

The existing GUI creates the model from the same production Tool Registry and Window Manager:

```text
new DockRuntimeModel({
    toolRegistry: WORKSPACE_TOOL_REGISTRY,
    windowManager
})
```

WS-3A exposes diagnostic attributes on the existing Workspace root only:

```text
data-ngvge-dock-runtime-model
data-ngvge-dock-runtime-revision
```

No Dock surface, launcher, item renderer, animation, placement or interaction has been introduced.

## 9. Architecture invariants

1. Dock runtime identity is `ngvge.workspace-dock-runtime-model@1`.
2. DockItem is ToolId-scoped and WindowId-aware.
3. Running state is derived from WindowManager state, not registration existence.
4. Dock does not maintain a second copy of WindowManager authority.
5. Dock does not call WindowManager mutation methods.
6. Dock pinning/order/organization metadata contains stable ToolIds only.
7. Dock DTOs contain no Scratch/backend handles.
8. WS-3A contains no localStorage/sessionStorage persistence.
9. WS-3A contains no Dock presentation UI.
10. Any later Dock library remains a Presentation implementation and may not own ToolId, WindowId or Window state authority.

## 10. Result

WS-3A provides the runtime projection required by WS-3B while preserving the frozen WS-1/WS-2 authority split.

The next stage is:

```text
WS-3B | Basic Interaction
```
