# LEX-1 Change Manifest

**Stage:** LEX-1 | Extension / Addons Containment  
**Status:** COMPLETE / VERIFIED  
**Baseline:** LRC-G1 PASS / CERTIFIED + LPL-1 COMPLETE / VERIFIED

## Runtime containment foundation

Added `src/lib/extension-containment/`:

- `constants.js`
- `extension-containment-authority.js`
- `extension-containment-host.js`
- `extension-descriptor.js`
- `ngvge-module-host.js`
- `scratch-extension-host.js`
- `legacy-addon-host.js`
- `legacy-addon-dom-bridge.js`
- `index.js`

## Production ingress migration

Modified:

- `src/lib/vm-manager-hoc.jsx`
- `src/lib/first-party-modules/runtime-integration.js`
- `src/addons/api.js`
- `src/components/gui/gui.jsx`
- `src/containers/stage.jsx`
- `src/containers/blocks.jsx`
- `src/containers/extension-library.jsx`
- `src/containers/tw-custom-extension-modal.jsx`
- `src/containers/tw-extension-import-modal.jsx`
- `src/containers/tw-security-manager.jsx`
- `src/lib/cloud-manager-hoc.jsx`
- `src/lib/tw-state-manager-hoc.jsx`

## Verification

Added:

- `scripts/validate-lex1-extension-addons-containment.js`
- `test/unit/lib/extension-containment/extension-containment-host.test.js`
- `test/unit/lib/extension-containment/scratch-extension-host.test.js`
- `test/unit/lib/extension-containment/legacy-addon-host.test.js`
- `test/unit/lib/extension-containment/legacy-addon-dom-bridge.test.js`
- `docs/architecture/extensions/LEX-1-EXTENSION-ADDONS-CONTAINMENT.md`
- `docs/architecture/extensions/LEX-1-VERIFICATION.md`
- `docs/architecture/extensions/LEX-1-CERTIFICATE.json`
- `docs/architecture/extensions/LEX-1-legacy-extension-debt-matrix.csv`

`package.json` adds focused, cumulative and real Editor Webpack LEX-1 gates.

## Explicitly not changed

- NGVGE Module Manager remains its own runtime host.
- Scratch ExtensionManager remains a replaceable Compatibility Backend.
- Legacy Addon execution is not promoted to Native NGVGE authority.
- Collaboration direct extension debt is deferred to COL-0 and recorded fail-visible.
- WS-6 Extension Manager UI is not implemented in LEX-1.
