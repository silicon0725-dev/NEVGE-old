# WS-4 Change Manifest

**Stage:** `WS-4 | Workspace Persistence / Settings`
**Status:** `COMPLETE / VERIFIED`
**Baseline:** `WS-3F | Minimize / Restore Animation — COMPLETE / VERIFIED`
**Patch semantics:** incremental WS-4 delta only; generated build outputs and dependencies are excluded.

## New persistence foundation

- `src/lib/editor-shell/workspace-persistence/workspace-schema.js`
- `src/lib/editor-shell/workspace-persistence/workspace-storage-adapter.js`
- `src/lib/editor-shell/workspace-persistence/workspace-migration.js`
- `src/lib/editor-shell/workspace-persistence/workspace-persistence-host.js`
- `src/lib/editor-shell/workspace-persistence/workspace-preference-bridge.js`
- `src/lib/editor-shell/workspace-persistence/index.js`

Stable identities introduced:

- `ngvge.workspace-layout@1`
- `ngvge.workspace-preferences@1`
- `ngvge.workspace-persistence-host@1`
- `ngvge.workspace-storage-adapter.local@1`
- `ngvge.workspace-legacy-migration@1`

## Production integration

- `src/components/gui/gui.jsx`
- `src/components/workspace-dock/workspace-dock.jsx`
- `src/components/workspace-dock/workspace-dock.css`
- `src/containers/tw-settings-modal.jsx`
- `src/components/tw-settings-modal/settings-modal.jsx`
- `src/components/tw-settings-modal/settings-modal.css`
- `src/lib/tw-persistent-settings.js`
- `src/lib/tw-state-manager-hoc.jsx`
- `src/lib/themes/themePersistance.js`
- `src/lib/editor-shell/dock-organization-model.js`

## Compatibility / certification maintenance

- `docs/architecture/extensions/LEX-1-legacy-extension-debt-matrix.csv` restores the already-certified LEX-G1 debt-state text that a historical Workspace overlay had overwritten.
- `scripts/validate-ws3c-dock-placement-geometry.js` now recognizes placement initialization from a persisted WS-4 preference instead of depending on a brittle constructor string.

## Verification additions

- `scripts/validate-ws4-workspace-persistence-settings.js`
- `scripts/validate-ws4-webpack-settings-entry.js`
- `scripts/validate-ws4-webpack-editor-entry.js`
- five focused Workspace Persistence test suites under `test/unit/lib/editor-shell/workspace-persistence/`
- `package.json` WS-4 focused/cumulative/Webpack/certification commands

## Governance records

- `docs/architecture/workspace/WS-4-WORKSPACE-PERSISTENCE-SETTINGS.md`
- `docs/architecture/workspace/WS-4-VERIFICATION.md`
- `docs/architecture/workspace/WS-4-CERTIFICATE.json`
- `docs/architecture/workspace/WS-4-persistence-domain-matrix.csv`
- `docs/architecture/workspace/WS-4-CHANGE-MANIFEST.md`

## Excluded from delivery delta

The WS-4 overlay/patch does not contain:

- `node_modules/`
- `build/`
- coverage output
- generated `translations/messages/`
- temporary logs
- temporary permission changes

## Verification summary

- WS-4 Machine Gate: **34/34 PASS**
- WS-4 focused: **7 suites / 35 tests PASS**
- WS-0 → WS-4 cumulative: **PASS**
- Unit: **118 suites / 643 tests PASS**
- Integration: **5/5 PASS**
- Smoke: **1/1 PASS**
- TypeScript: **PASS**
- ESLint correctness: **PASS**
- Settings production Webpack: **exit 0 / 0 errors / 0 warnings**
- Final full Editor production Webpack: **exit 0 / 0 errors / 0 warnings**
- Unified certification wrapper: **constituent gates PASS / outer wrapper timeout at repeated final Editor Webpack; no aggregate exit-0 claim**
