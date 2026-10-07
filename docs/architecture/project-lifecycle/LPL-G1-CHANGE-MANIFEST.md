# LPL-G1 Change Manifest

**Baseline:** COL-0 | COMPLETE / VERIFIED
**Stage:** LPL-G1 | Project Lifecycle Consolidation Certification
**Result:** PASS / CERTIFIED

LPL-G1 is a certification-only increment. It does not modify production Project Lifecycle behavior.

## Added

- `scripts/validate-lpl-g1-project-lifecycle-consolidation-certification.js`
  - 17 machine-certification requirements;
  - real Scratch root/nested lifecycle transaction evidence;
  - failure, deterministic hook, diagnostics-only and replaceable-backend checks.
- `scripts/validate-lpl-g1-webpack-project-lifecycle-entry.js`
  - real Webpack production-module gate for `src/lib/project-lifecycle/index.js`.
- `test/unit/lib/project-lifecycle/project-lifecycle-consolidation-certification.test.js`
  - 9 end-to-end lifecycle certification tests.
- `docs/architecture/project-lifecycle/LPL-G1-PROJECT-LIFECYCLE-CONSOLIDATION-CERTIFICATION.md`
- `docs/architecture/project-lifecycle/LPL-G1-VERIFICATION.md`
- `docs/architecture/project-lifecycle/LPL-G1-CERTIFICATE.json`
- `docs/architecture/project-lifecycle/LPL-G1-CHANGE-MANIFEST.md`

## Modified

- `package.json`
  - `test:project-lifecycle:lpl-g1-certification`;
  - `test:project-lifecycle:lpl-g1-webpack`;
  - `test:project-lifecycle:lpl-g1`.

## Production behavior changes

None.

The certified production identities remain:

```text
ngvge.project-lifecycle-host@1
ngvge.project-lifecycle-client@1
ngvge.project.lifecycle
authority:ngvge.project-lifecycle-host
```
