# WS-10N8-HF5｜Runtime Phase Scheduler & Scratch Projection Decoupling

Status: IMPLEMENTED / MACHINE VERIFIED / BROWSER RE-TEST REQUIRED

## Trigger

HF4 browser capture from the real lagging scene reported:

```text
Average FPS          9.793
Average frame       102.113 ms
Frame P95           433.4 ms
Frame P99           549.9 ms
Long frames          75.723%

Scratch VM Event Cycle
  P50                 1.2 ms
  P95               346.2 ms
  P99               381.5 ms
  Max               638.9 ms

Scratch Renderer P95  0 ms
Collision Canvas P95  0.1 ms
Physics2D              0 ms in the capture
```

The very low P50 combined with several-hundred-millisecond P95/P99 is a burst-stall pattern, not a steady per-frame solver cost.

HF4's `scratch-vm` probe measured from `BEFORE_EXECUTE` to its own `AFTER_EXECUTE` listener. Because EventEmitter listeners run synchronously in registration order, synchronous NGVGE `AFTER_EXECUTE` listeners registered before the profiler were included in that category. Therefore the capture did **not** prove that Scratch's sequencer itself consumed 346 ms; it proved that the Scratch VM event cycle plus synchronous listeners did.

## Root cause found in the N8-HF4 source

Three NGVGE paths were coupled to Scratch execution/update events:

1. Scratch Transform Projection subscribed to `AFTER_EXECUTE`, `TARGETS_UPDATE`, and public `targetsUpdate`.
2. Scratch Sprite Binding Lifecycle scheduled a full binding reconciliation from target-update signals even when only x/y/direction/size changed.
3. Physics2D advanced from synchronous Scratch `AFTER_EXECUTE`.

This produced a high-risk chain:

```text
Scratch execute
  ↓
AFTER_EXECUTE
  ↓
full Scratch → NGVGE scene Transform projection
  ↓
Runtime Transform notifications
  ↓
Collider / Tile / Stage subscribers
  ↓
React work
```

A target update could additionally produce both runtime `TARGETS_UPDATE` and public VM `targetsUpdate`, duplicating signals in the same browser turn.

## HF5 scheduler model

HF5 introduces an execution-only `Runtime Phase Scheduler`:

```text
Frame phase order

50   Scratch Binding Lifecycle check
100  Scratch → NGVGE Transform Projection
200  Physics2D fixed-step accumulator
```

The scheduler:

- coalesces one-shot work by stable phase id;
- uses `requestAnimationFrame` when available;
- isolates task exceptions so one phase cannot suppress later phases;
- supports independent recurring frame phases;
- is execution state only and is never serialized.

## Scratch Transform Projection

`AFTER_EXECUTE → projectEntireScene()` is removed.

Target update listeners now do only:

```text
TARGETS_UPDATE / targetsUpdate
        ↓
schedule(scratch-transform-projection)
        ↓
return to Scratch
```

Duplicate update signals before the next scheduler tick collapse into one projection.

Projection keeps a scene-scoped topology cache:

```text
NodeId
Target runtime ref
Binding record
Transform component presence
Last projected Transform shadow
```

At flush time every bound target may be checked, but unchanged transforms are rejected by the shadow cache **before** Runtime Transform mutation and subscriber notification. The expensive target-index/binding topology reconstruction only occurs after topology invalidation.

Explicit `projectScene`, bootstrap, save/commit, and node projection remain available as authority-boundary operations. HF5 changes automatic high-frequency scheduling, not Transform2D semantics.

## Scratch Binding Lifecycle

Binding lifecycle target-update handling is split from transform updates.

A target-update signal is first coalesced into the scheduler. The scheduled lifecycle phase computes a lightweight topology signature from original Scratch targets:

```text
serialized index + target runtime id + target name
```

If the signature is unchanged, full reconciliation is skipped. Therefore ordinary movement no longer causes persistent binding merge/index/reconciliation work.

Create/delete/recreate/rename changes still alter the signature and retain the existing reconciliation path.

## Physics2D

Physics is no longer registered as a Scratch `AFTER_EXECUTE` listener.

On project start it registers a recurring `physics2d` frame phase with the Runtime Phase Scheduler. The existing fixed-step accumulator, quality profile, frame-delta clamp, and `maxCatchUpSteps` remain in force.

If backlog exceeds the permitted catch-up budget it is discarded and counted instead of creating a spiral of death.

This preserves:

```text
Physics fixed timestep
≠ Scratch VM step cadence
≠ editor render authority
```

## Profiler correction

HF5 adds separate categories:

```text
Scratch VM Event Cycle
Scratch Binding Lifecycle
Scratch → NGVGE Projection
Physics2D
```

The old category id `scratch-vm` is retained for report compatibility, but its label is corrected to `Scratch VM Event Cycle`. After HF5 the two major NGVGE synchronous paths are no longer inside that event cycle, so a new capture can determine whether Scratch's own execution is still a hotspot.

## Authority / persistence boundary

HF5 does not change:

- Transform2D schema or writer authority;
- Collider2D / TileMapLayer2D / RigidBody2D persistence;
- Scratch block semantics;
- `.ne` data;
- NodeId / ColliderId / RigidBodyId identity;
- Rapier backend handle isolation.

The scheduler, topology signature, target references and Transform shadows are disposable execution caches only.
