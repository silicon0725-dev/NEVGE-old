# LEX-1 | Extension / Addons Containment Verification

**Status:** `COMPLETE / VERIFIED`  
**Date:** 2026-08-13  
**Architecture Parent:** `ARC-0001 | Kernel Independence Contract`  
**Baseline:** `LRC-G1 PASS / CERTIFIED + LPL-1 COMPLETE / VERIFIED`

## Certification result

LEX-1 establishes the first explicit containment boundary across NGVGE Modules, Scratch Extensions and Legacy Addons while preserving three separate runtime hosts.

### LEX-1 focused evidence

- Machine DoD: **14 / 14 PASS**
- Focused Jest: **4 suites / 8 tests PASS**
- Extension Containment Writer Authority: one writer for `ngvge.extension.containment`
- Normal GUI direct `_loadedExtensions` / ExtensionManager mutation scan: **0 violations**
- `window.addonAPI`: **0 production source references**
- Production `window.vm`: **forbidden; development diagnostics only**
- Custom/untrusted Legacy Addon raw VM lease: **DENIED**
- Bundled Legacy Addon raw VM: **explicit quarantine lease + diagnostic only**

### Cumulative architecture evidence

- LPL-1 Machine DoD: **13 / 13 PASS**
- LPL-1 focused: **6 suites / 32 tests PASS**
- LRC-G1 Machine Certification: **15 / 15 PASS**
- LRC-G1 E2E: **1 suite / 9 tests PASS**
- ARC-C001.1 minimum baseline: **7 / 7 PASS**
- 0009-E Transform DoD: **12 / 12 PASS**
- Permanent Regression: **19 / 19 PASS**
- RE-3 → RE-5: **PASS**
- WS-0 → WS-2: **PASS**
- LSC-0 focused: **2 suites / 5 tests PASS**

### Full project evidence

- Unit / Node: **95 suites / 508 tests PASS**
- Unit / DOM: **3 suites / 26 tests PASS**
- Unit total: **98 suites / 534 tests PASS**
- Integration: **4 suites / 5 tests PASS**
- Smoke: **1 suite / 1 test PASS**
- TypeScript: **PASS**
- ESLint correctness: **PASS**

### Real Webpack evidence

The existing real Editor-entry verifier was executed against the final production source tree:

```text
entry: src/playground/editor.jsx
webpackConfig: webpack.config.js[0]
exit code: 0
errors: 0
warnings: 0
result: PASS
```

The first pollable attempt failed only because the reconstructed working directory did not permit the Babel `react-intl` extraction plugin to write generated translation messages. Build-directory permissions were repaired in the disposable working copy and the same source tree then compiled with exit code 0. No permission change is part of the Overlay/Patch.

### Execution-window note

A cumulative `test:legacy-containment:lsc0` run reached and passed RE-3 → RE-5 and WS-0 → WS-2 before the outer tool window expired. The remaining LSC-0 validator and 5 tests were then executed separately on the same final tree and passed. This timeout is not recorded as an aggregate PASS.

## Deferred / fail-visible debt

LEX-1 intentionally does not hide remaining direct ExtensionManager access. The exact locations and owners are recorded in `LEX-1-legacy-extension-debt-matrix.csv`.

Collaboration-owned direct extension access is deferred to `COL-0`; Legacy Addon/02Agent and Developer-only seams remain quarantined and must be resolved or explicitly certified before `LEX-G1`.

## Governance conclusion

LEX-1 is `COMPLETE / VERIFIED`, not `ARCHITECTURE FROZEN` and not `LEX-G1 CERTIFIED`.

The following must remain true after LEX-1:

1. NGVGE Module, Scratch Extension and Legacy Addon remain distinct runtime host kinds.
2. Normal GUI code cannot acquire Scratch ExtensionManager private mutation authority.
3. Legacy raw VM access cannot become a Native NGVGE capability.
4. Custom/untrusted Legacy Addons cannot acquire raw VM quarantine leases.
5. `window.addonAPI` cannot return as a global extension contract.
6. `window.vm` cannot exist in production as an extension authority.
7. Remaining legacy/collaboration/debug debt must remain fail-visible and assigned.
