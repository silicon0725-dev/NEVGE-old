# 0008.9.4.1.2 Module Completion Reentrancy and Observer Failure Closure

Status: Implemented / Module Completion Governance Frozen  
Scene System: `0.8.9.4.1.2`

## Frozen boundary

This task freezes three runtime-only Module Framework semantics:

1. `completeEnable` may synchronously request additional modules without recursively flushing the completion queue.
2. Module, Capability Registry, Module Registry and Module Data Store subscribers are observers; observer exceptions are diagnostic and cannot interrupt semantic operations.
3. Capabilities published by a failing `initialize` hook are revoked before the module enters the failed state.

It does not introduce a general transaction manager and does not compensate arbitrary external JavaScript side effects.

## Completion queue ownership

The Module Manager exclusively owns completion queue execution. While the queue is being flushed:

- nested `enableModule()` calls may execute registration hooks and append pending completions;
- nested batches cannot recursively invoke the completion runner;
- the current `completeEnable` commits before any appended completion observes it;
- pending entries complete only after required dependencies are operational;
- a queue that cannot make progress fails with `MODULE_ENABLE_COMPLETION_DEADLOCK` and rolls back all blocked entries.

The queue is processed as a live, dependency-aware loop rather than a fixed snapshot.

## Observer error policy

Observer delivery uses a shared isolation policy:

```text
semantic mutation commits
→ observers are notified independently
→ each observer failure is recorded
→ remaining observers continue
→ the semantic caller receives its normal result
```

The policy applies to:

- Module Manager events;
- Capability Registry events;
- Module Registry events;
- Module Data Store events and its manager-facing change callback.

Each source exposes a Runtime-only observer error snapshot containing the count and last error. Reporting callbacks are themselves isolated.

## Initialize rollback

A module may publish capabilities during `initialize`. If initialization throws:

```text
revoke module capabilities
→ keep initialized = false
→ set enableCompletion = failed
→ enter error state
→ rethrow original initialize error
```

A later retry starts without stale provider records and reruns `initialize` deterministically.

## Native Kernel equivalence

A Native Kernel implementation must preserve:

- non-recursive completion queue ownership;
- deterministic dependency ordering;
- observer failure isolation;
- initialize capability rollback;
- stable error codes and visible module states.

JavaScript callbacks and Sets are implementation details, not contract semantics.

## Final status

```text
Completion Queue Reentrancy:       Frozen
Deterministic Pending Append:       Frozen
Observer Failure Isolation:        Frozen
Observer Diagnostics:              Frozen
Initialize Capability Rollback:    Frozen
Registration → Restore Governance: Frozen
Component Schema Contract:         Frozen
```
