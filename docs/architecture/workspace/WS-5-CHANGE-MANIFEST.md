# WS-5 | Change Manifest

**Stage:** `WS-5 | Node Explorer Workspace Integration`
**Status:** `COMPLETE / VERIFIED`
**Baseline:** WS-4 verified source, local baseline commit `829b5ee`

## Production source

### Added

- `src/lib/editor-shell/node-workspace-command.js`
  - Workspace Node Command Host/Client v1;
  - ToolId provenance;
  - Runtime Engine Protocol delegation;
  - explicit Project Node compatibility adapter;
  - recursive backend-identity rejection.

### Modified

- `src/components/project-explorer/project-explorer.jsx`
  - selection through stable NodeId client;
  - create/delete/duplicate/patch/reparent through Workspace Node commands;
  - drag/drop and context menus share the same mutation boundary;
  - direct Project NodeDatabase writer calls removed;
  - direct Runtime Node editor client construction removed.
- `src/components/project-inspector/project-inspector.jsx`
  - Project and Runtime semantic node mutations routed through the shared Workspace Node command client;
  - NodeId selection fallback routed through the client.
- `src/components/gui/gui.jsx`
  - one production Workspace Node Command Host;
  - Node Explorer and Inspector Tool-specific clients;
  - Classic and Custom Workspace instances receive those clients.

## Successor-aware governance

- `scripts/validate-runtime-editor-node-command-boundary.js`
  - RE-3 still forbids direct Runtime Node Model mutation;
  - accepts the stronger WS-5 component → Workspace Host → Runtime Engine Protocol delegation path.

## WS-5 verification tooling

### Added

- `scripts/validate-ws5-node-explorer-workspace-integration.js`
- `scripts/validate-ws5-webpack-node-explorer-entry.js`
- `scripts/validate-ws5-webpack-editor-entry.js`
- `test/unit/lib/editor-shell/node-workspace-command.test.js`

### Modified

- `package.json`
  - `test:workspace-shell:ws5:focused`
  - `test:workspace-shell:ws5`
  - `test:workspace-shell:ws5-webpack`
  - `test:workspace-shell:ws5-webpack-editor`
  - `test:workspace-shell:ws5-certification`

## Governance records

### Added

- `docs/architecture/workspace/WS-5-NODE-EXPLORER-WORKSPACE-INTEGRATION.md`
- `docs/architecture/workspace/WS-5-VERIFICATION.md`
- `docs/architecture/workspace/WS-5-CERTIFICATE.json`
- `docs/architecture/workspace/WS-5-node-command-boundary-matrix.csv`
- `docs/architecture/workspace/WS-5-CHANGE-MANIFEST.md`

## Verification summary

```text
WS-5 Machine Gate                  26/26 PASS
WS-5 focused                       4 suites / 42 tests PASS
WS-0 → WS-5                        PASS
LSC-G1 / LRC-G1 / LPL-G1          PASS
LEX-G1 / COL-0                     PASS
0009-E                             12/12 PASS
Permanent Regression               19/19 PASS
Unit                               119 suites / 652 tests PASS
Integration                         5/5 PASS
Smoke                               1/1 PASS
TypeScript                          PASS
ESLint correctness                  PASS
Node Explorer Webpack               0 errors / 0 warnings
Full Editor Webpack                 0 errors / 0 warnings
```

Aggregate `ws5-certification` completed WS-0→WS-5 and Node Explorer Webpack, then the outer execution window expired during its redundant final Editor Webpack. Aggregate exit zero is not claimed; the final Editor entry was independently verified with exit zero on the same production source.

## Final delta

```text
15 files changed
1599 insertions
167 deletions
```

No generated build output, `node_modules`, coverage output or translation extraction is part of the WS-5 source delta.
