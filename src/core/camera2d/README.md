# Camera2D Core Contract

`ngvge.camera2d@1` owns backend-independent camera configuration. Position and rotation remain authoritative in `ngvge.transform2d@1`; Camera2D adds enabled state, zoom, viewport offset and priority.

The component never stores Scratch renderer identities or matrices. Rendering is an adapter concern. `.sb3` has no native Camera2D representation; Camera2D remains an NGVGE-native `.ne` semantic.
