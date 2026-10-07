# WS-3A Change Manifest

**Stage:** WS-3A | Dock Runtime Model
**Status:** COMPLETE / VERIFIED
**Baseline:** LSC-G1 / LRC-G1 / LPL-G1 / LEX-G1 certified + COL-0 verified Workspace baseline

## Production changes

### `src/lib/editor-shell/dock-runtime-model.js`

Adds `ngvge.workspace-dock-runtime-model@1`.

Responsibilities:

- derive DockItem runtime state from ToolRegistry + WindowManager;
- preserve ToolId / WindowId distinction;
- derive running/minimized/active state;
- own runtime-only pinning/order/organization metadata;
- publish immutable projection events;
- expose no backend identity or WindowManager mutation authority.

### `src/components/gui/gui.jsx`

Installs one dormant Dock Runtime Model from the existing production Tool Registry and Window Manager and exposes diagnostics attributes only.

No Dock UI or user-facing interaction is introduced.

## Verification/tooling changes

### `test/unit/lib/editor-shell/dock-runtime-model.test.js`

Adds 9 focused model tests.

### `scripts/validate-workspace-dock-runtime-model.js`

Adds 29 machine boundary checks.

### `scripts/validate-ws3a-webpack-editor-entry.js`

Adds a real `src/playground/editor.jsx` Webpack smoke gate using `webpack.config.js[0]`.

### `package.json`

Adds:

```text
test:workspace-shell:ws3a:focused
test:workspace-shell:ws3a
test:workspace-shell:ws3a-webpack
test:workspace-shell:ws3a-certification
```

## Governance records

```text
docs/architecture/workspace/WS-3A-DOCK-RUNTIME-MODEL.md
docs/architecture/workspace/WS-3A-VERIFICATION.md
docs/architecture/workspace/WS-3A-CERTIFICATE.json
docs/architecture/workspace/WS-3A-CHANGE-MANIFEST.md
```

## Explicitly not included

- Dock visual component;
- launcher click behavior;
- pin/unpin UI;
- drag reorder UI;
- running/minimized indicator rendering;
- placement or geometry;
- minimize animation;
- Workspace persistence;
- separator/folder/group topology UI;
- Dock/layout OSS library adoption.

These remain assigned to WS-3B/3C/3D/3F/WS-4 as defined by the Workspace plan.
