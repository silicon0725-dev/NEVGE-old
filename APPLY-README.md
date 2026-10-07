# Apply WS-10N8-HF14.9

Base: WS-10N8-HF14.8.

Apply this overlay at the project root, replacing matching files. No dependency changes are required.

HF14.9 adds Scratch-driven Collider refresh containment for editor debug presentation. It does not throttle Scratch VM execution, Scratch -> NGVGE Transform projection, collision semantics, Rapier/Physics, or Area/Sensor transitions.

After rebuilding Production, verify profiler output contains:

`"diagnosticsVersion": "WS-10N8-HF14.9"`

Then repeat the `repeat -> go to mouse-pointer` + Collider stress test.
