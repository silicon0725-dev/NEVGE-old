# WS-9G Verification | Project Command Host & Transaction Foundation

Status: COMPLETE / VERIFIED  
Date: 2026-08-14  
Baseline: WS-9F COMPLETE / VERIFIED

## Focused WS-9G evidence

```text
node scripts/validate-ws9g-project-command-host-transaction.js
→ 16 / 16 PASS

Jest focused
→ 4 suites / 31 tests PASS

npm run test:workspace-shell:ws9g-webpack
→ 0 errors / 0 warnings
```

Focused suites include:

- `project-command-host.test.js`;
- `workspace-project-command-provider.test.js`;
- `workspace-project-resource-capabilities.test.js`;
- `workspace-capability-provider.test.js`.

The focused evidence covers:

- stable Host / Authority / schema identities;
- reversible Project transaction v1 command vocabulary;
- Tool-owned proposal semantics;
- Tool-owner-scoped proposal/transaction metadata queries;
- Project Context stale-proposal rejection;
- serialized commit;
- failed-partial-commit compensation;
- exact latest-history rollback;
- rollback-order conflict;
- Provider READY state with native Host;
- Provider fail-closed state without Host/adapter;
- capability lease revocation.

## Full Unit

```text
Node environment
135 suites / 729 tests PASS

DOM harness
3 suites / 27 tests PASS

Total
138 suites / 756 tests PASS
```

## Integration / Smoke / static correctness

```text
Integration
4 suites / 5 tests PASS

Smoke
1 suite / 1 test PASS

TypeScript scoped gate
PASS

ESLint correctness
PASS
```

## Permanent regression

```text
NGVGE permanent regression layer
19 / 19 PASS
```

## Frozen architecture / containment gates

```text
ARC-C001.1 Minimum Baseline
7 / 7 PASS

LSC-G1
19 / 19 machine PASS
7 / 7 certification tests PASS

LRC-G1
15 / 15 machine PASS
certification Jest PASS

LPL-G1
17 / 17 machine PASS
certification Jest PASS

LEX-G1
19 / 19 machine PASS
certification Jest PASS

COL-0
15 / 15 machine PASS
4 suites / 12 tests PASS
```

These gates are significant for WS-9G because the new Host must not acquire Project Lifecycle, Resource, Extension, Collaboration, Scratch adapter, or credential authority by side effect.

## Workspace cumulative focused chain

The focused constituent gates were rerun after WS-9G implementation:

```text
WS-8   27 / 27 machine; 6 suites / 22 tests PASS
WS-9A  12 / 12 machine; 2 suites / 15 tests PASS
WS-9B  12 / 12 machine; 3 suites / 24 tests PASS
WS-9C  12 / 12 machine; runtime 3 suites / 21 tests PASS; DOM 2 suites / 24 tests PASS
WS-9D  13 / 13 machine; 7 suites / 35 tests PASS
WS-9E  14 / 14 machine; 6 suites / 36 tests PASS
WS-9F  15 / 15 machine; Node 6 suites / 51 tests PASS; DOM 1 suite / 3 tests PASS
WS-9G  16 / 16 machine; 4 suites / 31 tests PASS
```

The WS-9F validator was evolved only where its production bootstrap assertion referenced the old inline Resource getter shape. Its permanent semantic rule remains: Project command must fail closed without a native Host and must never expose Scratch project payload mutation.

## Production-entry Webpack

WS-9G's direct production entries were compiled through the real project Webpack configuration:

```text
src/lib/editor-shell/project-command-host.js
src/lib/editor-shell/workspace-project-resource-capabilities.js
src/lib/editor-shell/workspace-capability-providers.js

0 errors
0 warnings
PASS
```

## Full Editor Webpack

A full Editor production-entry Webpack attempt was performed through:

```text
npm run test:workspace-shell:ws8-webpack-editor
```

The compile entered the large Babel/Webpack dependency graph and exceeded the execution environment's 120-second command window. No compile error was emitted before timeout. After timeout no Webpack/validator Node process remained.

Therefore the evidence is recorded as:

```text
Full Editor Webpack: INCONCLUSIVE
≠ PASS
≠ FAIL
```

The focused WS-9G production entries above remain explicit PASS evidence.

## Architecture result

WS-9G establishes a new Writer Authority only for:

```text
ngvge.project.command.transaction
```

It does not replace or compete with:

```text
ngvge.project.lifecycle
Resource database writer authority
Runtime Node authority
Scene authority
Collaboration semantic authority
Extension host authority
```

Project transaction v1 currently coordinates only Resource metadata `rename` and `move`, addressed by canonical ResourceId.

No `vm.loadProject()`, Scratch JSON/SB3 payload, Scratch Target, Renderer, process, filesystem, network, or credential authority is exposed by the new Host or capability facade.
