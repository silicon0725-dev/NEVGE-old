# WS-7 | Change Manifest

Status: `COMPLETE / VERIFIED`

Baseline: WS-6 verified local commit `0bfdddc`.

Final delta relative to the baseline:

```text
28 files changed
2666 insertions
3 deletions
```

## Added architecture and verification records

- `docs/architecture/workspace/WS-7-NGVGE-AGENT-WORKSPACE-INTEGRATION.md`
- `docs/architecture/workspace/WS-7-VERIFICATION.md`
- `docs/architecture/workspace/WS-7-CERTIFICATE.json`
- `docs/architecture/workspace/WS-7-agent-transaction-boundary-matrix.csv`
- `docs/architecture/workspace/WS-7-CHANGE-MANIFEST.md`

## Added Agent runtime contracts

- `src/lib/editor-shell/agent-change-set.js`
- `src/lib/editor-shell/agent-transaction-host.js`
- `src/lib/editor-shell/agent-workspace-model.js`
- `src/lib/editor-shell/agent-workspace-runtime.js`

These establish portable ChangeSet v1, explicit review, private reviewed Node authorization, trusted compensation, atomic failure rollback, manual Undo, safe context projection, and runtime/session Agent state.

## Added Agent Workspace Tool

- `src/components/workspace-agent/index.js`
- `src/components/workspace-agent/workspace-agent.jsx`
- `src/components/workspace-agent/workspace-agent.css`

The tool presents Current Context, visibility boundaries, proposed ChangeSets, portable diff, Apply/Reject, reviewed transactions, and Undo history. It does not create an independent document-body application.

## Modified Workspace integration

- `src/lib/editor-shell/tool-registry.js`
- `src/lib/editor-shell/node-workspace-command.js`
- `src/components/gui/gui.jsx`
- `src/components/workspace-dock/workspace-dock.jsx`
- `src/components/workspace-launchpad/workspace-launchpad.jsx`
- `package.json`

Key changes include the first-party `ngvge.tool.agent` / `WindowId=agent`, managed WindowManager integration, registry-driven Launchpad discovery, SVG Agent glyphs, and the reviewed Agent Node-command authorization seam.

## Added/modified verification

- `scripts/validate-ws7-agent-workspace-integration.js`
- `scripts/validate-ws7-webpack-agent-entry.js`
- `scripts/validate-ws7-webpack-editor-entry.js`
- `test/unit/lib/editor-shell/agent-change-set.test.js`
- `test/unit/lib/editor-shell/agent-transaction-host.test.js`
- `test/unit/lib/editor-shell/agent-workspace-model.test.js`
- `test/unit/components/workspace-agent.test.jsx`
- `test/unit/lib/editor-shell/node-workspace-command.test.js`
- `test/unit/lib/editor-shell/tool-registry.test.js`
- `test/unit/components/workspace-launchpad.test.jsx`

## Explicit non-changes

WS-7 does not:

- replace or weaken Legacy 02Agent containment;
- grant the Agent raw VM, renderer, Scratch target, credential, Project Lifecycle, or Extension Host authority;
- add an Agent localStorage/sessionStorage domain;
- persist ChangeSets or compensation records as Workspace state;
- permit destructive `DestroyNode` ChangeSets in v1;
- allow AI-authored compensation commands;
- implement a provider-specific mutation bypass;
- default-pin the Agent Tool to the Dock.

## Delivery exclusions

The WS-7 Overlay/Patch excludes `node_modules`, build outputs, coverage, generated translations, temporary logs, and other non-source artifacts.
