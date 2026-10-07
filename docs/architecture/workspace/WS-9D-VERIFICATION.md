# WS-9D Verification

Status: COMPLETE / VERIFIED

## Focused evidence

Final WS-9D focused verification:

- machine gate: `13/13 PASS`
- focused Jest: `7 suites / 35 tests PASS`
- real Webpack Context consumer / Agent entries: `0 errors / 0 warnings`

Webpack entries:

- `src/lib/editor-shell/workspace-context-consumer.js`
- `src/lib/editor-shell/agent-workspace-runtime.js`
- `src/components/workspace-agent/workspace-agent.jsx`

## Cumulative Workspace evidence

Because WS-9D intentionally retires the Agent migration deferral from WS-9B/WS-9C, the two older machine checks were evolved to retain their permanent boundary instead of their temporary implementation state.

Post-update focused gates:

- WS-8: `27/27 machine PASS`, `6 suites / 22 tests PASS`
- WS-9A: `12/12 machine PASS`, `2 suites / 15 tests PASS`
- WS-9B: `12/12 machine PASS`, `3 suites / 24 tests PASS`
- WS-9C: `12/12 machine PASS`, runtime `3 suites / 21 tests PASS`, DOM `2 suites / 24 tests PASS`
- WS-9D: `13/13 machine PASS`, `7 suites / 35 tests PASS`

The evolved invariant is:

```text
Agent cannot receive raw WorkspaceContextService authority.
```

It allows the historical callback implementation or the later admitted capability implementation, so old stages remain cumulative without blocking legitimate later migration.

## Full Unit evidence

Final unit run:

- Node environment: `131 suites / 697 tests PASS`
- DOM harness: `3 suites / 27 tests PASS`
- Total: `134 suites / 724 tests PASS`

## Cross-domain evidence

- TypeScript: PASS
- correctness ESLint source/tooling + tests: PASS
- Integration: `4 suites / 5 tests PASS`
- Smoke: `1 suite / 1 test PASS`
- Permanent Regression: `19/19 PASS`
- ARC-C001.1 minimum baseline: `7/7 PASS`

Containment / semantic certification rerun:

- LSC-G1 Credentials & Unsafe Agent Containment: PASS (`19/19` machine + `7/7` certification tests)
- LRC-G1 Runtime Policy Containment: PASS
- LPL-G1 Project Lifecycle Consolidation: PASS
- LEX-G1 Extension/Addons Containment: PASS
- COL-0 Stable Semantic Collaboration Boundary: PASS

## Agent migration evidence

Production `src/` contains no `getCurrentNodeId` reference.

The Agent runtime requires:

```text
contextReadCapability.getSnapshot()
```

and reads `primaryNodeId` from the admitted Context snapshot. It does not import or receive `WorkspaceContextService`.

GUI performs:

```text
ToolId Agent
  ↓
admitWorkspaceContextConsumer(...)
  ↓
agentContextConsumer.contextRead
  ↓
createWorkspaceAgentRuntime(...)
```

The Agent-visible output remains only NodeId + portable Node snapshot.

## Revocation evidence

Focused tests verify:

- Tool without explicit Context descriptor fails closed;
- ToolRegistry `tool:unregistered` immediately revokes the Tool lease;
- revocation listener fires with `tool-unregistered` reason;
- Context observation stops immediately after revocation;
- stale `getSnapshot()` calls fail with revoked-lease error;
- Host disposal revokes active leases with `host-disposed`;
- disposed Host rejects new admission;
- consumer and Agent runtime teardown are idempotent.

## Stale UI fix evidence

Agent runtime subscribes to admitted Context and calls `model.notifyContextChanged()`.

Focused tests change selection from `node:a` to `node:b` without any ChangeSet operation and verify Agent Model revision advances and `getView()` projects `node:b`. This closes the stale-selection memoization hole from the former ref callback path.

## Full Editor Webpack note

The stage-specific production entries compile with `0 errors / 0 warnings`.

`test:workspace-shell:ws8-webpack-editor` was also invoked during final WS-9D verification. The large full Editor Babel/Webpack compile again exceeded the execution environment's 120-second command window before emitting a terminal result. No compile error was emitted before timeout.

This result is recorded as **INCONCLUSIVE**, not PASS and not FAIL. The timeout process was terminated and no Webpack process remained running afterward.
