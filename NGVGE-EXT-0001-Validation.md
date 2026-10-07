# NGVGE EXT-0001 Validation

## 基线

- Base project: `scratch-gui-main-task-0008.7.2.2-cross-scene-projection-empty-node-crash-hotfix.zip`
- Intake archive: `拓展.zip`
- Intake entries: 695
- JavaScript entries: 577

## 审计结果

- Node syntax pass: 574 / 577
- Scratch extension registration detected: 481
- Unsandboxed extensions: 179
- VM/runtime internal access: 324
- Renderer/WebGL access: 150
- Network access: 110
- Dynamic code execution patterns: 48
- Exact duplicate groups: 19

The audit used static heuristics and is not a security certification.

## Clean-room implementation rule

No third-party source file from the intake archive was copied into the project. The selected extensions were independently implemented from documented behavior and general algorithms.

## Added first-party extensions

### NGVGE Motion Toolkit

- Extension ID: `ngvgeMotion`
- Pure deterministic implementation; no VM, DOM, network or renderer access.
- Includes interpolation, 29 easing curves, cubic Bezier evaluation and damped spring progress.

### NGVGE Input Core

- Extension ID: `ngvgeInput`
- Tracks keyboard, mouse, wheel and Gamepad input.
- Ignores keyboard capture while an editable DOM control has focus.
- Cleans listeners on runtime disposal and clears state on project stop/window blur.
- Exposes a frozen runtime query bridge at `runtime.ngvgeInputCore`.
- Action maps remain runtime-only in this release and are not serialized into SB3.

### NGVGE Data Toolkit

- Extension ID: `ngvgeData`
- JSON path operations and stable serialization.
- Unicode-safe Base64.
- CRC32, Adler-32 and FNV-1a checksums.
- GZIP uses native Compression Streams; unsupported browsers return an `ERROR:` reporter value.

## Editor integration

The extension library now contains three additional featured `ngvge` entries with local static URLs and first-party SVG icons.

## Validation performed

- `node --check` passed for all three extension files and validation script.
- SVG XML parsing passed for all three icons.
- Motion numeric smoke tests passed.
- Cubic Bezier and spring tests passed.
- JSON path, stable JSON, Base64 and CRC32 tests passed.
- GZIP round-trip passed in Node 22 native streams.
- Keyboard edge-state test passed.
- Gamepad button, axis and action-map tests passed.
- Runtime disposal cleanup path executed.
- Relative diff confirmed that only extension catalog, new extensions/icons, docs and validation script changed.

Validation command:

```bash
node scripts/validate-ngvge-foundation-extensions.js
```

Result:

```text
NGVGE foundation extension validation passed.
```

## Not executed

The base project does not contain root `node_modules`, so full Jest, ESLint and Webpack production builds were not executed in this environment.

## Deferred candidates

- Runtime Event Bus
- Permission-aware File I/O
- Audio Analysis / MIDI
- Renderer FX / post-processing
- Tile Grid / Tilemap
- Physics and collision helpers
- UI input widgets

These are intentionally deferred to their corresponding NGVGE architecture phases.
