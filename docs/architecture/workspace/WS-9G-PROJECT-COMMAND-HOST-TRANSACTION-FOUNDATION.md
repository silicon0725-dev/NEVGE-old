# WS-9G | Project Command Host & Transaction Foundation

Status: COMPLETE / VERIFIED  
Authority: ARC-0001  
Baseline: WS-9F COMPLETE / VERIFIED

## Purpose

WS-9F deliberately left `project-command#propose` and `project-command#mutate` unavailable because no NGVGE-owned Project Command Host existed. Exposing Scratch `vm.loadProject()`, Scratch JSON, or a backend payload as a Workspace mutation API would have promoted compatibility/backend identity into Project semantics.

WS-9G closes that gap by introducing a native Project-scoped transaction coordinator:

```text
Tool Capability Admission
        ↓
project-command#propose / #mutate
        ↓
Capability Provider Registry
        ↓
Workspace Project Command Host
        ↓
versioned proposal + transaction semantics
        ↓
registered semantic transaction adapter
        ↓
existing domain Authority
```

The Host owns **Project command transaction semantics**, not every underlying Project domain. Existing Resource authority remains the Resource writer.

## Stable identities

```text
Host
ngvge.workspace-project-command-host@1

Authority
ngvge.project.command.transaction
→ authority:ngvge.workspace-project-command-host

Project Command schema v1
Project Command Proposal schema v1
Project Transaction schema v1
```

The Authority domain is intentionally scoped to transaction coordination. It does not claim `ngvge.project.lifecycle`, Resource storage, Node runtime state, Scene state, or Scratch VM ownership.

## Project transaction vocabulary v1

The first production adapter uses the canonical ResourceId seam established by WS-9F.

Supported Project transaction commands:

```text
resource.rename
resource.move
```

Both commands are:

- addressed by canonical `ngvge:resource:*` identity;
- portable plain-data DTOs;
- reversible inside the current Resource transaction boundary;
- executed through existing Resource authority methods.

`resource.delete` is intentionally **not** part of Project Transaction v1. Direct Resource capability may still expose bounded delete according to WS-9F, but the Project transaction coordinator does not advertise an irreversible command until a stronger reversible content/state contract exists.

## Proposal contract

A Tool does not send arbitrary mutation directly to the Host. It creates a proposal first:

```text
schemaVersion
label
commands[]
```

The Host records:

```text
proposalId
projectId
ToolId owner
normalized commands
proposal state
```

The current `projectId` is the WS-9C session Project Context identity. WS-9G still does not claim it is the future Persistent Project Model canonical ProjectId.

### Ownership

A proposal can only be committed by the admitted Tool that created it.

```text
Tool A creates proposal
        ↓
Tool B commit attempt
        ↓
NGVGE_WORKSPACE_PROJECT_COMMAND_PROPOSAL_OWNER_MISMATCH
```

Proposal and transaction metadata queries are scoped by the same Tool owner. A Tool cannot use a guessed proposal/transaction ID to inspect another Tool's transaction metadata through the capability facade.

```text
Tool B getProposal/getTransaction for Tool A identity
        ↓
owner check
        ↓
fail closed
```

### Project-context binding

A proposal is bound to the Project Context active at proposal time.

```text
Project Context g7
→ create proposal
→ switch to g8
→ commit old proposal
→ fail closed
```

This prevents a delayed Tool action from mutating a different loaded Project.

## Transaction execution

The Host serializes transaction commits through its own operation queue.

For Resource metadata v1, the transaction is then executed inside one Global Asset Database `perform(...)` operation:

```text
Project transaction
        ↓
Resource transaction adapter
        ↓
database.perform(one history operation)
        ↓
command 1
command 2
...
```

The Project Host does not receive Resource writer ownership. It coordinates a command sequence while the Resource database remains the mutation implementation/authority seam.

## Failure compensation

Before each reversible command executes, the Resource adapter captures a portable inverse command from current Resource state.

If a later command fails:

```text
command A committed in transaction callback
command B fails
        ↓
reverse inverse(A)
        ↓
leave perform(...) with error
```

Compensation occurs before leaving the Resource transaction boundary. The failed `perform` therefore does not publish a committed history entry for a partially-applied transaction.

Failure results are explicit:

```text
failed
rollback-failed
```

The Host never silently reports a failed partial transaction as committed.

## Explicit rollback after commit

A successfully committed Project transaction becomes one Resource history entry with a unique transaction label.

Explicit rollback is allowed only while that transaction remains the latest Resource history entry:

```text
Project Transaction T1
        ↓
latest Resource history entry = T1
        ↓
rollback allowed
```

If another Resource operation occurs after T1:

```text
T1
External Resource operation
        ↓
rollback(T1)
        ↓
NGVGE_WORKSPACE_PROJECT_TRANSACTION_ROLLBACK_ORDER_CONFLICT
```

This is intentionally conservative. The Host will not call generic `undo()` when it cannot prove that the top history entry belongs to the requested transaction.

## Capability Provider integration

WS-9G replaces the WS-9F production `provider-unavailable` state when the native Host is installed.

Production path:

```text
project-command#propose
→ Project Command Proposal facade
→ Host.createProposal(...)

project-command#mutate
→ Project Command Mutate facade
→ Host.commit(...)
→ Host.rollback(...)
```

The facade is Tool-scoped. Capability lease revocation still invalidates the Provider binding through the WS-9E lifecycle.

If the native Host is absent, the Provider retains the WS-9F fail-closed diagnostic:

```text
NGVGE_WORKSPACE_PROJECT_COMMAND_AUTHORITY_NOT_READY
```

If the Host exists but its semantic transaction adapter is unavailable:

```text
NGVGE_WORKSPACE_PROJECT_COMMAND_TRANSACTION_ADAPTER_UNAVAILABLE
```

Provider availability therefore remains truthful rather than assuming that Host construction implies working backend/domain authority.

## Production bootstrap

The GUI now constructs exactly one Workspace Project Command Host and injects it into the existing Capability Provider Registry.

The Host receives:

```text
WorkspaceContextService
canonical Resource database getter
```

The getter remains a seam; the Host does not own the Resource database and never exposes it to Tools.

## Raw authority exclusion

Project Command DTO validation rejects fields such as:

```text
vm
rawVM
renderer
ScratchTarget
target
backend
backendHandle
asset
raw
```

The Host source also contains no `loadProject()`, Scratch project serialization API, process spawning, or filesystem API.

This is a permanent boundary, not a temporary UI convention.

## Explicit non-goals

WS-9G does not:

- expose `vm.loadProject()` as a Project command;
- expose Scratch project JSON or SB3 payloads to Workspace Tools;
- create a persistent canonical ProjectId;
- transfer Resource writer authority into Workspace;
- claim atomic transactions across unrelated Authority domains;
- expose Resource binary replacement;
- include irreversible Resource delete in Project Transaction v1;
- migrate Agent ChangeSet/AgentTransactionHost to Project Command Host;
- activate Paint, Terminal, Browser, IDE, filesystem, process, network, or credential capabilities;
- turn Provider Registry into a Project Service Locator.

## Definition of Done

- [x] native `ngvge.workspace-project-command-host@1` exists;
- [x] Project command transaction Authority is explicit and single-writer;
- [x] Project command/proposal/transaction contracts are versioned;
- [x] Project transaction v1 exposes only reversible Resource rename/move commands;
- [x] raw backend identity/objects are rejected from command DTOs;
- [x] proposals are owned by the creating admitted Tool;
- [x] proposals are bound to the active Project Context;
- [x] transaction commit is serialized;
- [x] Resource v1 transaction executes as one Resource history operation;
- [x] failed partial commit compensates prior mutation before leaving transaction boundary;
- [x] committed rollback requires exact latest history ownership;
- [x] rollback-order conflict fails visibly;
- [x] `project-command#propose` binds to native proposal facade;
- [x] `project-command#mutate` binds to native commit/rollback facade;
- [x] missing Host remains fail-closed;
- [x] dynamic adapter unavailability remains fail-visible;
- [x] production GUI installs Project Command Host before Provider binding;
- [x] no Scratch project payload shortcut is introduced;
- [x] cumulative Workspace/Containment/Regression gates remain protected.

## Resume point

WS-9G closes the last WS-9F Provider gap without making Scratch project payloads authoritative.

The next stage should build on the transaction foundation rather than bypass it. A natural continuation is:

```text
WS-9H | Project Transaction Review / Diagnostics Integration
```

That stage can expose portable proposal/transaction diagnostics and decide how reviewed mutation consumers such as Agent should bridge into the unified Project transaction path without weakening the existing ChangeSet approval boundary.
