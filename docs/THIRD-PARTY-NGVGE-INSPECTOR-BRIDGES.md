# Third-party NGVGE Inspector Bridges

## NGVGE Camera V2

- Source name: Camera V2
- Original ID: `SPcamera`
- Original author: SharkPool
- License: MIT
- NGVGE modification: adds a schema-driven Inspector bridge for camera binding, X, Y, zoom, and direction.
- Persistence: camera definitions are saved at project level; each Stage/Sprite camera binding is saved at target level.
- History: Inspector camera edits participate in NGVGE undo and redo.

The original extension behavior and block ID are retained.

## NGVGE XY Stretch

- Source name: Stretch
- Original ID: `stretch`
- Original authors: GarboMuffin and TheStarWorld
- License: MIT AND MPL-2.0
- NGVGE modification: adds a schema-driven Inspector bridge for horizontal and vertical stretch.
- Persistence: X and Y stretch are saved per target.
- History: Inspector stretch edits participate in NGVGE undo and redo.

The uploaded source ended immediately after the `getY` method without the final class closure, extension registration, and IIFE closure. The NGVGE adaptation completes those structural endings before adding the Inspector bridge.
