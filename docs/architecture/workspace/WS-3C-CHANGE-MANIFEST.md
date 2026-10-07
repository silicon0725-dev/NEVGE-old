# WS-3C Change Manifest

**Stage:** WS-3C | Dock Placement & Geometry
**Baseline:** WS-3B COMPLETE / VERIFIED (`a00f8eb` local reconstructed baseline)
**Status:** COMPLETE / VERIFIED

## Added

- `src/lib/editor-shell/dock-placement-model.js`
  - stable `ngvge.workspace-dock-placement-model@1` identity;
  - versioned `ngvge.workspace-dock-placement-preference@1` schema;
  - top/bottom/left/right placement;
  - start/center/end alignment;
  - offsetX/offsetY screen-axis semantics;
  - runtime-only subscriptions and geometry projection;
  - fail-closed unknown fields.
- `test/unit/lib/editor-shell/dock-placement-model.test.js`
- `scripts/validate-ws3c-dock-placement-geometry.js`
- `scripts/validate-ws3c-webpack-dock-entry.js`
- `docs/architecture/workspace/WS-3C-DOCK-PLACEMENT-GEOMETRY.md`
- `docs/architecture/workspace/WS-3C-VERIFICATION.md`
- `docs/architecture/workspace/WS-3C-CERTIFICATE.json`
- `docs/architecture/workspace/WS-3C-CHANGE-MANIFEST.md`

## Modified

- `src/components/workspace-dock/workspace-dock.jsx`
  - consumes placement projection;
  - exposes placement/alignment/orientation diagnostics;
  - applies CSS variables;
  - orientation-aware keyboard reorder and toolbar ARIA orientation.
- `src/components/workspace-dock/workspace-dock.css`
  - replaces single bottom-center geometry with four-edge + three-alignment projection;
  - adds horizontal/vertical track orientation.
- `src/components/gui/gui.jsx`
  - creates one production `DockPlacementModel`;
  - exposes model revision diagnostics;
  - passes placement authority to `WorkspaceDock`.
- `test/unit/components/workspace-dock.test.jsx`
  - adds geometry projection and vertical keyboard-reorder coverage.
- `scripts/validate-ws3b-dock-basic-interaction.js`
  - preserves the WS-3B interaction Gate while recognizing WS-3C as the successor placement owner.
- `package.json`
  - adds focused, cumulative, Webpack and certification WS-3C gates.

## Explicitly unchanged

- WindowManager authority;
- Dock launch/focus/restore semantics;
- Scratch/Runtime/Extension/Project/Collaboration authority;
- Workspace persistence/localStorage;
- group/folder presentation;
- Launchpad;
- minimize/restore animation.
