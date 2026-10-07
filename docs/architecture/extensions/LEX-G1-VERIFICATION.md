# LEX-G1 | Extension / Addons Containment Certification Verification

**Status:** `PASS / CERTIFIED`
**Date:** 2026-08-13
**Architecture Parent:** `ARC-0001 | Kernel Independence Contract`
**Certified Implementation:** `LEX-1 | COMPLETE / VERIFIED`
**Baseline:** `LPL-G1 PASS / CERTIFIED + COL-0 COMPLETE / VERIFIED`

## Focused certification

- LEX-G1 Machine Certification: **19 / 19 PASS**
- LEX-G1 E2E: **1 suite / 9 tests PASS**
- LEX-1 Machine DoD: **14 / 14 PASS**
- LEX-1 focused: **4 suites / 11 tests PASS**

## Certification blocker closure

### LEX-D002

`load-extensions` no longer uses `addon.tab.traps.vm` or raw ExtensionManager. It declares
`legacy-addon.scratch-extension.load-built-in` and receives a narrow immutable capability facade from the Legacy
Addon Host. The facade delegates to Scratch Extension Host and exposes no VM/ExtensionManager handle.

Undeclared, custom/untrusted and non-built-in load attempts fail visibly.

### LEX-D006

`extension-debug` is no longer a static production GUI dependency. It is loaded dynamically only when
`NODE_ENV !== 'production'` and remains Developer Tools quarantine.

## Certified explicit quarantine

- LEX-D001 / Legacy 02Agent — legacy-only ExtensionManager quarantine; cannot become NGVGE Module authority.
- LEX-D007 / `window.vm` — development diagnostics quarantine only.
- LEX-D008 / `addon.tab.traps.vm` — bundled legacy raw-VM quarantine; custom/untrusted denied.
- compatibility project scan — backend compatibility analysis only.
- extension debug — non-production developer quarantine.

These exceptions are fail-visible and do not count as Native NGVGE extension capabilities.

## Cumulative evidence

- LPL-G1: **17/17 Machine + 9/9 E2E PASS**
- LRC-G1: **15/15 Machine + 9/9 E2E PASS**
- COL-0: **15/15 Machine + 4 suites / 12 tests PASS**
- ARC-C001.1: **7/7 PASS**
- 0009-E: **12/12 PASS**
- Permanent Regression: **19/19 PASS**
- Unit / Node: **100 suites / 537 tests PASS**
- Unit / DOM: **3 suites / 26 tests PASS**
- Unit total: **103 suites / 563 tests PASS**
- Integration: **4 suites / 5 tests PASS**
- Smoke: **1 suite / 1 test PASS**
- RE-3 -> RE-5: **PASS**
- WS-0 -> WS-2: **PASS**
- LSC-0: **2 suites / 5 tests PASS**
- TypeScript: **PASS**
- ESLint correctness: **PASS**

## Real Webpack evidence

```text
command: npm run test:extension-containment:lex-g1-webpack
entry: src/lib/extension-containment/index.js
webpack config: webpack.config.js[0]
exit code: 0
errors: 0
warnings: 0
result: PASS
```

## Aggregate certification

```text
npm run test:extension-containment:lex-g1
```

The final aggregate rerun reached the last `test:lint:correctness` stage and printed `PASS ESLint correctness: source/tooling` before the outer 15-minute execution window terminated the wrapper. The wrapper exit code was therefore not captured and is **not** recorded as exit 0.

`npm run test:lint:correctness` was immediately rerun independently on the same final tree and returned explicit PASS for both `source/tooling` and `tests`. All other aggregate constituents had already returned explicit PASS in the same final tree, including the real Webpack gate. The aggregate status is therefore recorded as `CONSTITUENT GATES PASS / wrapper timeout`.

## Governance conclusion

LEX-G1 certifies the Extension/Addons containment invariant. It does not implement WS-6 and does not collapse
Module Manager, Scratch Extension Host and Legacy Addon Host into one runtime. Any future Extension Manager UI must
consume this descriptor/trust/capability boundary rather than acquire backend authority directly.

## Delivery verification

The final LEX-G1 delta was generated against the clean `COL-0 COMPLETE / VERIFIED + LPL-G1 PASS / CERTIFIED`
baseline.

```text
changed files: 16
insertions:     1124
 deletions:       20

git apply --check: PASS
applied content vs final certified worktree: MATCH
```

Generated build output, translation extraction, `node_modules`, coverage data and disposable permission changes are
not part of the patch/overlay.
