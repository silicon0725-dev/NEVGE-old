# LSC-G1 Change Manifest

Baseline: `LEX-G1 PASS / CERTIFIED + LPL-G1 PASS / CERTIFIED + COL-0 COMPLETE / VERIFIED`

Stage: `LSC-G1 | Credentials & Unsafe Agent Containment Certification`

## Production hardening

- `src/lib/credentials/legacy-bridge-token.js`
  - adds CSPRNG-only 128-bit ephemeral Legacy bridge bearer token generation;
  - fails closed with `NGVGE_LEGACY_BRIDGE_SECURE_RANDOM_UNAVAILABLE`;
  - removes insecure `Date.now()` / `Math.random()` fallback semantics.
- `src/addons/addons/02agent/hooks/useBridgeClient.ts`
  - routes initial, toggle and reset token generation through the secure helper.

## Certification tooling

- `scripts/validate-lsc-g1-credentials-unsafe-agent-containment-certification.js`
- `scripts/validate-lsc-g1-webpack-agent-containment-entry.js`
- `scripts/jest-transform-lsc-g1.js`
- `jest.lsc-g1.config.js`
- `test/certification/legacy-containment/lsc-g1-credentials-unsafe-agent-containment.test.js`
- `package.json` certification / Webpack / aggregate gates.

The dedicated certification test is intentionally outside `test/unit/` so the ordinary Unit harness does not need its Babel/Jest configuration expanded to TypeScript solely for this gate.

## Governance records

- `docs/architecture/legacy-containment/LSC-G1-CERTIFICATE.json`
- `docs/architecture/legacy-containment/LSC-G1-CREDENTIALS-UNSAFE-AGENT-CONTAINMENT-CERTIFICATION.md`
- `docs/architecture/legacy-containment/LSC-G1-VERIFICATION.md`
- `docs/architecture/legacy-containment/LSC-G1-security-debt-matrix.csv`
- `docs/architecture/legacy-containment/LSC-G1-CHANGE-MANIFEST.md`

## Explicit non-goals

This delta does not implement the final OS-backed credential service, does not create native Agent mutation authority, does not retire the LEX raw-VM Legacy quarantine, and does not migrate Legacy 02Agent into Workspace Window Manager. Those remain explicitly assigned future responsibilities.
