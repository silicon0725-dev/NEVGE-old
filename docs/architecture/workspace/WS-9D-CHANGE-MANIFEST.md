# WS-9D Change Manifest

Stage: `WS-9D | Context Consumer Admission & Agent Migration`  
Status: COMPLETE / VERIFIED  
Baseline: `WS-9C | Context Source Integration & Lifecycle Binding` COMPLETE / VERIFIED

## Added

- `src/lib/editor-shell/workspace-context-consumer.js`
  - generic Tool Capability admission seam for Workspace Context consumers
  - owns consumer lease release lifecycle
  - fails closed when Tool lacks `context-read/query`
- `test/unit/lib/editor-shell/workspace-context-consumer.test.js`
- `test/unit/lib/editor-shell/agent-workspace-runtime.test.js`
- `scripts/validate-ws9d-context-consumer-agent-migration.js`
- `scripts/validate-ws9d-webpack-context-consumer-entry.js`
- `docs/architecture/workspace/WS-9D-CONTEXT-CONSUMER-ADMISSION-AGENT-MIGRATION.md`
- `docs/architecture/workspace/WS-9D-context-consumer-admission-matrix.csv`
- `docs/architecture/workspace/WS-9D-VERIFICATION.md`
- `docs/architecture/workspace/WS-9D-CERTIFICATE.json`

## Extended

- `src/lib/editor-shell/tool-ecosystem-manifests.js`
  - adds active first-party Agent ecosystem manifest
  - preserves WS-8 Todo / planned Terminal / planned Paint manifests
- `src/lib/editor-shell/tool-capability-descriptors.js`
  - adds Agent `context-read/query` descriptor only
- `src/lib/editor-shell/tool-capability.js`
  - ToolRegistry unregister -> `revokeTool()` lifecycle
  - revocation listeners
  - consumer lease `release()`
  - Capability Host disposal
- `src/lib/editor-shell/workspace-context.js`
  - Context facade immediately tears down subscriptions when underlying Tool lease is revoked
- `src/lib/editor-shell/agent-workspace-model.js`
  - adds read-only `notifyContextChanged()` revision signal
- `src/lib/editor-shell/agent-workspace-runtime.js`
  - removes `getCurrentNodeId`
  - consumes admitted Context read facade
  - subscribes Context changes
  - keeps Agent-visible projection limited to NodeId + portable Node snapshot
  - adds runtime dispose lifecycle
- `src/components/gui/gui.jsx`
  - owns Workspace Tool Capability Host lifecycle
  - admits Agent Context consumer
  - passes only admitted Context facade to Agent runtime
  - removes Agent selected-Node ref callback bypass
- `test/unit/lib/editor-shell/tool-ecosystem.test.js`
  - verifies Agent active Context consumer manifest without activating Terminal/Paint
- `test/unit/lib/editor-shell/tool-capability.test.js`
  - verifies Agent minimal descriptor, Tool unregister revocation and Host disposal
- `scripts/validate-ws9b-workspace-context-service.js`
  - converts temporary "Agent not migrated yet" assertion into permanent "no raw Context Service authority" invariant
- `scripts/validate-ws9c-context-source-integration.js`
  - same cumulative-gate evolution for WS-9C
- `package.json`
  - adds WS-9D focused, cumulative, Webpack and certification commands

## Authority preserved

- Workspace Context remains read-only projection state.
- Tool Capability Host grants admission metadata/leases; it does not become Project authority.
- Agent Project mutation remains behind WS-7 reviewed ChangeSet -> AgentTransactionHost -> reviewed Node command boundary.
- Context consumer admission exposes no VM/Renderer/Scratch/backend object.
- ToolRegistry lifecycle owns Tool identity presence; Capability Host only reacts by revoking leases.

## Explicitly unchanged

- Todo behavior and persistence remain unchanged.
- Terminal and Paint remain `PLANNED`.
- Agent still cannot see credentials, raw VM, renderer internals, Scratch target/runtime identities, or unreviewed mutation authority.
- no Project/Resource capability provider is added in WS-9D.
- no filesystem/process/browser/network capability is added.
- no active extension-provided Workspace Tool is introduced.
