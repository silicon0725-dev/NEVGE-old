# WS-9H Change Manifest

Stage: `WS-9H | Project Transaction Review / Diagnostics Integration`

Baseline: `WS-9G COMPLETE / VERIFIED`

## Added

- `src/lib/editor-shell/project-transaction-review.js`
- `test/unit/lib/editor-shell/project-transaction-review.test.js`
- `scripts/validate-ws9h-project-transaction-review.js`
- `scripts/validate-ws9h-webpack-review-entry.js`
- `docs/architecture/workspace/WS-9H-PROJECT-TRANSACTION-REVIEW-DIAGNOSTICS-INTEGRATION.md`
- `docs/architecture/workspace/WS-9H-review-diagnostics-matrix.csv`
- `docs/architecture/workspace/WS-9H-VERIFICATION.md`
- `docs/architecture/workspace/WS-9H-CERTIFICATE.json`
- `docs/architecture/workspace/WS-9H-CHANGE-MANIFEST.md`
- `WS-9H-APPLY-README.txt`
- `WS-9H-FILE-MANIFEST.txt`

## Modified

- `src/lib/editor-shell/project-command-host.js`
  - adds Tool-scoped read-only commit and rollback availability diagnostics.
- `src/lib/editor-shell/workspace-project-resource-capabilities.js`
  - adds `reviewProposal()` and `reviewTransaction()` to Project Command scoped facades.
- `src/lib/editor-shell/workspace-capability-providers.js`
  - requires shared Project Transaction Review service for production Project Command Provider readiness.
- `src/components/gui/gui.jsx`
  - installs exactly one production Review service and injects it into Provider Registry.
- `test/unit/lib/editor-shell/project-command-host.test.js`
  - adds diagnostic readiness coverage.
- `test/unit/lib/editor-shell/workspace-project-command-provider.test.js`
  - migrates fixture to production review path and covers review facade/provider fail-closed behavior.
- `package.json`
  - adds WS-9H focused, cumulative, Webpack, and certification commands.

## Authority impact

No new writer Authority is added.

Review service is explicitly read-only and cannot commit or rollback transactions.

Actual Project mutation remains under:

```text
authority:ngvge.workspace-project-command-host
ngvge.project.command.transaction
```

## Compatibility

WS-9G proposal and transaction identities are unchanged.

Provider readiness is intentionally stricter: a native Project Command Host without the shared Review service is now fail-visible rather than treated as a complete production Project Command Provider surface.
