# WS-3E | Launchpad

**Status:** COMPLETE / VERIFIED
**Date:** 2026-08-13
**Architecture Parent:** ARC-0001 | Kernel Independence Contract
**Workspace Parents:** WS-0 / WS-1 / WS-2 / WS-3A / WS-3B / WS-3C / WS-3D

## 1. Objective

WS-3E introduces a complete Workspace Launchpad without creating a second Tool inventory or launch authority.

The required views are:

```text
All Tools
Pinned
Recent
First-party
Extensions
Developer
Compatibility
```

The governing relationship is:

```text
ToolRegistry
    +
DockRuntimeModel
    +
WindowManager history
        ↓
LaunchpadModel
        ↓
WorkspaceLaunchpad
        ↓
DockInteractionController
```

Launchpad discovers and presents Tools. It does not own Tool identity, Window lifecycle or backend execution.

## 2. Stable identity

```text
ngvge.workspace-launchpad-model@1
```

Portable query records use:

```text
LaunchpadEntry schemaVersion = 1
LaunchpadSnapshot schemaVersion = 1
```

Launchpad itself is not a Tool and has no `ToolId`.

The Launchpad button is Workspace chrome rather than a synthetic `ngvge.tool.launchpad` registration.

## 3. Tool inventory authority

The Launchpad has no static Tool list.

Its inventory is derived from:

```text
DockRuntimeModel.listItems({includeStopped: true})
        ↓
ToolRegistry-backed ToolDefinitions
```

`TOOL_IDS` and `CORE_TOOL_DEFINITIONS` are not copied into LaunchpadModel or WorkspaceLaunchpad.

Runtime ToolRegistry lifecycle events are observed. A Tool registered after Launchpad construction therefore enters Launchpad queries automatically.

This is the seam required for later plugin/extension Tool registration.

## 4. Tool source metadata

ToolDefinition schema identity remains unchanged, while WS-3E adds normalized source metadata:

```text
source.kind
├── first-party
├── extension
├── developer
└── compatibility

source.providerId
```

Rules:

1. unknown source fields fail closed;
2. unknown source kinds fail closed;
3. `providerId`, when present, must be a non-empty string;
4. a compatibility Tool must use `source.kind = compatibility`;
5. legacy definitions without explicit source metadata normalize to `first-party`, or `compatibility` when their existing compatibility flag is true.

Current built-in classifications include:

```text
Node Explorer     first-party / ngvge.core
Inspector         first-party / ngvge.core
Assets            first-party / ngvge.core
Stage             first-party / ngvge.core
Editor            first-party / ngvge.core
Legacy Sprites    compatibility / scratch.compatibility
```

## 5. Launchpad sections

### All Tools

Every current ToolRegistry Tool appears exactly once as a Launchpad entry.

### Pinned

Derived from DockRuntimeModel `pinned` state. Launchpad has no independent pin store.

### Recent

Derived from WindowManager `lastFocusedAt` history and sorted most-recent first.

WS-3E does not create a second recent-history persistence store.

### First-party / Extensions / Developer / Compatibility

Derived from `ToolDefinition.source.kind`.

The category pipeline is live even when a category currently has no registered production Tool.

The WS-3E fixture proves that a runtime ToolRegistry registration with:

```text
source.kind = extension
```

automatically appears under `Extensions` and advances the Launchpad revision without editing Launchpad code.

## 6. Query contract

LaunchpadModel is query-oriented:

```text
listEntries({section, query})
getCounts()
getSnapshot({section, query})
subscribe(listener)
dispose()
```

Search matches stable presentation metadata including Tool title, ToolId and providerId.

LaunchpadModel does not expose:

```text
open
close
minimize
restore
activate
move
resize
vm
renderer
extensionManager
```

## 7. Activation authority

Launching a Tool from Launchpad reuses WS-3B:

```text
WorkspaceLaunchpad
        ↓
DockInteractionController.activateTool(ToolId)
        ↓
stopped   → existing GUI launch authority
minimized → WindowManager.restore(WindowId)
running   → WindowManager.activate(WindowId)
```

No separate Launchpad launch lifecycle exists.

For a future plugin Tool, registration guarantees discovery, not execution by magic. The plugin integration must still register/provide the Tool's supported Window/launch authority. Launchpad deliberately does not invent backend-specific launch behavior.

## 8. Pin authority

Launchpad pin controls delegate to:

```text
DockInteractionController.togglePin(ToolId)
        ↓
DockRuntimeModel
```

Launchpad does not own pin state.

## 9. User interface

WorkspaceDock contains a dedicated Launchpad chrome button.

The Launchpad panel provides:

- the seven required sections;
- search;
- running/minimized/active state presentation;
- Tool launch/focus/restore;
- pin/unpin;
- Escape-to-close;
- dialog/tab semantics;
- placement-aware positioning for top/bottom/left/right Dock placement.

The Launchpad button itself is not included in Dock organization topology and cannot become a Group/Folder member.

## 10. React lifecycle

GUI constructs one LaunchpadModel for the Workspace shell and disposes it on unmount:

```text
ToolRegistry subscription
WindowManager subscription
DockRuntimeModel subscription
        ↓
LaunchpadModel.dispose()
```

This prevents Workspace remount/hot-reload from accumulating source listeners.

## 11. Persistence boundary

WS-3E introduces no persistence writer.

```text
localStorage       NONE
sessionStorage     NONE
windowStateStorage NONE
```

Pinned persistence, Recent persistence policy, Launchpad UI preferences and other Workspace persistence belong to WS-4.

## 12. Explicit non-goals

WS-3E does not implement:

- a second Tool Registry;
- a second Window/launch authority;
- plugin installation or Extension Host behavior;
- automatic execution authority for newly discovered plugin Tools;
- persistent Recent history;
- Workspace persistence/settings — WS-4;
- minimize/restore animation — WS-3F.

## 13. Verification

- Machine Gate: **41/41 PASS**
- Focused Jest: **4 suites / 25 tests PASS**
- WS-0 → WS-3E cumulative: **PASS**
- Legacy containment / Runtime / Project lifecycle / Extension / Collaboration gates: **PASS**
- 0009-E: **12/12 PASS**
- Permanent Regression: **19/19 PASS**
- Unit: **617 tests PASS**
- Integration: **5/5 PASS**
- Smoke: **1/1 PASS**
- TypeScript: **PASS**
- ESLint correctness: **PASS**
- targeted full ESLint for new WS-3E source: **PASS**
- real Dock production Webpack: **0 errors / 0 warnings / PASS**
- real full Editor Webpack: **0 errors / 0 warnings / PASS**
- unified `ws3e-certification`: **exit 0 / PASS**

See `WS-3E-VERIFICATION.md` and `WS-3E-CERTIFICATE.json` for the evidence record.
