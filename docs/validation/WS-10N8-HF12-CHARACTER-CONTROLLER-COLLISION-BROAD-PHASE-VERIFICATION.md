# WS-10N8-HF12 Verification

## Machine Verification

```text
HF1 → HF12 machine conformance        PASS
HF12 Conformance                      15/15 PASS
HF12 Focused Jest                     5 suites / 23 tests PASS
Permanent Regression                  46/46 PASS
Full Unit Node                        215 suites / 1109 tests PASS
Full Unit DOM                         3 suites / 33 tests PASS
Integration                           12 suites / 13 tests PASS
Smoke                                 1/1 PASS
TypeScript scope/typecheck            PASS
ESLint correctness                    PASS
```

## Browser Re-test Gate

Use the Production launcher with the same runtime CharacterBody2D / Circle/Capsule collision scene that produced the ~14.4 FPS capture.

Capture 5 seconds while actively moving/colliding.

Primary metrics:

```text
averageFps
frameP95Ms
longAnimationFrameCount
browserMainThread.topScripts
Character Controller average / P95 / max
Collision Prepare average / P95
trackedAverageMs
untrackedAverageMs
counters.characterControllerSteps
```

Expected signature if HF12 hits:

```text
Character Controller becomes visible in tracked categories
FrameRequestCallback h stalls collapse substantially
TileMap-wide collision enumeration no longer dominates local sweeps
Collision refreshes are coalesced per logical controller move
averageFps materially improves from the ~14.4 FPS baseline
```

HF12 is not an N8 Freeze by itself. Runtime collision/physics browser performance remains the gate.
