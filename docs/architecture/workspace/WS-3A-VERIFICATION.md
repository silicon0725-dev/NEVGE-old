# WS-3A Verification

**Stage:** WS-3A | Dock Runtime Model
**Status:** COMPLETE / VERIFIED

## Focused verification

```text
WS-3A Machine checks              29 / 29 PASS
WS-3A focused Jest                 1 suite / 9 tests PASS
WS-0 → WS-2 cumulative chain       PASS
```

The focused tests verify:

- stable Dock Runtime identity;
- ToolRegistry + WindowManager are the only runtime projection sources;
- registered-but-closed WindowIds are not treated as running;
- minimized/active state is derived from WindowManager;
- multi-instance Editor keeps one ToolId and multiple WindowIds;
- pinning and ordering do not mutate WindowManager;
- organization metadata remains Dock-owned and runtime-only;
- lifecycle projection events are immutable;
- backend/private identity is rejected;
- snapshots omit WindowManager geometry/z-order authority.

## Existing certified boundary regression

```text
LSC-G1                            19/19 + 7/7 PASS
LRC-G1                            15/15 + 9/9 PASS
LPL-G1                            17/17 + 9/9 PASS
LEX-G1                            19/19 + 9/9 PASS
COL-0                             15/15 + 12/12 PASS
ARC-C001.1                         7/7 PASS
0009-E                            12/12 PASS
Permanent Regression             19/19 PASS
```

## Full test evidence

```text
Unit / Node                       101 suites / 546 tests PASS
Unit / DOM                          3 suites / 26 tests PASS
Unit total                        104 suites / 572 tests PASS
Integration                         4 suites / 5 tests PASS
Smoke                               1 suite / 1 test PASS
TypeScript                          PASS
ESLint correctness                  PASS
```

## Real Webpack evidence

Command:

```text
npm run test:workspace-shell:ws3a-webpack
```

Result:

```text
entry: src/playground/editor.jsx
webpack: webpack.config.js[0]
exit code: 0
errors: 0
warnings: 0
PASS
```

The first foreground invocation exceeded the external command window while webpack remained in compilation. The same command was then allowed to continue as a single process and returned the explicit result above. The timeout is not recorded as PASS; the final process exit code is the build evidence.

The aggregate `npm run test:workspace-shell:ws3a-certification` also reached its final Webpack step and was cut off by the same outer command window. Therefore the aggregate wrapper is recorded as `CONSTITUENT GATES PASS / wrapper timeout`; the independently completed WS-3A cumulative chain and the explicit Webpack `exit 0` above are the certification evidence.

## Product behavior boundary

WS-3A introduces no Dock visual surface and no user-facing Dock interaction.

```text
production Dock UI switch: false
Dock persistence: deferred to WS-4
Dock interactions: deferred to WS-3B
Dock placement/geometry: deferred to WS-3C
Dock organization UI/topology: deferred to WS-3D
```
