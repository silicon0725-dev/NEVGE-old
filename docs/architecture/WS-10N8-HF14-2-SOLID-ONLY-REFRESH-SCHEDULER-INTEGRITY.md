# WS-10N8-HF14.2｜Solid-Only Collider Refresh Fast Path & Scheduler Attribution Integrity

Status: IMPLEMENTED / MACHINE VERIFIED / BROWSER RE-TEST REQUIRED

## Problem

HF14.1 proved the native Rapier primitive path is live and restored green-flag execution. Browser captures then showed a stable shape-dependent runtime gap: Rectangle reached 60 FPS while Circle and Capsule remained substantially slower. The capture still attributed the dominant long callback only to the outer Runtime Phase Scheduler, while scheduler sub-phase categories were absent.

Separately, every dynamic Transform mutation still caused Collider2D `refreshOverlaps()` to build all native collider world geometry even in scenes with no Area2D/sensor semantics. For Circle/Capsule this recreated the 32/34-point presentation/fallback polygons after Rapier had already completed native primitive collision work.

## Decision

HF14.2 keeps HF14 Shape-Aware Collision unchanged and adds two contained changes.

### 1. Solid-only refresh fast path

Before materializing native collider world geometry, Collider2D Runtime performs a lightweight sensor-status pass. If all of the following are true:

- no active native sensor Collider2D exists;
- every external provider explicitly declares `containsSensors === false`;
- no previous Area overlap state remains to emit exits;

then the refresh only invalidates geometry/debug revisions and emits `collision:refresh`. It does not build Circle/Capsule world polygons or run Area overlap geometry.

This does not change collision, physics, serialization, or Area semantics. If any Area/sensor may exist, the original overlap path is used unchanged.

### 2. Scheduler attribution integrity

Runtime Phase Scheduler instrumentation is reasserted as an explicit HF14.2 source generation. The real rAF callback records:

- `runtimeSchedulerInstrumentationV2`
- `runtimeSchedulerTicks`
- `runtimeSchedulerTickMs`
- `runtimeSchedulerPendingOneShotTasks`
- `runtimeSchedulerRegisteredFrameTasks`

Semantic per-task categories remain:

- `runtime-scheduler-one-shot:<taskId>`
- `runtime-scheduler-frame:<taskId>`

A Production capture therefore has positive evidence that the instrumented scheduler source is actually executing, rather than relying only on the frame-profiler bundle version.

## Non-goals

HF14.2 does not:

- reduce Circle/Capsule tessellation;
- restore HF12 CharacterController broad-phase changes;
- replace Rapier Ball/Cuboid/Capsule mapping;
- alter CharacterController movement semantics;
- suppress Area enter/exit events;
- change `.ne` persistent data.

## Architecture boundary

NGVGE remains authoritative for Collider2D semantics, Area events, Transform authority, lifecycle, and persistence. Rapier remains a replaceable geometry/physics backend. The solid-only fast path removes redundant semantic-layer work only when there are no Area semantics to evaluate.
