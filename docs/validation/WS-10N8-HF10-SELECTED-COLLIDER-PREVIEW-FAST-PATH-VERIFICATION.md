# WS-10N8-HF10｜Selected Collider Preview Fast Path Verification

**Status:** MACHINE VERIFIED / BROWSER RE-TEST REQUIRED

Machine verification completed on the cumulative HF1→HF10 source tree.

## Passed

- HF10 Conformance: 12/12 PASS
- HF10 Focused Jest: 3 suites / 26 tests PASS
- Permanent Regression: 44/44 PASS
- Full Unit Node: 215 suites / 1108 tests PASS
- Full Unit DOM: 3 suites / 33 tests PASS
- Integration: 12 suites / 13 tests PASS
- Smoke: 1/1 PASS
- ESLint correctness: PASS

## Browser gate

Use the production launcher and capture 5 seconds while continuously dragging the worst Circle or Capsule handle.

Inspect:

- averageFps / averageFrameMs
- frameP95Ms / frameP99Ms
- Collider Authoring Preview
- Collider Authoring Presentation
- Collision Prepare
- browserMainThread.topScripts
- trackedAverageMs / untrackedAverageMs

N8 remains NOT FROZEN until browser performance is acceptable.
