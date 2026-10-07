# WS-10N8-HF3｜Performance Quality Profiles

Status: IMPLEMENTED / MACHINE VERIFIED / BROWSER EVIDENCE INSUFFICIENT / SUPERSEDED FOR ROOT-CAUSE DIAGNOSIS BY HF4

## Purpose

Provide explicit execution-quality controls after HF1/HF2 showed that large TileMap + Collision Debug workloads can exceed editor frame budgets even after structural hot-path optimization.

Browser validation subsequently showed that the lowest Render / Physics / Debug quality combination still produced visible frame drops. HF3 remains a valid execution-quality control, but it did not isolate the dominant hotspot; root-cause diagnosis therefore proceeds in HF4.

HF3 does **not** change persistent gameplay geometry, stable identity, Resource ownership, or backend authority. Quality is an editor/runtime execution policy.

## Independent quality axes

### Render Quality

| Level | Canvas scale | Debug max refresh | TileMap max refresh |
|---|---:|---:|---:|
| Performance | 50% | 20 Hz | 20 Hz |
| Balanced (default) | 75% | 30 Hz | 30 Hz |
| Quality | 100% | 60 Hz | 60 Hz |

Applies to NGVGE-owned Stage canvases: TileMap passive renderer, TileMap authoring canvas, and bulk Collision Debug canvas. The selected Collider authoring SVG remains vector/interactive. Scratch renderer semantic output is not redefined by this setting.

Presentation/editor-preview mutations may request an immediate flush so direct manipulation stays responsive even when background debug/tile refresh is throttled.

### Physics Quality

| Level | Fixed step | Catch-up budget |
|---|---:|---:|
| Performance | 30 Hz | 2 |
| Balanced | 45 Hz | 4 |
| Precise (default) | 60 Hz | 8 |

The default remains 60 Hz to preserve the pre-HF3 N8 execution behavior. Switching quality resets only the Physics accumulator/timestamp; authored Transform2D and RigidBody2D data are untouched.

This is a scheduler/execution-quality policy, not a replacement for Collider2D geometry precision or a backend-specific Rapier identity.

### Debug Detail

| Level | Visible collision debug budget |
|---|---:|
| Light | 300 |
| Balanced (default) | 1000 |
| Full | 5000 |

The budget is pushed into `getDebugViewportSnapshot(maxColliders)` and external TileMap AABB providers through `maxResults`, so unused Tile collision projections are not constructed merely to be discarded by the Stage renderer.

## Stage quality control

The Stage exposes a compact `Quality` panel with independent Render / Physics / Debug selectors and the effective numeric policy. This is intentionally close to the workload being diagnosed and does not require changing project data.

## Authority boundary

```text
Performance Quality Preferences
        ↓ execution policy only
Render Canvas / Refresh Budget / Debug Query Budget / Physics Scheduler

≠ Collider2D semantic data
≠ TileMap authored cells
≠ RigidBody2D authored data
≠ .ne stable identity
≠ Rapier handle
```

HF3 preferences are runtime/editor-session preferences in this stage. Persistent project quality policy can be introduced later only through an explicit schema/authority decision.

## Compatibility

- Existing projects default to Balanced Render, Precise Physics, Balanced Debug.
- Precise Physics preserves N8's pre-HF3 60 Hz fixed-step behavior.
- Scratch renderer authored/runtime semantics are not rewritten by Render Quality.
- Changing a quality profile must not dirty/save the project or modify authored Transform2D/RigidBody2D/Collider2D/TileMap data.
