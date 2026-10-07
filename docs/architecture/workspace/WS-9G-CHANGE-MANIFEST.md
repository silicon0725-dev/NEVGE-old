# WS-9G Change Manifest

Baseline: WS-9F COMPLETE / VERIFIED  
Stage: WS-9G Project Command Host & Transaction Foundation

## Added

- `src/lib/editor-shell/project-command-host.js`
  - native Project Command Host;
  - explicit Project transaction writer Authority;
  - versioned command / proposal / transaction contracts;
  - Tool-owned, Project-context-scoped proposals;
  - Resource metadata transaction adapter;
  - serialized commit, failure compensation and conservative explicit rollback.
- `test/unit/lib/editor-shell/project-command-host.test.js`
- `test/unit/lib/editor-shell/workspace-project-command-provider.test.js`
- `scripts/validate-ws9g-project-command-host-transaction.js`
- `scripts/validate-ws9g-webpack-project-command-entry.js`
- `docs/architecture/workspace/WS-9G-PROJECT-COMMAND-HOST-TRANSACTION-FOUNDATION.md`
- `docs/architecture/workspace/WS-9G-VERIFICATION.md`
- `docs/architecture/workspace/WS-9G-CERTIFICATE.json`
- `docs/architecture/workspace/WS-9G-provider-coverage-matrix.csv`
- `docs/architecture/workspace/WS-9G-CHANGE-MANIFEST.md`
- `WS-9G-APPLY-README.txt`
- `WS-9G-FILE-MANIFEST.txt`

## Modified

- `src/lib/editor-shell/workspace-project-resource-capabilities.js`
  - Project command propose facade now creates native Host proposals;
  - proposal/transaction metadata queries are Tool-owner scoped;
  - Project command mutate facade commits/rolls back native Host transactions;
  - unavailable facade remains as fail-closed compatibility when Host is absent.
- `src/lib/editor-shell/workspace-capability-providers.js`
  - accepts a native Project Command Host;
  - Project command Provider availability is dynamically delegated to the Host;
  - propose/mutate Providers become READY only when the Host transaction adapter is available.
- `src/components/gui/gui.jsx`
  - installs one Workspace Project Command Host;
  - shares the canonical Resource database getter with Host and Provider Registry;
  - disposes the Host with GUI lifecycle.
- `scripts/validate-ws9f-project-resource-provider-foundation.js`
  - evolves only the production bootstrap shape assertion from an inline Resource getter to the named shared getter;
  - keeps the WS-9F permanent fail-closed-without-native-Host invariant.
- `package.json`
  - adds WS-9G focused, cumulative, Webpack, and certification commands.

## Explicitly unchanged

- Project Lifecycle Host remains the only `ngvge.project.lifecycle` writer.
- Global Asset Database remains Resource mutation implementation/authority seam.
- Workspace Context remains projection/query, not Project authority.
- Provider Registry remains resolver/binding, not Project authority.
- Agent ChangeSet review and AgentTransactionHost are not migrated in WS-9G.
- Direct Resource command capability still has its WS-9F bounded rename/move/delete semantics.
- Project Transaction v1 intentionally excludes Resource delete and binary replacement.
- Scratch project JSON / SB3 / `vm.loadProject()` are not Project capability semantics.
- Terminal/Paint remain PLANNED / UNADMITTED.
- No filesystem/process/network/browser/credential capability is introduced.
