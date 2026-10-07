# WS-9I | Privileged Tool Mutation Review Policy & WS-9 Certification

Status: `COMPLETE / VERIFIED`

Architecture parent: `ARC-0001 | Kernel Independence Contract`

Baseline: `WS-9H COMPLETE / VERIFIED`

Stable identity:

```text
ngvge.workspace-privileged-mutation-review-policy@1
```

## 1. Purpose

WS-9H made Project transaction review and diagnostics available. WS-9I changes the security model from **review is available** to **privileged mutation is admitted only with valid review evidence**.

The policy is intentionally separate from both the Project Command Host and the Review Service:

```text
Project Transaction Review Service
        ↓ read-only review
Privileged Mutation Review Policy
        ↓ issue / validate one-shot evidence
Capability Provider Registry
        ↓ scoped facade
Workspace Tool
        ↓
Project Command Host
        ↓ actual mutation authority
```

The policy never commits or rolls back a transaction itself.

## 2. Surface policy v1

WS-9I classifies mutation capability surfaces rather than forcing every mutation through the same UX.

```text
project-command#mutate
→ review-required

resource-command#mutate
→ direct-denied

other capability surfaces
→ not-required unless explicitly classified later
```

### Project mutation

`project-command#mutate` is available only when the shared Review Policy is installed. Commit and rollback require fresh Review Evidence.

### Direct Resource mutation

`resource-command#mutate` is deliberately unavailable to Workspace Tools. A Tool must use a reviewed Project transaction for Resource operations supported by the Project Command Host.

This prevents a Tool from bypassing Project review by binding the lower-level Resource mutation facade directly through the core Provider Registry.

This does **not** transfer Resource writer authority into the Project Command Host or Review Policy. Resource mutation is still executed by the existing Resource authority under the WS-9G transaction coordinator.

## 3. Review Evidence v1

A Review Evidence record binds:

```text
evidenceId
operation              commit | rollback
subjectId              proposalId | transactionId
projectId
ToolId
capabilityLeaseId
reviewServiceId
reviewRevision
state
```

Evidence states:

```text
active
consumed
stale
revoked
```

### Evidence invariants

Review Evidence is:

- Tool-owned;
- Capability-lease-owned;
- Project-context-bound;
- subject-bound;
- operation-bound;
- Review-revision-bound;
- one-shot;
- revocable.

A second lease owned by the same Tool cannot consume evidence issued for the first lease.

## 4. Freshness model

WS-9I v1 intentionally uses a conservative freshness rule:

```text
Review Evidence captures reviewRevision N
        ↓
any Project / Resource / transaction-review source change
        ↓
Review Service revision becomes N+1
        ↓
old evidence is stale at mutation time
```

The evidence is validated lazily immediately before mutation. The policy re-runs the relevant Proposal/Transaction Review and verifies that:

- Review Service revision still matches;
- Project Context still matches;
- the Proposal can still commit, or Transaction can still rollback;
- the Tool and Capability lease still match;
- the evidence is still active.

This model is intentionally conservative for v1. A future stage may introduce domain-specific review dependency revisions if there is a measured need to reduce unnecessary re-review, but it must not weaken freshness guarantees.

## 5. Lease and lifecycle binding

Capability lease revocation immediately revokes all active Review Evidence issued against that lease.

```text
Tool unload / unregister / capability revoke
        ↓
Capability lease revoked
        ↓
Review Evidence revoked
        ↓
old mutate facade cannot commit or rollback with that evidence
```

Disposing the Review Policy revokes all remaining active evidence.

## 6. Provider integration

`project-command#mutate` has an additional Provider availability requirement:

```text
Project Command Host
+
Project Transaction Review Service
+
Privileged Mutation Review Policy
        ↓
READY
```

Missing policy is fail-visible:

```text
NGVGE_WORKSPACE_PRIVILEGED_MUTATION_REVIEW_POLICY_UNAVAILABLE
```

Direct Resource mutation is fail-visible:

```text
NGVGE_WORKSPACE_RESOURCE_DIRECT_MUTATION_REVIEW_REQUIRED
```

No fallback to raw Resource mutation, Scratch VM, renderer state, or backend handles is permitted.

## 7. Tool flow

Commit:

```text
createProposal()
        ↓
prepareMutationReview()
        ↓
Review Snapshot + fresh Evidence
        ↓
user/tool review surface
        ↓
execute(proposalId, {reviewEvidence})
        ↓
Policy consumes Evidence
        ↓
Project Command Host.commit()
```

Rollback:

```text
reviewTransaction()
        ↓
prepareRollbackReview()
        ↓
Review Snapshot + fresh Evidence
        ↓
rollback(transactionId, {reviewEvidence})
        ↓
Policy consumes Evidence
        ↓
Project Command Host.rollback()
```

Evidence is consumed before the corresponding Host mutation begins, so it cannot be replayed after a successful or failed mutation attempt.

## 8. Authority boundary

WS-9I owns **mutation review admission policy only**.

It does not own:

```text
Project Lifecycle
Project serialization
Project transaction mutation
Resource storage/mutation
Scene state
Node Runtime
Workspace Context
Extension lifecycle
Collaboration state
Scratch VM / Renderer
filesystem / process / network / credentials
```

Authority remains:

```text
Review diagnostics      → WS-9H Review Service (read-only)
Review admission        → WS-9I Review Policy
Project transaction     → WS-9G Project Command Host
Resource mutation       → existing Resource Authority
Project lifecycle       → Project Lifecycle Host
Capability admission    → WS-9A Capability Host
Provider binding        → WS-9E Provider Registry
```

## 9. WS-9I Definition of Done

- [x] Stable Privileged Mutation Review Policy identity v1.
- [x] Project mutation is review-required.
- [x] Direct Resource mutation is denied through the core Tool Provider path.
- [x] Review Evidence is Tool-bound.
- [x] Review Evidence is Capability-lease-bound.
- [x] Review Evidence is Project-bound.
- [x] Review Evidence is operation/subject-bound.
- [x] Review Evidence is Review-revision-bound.
- [x] Evidence is one-shot.
- [x] Capability revoke invalidates evidence.
- [x] Project/Resource/review changes make evidence stale.
- [x] Commit requires evidence.
- [x] Rollback requires new evidence.
- [x] Policy is wired before Provider Registry in production bootstrap.
- [x] Policy owns no Project/Resource mutation authority.
- [x] No raw VM/Renderer/Scratch Target/backend handle exposure.
- [x] WS-8 through WS-9I focused chain passes.
- [x] Frozen architecture/containment gates pass.
- [x] Full Unit / Integration / Smoke / TypeScript / ESLint pass.
- [x] Real Editor production Webpack passes with 0 errors / 0 warnings.

## 10. Stage conclusion

```text
WS-9I | Privileged Tool Mutation Review Policy & WS-9 Certification
COMPLETE / VERIFIED
```

WS-9I closes the capability foundation by making privileged Tool mutation reviewable, fresh, scoped, revocable, and fail-closed before large post-MVP tools are admitted.
