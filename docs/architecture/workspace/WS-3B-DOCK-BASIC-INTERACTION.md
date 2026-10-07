# WS-3B | Dock Basic Interaction

**Status:** COMPLETE / VERIFIED
**Architecture Parent:** ARC-0001 | Kernel Independence Contract
**Workspace Parents:** WS-1 Tool Registry, WS-2 Window Manager, WS-3A Dock Runtime Model
**Runtime Identity:** `ngvge.workspace-dock-interaction-controller@1`

## 1. Purpose

WS-3B activates the first real Dock interaction surface on top of the already verified WS-3A runtime model.

The phase owns only:

- click → launch / focus / restore;
- running / minimized / active indicators;
- pin / unpin interaction;
- drag reorder;
- keyboard reorder fallback;
- multi-instance Tool projection and focus selection.

It does **not** own:

- Window open/close/minimize/focus state itself;
- placement preference or four-edge geometry (WS-3C);
- group/folder presentation topology (WS-3D);
- Launchpad (WS-3E);
- minimize animation (WS-3F);
- versioned Workspace persistence (WS-4).

## 2. Interaction authority

```text
WorkspaceDock
      ↓
DockInteractionController
      ├── stopped Tool
      │      ↓
      │   launchTool callback
      │      ↓
      │   existing GUI/Tool launch path
      │
      ├── minimized Window
      │      ↓
      │   WindowManager.restore
      │
      └── running Window
             ↓
          WindowManager.activate
```

Dock interaction does not copy WindowManager state and does not mutate close, minimize, move, resize, maximize, registration, or z-order directly.

The controller is therefore an interaction router, not a second Window authority.

## 3. Click semantics

For every `ToolId`:

```text
active
→ already-active / no-op

running + not active
→ focus existing WindowId

minimized
→ restore existing WindowId

stopped
→ launch through the GUI Tool launch callback
```

For multi-instance Tools, if no instance is active, the interaction controller chooses the running instance with the newest WindowManager `lastFocusedAt` value.

This preserves:

```text
ToolId != WindowId
```

For Editor:

```text
ToolId = ngvge.tool.editor
WindowId = editor-1 / editor-2 / ...
```

## 4. Editor minimize capability consistency

WS-3B identified a pre-existing inconsistency:

- GUI already implemented Editor minimize/restore handlers;
- `ToolDefinition` still declared Editor `minimize: false`.

WS-3B removes that contradictory capability override. Editor windows now advertise the minimize capability that their existing GUI implementation already supports, allowing Dock restore semantics to be expressed correctly.

This does not move minimize authority away from WindowManager.

## 5. Runtime pin defaults

The current runtime-only defaults pin:

```text
ngvge.tool.node-explorer
ngvge.tool.inspector
ngvge.tool.assets
ngvge.tool.stage
ngvge.tool.editor
```

`ngvge.tool.legacy-sprites` is not pinned by default because it remains Compatibility UI.

These defaults are not a persisted Workspace preference. WS-4 will own versioned pin persistence and migration.

## 6. Presentation

WS-3B adds `WorkspaceDock` as the custom Workspace interaction surface.

The current presentation is intentionally one provisional bottom-centered Dock. This is **not** the stable placement model.

```text
WS-3B
bottom presentation only
runtime-only

WS-3C
four-edge placement
alignment
offsetX / offsetY
versioned preference seam
```

The WS-3B CSS therefore must not be treated as the future placement authority.

## 7. Classic compatibility UI

In Custom Workspace mode:

- `WorkspaceDock` becomes the restore/launch surface;
- the old global `MinimizedBar` is not rendered;
- old standalone Node Explorer / Inspector / Assets launchers are not rendered.

In Classic UI:

- existing standalone launchers remain available;
- existing `MinimizedBar` remains available.

This avoids two competing Workspace interaction surfaces while preserving compatibility fallback.

## 8. Indicators

Every Dock item projects:

- `running`;
- `minimized`;
- `active`;
- `pinned`;
- running instance count.

The Dock does not infer these from DOM state. Running/minimized/active are read from the WS-3A projection, which derives them from WindowManager.

## 9. Reorder and accessibility

Mouse/pointer reorder uses native drag/drop and commits ordering through:

```text
DockInteractionController
→ DockRuntimeModel.setOrder
```

A keyboard fallback is also provided:

```text
Alt + ArrowLeft
Alt + ArrowRight
```

Tool activation and pin controls use real `<button>` elements with ARIA labels. Functional icons remain SVG-only.

## 10. Persistence boundary

WS-3B contains no `localStorage` or `sessionStorage` authority for Dock state.

```text
pinning / order
→ runtime Dock model only

persistence
→ WS-4
```

## 11. Diagnostics

Production Workspace exposes:

```text
data-ngvge-dock-runtime-model
data-ngvge-dock-runtime-revision
data-ngvge-dock-interaction
```

These identify the stable Workspace contracts; they do not expose VM, Renderer, Scratch Target, or backend handles.

## 12. Verification summary

- WS-3B machine gate: 39/39 PASS;
- WS-3B focused tests: 3 suites / 20 tests PASS;
- WS-0 → WS-3B cumulative Workspace chain: PASS;
- LSC-G1 / LRC-G1 / LPL-G1 / LEX-G1 / COL-0: PASS;
- ARC-C001.1: 7/7 PASS;
- 0009-E: 12/12 PASS;
- Permanent Regression: 19/19 PASS;
- Unit: 103 Node suites / 557 tests + 3 DOM suites / 26 tests = 583 tests PASS;
- Integration: 4 suites / 5 tests PASS;
- Smoke: 1/1 PASS;
- TypeScript: PASS;
- ESLint correctness: PASS;
- CSS/PostCSS: PASS, including Workspace Dock CSS;
- real Webpack Dock production entry: exit 0 / 0 errors / 0 warnings;
- full real Editor Webpack entry: attempted, external execution window expired before callback; not reported as PASS.

## 13. Next stage

```text
WS-3C | Placement & Geometry
```

WS-3C may extend Dock presentation geometry, but must not move Window state authority out of WindowManager or persistence authority into the Dock component.
