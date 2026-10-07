# WS-8 Change Manifest

Stage: `WS-8 | Post-MVP Tool Ecosystem`
Status: `COMPLETE / VERIFIED`
Baseline: `8d9a944` (`WS-7 COMPLETE / VERIFIED`)

## Scope

WS-8 establishes the admission and integration contract for post-MVP Workspace tools. It does not claim that every planned tool is implemented.

Delivered in this stage:

- versioned Tool Ecosystem Manifest and Registry;
- Workspace-scoped Tool Persistence service;
- Todo as the first active first-party reference tool;
- planned stable identities for Better Terminal and Better Paint / Costume Editor;
- OSS Intake ADR template and activation gate;
- ToolRegistry, WindowManager, Dock/Launchpad, GUI and persistence integration for Todo;
- cumulative and production-build certification.

Explicitly not delivered:

- Better Terminal implementation or backend selection;
- Better Paint / Costume Editor implementation or backend selection;
- an OSS dependency with authority over NGVGE identities or protocols;
- Project or Secret persistence owned by ecosystem tools.

## Stable identities

- `ngvge.workspace-tool-ecosystem-registry@1`
- Tool Ecosystem Manifest schema v1
- `ngvge.workspace-tool-persistence@1`
- Workspace Tool State schema v1
- `ngvge.workspace-todo-tool-model@1`
- `ngvge.tool.todo`
- reserved/planned `ngvge.tool.terminal`
- reserved/planned `ngvge.tool.paint`

## Authority constraints

- Ecosystem Registry is declaration/admission only; it is not an execution authority.
- ACTIVE manifests must correspond to a ToolRegistry definition.
- PLANNED manifests must not leak into ToolRegistry.
- ACTIVE OSS-wrapped tools require an approved OSS Intake ADR identity.
- Normal ecosystem tools cannot claim Project or Secret as persistence scopes.
- Workspace Tool Persistence rejects secret/backend identity fields and non-portable values.
- Todo owns no Project, Resource, Runtime, Extension, Agent, VM, renderer, or Scratch target mutation authority.
- OSS libraries may be KEEP/WRAP dependencies but never own NGVGE ToolId, WindowId, NodeId, ResourceId, Schema, Authority, Protocol, Project Lifecycle, or Compatibility semantics.

## Active / planned tools

| Tool | Lifecycle | Registry | OSS intake | Result |
| --- | --- | --- | --- | --- |
| Todo (`ngvge.tool.todo`) | ACTIVE | ToolRegistry | not applicable | VERIFIED reference tool |
| Better Terminal (`ngvge.tool.terminal`) | PLANNED | not registered | REQUIRED | backend unselected |
| Better Paint (`ngvge.tool.paint`) | PLANNED | not registered | REQUIRED | backend unselected |

## Verification evidence

- WS-8 Machine Gate: `27/27 PASS`
- Focused Jest: `6 suites / 21 tests PASS`
- Cumulative `WS-0 -> WS-8`: exit `0 / PASS`
- Unit Node: `126 suites / 666 tests PASS`
- Unit DOM: `3 suites / 26 tests PASS`
- Total Unit: `129 suites / 692 tests PASS`
- Integration: `4 suites / 5 tests PASS`
- Smoke: `1 / 1 PASS`
- TypeScript: `PASS`
- ESLint correctness: `PASS`
- WS-8 targeted full-rule ESLint: `PASS`
- Todo production Webpack: exit `0`, errors `0`, warnings `0`
- Full Editor production Webpack: exit `0`, errors `0`, warnings `0`
- Aggregate certification wrapper: constituent gates PASS; wrapper timed out while starting the final repeated Full Editor Webpack; aggregate exit `0` is not claimed.

## Delivery rules

The WS-8 patch and overlay are generated strictly relative to baseline `8d9a944`.

The delivery excludes:

- `node_modules`;
- `build` output;
- coverage output;
- generated translation extraction;
- temporary logs.

Patch verification must include:

- `git diff --check`;
- `git apply --check` against a clean WS-7 baseline;
- actual patch application;
- byte-for-byte comparison of every changed file against the final verified WS-8 worktree.
