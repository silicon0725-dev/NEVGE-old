# NGVGE LRC-2A Change Manifest

Date: 2026-08-13  
Stage: LRC-2A | Runtime Policy Foundation  
Status: Foundation slice PASS; LRC-2 overall remains in progress.

## Existing files modified

- `package.json`

## New files

- `docs/architecture/legacy-runtime/LRC-2-A-RUNTIME-POLICY-FOUNDATION.md`
- `docs/architecture/legacy-runtime/LRC-2-A-VERIFICATION.md`
- `scripts/validate-lrc2-runtime-policy-foundation.js`
- `src/lib/runtime-policy/README.md`
- `src/lib/runtime-policy/constants.js`
- `src/lib/runtime-policy/index.js`
- `src/lib/runtime-policy/presenter-capability.js`
- `src/lib/runtime-policy/profile-registry.js`
- `src/lib/runtime-policy/runtime-policy-authority.js`
- `src/lib/runtime-policy/runtime-policy-contract.js`
- `src/lib/runtime-policy/runtime-policy-resolver.js`
- `src/lib/runtime-policy/runtime-policy-schema.js`
- `src/lib/runtime-policy/scratch-runtime-policy-adapter.js`
- `test/unit/lib/runtime-policy/runtime-policy-foundation.test.js`
- `test/unit/lib/runtime-policy/scratch-runtime-policy-adapter.test.js`

## Verification

- `npm run test:legacy-containment:lrc2-foundation` — PASS
- `npm run test:conformance:c001.1-baseline` — PASS (7/7)
- `npm run test:conformance:0009-e` — PASS (0009-E 12/12)
- LRC-2 Runtime Policy Jest suites — PASS (2 suites / 11 tests)
- New Runtime Policy source + LRC-2 validator ESLint — PASS

## Intentional non-change

`src/containers/tw-settings-modal.jsx` is not rewired in this foundation slice. Legacy direct VM/Renderer setter ownership remains temporarily so that no production UI behavior changes before the Runtime Policy schema/resolver/adapter seam is certified.
