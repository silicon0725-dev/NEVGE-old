# WS-9 Certification | Workspace Tool Capability Host & Reviewed Mutation Foundation

Status: `COMPLETE / CERTIFIED`

Architecture parent: `ARC-0001 | Kernel Independence Contract`

Certified constituent stages:

```text
WS-9A  Capability Schema & Admission Foundation
WS-9B  Workspace Context Service
WS-9C  Context Source Integration & Lifecycle Binding
WS-9D  Context Consumer Admission & Agent Migration
WS-9E  Capability Provider Binding & Diagnostics
WS-9F  Project / Resource Capability Provider Foundation
WS-9G  Project Command Host & Transaction Foundation
WS-9H  Project Transaction Review / Diagnostics Integration
WS-9I  Privileged Tool Mutation Review Policy
```

All are `COMPLETE / VERIFIED` on the certified tree.

## Certified architecture

```text
ToolDefinition / Tool Ecosystem Manifest
        ↓
Capability Descriptor
        ↓
Capability Host Admission + revocable Tool lease
        ↓
Provider Registry
        ↓
scoped portable facade
        ↓
┌──────────────────────────────────────────────┐
│ Context read                                 │
│ Workspace state                             │
│ Project read                                │
│ Project command proposal / reviewed mutation│
│ Resource read                               │
│ Resource command proposal                   │
└──────────────────────────────────────────────┘
        ↓
existing NGVGE Authorities
```

Privileged Project mutation adds:

```text
Proposal
 ↓
Review Service
 ↓
Privileged Mutation Review Policy
 ↓ fresh Tool/lease/Project/revision Evidence
Project Command Host
 ↓
Resource Authority / future admitted domain adapters
```

## Certified invariants

1. Tool Capability admission is explicit and fail-closed.
2. Capability lease lifecycle is revocable and Tool-scoped.
3. Workspace Context is a read-only stable-identity projection, not Authority.
4. Tools consume Context through admitted Provider facades, not raw Context Service.
5. Provider Registry owns binding/availability/diagnostics, not semantic mutation Authority.
6. Canonical Resource identity is `ngvge:resource:*`; Global Asset internal `asset:*` identity stays private/compatibility-side.
7. Project read is portable and does not expose Scratch Project payloads.
8. Project transactions are coordinated by NGVGE-owned Project Command Host.
9. Proposal/Transaction review is read-only and Tool-scoped.
10. `project-command#mutate` requires fresh one-shot Review Evidence.
11. Review Evidence is bound to ToolId, Capability lease, Project Context, subject, operation and Review revision.
12. `resource-command#mutate` is not directly available to Workspace Tools; supported Resource mutations use the reviewed Project transaction path.
13. Project Lifecycle, Resource, Extension, Collaboration and Scratch backend authorities remain separate.
14. No core Tool capability DTO/facade contains Scratch Target, VM, Renderer or raw backend handle.
15. Agent Context consumption remains admitted and its mutation path remains ChangeSet/Review/transaction-based.
16. Terminal and Paint remain planned, not secretly activated by WS-9.

## Certified capability state

```text
context-read#query             READY
workspace-state#query          READY
workspace-state#mutate         READY
project-read#query             READY
project-command#propose        READY
project-command#mutate         READY + fresh Review Evidence required
resource-read#query            READY
resource-command#propose       READY
resource-command#mutate        DIRECT-DENIED for Workspace Tools
```

`READY` means the required core authority/provider is installed; runtime availability may still fail visibly when a required domain authority is absent.

## Certification evidence

Final WS-9I tree:

```text
Full Unit             140 suites / 778 tests PASS
Integration           4 suites / 5 tests PASS
Smoke                 1 / 1 PASS
TypeScript            PASS
ESLint correctness    PASS
Permanent Regression  19 / 19 PASS
Full Editor Webpack   0 errors / 0 warnings PASS
```

Frozen architecture/containment:

```text
ARC-C001.1 baseline   7 / 7 PASS
LSC-G1                19 / 19 machine PASS
LRC-G1                15 / 15 machine PASS
LPL-G1                17 / 17 machine PASS
LEX-G1                19 / 19 machine PASS
COL-0                 15 / 15 machine PASS
```

Workspace focused constituent chain:

```text
WS-8   PASS
WS-9A  PASS
WS-9B  PASS
WS-9C  PASS
WS-9D  PASS
WS-9E  PASS
WS-9F  PASS
WS-9G  PASS
WS-9H  PASS
WS-9I  PASS
```

## Certification boundary

WS-9 certifies the **foundation for high-capability Workspace Tools**. It does not certify a Terminal, IDE, Paint, Browser, Office suite or unrestricted Agent host.

Future Tools must enter through the certified capability/provider/review boundaries. A new Tool is not permitted to bypass the system by importing VM/Renderer/Resource backend/private services directly.

## Final result

```text
WS-9 | Workspace Tool Capability Host & Reviewed Mutation Foundation
COMPLETE / CERTIFIED
```

Recommended next route:

```text
WS-10 | High-Capability Tool Integration
```

WS-10 can now introduce real post-MVP tools one capability domain at a time without reopening Workspace Authority design.
