# LSC-G1 Verification

Status: `PASS / CERTIFIED`

## Focused certification

- Machine invariant validator: `19/19 PASS`
- E2E certification: `1 suite / 7 tests PASS`
- LSC-0 legacy credential tests: PASS
- 02Agent strict TypeScript scope: PASS

## Production entry evidence

`src/addons/addons/02agent/hooks/useBridgeClient.ts` was compiled with the real `webpack.config.js[0]` module/Babel/TypeScript resolution path.

Result: `exit 0 / 0 errors / 0 warnings`.

## Cumulative gates

- LRC-G1: PASS
- LPL-G1: PASS
- LEX-G1: PASS
- COL-0: PASS
- ARC-C001.1 / 0009-E: PASS
- Permanent Regression: `19/19 PASS`
- Unit Node: `100 suites / 537 tests PASS`
- Unit DOM: `3 suites / 26 tests PASS`
- Integration: `4 suites / 5 tests PASS`
- Smoke: `1 suite / 1 test PASS`
- TypeScript: PASS
- ESLint correctness: PASS

## Production hardening included in this certification

The Legacy 02Agent bridge token generator no longer falls back to `Date.now()` / `Math.random()`. It requires `crypto.getRandomValues` and fails closed when secure random generation is unavailable.

## Scope limitation

This gate certifies Legacy containment only. Final OS-backed credential storage and the native Agent ChangeSet/Review/Authority path remain deferred and are recorded in `LSC-G1-security-debt-matrix.csv`.

## Aggregate execution note

`npm run test:legacy-containment:lsc-g1` ran through Webpack, LSC-0, LSC-G1, LRC-G1, LPL-G1, LEX-G1, COL-0, 0009, Regression, Unit, Integration, Smoke and TypeScript before the outer execution window terminated the wrapper. The remaining ESLint correctness gate was rerun independently on the same final tree and returned exit code `0`.

Therefore the aggregate wrapper is recorded as `CONSTITUENT GATES PASS / WRAPPER TIMEOUT`, not as a fabricated aggregate exit code.
