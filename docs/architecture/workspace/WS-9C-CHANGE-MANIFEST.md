# WS-9C Change Manifest

Stage: `WS-9C | Context Source Integration & Lifecycle Binding`  
Status: COMPLETE / VERIFIED  
Baseline: `WS-9B | Workspace Context Service` COMPLETE / VERIFIED

## Added

- `src/lib/editor-shell/workspace-context-runtime.js`
  - production Context source runtime binding
  - Project Lifecycle generation projection
  - Scene System semantic projection
  - Node selection projection writer
  - Resource selection projection writer
  - WindowManager projection installation
  - root project-load Context quarantine
  - teardown/release of all source writer leases
- `test/unit/lib/editor-shell/workspace-context-runtime.test.js`
- `scripts/validate-ws9c-context-source-integration.js`
- `scripts/validate-ws9c-webpack-context-source-entry.js`
- `docs/architecture/workspace/WS-9C-CONTEXT-SOURCE-INTEGRATION-LIFECYCLE-BINDING.md`
- `docs/architecture/workspace/WS-9C-context-source-matrix.csv`
- `docs/architecture/workspace/WS-9C-VERIFICATION.md`
- `docs/architecture/workspace/WS-9C-CERTIFICATE.json`

## Extended

- `src/lib/editor-shell/workspace-context.js`
  - registers explicit Project / Scene / Node Selection / Resource source identities
- `src/components/gui/gui.jsx`
  - owns one Workspace Context Service and one Runtime Binding lifecycle
  - installs production Context source integration
  - exposes diagnostics-only Context attributes
  - forwards Node/Resource projection callbacks
- `src/components/project-explorer/project-explorer.jsx`
  - projects `selectedNodeIds[]` + `primaryNodeId` through a dedicated callback seam
- `src/components/project-assets/project-asset-manager.jsx`
  - projects selected `ResourceId`
  - clears Resource Context on selection loss/tool-surface teardown
- `test/unit/components/project-explorer.test.jsx`
  - verifies NodeId selection projection
- `test/unit/components/project-asset-manager.test.jsx`
  - verifies ResourceId projection and teardown clear
- `package.json`
  - adds WS-9C focused, cumulative, Webpack and certification commands

## Authority preserved

WS-9C does not become a writer authority for any projected semantic domain.

- Project Lifecycle Host remains Project lifecycle authority.
- First-party Scene System remains Scene semantic authority.
- Existing Editor/Workspace selection path remains Node selection authority.
- Asset/Resource subsystem remains Resource authority.
- WindowManager remains Window runtime authority.
- Workspace Context remains an ephemeral read-only projection.

## Explicitly unchanged

- no persistent canonical Project Model ProjectId is introduced;
- no Redux/server/Scratch project ID is promoted into NGVGE core identity;
- Agent still uses the existing `getCurrentNodeId()` path and is **not** given direct Context Service access;
- Tool consumer migration does not bypass WS-9A Capability Admission;
- Terminal/Paint remain `PLANNED`;
- no filesystem/process/browser privilege is introduced;
- no VM, Scratch Target, Renderer, React, DOM, Redux store or backend-private handle is exposed through Context;
- Workspace Context is not persisted into Project data.
