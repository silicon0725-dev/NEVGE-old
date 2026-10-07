# WS-10N8-HF11 Verification

## Machine Verification

```text
HF1 → HF11 machine conformance       PASS
HF11 Conformance                     11/11 PASS
HF11 Focused Jest                    2 suites / 13 tests PASS
Permanent Regression                 45/45 PASS
Full Unit Node                       215 suites / 1108 tests PASS
Full Unit DOM                        3 suites / 33 tests PASS
Integration                          12 suites / 13 tests PASS
Smoke                                1/1 PASS
ESLint correctness                   PASS
```

## Browser Re-test Gate

Use the Production launcher and continuously drag the previously slow Circle or Capsule collider for a 5-second profiler capture.

Primary metrics:

```text
averageFps
frameP95Ms
Collider Authoring Presentation average / P95 / max
Collider Authoring Preview P95
counters.colliderPresentationDirectDom
counters.colliderPresentationReactFallback
browserMainThread.topScripts
```

Expected signature if HF11 hits:

```text
colliderPresentationDirectDom > 0
colliderPresentationReactFallback ≈ 0
Collider Authoring Presentation P95 << HF10 15.6 ms
Collider Authoring Preview remains around low single-digit ms or below
Collision Prepare remains out of the drag hot path
```

HF11 is not a WS-10N8 Freeze by itself. Browser performance remains the gate.
