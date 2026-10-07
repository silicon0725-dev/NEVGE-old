# WS-4 Verification

**Result:** `COMPLETE / VERIFIED`

## Focused certification

- WS-4 Machine Gate: **34 / 34 PASS**
- WS-4 focused Jest: **7 suites / 35 tests PASS**
- WS-0 → WS-4 cumulative gate: **exit 0 / PASS**

Focused coverage includes schema fail-closed behavior, physical scope separation, legacy migration, compatibility bridges, persistable-window filtering, Dock round-trip state, Settings ownership and the WS-3D organization serialization round-trip fix.

## Cumulative architecture gates

- LSC-G1: **19/19 Machine + 7/7 E2E PASS**
- LRC-G1: **15/15 Machine + 9/9 E2E PASS**
- LPL-G1: **17/17 Machine + 9/9 E2E PASS**
- LEX-G1: **19/19 Machine + 9/9 E2E PASS**
- COL-0: **15/15 Machine + 12/12 focused PASS**
- 0009-E Transform DoD: **12/12 PASS**
- Permanent Regression: **19/19 PASS**

During cumulative verification, a historical overlay reconstruction issue was detected in `LEX-1-legacy-extension-debt-matrix.csv`: later Workspace overlays had restored its pre-LEX-G1 status text even though the production LEX-G1 closure remained present. The certified LEX-G1 debt matrix was restored and LEX-G1 returned **19/19 PASS**. WS-4 delivery includes this documentation-state correction so future reconstructed baselines do not report a false containment regression.

## Full tests

- Unit / Node: **115 suites / 617 tests PASS**
- Unit / DOM: **3 suites / 26 tests PASS**
- Unit total: **118 suites / 643 tests PASS**
- Integration: **4 suites / 5 tests PASS**
- Smoke: **1 suite / 1 test PASS**
- TypeScript scope: **PASS**
- ESLint correctness source/tooling + tests: **PASS**
- WS-4 new persistence source/scripts full-rule ESLint: **PASS**

## Real production Webpack evidence

Workspace Settings entry:

```text
entry: src/components/tw-settings-modal/settings-modal.jsx
webpack: webpack.config.js[0]
exit: 0
errors: 0
warnings: 0
PASS
```

Full Editor entry:

```text
entry: src/playground/editor.jsx
webpack: webpack.config.js[0]
exit: 0
errors: 0
warnings: 0
PASS
```


## Unified certification wrapper

`npm run test:workspace-shell:ws4-certification` executed the WS-0 → WS-4 cumulative gate and the Settings Webpack entry successfully, then reached the final repeated full-Editor Webpack invocation. The outer 15-minute execution window terminated the wrapper before it returned an npm exit code. This is recorded as **CONSTITUENT GATES PASS / aggregate wrapper timeout**; no aggregate `exit 0` is claimed. The same final source tree was then compiled independently with `test:workspace-shell:ws4-webpack-editor` and returned **exit 0 / 0 errors / 0 warnings**.

## Scope containment evidence

The v1 storage adapter has only four durable keys:

- Layout;
- Workspace preferences;
- User preferences;
- Device preferences.

No Project, Session or Secret storage key exists. New Custom UI, background, theme and block-flyout writes route through WS-4 bridges while legacy records remain fallback-only during the migration window.
