# WS-3F Change Manifest | Minimize / Restore Animation

**Status:** COMPLETE / VERIFIED
**Date:** 2026-08-14
**Baseline:** corrected WS-3E verified baseline `f3777df`

## Production changes

```text
src/lib/editor-shell/dock-transition-model.js
src/components/workspace-window-transition/workspace-window-transition.jsx
src/components/workspace-window-transition/workspace-window-transition.css
src/components/draggable-window/draggable-window.jsx
src/components/draggable-window/draggable-window.css
src/components/workspace-dock/workspace-dock.jsx
src/components/gui/gui.jsx
```

Key behavior:

- adds `ngvge.workspace-dock-transition-model@1`;
- observes committed WindowManager minimize/restore lifecycle events;
- projects WindowManager geometry to Dock ToolId target geometry;
- renders presentation-only minimize/restore ghosts;
- respects reduced motion;
- skips missing geometry without blocking semantic state;
- keeps controlled Workspace Window minimize/restore owner-first;
- adds ToolId Dock transition target markers including collapsed Folder fallback;
- introduces no persistence writer or backend identity.

## Verification and tests

```text
scripts/validate-ws3f-minimize-restore-animation.js
scripts/validate-ws3-dock-foundation-dod.js
scripts/validate-ws3f-webpack-transition-entry.js
scripts/validate-ws3f-webpack-editor-entry.js

test/unit/lib/editor-shell/dock-transition-model.test.js
test/unit/components/workspace-window-transition.test.jsx
test/unit/components/draggable-window-controlled-minimize.test.jsx
test/unit/components/workspace-dock.test.jsx
```

`package.json` registers the focused, cumulative and two real Webpack certification gates.

## Governance records

```text
docs/architecture/workspace/WS-3F-MINIMIZE-RESTORE-ANIMATION.md
docs/architecture/workspace/WS-3F-VERIFICATION.md
docs/architecture/workspace/WS-3F-CERTIFICATE.json
docs/architecture/workspace/WS-3F-CHANGE-MANIFEST.md
docs/architecture/workspace/WS-3-DOCK-FOUNDATION-CERTIFICATION.md
docs/architecture/workspace/WS-3-CERTIFICATE.json
```

## Baseline correction

The first temporary WS-3E reconstruction was rejected after LRC-G1 exposed a missing root-level LRC-3 compatibility source. The final baseline was rebuilt with normalized Overlay project-root handling and independently passed LRC-2/LRC-3/LRC-4/LRC-G1 and WS-3C/D/E validators before WS-3F was reapplied.

No nested `NGVGE/NGVGE` tree participates in the final patch or certification evidence.

## Excluded generated content

The delivery delta excludes:

```text
node_modules/
build/
coverage/
translations/
temporary logs
```
