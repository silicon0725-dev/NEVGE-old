# WS-5 | Verification

**Stage:** `WS-5 | Node Explorer Workspace Integration`
**Status:** `COMPLETE / VERIFIED`
**Baseline:** WS-4 verified source, local baseline commit `829b5ee`

## Focused certification

```text
WS-5 Machine Gate
26 / 26 PASS

Focused Jest
non-DOM: 3 suites / 21 tests PASS
DOM Project Explorer: 1 suite / 21 tests PASS
focused total: 4 suites / 42 tests PASS
```

Focused coverage includes:

- Host / Client / compatibility adapter identities;
- stable NodeId selection writer;
- Runtime create/destroy/duplicate/patch/reparent through Engine Protocol;
- Project NodeDatabase writer quarantine;
- ToolId provenance;
- recursive backend-identity rejection;
- mixed-domain rejection;
- Node Explorer product behavior and context menus;
- Inspector mutation behavior;
- Runtime Node primary-mode / Legacy Sprites demotion.

## Cumulative Workspace gate

```text
npm run test:workspace-shell:ws5
exit 0
PASS
```

This includes WS-0 through WS-4 and the successor-aware RE-3/RE-4/RE-5 Runtime Editor chain.

## Cross-domain certified gates

Final WS-5 source passed:

```text
LSC-G1  19/19 machine + 7/7 certification tests
LRC-G1  15/15 machine + 9/9 certification tests
LPL-G1  17/17 machine + 9/9 certification tests
LEX-G1  19/19 machine + 9/9 certification tests
COL-0   15/15 machine + 12/12 focused tests
0009-E  12/12 PASS
Permanent Regression 19/19 PASS
```

No Workspace Node command path gained Runtime Policy, Project Lifecycle, Extension, Collaboration, credential or Scratch backend authority.

## Full regression

```text
Unit / Node
116 suites / 626 tests PASS

Unit / DOM harness
3 suites / 26 tests PASS

Unit total
119 suites / 652 tests PASS

Integration
4 suites / 5 tests PASS

Smoke
1 suite / 1 test PASS

TypeScript
PASS

ESLint correctness
source/tooling PASS
tests PASS
```

The cumulative RE-5 chain also compiles the Node Explorer / GUI / Target Pane CSS through its CSS/PostCSS gate.

## Production Webpack

Node Explorer production entry:

```text
entry: src/components/project-explorer/project-explorer.jsx
webpack.config.js[0]
exit 0
errors 0
warnings 0
PASS
```

Full Editor production entry:

```text
entry: src/playground/editor.jsx
webpack.config.js[0]
exit 0
errors 0
warnings 0
PASS
```

## Aggregate certification wrapper

`npm run test:workspace-shell:ws5-certification` was executed on the final production source. It completed WS-0→WS-5 and the Node Explorer Webpack entry, then the outer execution window expired while redundantly running the final full Editor Webpack entry.

Therefore:

```text
aggregate wrapper exit 0: NOT CLAIMED
status: CONSTITUENT GATES PASS / WRAPPER TIMEOUT
```

The same final source had already independently completed the full Editor Webpack entry with `exit 0 / errors 0 / warnings 0`, and no production source changed afterward.

## Authority result

```text
Node Explorer / Inspector
→ stable ToolId client
→ Workspace Node Command Host
→ stable NodeId command
→ Runtime Engine Protocol OR explicit Project compatibility adapter
```

Direct Runtime Node Model mutation from the product components: `0`.
Direct Project NodeDatabase writer calls from the product components: `0`.
Production Workspace Node Command Host instances in GUI: `1`.
