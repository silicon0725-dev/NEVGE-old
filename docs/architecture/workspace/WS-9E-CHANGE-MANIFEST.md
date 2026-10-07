# WS-9E Change Manifest

Baseline: WS-9D COMPLETE / VERIFIED  
Stage: WS-9E Capability Provider Binding & Diagnostics

## Added

- `src/lib/editor-shell/workspace-capability-provider.js`
- `src/lib/editor-shell/workspace-capability-providers.js`
- `test/unit/lib/editor-shell/workspace-capability-provider.test.js`
- `scripts/validate-ws9e-capability-provider-binding.js`
- `scripts/validate-ws9e-webpack-provider-entry.js`
- `docs/architecture/workspace/WS-9E-CAPABILITY-PROVIDER-BINDING-DIAGNOSTICS.md`
- `docs/architecture/workspace/WS-9E-VERIFICATION.md`
- `docs/architecture/workspace/WS-9E-CERTIFICATE.json`
- `docs/architecture/workspace/WS-9E-provider-coverage-matrix.csv`

## Modified

- `src/lib/editor-shell/tool-capability.js`
  - adds read-only capability definition enumeration for diagnostics.
- `src/lib/editor-shell/workspace-context-consumer.js`
  - replaces direct raw Context Service facade construction with Provider Registry binding.
- `src/components/gui/gui.jsx`
  - owns Provider Registry production lifecycle and supplies it to Agent Context admission.
  - moves the existing Workspace Tool Persistence service construction earlier so it can back core scoped Providers without changing Todo behavior.
- `test/unit/lib/editor-shell/workspace-context-consumer.test.js`
  - uses the real Provider Registry path.
- `test/unit/lib/editor-shell/agent-workspace-runtime.test.js`
  - updates WS-9D fixture to the new permanent Provider binding path.
- `scripts/validate-ws9d-context-consumer-agent-migration.js`
  - evolves the historical WS-9D construction assertion into the permanent invariant that Context consumption must not receive raw WorkspaceContextService.
- `package.json`
  - adds WS-9E focused, cumulative, Webpack and certification commands.

## Explicitly unchanged

- Project semantic writer authority.
- Resource semantic writer authority.
- Workspace Context writer ownership.
- Agent ChangeSet / review / transaction mutation path.
- Todo production model/persistence behavior.
- Terminal/Paint lifecycle remains PLANNED.
- No filesystem/process/network/browser/credential capability is introduced.
