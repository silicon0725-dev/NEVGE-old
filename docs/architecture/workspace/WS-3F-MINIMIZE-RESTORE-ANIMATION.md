# WS-3F | Minimize / Restore Animation

**Status:** COMPLETE / VERIFIED
**Date:** 2026-08-14
**Architecture Parent:** ARC-0001 | Kernel Independence Contract
**Workspace Parents:** WS-0 / WS-1 / WS-2 / WS-3A / WS-3B / WS-3C / WS-3D / WS-3E

## 1. Objective

WS-3F adds minimize/restore presentation transitions without granting the Dock or animation layer Window semantic authority.

The governing lifecycle is:

```text
Request Minimize / Restore
        ↓
WindowManager commits semantic state
        ↓
window:minimized / window:restored event
        ↓
DockTransitionModel resolves geometry
        ↓
WorkspaceWindowTransitionLayer
        ↓
Presentation-only transition
```

The animation is optional representation. Semantic Window state is already correct before a transition exists.

## 2. Stable identity

```text
ngvge.workspace-dock-transition-model@1
DockTransition schemaVersion = 1
```

Kinds:

```text
minimize
restore
```

Transition records contain stable Workspace identities only:

```text
transitionId
windowId
toolId
kind
from geometry
to geometry
durationMs
semanticState snapshot
```

They contain no Scratch Target, VM, Renderer or ExtensionManager identity.

## 3. Semantic authority ordering

`DockTransitionModel` subscribes to `WindowManager` lifecycle events. It does not invoke:

```text
minimize
restore
open
close
activate
move
resize
maximize
```

For a controlled Workspace window, `DraggableWindow` now requests minimize/restore through its controlling callback before changing presentation. It does not pre-commit a local minimized state.

This makes the ordering explicit:

```text
User interaction
→ WindowManager mutation
→ WindowManager event
→ transition representation
```

Transition completion only removes a presentation record.

## 4. Source geometry

Source Window geometry is projected from WindowManager state plus the Workspace viewport origin:

```text
viewport.left + state.position.x
viewport.top  + state.position.y
state.size.width
state.size.height
```

The animation layer does not read a second Window geometry store.

## 5. Dock target geometry

Dock targets are resolved through ToolId presentation markers:

```text
data-ngvge-dock-transition-targets="ngvge.tool.*"
```

Direct Tool items are preferred. A collapsed Folder can act as a fallback target for its member ToolIds so a minimized Tool still has a valid visual destination when its member icon is not individually visible.

Target geometry is DOM presentation geometry only and never becomes persistent Dock or Window semantic state.

## 6. Minimize transition

```text
WindowManager.minimize(WindowId)
        ↓
semantic minimized = true
        ↓
window:minimized
        ↓
Window geometry → Dock geometry
```

The real Window is already semantically minimized before the animation record is produced.

## 7. Restore transition

```text
WindowManager.restore(WindowId)
        ↓
semantic minimized = false
        ↓
window:restored
        ↓
Dock geometry → Window geometry
```

During the restore presentation, the real Window may be temporarily hidden with:

```text
data-ngvge-presentation-hidden="true"
```

This attribute is representation-only and is always removed when the transition completes or the transition component unmounts.

## 8. Failure and interruption semantics

Animation can never block semantic lifecycle.

If Workspace or Dock geometry is unavailable:

```text
semantic state remains committed
transition is skipped
diagnostic counter increments
```

If a second transition for the same Window arrives before the first completes, the newer transition supersedes the old presentation record. No semantic Window rollback occurs.

## 9. Reduced motion

`prefers-reduced-motion: reduce` is respected. The presentation transition completes immediately while preserving the already committed semantic state.

No accessibility preference changes Window lifecycle semantics.

## 10. Presentation layer

The transition layer is:

```text
aria-hidden
pointer-events: none
presentation-only z-layer
```

It renders a temporary visual ghost and does not accept interaction or own focus.

## 11. Persistence boundary

WS-3F adds no persistence writer.

```text
localStorage       NONE
sessionStorage     NONE
windowStateStorage NONE
```

Animation records and diagnostics are runtime-only. Workspace persistence/settings remain WS-4 responsibility.

## 12. Explicit non-goals

WS-3F does not implement:

- a second Window state machine;
- animation-driven semantic commits;
- persistent transition history;
- Dock/Window backend identity coupling;
- animation settings persistence;
- WS-4 Workspace Persistence / Settings.

## 13. Result

WS-3F completes the final WS-3 Dock Foundation substage while preserving WindowManager as the unique semantic owner of Window lifecycle/geometry state.
