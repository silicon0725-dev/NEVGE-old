# WS-10F2B｜Unified Paint Shell

**Status:** `COMPLETE / VERIFIED`  
**Parent:** `WS-10F2A | Native Paint Host Migration`  
**Architecture Parent:** `ARC-0001 | Kernel Independence Contract`

## Goal

WS-10F2B freezes one NGVGE-owned native Paint presentation shell inside the existing Costume / Backdrop editor host. The shell is shared by Vector now and by Bitmap / Pixel after their backend integrations.

The OSS backend is a canvas/editing engine, not the Paint application shell.

## Stable identity

```text
ngvge.native-paint-shell@1
```

Schema version: `1`.

The shell is presentation-only. It owns no Project, Resource, Transaction, Persistence or backend semantic identity authority.

## Frozen presentation slots

```text
Native Paint Shell
├── context-toolbar
├── tool-rail
├── canvas-chrome
├── panel-rail
└── status-bar
```

These slots are NGVGE presentation vocabulary. SVG-Edit, miniPaint, Piskel or a future backend may supply editing operations behind an adapter, but may not replace the native host with its own complete application shell.

### context-toolbar

Shows current Paint mode/tool/document context plus bounded history and reviewed-save actions. It is not a File/Open/Save application menu.

### tool-rail

Owns stable NGVGE tool presentation. Vector tool selection is routed through the bounded SVG-Edit adapter controls. Future Bitmap and Pixel modes map the same shell tool vocabulary to their backend adapters.

### canvas-chrome

Owns the editor workarea surrounding the backend canvas. Workspace geometry remains presentation state and does not become authored document geometry.

### panel-rail

Reserves collapsible Properties / Layers / Color panel presentation. F2B freezes the dock, while F2D supplies professional panel semantics.

### status-bar

Owns working-copy state and backend/mode status. Dirty/stale state is projected from the PaintSession and does not become Project authoring schema.

## Vector migration

The native Vector path is now:

```text
Costume / Backdrop host
        ↓
Native Paint Shell
        ↓
Tool Rail / Context Toolbar / Canvas Chrome
        ↓
WorkspaceVectorEditor (canvas only)
        ↓
SVG-Edit adapter
        ↓
Paint Working Copy
```

`WorkspaceVectorEditor` retains an internal toolbar only for the standalone development/compatibility presentation. The primary native host explicitly passes `showToolbar={false}` and drives bounded `setTool / undo / redo / focus` presentation commands through a React ref.

## Raster compatibility

WS-10F2B does not pretend miniPaint has already been integrated. PNG/JPG/bitmap costumes continue to render the existing Scratch Paint compatibility editor.

The compatibility path is wrapped by the Native Paint presentation boundary but does not receive a second NGVGE tool rail. This prevents duplicate toolbar UX before WS-10G replaces the raster backend.

## Reviewed mutation boundary

Review / Commit / Discard remain PaintSession operations. The shell has no raw VM update path and does not call `vm.updateSvg`, `vm.updateBitmap`, renderer mutation, storage mutation or Project Command Host directly.

## UX direction

The F2B shell intentionally follows the existing native Costume / Backdrop page rather than creating a separate Illustrator clone window:

```text
Asset list | Tool rail | Canvas | optional panels
                   + context toolbar
                   + status bar
```

Professional Vector operations and properties are staged for F2C/F2D. F2B only freezes the reusable shell and removes backend-owned toolbar presentation from the primary native path.

## Non-goals

- No miniPaint production integration.
- No Piskel production integration.
- No Vector node/path professional tooling expansion.
- No real Layers/Properties/Pathfinder semantics yet.
- No timeline.
- No standalone Paint window retirement yet.
- No change to WS-9 mutation authority.

## Resume point

```text
WS-10F2A Native Paint Host Migration
COMPLETE / VERIFIED
        ↓
WS-10F2B Unified Paint Shell
COMPLETE / VERIFIED
        ↓
WS-10F2C Vector Professional Tooling
NEXT
```
