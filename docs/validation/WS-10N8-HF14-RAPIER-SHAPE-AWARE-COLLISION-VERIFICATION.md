# WS-10N8-HF14｜Rapier Shape-Aware Collision Verification

Status: **MACHINE VERIFIED / BROWSER RE-TEST REQUIRED**

## Machine evidence

### HF14 conformance

- 12 / 12 PASS
- Covers analytic Cuboid/Ball/Capsule mapping, convex fallback, Rapier shape cast/contact, CharacterController query-session admission, complete-session fallback, diagnostics identity, unchanged authoring tessellation, and rejected-HF12 containment.

### Focused behavior

- 5 suites / 17 tests PASS
- Includes actual `@dimforge/rapier2d-compat@0.19.3` shape queries.
- Verifies:
  - rectangle / circle / capsule primitive fitting;
  - non-uniform circle rejects primitive fitting and safely falls back;
  - Circle-vs-Box analytic shape cast TOI/normal;
  - Capsule-vs-Box analytic shape cast;
  - Physics2D adapter emits `cuboid`, `ball`, and `capsule` descriptors;
  - CharacterController floor/wall behavior;
  - Circle and Capsule CharacterController floor collision through initialized Rapier query backend.

### Permanent regression

- 47 / 47 PASS
- CharacterController legacy backend ban was narrowed intentionally: replaceable geometry/query backends are now allowed, while backend handles remain forbidden as CharacterController authority and continuous SAT fallback remains required.

### Full Unit Node

- 216 suites / 1114 tests PASS

### Full Unit DOM

- 3 suites / 33 tests PASS

### Integration

- 12 suites / 13 tests PASS

### Smoke

- 1 / 1 PASS

### TypeScript

- PASS

### ESLint correctness

- source/tooling PASS
- tests PASS

## Known non-failure warning

`@dimforge/rapier2d-compat@0.19.3` emits its existing initialization deprecation warning during machine tests. It does not fail initialization or any behavioral gate. No dependency version was changed in HF14.

## Browser acceptance

Use Production build and reproduce the same runtime movement/collision workload used for HF13 Rectangle/Circle/Capsule comparison.

The report must contain:

```json
"diagnosticsVersion": "WS-10N8-HF14"
```

For Circle and Capsule, verify counters show the new path, especially:

```text
characterRapierQuerySessions
characterRapierPreparedCandidates
characterRapierShapeCasts
characterRapierContactQueries
```

If `characterSatShapeCasts` dominates, inspect backend readiness or primitive-fit fallback before making further performance conclusions.

Performance acceptance is based on browser evidence, not machine-test timing. WS-10N8 remains NOT FROZEN until browser behavior and performance pass.
