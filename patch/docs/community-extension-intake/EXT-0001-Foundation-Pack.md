# EXT-0001 Foundation Extension Pack

This package is a clean-room first-party implementation. It does not copy third-party extension source code from the intake archive.

## NGVGE Motion Toolkit

Extension ID: `ngvgeMotion`

Purpose:

- deterministic easing and interpolation;
- cubic Bezier easing compatible with CSS-style control points;
- spring response for future Transform animation;
- utility functions such as clamp, normalize, wrap and ping-pong.

The spring reporter returns an unclamped progress value so that overshoot is preserved.

## NGVGE Input Core

Extension ID: `ngvgeInput`

Purpose:

- keyboard held/pressed/released states;
- mouse button, stage coordinate and wheel input;
- Gamepad button, axis and deadzone handling;
- action bindings independent of the physical device.

Binding examples:

```text
key:Space
mouse:left
gamepad:any:button:0
gamepad:0:axis:0:+
gamepad:0:axis:1:-
```

Multiple bindings are comma-separated:

```text
key:Space,gamepad:any:button:0
```

A frozen runtime bridge is available at:

```js
Scratch.vm.runtime.ngvgeInputCore
```

The bridge is intended for future first-party module integration. It does not expose the internal mutable input sets.

## NGVGE Data Toolkit

Extension ID: `ngvgeData`

Purpose:

- read, write and delete JSON paths;
- stable JSON serialization for hashing and deterministic saves;
- Unicode-safe Base64 and URL-safe Base64;
- CRC32, Adler-32 and FNV-1a checksums;
- GZIP compression using browser-native `CompressionStream` APIs.

JSON path examples:

```text
player.stats.hp
inventory[0].id
settings["audio.volume"]
```

GZIP blocks return an `ERROR: ...` string when the browser does not support the native stream APIs or when the input is invalid.

## Architectural boundary

These are first-party Scratch extensions, not replacements for planned NGVGE modules.

- Motion Toolkit will later be consumed by Transform System.
- Input Core will later be promoted behind a formal `ngvge.input@1` capability.
- Data Toolkit will remain a utility extension and may also be reused by Save System.
