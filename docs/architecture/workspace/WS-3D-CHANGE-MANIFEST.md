# WS-3D Change Manifest | Dock Organization

**Stage:** WS-3D | Organization
**Status:** COMPLETE / VERIFIED
**Baseline:** WS-3C | Placement & Geometry — COMPLETE / VERIFIED
**Date:** 2026-08-13

## Production

- `src/lib/editor-shell/dock-organization-model.js`
  - introduces `ngvge.workspace-dock-organization-model@1`;
  - introduces `ngvge.workspace-dock-organization-preference@1`;
  - owns Group/Folder/Separator topology and runtime Folder expand state;
  - references stable ToolIds and mirrors membership through the existing DockRuntimeModel organization seam.
- `src/components/workspace-dock/workspace-dock.jsx`
  - renders Separator / Group / Folder organization nodes;
  - adds right-click and `Shift+F10` organization menu;
  - supports membership moves and container block reorder while preserving WindowManager authority.
- `src/components/workspace-dock/workspace-dock.css`
  - adds horizontal/vertical organization surfaces, Folder popover and organization menu styling.
- `src/components/gui/gui.jsx`
  - constructs one production `DockOrganizationModel` and passes it to `WorkspaceDock`;
  - exposes stable organization diagnostics on the Workspace root.
- `package.json`
  - registers focused, cumulative, Dock Webpack and full Editor Webpack WS-3D gates.

## Verification

- `scripts/validate-ws3d-dock-organization.js`
- `scripts/validate-ws3d-webpack-dock-entry.js`
- `scripts/validate-ws3d-webpack-editor-entry.js`
- `test/unit/lib/editor-shell/dock-organization-model.test.js`
- `test/unit/components/workspace-dock.test.jsx`

## Governance

- `docs/architecture/workspace/WS-3D-DOCK-ORGANIZATION.md`
- `docs/architecture/workspace/WS-3D-VERIFICATION.md`
- `docs/architecture/workspace/WS-3D-CERTIFICATE.json`
- `docs/architecture/workspace/WS-3D-CHANGE-MANIFEST.md`

## Explicit exclusions

The delivery does not include:

- `node_modules/`;
- `build/` Webpack outputs;
- coverage or temporary logs;
- local permission changes;
- WS-3E Launchpad;
- WS-3F animation;
- WS-4 persistence/settings behavior.

## Final delta

```text
14 files changed
2217 insertions
53 deletions
```
