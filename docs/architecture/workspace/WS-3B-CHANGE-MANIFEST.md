# WS-3B | Dock Basic Interaction — Change Manifest

**Stage:** `WS-3B`
**Status:** `COMPLETE / VERIFIED`
**Baseline:** `WS-3A | Dock Runtime Model — COMPLETE / VERIFIED` (`26e1715`)
**Next:** `WS-3C | Placement & Geometry`

## Production changes

- `src/lib/editor-shell/dock-interaction-controller.js`
  - Adds stable identity `ngvge.workspace-dock-interaction-controller@1`.
  - Defines click semantics: launch / focus / restore / already-active.
  - Delegates focus/restore to WindowManager and pin/reorder to DockRuntimeModel.
  - Selects the most recently focused running instance for multi-instance tools.
- `src/components/workspace-dock/workspace-dock.jsx`
  - Adds the first interactive Dock projection.
  - Renders running / minimized / active / pinned state.
  - Adds pin/unpin, drag reorder, and keyboard reorder.
  - Keeps ToolId distinct from WindowId for multi-instance tools.
- `src/components/workspace-dock/workspace-dock.css`
  - Adds compact neutral-dark provisional Dock presentation.
  - Bottom-center placement is temporary WS-3B presentation only; placement authority remains deferred to WS-3C.
- `src/components/gui/gui.jsx`
  - Instantiates DockInteractionController and WorkspaceDock in Custom Workspace mode.
  - Routes stopped-tool launch through existing GUI/WindowManager authorities.
  - Restricts legacy standalone launchers and MinimizedBar to Classic UI to avoid competing Workspace entry points.
- `src/lib/editor-shell/tool-registry.js`
  - Aligns Editor minimize capability with the already-existing Editor minimize/restore behavior.

## Gate / validator changes

- `scripts/validate-ws3b-dock-basic-interaction.js`
  - Adds the WS-3B 39-check machine gate.
- `scripts/validate-ws3b-webpack-dock-entry.js`
  - Adds a real webpack production-entry smoke for the Dock component.
- `scripts/validate-ws3b-webpack-editor-entry.js`
  - Adds the stronger full Editor entry probe; current environment records timeout rather than claiming PASS.
- `scripts/validate-workspace-dock-runtime-model.js`
  - Keeps the WS-3A invariant truthful after a later stage adds presentation/interaction.
- `scripts/validate-workspace-shell-visual-css.js`
  - Adds `workspace-dock.css` to the cumulative CSS/PostCSS gate.
- `package.json`
  - Adds WS-3B focused, cumulative, webpack, full-editor probe, and certification commands.

## Tests

- `test/unit/lib/editor-shell/dock-interaction-controller.test.js`
- `test/unit/components/workspace-dock.test.jsx`

These cover stopped launch, focus, restore, active no-op, multi-instance selection, Dock-only pin/reorder mutation, drag reorder, rendered state indicators, and WindowManager authority preservation.

## Governance / evidence

- `docs/architecture/workspace/WS-3B-DOCK-BASIC-INTERACTION.md`
- `docs/architecture/workspace/WS-3B-VERIFICATION.md`
- `docs/architecture/workspace/WS-3B-CERTIFICATE.json`
- `docs/architecture/workspace/WS-3B-CHANGE-MANIFEST.md`

## Explicit non-goals retained

WS-3B does **not** own:

- placement / geometry preferences (`WS-3C`);
- group/folder presentation (`WS-3D`);
- Launchpad (`WS-3E`);
- minimize/restore animation (`WS-3F`);
- versioned Dock/Workspace persistence (`WS-4`);
- a second Window state authority.
