# WS-8 | Post-MVP Tool Ecosystem

Status: COMPLETE / VERIFIED
Authority: ARC-0001
Baseline: WS-7 COMPLETE / VERIFIED (`8d9a944`)

## Purpose

WS-8 establishes the admission contract for Post-MVP Workspace tools. It does not make external libraries or tool UI components owners of NGVGE semantic identity. A tool may be first-party, extension-provided, or implemented through an OSS wrapper, but it must enter the Workspace through stable ToolId/WindowId, declared services, scoped persistence, and explicit authority.

The stage deliberately separates:

- ecosystem declaration/admission;
- Workspace window/tool lifecycle;
- persistence service consumption;
- Project/Resource mutation authority;
- external OSS implementation backends.

## Stable identities

- `ngvge.workspace-tool-ecosystem-registry@1`
- Tool Ecosystem Manifest schema v1
- `ngvge.workspace-tool-persistence@1`
- Workspace Tool State schema v1
- `ngvge.workspace-todo-tool-model@1`
- `ngvge.tool.todo`
- `WindowId: todo`

Reserved Post-MVP ToolIds:

- `ngvge.tool.todo` — ACTIVE reference tool
- `ngvge.tool.terminal` — PLANNED / OSS Intake required
- `ngvge.tool.paint` — PLANNED / OSS Intake required

## Tool Ecosystem Manifest v1

Each ecosystem tool declares:

- stable ToolId;
- title;
- lifecycle: active / planned / retired;
- origin: first-party / extension / oss-wrapped;
- required Workspace services;
- permitted persistence scopes;
- authority requirement;
- OSS Intake status and ADR identity where applicable.

The registry is admission metadata, not execution authority. It cannot mutate WindowManager, Project, Resource, Runtime, Extension, or Agent state.

### Active/planned invariant

An `active` manifest requires a corresponding ToolRegistry definition.

A non-active manifest must not already exist in ToolRegistry. This prevents planned tools from silently becoming discoverable/launchable.

### OSS activation invariant

An active `oss-wrapped` tool requires:

- `ossIntake.status = approved`;
- a stable `adrId`.

A planned OSS candidate may name no backend at all. WS-8 intentionally leaves Better Terminal and Better Paint backend selection as `unselected`.

## Persistence scopes

Ordinary Post-MVP Tool manifests may declare only:

- Workspace;
- User;
- Device;
- Session.

They may not claim Project or Secret persistence ownership.

Project persistence remains Project Lifecycle authority. Secrets remain the credential/security boundary.

## Workspace Tool Persistence service

`ngvge.workspace-tool-persistence@1` provides a bounded Workspace-scoped state service for tools that need small Workspace preferences/state without creating private browser-storage domains.

Durable record:

`ngvge:workspace:tool-state:v1`

Properties:

- stable `ngvge.tool.*` namespace per tool;
- JSON-portable plain data only;
- 64 KiB maximum per tool;
- recursive rejection of secret/token/password/API-key fields;
- recursive rejection of VM/renderer/target/backend identity fields;
- storage failure degrades to runtime memory without changing tool semantics.

This service does not replace Project serialization or credential storage.

## Todo reference tool

Todo is the executable reference implementation for the ecosystem contract.

It proves the following end-to-end path:

Tool Ecosystem Manifest
→ ToolRegistry
→ WindowModel
→ WindowManager
→ Launchpad/Dock
→ managed Workspace window
→ Workspace Tool Persistence service

Todo has `workspace-only` authority. It does not consume Node, Resource, Project Lifecycle, VM, renderer, target, Extension, or Agent mutation authority.

Todo is default-hidden and not default-pinned. Launchpad discovery is inherited from ToolRegistry rather than a second Todo list.

## Planned tools

### Better Terminal

Status: PLANNED
Origin: OSS-wrapped candidate
Backend: unselected

Before activation it requires a concrete OSS Intake ADR. A terminal frontend or backend cannot own WindowId, ToolId, Project identity, Secret storage, or unrestricted host process authority by implication.

### Better Paint / Costume Editor

Status: PLANNED
Origin: OSS-wrapped candidate
Backend: unselected

Before activation it requires a concrete OSS Intake ADR and an explicit Resource authority adapter. Bitmap/vector/pixel implementation libraries remain replaceable backends/components and cannot own ResourceId or serialization identity.

## OSS Intake ADR

`docs/architecture/workspace/OSS-INTAKE-TEMPLATE.md` freezes the required evaluation dimensions:

- semantic responsibility;
- license;
- maintenance;
- bundle/runtime footprint;
- browser/desktop support;
- backend seam;
- persistence and authority;
- migration/escape plan;
- verification.

An OSS project is never allowed to own NGVGE NodeId, ResourceId, ToolId, WindowId, Schema, Authority, Protocol, Project Lifecycle, serialization identity, or compatibility semantics.

## Explicit non-goals

WS-8 does not claim that Better Terminal or Better Paint are implemented.

WS-8 does not:

- mount external Apps directly into `document.body`;
- create a second z-index/window manager;
- expose raw `window.vm` or renderer internals to tools;
- create Project persistence for arbitrary tool state;
- create Secret storage for arbitrary tools;
- select an OSS backend before intake review;
- let an OSS library define NGVGE identity or protocol.

## Stage completion definition

WS-8 is complete when:

1. Tool Ecosystem Manifest v1 is versioned and fail-closed.
2. Active/planned lifecycle is enforced against ToolRegistry.
3. OSS-wrapped activation requires approved ADR identity.
4. Workspace Tool Persistence is scoped, bounded, and secret/backend-safe.
5. Todo proves the complete Workspace Tool integration path.
6. Better Terminal and Better Paint have reserved planned identities without active leakage.
7. OSS Intake ADR template is present.
8. WS-0 through WS-8 cumulative gates pass.
9. containment/conformance/regression gates pass.
10. Unit/Integration/Smoke/TypeScript/ESLint pass.
11. real Todo production entry Webpack passes.
12. real Editor production entry Webpack passes.
