# WS-9B Change Manifest

Stage: `WS-9B | Workspace Context Service`  
Status: COMPLETE / VERIFIED

## Added

- `src/lib/editor-shell/workspace-context.js`
  - Workspace Context Service v1
  - immutable Snapshot v1
  - one-writer-per-domain leases
  - WindowManager Context projection adapter
  - lease-gated Context read capability facade
- `test/unit/lib/editor-shell/workspace-context.test.js`
- `scripts/validate-ws9b-workspace-context-service.js`
- `scripts/validate-ws9b-webpack-context-entry.js`
- `docs/architecture/workspace/WS-9B-WORKSPACE-CONTEXT-SERVICE.md`
- `docs/architecture/workspace/WS-9B-context-source-matrix.csv`
- `docs/architecture/workspace/WS-9B-VERIFICATION.md`
- `docs/architecture/workspace/WS-9B-CERTIFICATE.json`

## Extended

- `src/lib/editor-shell/tool-capability.js`
  - adds `ngvge.workspace-capability.context-read`
- `src/lib/editor-shell/tool-capability-descriptors.js`
  - registers query-only Context capability definition
- `src/lib/editor-shell/tool-ecosystem.js`
  - adds explicit `workspace.context` service dependency identity
- `package.json`
  - adds WS-9B focused/cumulative/Webpack/certification scripts

## Explicitly unchanged

- Agent production context path
- Node Explorer / Inspector production selection path
- SceneSelector production path
- Resource/Asset selection production path
- Todo runtime behavior and permissions
- Terminal/Paint lifecycle (`PLANNED`)
- Project/Scene/Node/Resource mutation authorities
- WindowManager authority
