# WS-10N8-HF6 | Transient Collider Authoring Verification

Status: MACHINE VERIFIED / BROWSER RE-TEST REQUIRED

## Browser evidence that triggered HF6

Production-build captures after HF5:

- Rectangle: 26.479 average FPS, 37.765 ms average frame, 216.6 ms frame P95, 37.36 ms average untracked time.
- Circle: 35.471 average FPS, 28.192 ms average frame, 150.0 ms frame P95, 27.847 ms average untracked time.
- Capsule: 36.091 average FPS, 27.708 ms average frame, 133.4 ms frame P95, 27.35 ms average untracked time.
- Collision Prepare stayed around 0.34-0.39 ms average, and browser authoring evidence reported pronounced stalls while dragging Collider2D handles.

Inspection found that every handle `pointermove` executed a persistent `PatchCollider2D`, which entered Runtime Node semantic checkpoint + full persistent project commit. Selected Rectangle handles also performed per-handle capability projection.

## HF6 machine evidence

- HF1-HF6 inherited machine chain: PASS.
- HF6 Transient Collider Authoring Conformance: 18/18 PASS.
- HF6 focused Jest: 3 suites / 22 tests PASS.
- 120 pointer-move stress contract: 120 transient preview patches, 0 persistent commands during movement, exactly 1 persistent command on release.
- Drag world->node projection contract: 3 capability samples for 120 pointer moves.
- Rectangle authoring handle projection: 10 handles projected from 3 node->world capability samples; per-handle `shapeLocalPointToWorld` calls are absent.
- Preview Runtime Service contract: `getCollider()` sees preview, `getPersistentCollider()` remains unchanged, Runtime Node `setComponentData()` remains untouched during preview, and transient preview emits no Area enter/exit semantic transitions.
- Full Unit Node: 215 suites / 1104 tests PASS.
- Full Unit DOM: 3 suites / 33 tests PASS.
- Integration: 12 suites / 13 tests PASS.
- Smoke: 1 suite / 1 test PASS.
- Permanent Regression: 40/40 PASS.
- TypeScript: PASS.
- ESLint correctness: PASS.
- ARC-C001.1 minimum baseline: 7/7 PASS, 0 active waivers, 0 blockers.
- 0009-E Transform DoD: 12/12 PASS.
- LRC-G1: 15/15 PASS.
- LPL-G1: 17/17 PASS.
- LEX-G1: 19/19 PASS.
- LSC-G1: 19/19 PASS.
- COL-0: 15/15 PASS.
- Production Node Explorer real Webpack entry: PASS, 0 errors / 0 warnings.

## Production dependency note

HF6 adds no dependency changes. The inherited validation container still does not contain `@dimforge/rapier2d-compat`, so a full Editor production build is not re-certified in this container. A normal N8 checkout should run `bun install` before real Rapier / complete production build verification.

## Browser acceptance

Repeat the same production-build Rectangle / Circle / Capsule captures and specifically drag:

- Rectangle width / height / corner handles;
- Circle radius;
- Capsule radius / height;
- Offset;
- Rotation.

Expected behavior:

1. Drag remains visually live.
2. `Collider Authoring Preview` may be called frequently but stays low-cost.
3. `Collider Authoring Commit` occurs on release only.
4. No project persistence occurs during pointer movement.
5. Pointer cancel returns to persistent geometry without a project mutation.
6. Rectangle no longer pays the old 10-handle per-capability projection path.
7. Browser frame P95 and subjective handle responsiveness materially improve before HF6 can be browser-verified.

If handle dragging becomes smooth but the idle/static scene remains dominated by untracked long tasks, the next investigation should be browser Long Animation Frame / layout / GC attribution rather than Physics or collision math.
