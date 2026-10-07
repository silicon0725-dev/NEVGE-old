# WS-9H | Project Transaction Review / Diagnostics Integration

Status: `COMPLETE / VERIFIED`

Architecture parent: `ARC-0001 | Kernel Independence Contract`

Baseline: `WS-9G | Project Command Host & Transaction Foundation — COMPLETE / VERIFIED`

## Purpose

WS-9G established a native Project-scoped transaction coordinator, but a high-privilege Workspace Tool still needed a common way to answer these questions before and after mutation:

```text
What will this proposal change?
Is the proposal still valid in the current Project Context?
Which Resources are affected?
Is a command a no-op?
Is the destination Resource folder valid?
Can the committed transaction still be rolled back safely?
Why is commit or rollback unavailable?
```

WS-9H introduces a shared, read-only review and diagnostics projection instead of letting Agent, IDE, Paint, or future Tools invent independent confirmation logic.

## Stable identity

```text
ngvge.workspace-project-transaction-review@1
```

Versioned contracts:

```text
ProjectTransactionReviewSnapshot v1
ProjectTransactionDiagnostic v1
```

The Review service owns no mutation Authority.

## Core relationship

```text
Project Command Proposal / Transaction
              +
Workspace Project Context
              +
Canonical Resource descriptors
              +
WS-9G commit / rollback readiness
              ↓
Project Transaction Review Service
              ↓
portable Tool-scoped review snapshot
```

Mutation remains:

```text
Tool
 ↓
project-command#mutate lease
 ↓
Project Command Provider facade
 ↓
WS-9G Project Command Host
 ↓
Domain Authority
```

The Review service has no `commit()` or `rollback()` entry point.

## Proposal review model

A proposal review contains:

```text
schemaVersion
reviewServiceId
kind = proposal
proposalId
projectId
ToolId
label
proposalState
review state
canCommit
commands[]
impact
diagnostics[]
```

Review states:

```text
ready
blocked
stale
completed
failed
```

### Command impact

WS-9H v1 currently reviews the reversible Project Transaction v1 commands from WS-9G:

```text
resource.rename
resource.move
```

Each command review contains portable data only:

```text
commandIndex
kind
domain = resource.metadata
ResourceId
reversible
destructive
changed
before
after
diagnostics[]
```

No internal Global Asset `asset:*` identity, Scratch asset object, VM, renderer, backend handle, costume object, or sound object is returned.

## Sequential shadow preview

Proposal preview is order-sensitive.

For example:

```text
1. rename Resource A → Hero Prime
2. move Resource A → folder:actors
3. rename Resource A → Hero Final
```

WS-9H does not preview all three commands against the same initial descriptor.

Instead it maintains a local, non-authoritative shadow state:

```text
Resource Authority snapshot
      ↓
command 1 preview
      ↓ local shadow only
command 2 preview
      ↓ local shadow only
command 3 preview
```

The real Resource database is not mutated by review.

## Proposal diagnostics

Representative diagnostics include:

```text
NGVGE_WORKSPACE_PROJECT_REVIEW_NO_OP
NGVGE_WORKSPACE_PROJECT_REVIEW_RESOURCE_NOT_FOUND
NGVGE_WORKSPACE_PROJECT_REVIEW_FOLDER_NOT_FOUND
NGVGE_WORKSPACE_PROJECT_REVIEW_RESOURCE_AUTHORITY_UNAVAILABLE
NGVGE_WORKSPACE_PROJECT_REVIEW_STALE_PROJECT_CONTEXT
```

Diagnostics carry:

```text
schemaVersion
code
severity
message
blocking
subject
```

Severity is presentation metadata:

```text
info
warning
error
```

The boolean `blocking` is the semantic decision input.

## No-op semantics

A command that is valid but would not change current Resource metadata produces:

```text
NGVGE_WORKSPACE_PROJECT_REVIEW_NO_OP
severity = info
blocking = false
```

It does not silently disappear from the command list.

This is important for future AI-generated ChangeSets because users should be able to see redundant proposed actions without those actions being misrepresented as errors.

## Blocking impact

A proposal is not review-ready when review detects a blocking condition such as:

```text
missing Resource
missing destination folder
stale Project Context
Resource authority unavailable
WS-9G commit precondition unavailable
```

`canCommit` is therefore derived from both:

```text
review impact diagnostics
+
WS-9G Host commit readiness
```

Review does not replace Host validation. The Host validates again at commit time.

## Host diagnostics

WS-9H adds two read-only semantic diagnostics to the WS-9G Project Command Host:

```text
getCommitAvailability(proposalId, {ToolId})
getRollbackAvailability(transactionId, {ToolId})
```

They mirror transaction preconditions without executing mutation.

### Commit readiness

Commit readiness checks:

```text
Host active
proposal exists
Tool owner matches
proposal state = proposed
active Project Context exists
proposal Project Context still matches
Resource transaction adapter available
```

### Rollback readiness

Rollback readiness checks:

```text
Host active
transaction exists
Tool owner matches
transaction state = committed
active Project Context still matches
Resource transaction adapter available
exact transaction history label remains top undo entry
```

Therefore the WS-9G latest-history rollback invariant becomes visible before a rollback request.

## Transaction review

Transaction review contains:

```text
transactionId
proposalId
projectId
ToolId
transactionState
review state
appliedCount
commandCount
canRollback
rollbackAvailability
diagnostics[]
```

Representative diagnostics include:

```text
NGVGE_WORKSPACE_PROJECT_REVIEW_TRANSACTION_FAILED
NGVGE_WORKSPACE_PROJECT_REVIEW_ROLLBACK_FAILED
NGVGE_WORKSPACE_PROJECT_TRANSACTION_ROLLBACK_ORDER_CONFLICT
NGVGE_WORKSPACE_PROJECT_REVIEW_STALE_PROJECT_CONTEXT
```

A newer Resource history entry does not trigger a destructive probe. Review only reports:

```text
canRollback = false
```

with the exact WS-9G rollback-order conflict code.

## Tool ownership

Review is Tool-scoped.

```text
Tool A proposal
→ Tool A may review
→ Tool B review attempt fails closed
```

The same rule applies to transaction review.

The Review service delegates proposal/transaction lookup to the WS-9G Host using the admitted ToolId, so it does not create a second metadata visibility policy.

## Provider integration

Project Command capability facades now expose:

```text
project-command#propose
├── createProposal(...)
├── getProposal(...)
├── reviewProposal(...)
└── getSupportedCommands()

project-command#mutate
├── execute(...)
├── rollback(...)
├── getTransaction(...)
├── reviewTransaction(...)
└── getSupportedCommands()
```

The actual mutation methods still bind directly to the WS-9G Project Command Host.

## Review service is required by Project Command Provider

A native Project Command Host without the shared Review/Diagnostics service no longer qualifies as a complete production Project Command Provider surface.

Missing review service is fail-visible:

```text
NGVGE_WORKSPACE_PROJECT_TRANSACTION_REVIEW_UNAVAILABLE
```

This prevents future Tool integrations from silently creating a Project mutation path that has no common diagnostics contract.

This does not mean a Tool is technically forced to display a specific modal before every mutation. WS-9H establishes the shared semantic review contract; stronger reviewed-mutation policy can be added later without changing transaction identity.

## Reactive diagnostics

The Review service subscribes to:

```text
Project Command Host events
Workspace Context changes
Resource database/history changes
```

This allows a future Review UI to invalidate and refresh a previously displayed snapshot when its underlying semantic facts change.

The subscriptions are observation-only.

## Authority boundaries

WS-9H preserves:

```text
Project Lifecycle Authority
Resource writer Authority
Project Command transaction Authority
Workspace Context projection ownership
Capability Admission Authority
Provider binding lifecycle
```

The Review service does not register an Authority writer.

It does not expose:

```text
VM
Scratch Target
Renderer
Scratch project JSON
SB3 payload
raw Resource object
asset:* database identity
backend handle
filesystem
process
network
credential
```

## Production bootstrap

The production GUI constructs one Review service after the WS-9G Project Command Host:

```text
WorkspaceContextService
        +
WorkspaceProjectCommandHost
        +
canonical Resource database getter
        ↓
WorkspaceProjectTransactionReviewService
        ↓
Core Capability Provider Registry
```

The Provider Registry receives the Review service explicitly. It is not discovered from a global singleton or service locator.

## Explicit non-goals

WS-9H does not:

- create a new Review/Changes Tool window;
- require a particular visual modal or dialog;
- migrate Agent ChangeSet execution to Project Command Host;
- broaden Agent project/resource permissions;
- expose irreversible Resource delete through Project Transaction v1;
- provide cross-domain atomicity;
- expose Resource binary replacement;
- create persistent canonical ProjectId;
- expose Scratch project JSON/SB3 as Project authority;
- add filesystem/process/network/browser/credential capabilities;
- make Review service a transaction writer.

## Definition of Done

- [x] stable `ngvge.workspace-project-transaction-review@1` identity;
- [x] versioned review and diagnostic schemas;
- [x] proposal review is Tool-scoped;
- [x] transaction review is Tool-scoped;
- [x] proposal impact uses canonical ResourceId;
- [x] sequential commands preview against local shadow state;
- [x] review does not mutate Resource authority;
- [x] no-op command is explicit and non-blocking;
- [x] missing Resource/folder is blocking and fail-visible;
- [x] stale Project Context is blocking and fail-visible;
- [x] Host exposes read-only commit readiness;
- [x] Host exposes read-only rollback readiness;
- [x] rollback-order conflict is visible before mutation;
- [x] failed/rollback-failed transactions have portable diagnostics;
- [x] proposal capability facade exposes review;
- [x] mutate capability facade exposes transaction review;
- [x] Project Command Provider requires Review service;
- [x] production bootstrap wires one shared Review service;
- [x] Review service owns no mutation Authority;
- [x] no raw backend object enters review DTO;
- [x] cumulative Workspace/Containment/Regression gates remain protected.

## Resume point

WS-9H makes Project transaction review a shared semantic surface rather than Tool-specific UI logic.

The next natural stage is a final WS-9 readiness/certification stage that can decide whether reviewed mutation should become a mandatory policy for privileged Tool consumers before the first large Post-MVP production Tool is activated.
