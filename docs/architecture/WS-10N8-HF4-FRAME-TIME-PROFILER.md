# WS-10N8-HF4｜Frame-Time Profiler & Root-Cause Isolation

Status: IMPLEMENTED / MACHINE VERIFIED / BROWSER CAPTURE REQUIRED

## Trigger

HF3 added independent Render / Physics / Debug quality profiles. Real browser evidence then showed that the lowest practical combination still dropped frames. Therefore quality level alone is not accepted as the root cause and N8 remains unfrozen.

HF4 stops speculative tuning and introduces an explicit frame-time diagnostic path.

## Diagnostic categories

The profiler measures the following execution-only categories while a capture is active:

```text
Frame interval (requestAnimationFrame)
├─ Scratch VM thread execution
├─ Scratch Renderer draw()
├─ Physics2D fixed steps
├─ TileMap passive render
├─ TileMap authoring render
├─ Collider debug preparation
├─ Collider debug Canvas draw
└─ React Stage overlays render
```

It also records visible/editor tile counts, debug collider counts, optional browser Long Task observations, frame P50/P95/P99, average FPS, calls per frame and an approximate untracked frame budget.

## Probe policy

The profiler is **disabled by default**. When disabled:

- no RAF sampling loop is active;
- Scratch renderer `draw()` is not wrapped;
- Scratch Runtime BEFORE_EXECUTE / AFTER_EXECUTE listeners are not installed;
- subsystem `measure()` calls immediately execute the callback without reading a clock.

Starting a capture installs temporary probes. Stopping restores the original Scratch renderer function and removes runtime listeners.

The profiler is diagnostic/editor execution state only. It does not mutate `.ne`, Transform2D, Collider2D, TileMapLayer2D, RigidBody2D, PhysicsMaterial2D, ResourceId or backend handles.

## Stage UI

Stage exposes a compact `Profiler` panel with:

- Start / Stop;
- Capture 5s;
- Reset;
- Copy report;
- average FPS and frame P95;
- long-frame percentage;
- ranked subsystem rows with average/P95/calls-per-frame;
- top-hotspot indication.

The panel refresh is throttled relative to sampled frames so diagnostics do not intentionally become a new 60 Hz React workload.

## Evidence rule

Machine tests can verify probe lifecycle, aggregation and subsystem wiring, but cannot identify the user's real browser hotspot. N8-HF4 therefore cannot Freeze from machine evidence alone.

The next browser evidence must come from a capture of the actual lagging scene. Optimization after HF4 should target the measured dominant category rather than another guessed subsystem.
