# WS-9A Change Manifest

Stage: `WS-9A | Capability Schema & Admission Foundation`  
Status: `COMPLETE / VERIFIED`  
Baseline: `WS-8 COMPLETE / VERIFIED`

## Delivered scope

- versioned `WorkspaceToolCapabilityHost` identity;
- versioned Tool Capability Descriptor and Grant records;
- stable Workspace / Project / Resource capability identities;
- explicit observe/query/propose/mutate access vocabulary;
- capability definition normalization and strict schema validation;
- ToolId capability descriptor normalization;
- ACTIVE Tool Ecosystem + ToolRegistry admission gate;
- authority compatibility gate against WS-8 ecosystem manifest authority;
- undeclared capability fail-closed checks;
- revocable per-lease and per-ToolId grants;
- Todo minimal Workspace-state descriptor;
- focused machine/Jest gate;
- real Webpack capability-entry gate;
- WS-9A cumulative npm script chain.

## Explicitly not delivered

- Project or Resource provider binding;
- Workspace Context Service;
- automatic Window/Extension lifecycle revocation wiring;
- terminal host/process execution authority;
- filesystem/browser capabilities;
- Better Terminal activation;
- Better Paint activation;
- Todo production behavior migration.

## Changed / added files

- `src/lib/editor-shell/tool-capability.js`
- `src/lib/editor-shell/tool-capability-descriptors.js`
- `test/unit/lib/editor-shell/tool-capability.test.js`
- `scripts/validate-ws9a-tool-capability-admission.js`
- `scripts/validate-ws9a-webpack-capability-entry.js`
- `docs/architecture/workspace/WS-9A-CAPABILITY-SCHEMA-ADMISSION-FOUNDATION.md`
- `docs/architecture/workspace/WS-9A-capability-matrix.csv`
- `docs/architecture/workspace/WS-9A-CHANGE-MANIFEST.md`
- `package.json`

## Authority constraints

- Capability Host is admission authority only; it is not Project/Resource execution authority.
- Capability DTOs contain stable semantic identity only.
- Capability requests must be predeclared and compatible with WS-8 ecosystem authority.
- PLANNED tools cannot receive grants.
- A revoked lease must fail closed.
- No raw VM, renderer, Scratch Target, DOM node, process, filesystem or backend handle is granted.
