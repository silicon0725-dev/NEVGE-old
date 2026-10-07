# WS-10C｜Change Manifest

## New

- `src/lib/project-assets/image-content-payload.js`
- `scripts/validate-ws10c-reviewed-resource-content-replace.js`
- `scripts/validate-ws10c-webpack-content-replace-entry.js`
- `scripts/validate-ws10c-certification.js`
- `test/unit/lib/project-assets-image-content-payload.test.js`
- `docs/architecture/workspace/WS-10C-REVIEWED-RESOURCE-CONTENT-REPLACE-TRANSACTION.md`
- `docs/architecture/workspace/WS-10C-VERIFICATION.md`
- `docs/architecture/workspace/WS-10C-CERTIFICATE.json`
- `docs/architecture/workspace/WS-10C-CHANGE-MANIFEST.md`
- `docs/architecture/workspace/WS-10C-content-replace-matrix.csv`

## Modified semantic/runtime surfaces

- `src/lib/project-assets/global-asset-database.js`
  - runtime per-Resource image `contentRevision`;
  - reviewed canonical Resource content replacement adapter;
  - SVG sanitize + compatibility backend materialization boundary.
- `src/lib/editor-shell/workspace-resource-content-capability.js`
  - source snapshots/events use per-Resource content revision.
- `src/lib/editor-shell/workspace-capability-providers.js`
  - content Provider availability requires the content-revision seam.
- `src/lib/editor-shell/project-command-host.js`
  - versioned `resource.content.replace` command;
  - source revision and image geometry validation;
  - reversible content transaction adapter.
- `src/lib/editor-shell/project-transaction-review.js`
  - `resource.content` impact summaries and stale diagnostics.
- `src/lib/editor-shell/paint-tool-runtime.js`
  - dirty Working Copy becomes reviewed Project content command;
  - commit/rollback authoritative reload.
- `src/components/workspace-paint/workspace-paint.jsx`
  - combined metadata/content Review presentation.

## Modified regression/certification surfaces

- `test/unit/lib/project-assets-global-database.test.js`
- `test/unit/lib/editor-shell/workspace-resource-content-capability.test.js`
- `test/unit/lib/editor-shell/project-command-host.test.js`
- `test/unit/lib/editor-shell/project-transaction-review.test.js`
- `test/unit/lib/editor-shell/paint-tool-runtime.test.js`
- `test/unit/components/workspace-paint.test.jsx`
- `scripts/validate-ws9h-project-transaction-review.js`
  - permanent Review invariant now permits the certified `resource.content` domain extension.
- `scripts/validate-ws10b-certification.js`
  - historical certification no longer freezes the roadmap string `WS-10C NEXT` as a permanent invariant.
- `docs/architecture/workspace/WS-10-HIGH-CAPABILITY-TOOL-INTEGRATION.md`
- `package.json`

## Explicitly unchanged authority

- WS-9 Capability / Provider / Review / Review Evidence identities;
- Project Lifecycle writer ownership;
- canonical ResourceId identity;
- direct Resource mutation denial for high-capability Tools;
- Scratch VM/renderer/storage as replaceable compatibility/backend implementation;
- Terminal remains unactivated.
