# LEX-G1 Change Manifest

**Baseline:** LPL-G1 | PASS / CERTIFIED + COL-0 | COMPLETE / VERIFIED
**Stage:** LEX-G1 | Extension / Addons Containment Certification
**Result:** PASS / CERTIFIED

LEX-G1 is primarily a certification increment, with two prerequisite containment closures required by the LEX-1
debt matrix before the gate could be signed.

## Production containment closure

- `src/lib/extension-containment/constants.js`
  - adds the narrow `legacy-addon.scratch-extension.load-built-in` compatibility capability.
- `src/lib/extension-containment/legacy-addon-host.js`
  - validates declared Legacy Addon capabilities;
  - denies custom/untrusted capability escalation;
  - exposes a narrow built-in Scratch-extension capability facade;
  - keeps raw VM as a separate explicit quarantine lease.
- `src/addons/api.js`
  - exposes Legacy Addon capability acquisition separately from `traps.vm`.
- `src/addons/addons/load-extensions/_manifest_entry.js`
  - explicitly declares the built-in Scratch-extension loading capability.
- `src/addons/addons/load-extensions/userscript.js`
  - migrates from raw VM/ExtensionManager to the declared capability facade.
- `src/containers/gui.jsx`
  - removes unconditional static `extension-debug` import;
  - loads developer extension debug only outside production.
- `docs/architecture/extensions/LEX-1-legacy-extension-debt-matrix.csv`
  - closes LEX-D002 and LEX-D006 while retaining explicit quarantine records.

## Certification additions

- `scripts/validate-lex-g1-extension-addons-containment-certification.js`
  - 19 machine-certification requirements.
- `scripts/validate-lex-g1-webpack-extension-containment-entry.js`
  - real production-module Webpack gate for `src/lib/extension-containment/index.js`.
- `test/unit/lib/extension-containment/extension-addons-containment-certification.test.js`
  - 9 end-to-end LEX-G1 certification tests.
- `test/unit/lib/extension-containment/legacy-addon-host.test.js`
  - declared capability / deny-by-default / no-backend-handle coverage.
- `docs/architecture/extensions/LEX-G1-EXTENSION-ADDONS-CONTAINMENT-CERTIFICATION.md`
- `docs/architecture/extensions/LEX-G1-VERIFICATION.md`
- `docs/architecture/extensions/LEX-G1-CERTIFICATE.json`
- `docs/architecture/extensions/LEX-G1-CHANGE-MANIFEST.md`
- `package.json`
  - `test:extension-containment:lex-g1-certification`;
  - `test:extension-containment:lex-g1-webpack`;
  - `test:extension-containment:lex-g1`.

## Stable identities unchanged

```text
ngvge.extension-containment-host@1
ngvge.extension-containment-client@1
ngvge.extension.containment
authority:ngvge.extension-containment-host
ngvge.extension-host.ngvge-module@1
ngvge.extension-host.scratch-extension@1
ngvge.extension-host.legacy-addon@1
```

LEX-G1 does not create a unified Extension runtime host and does not implement WS-6 UI.

## Delivery delta

```text
baseline: COL-0 COMPLETE / VERIFIED + LPL-G1 PASS / CERTIFIED
changed files: 16
insertions: 1124
deletions: 20
git apply --check: PASS
```
