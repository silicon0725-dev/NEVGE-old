# WS-9I Change Manifest

Stage: `WS-9I | Privileged Tool Mutation Review Policy & WS-9 Certification`

Baseline: `WS-9H COMPLETE / VERIFIED`

## Production additions

- `src/lib/editor-shell/privileged-mutation-review-policy.js`
  - stable Review Policy identity;
  - surface classification;
  - Review Evidence issuance/validation;
  - lease/project/revision/subject/operation binding;
  - one-shot consume and revoke/stale lifecycle.

## Production modifications

- `src/lib/editor-shell/workspace-project-resource-capabilities.js`
  - Project proposal facade can prepare commit Review Evidence;
  - Project mutate facade requires Evidence before commit/rollback;
  - rollback Review Evidence preparation added.

- `src/lib/editor-shell/workspace-capability-providers.js`
  - Project mutate availability requires shared Review Policy;
  - Resource direct mutate Provider becomes fail-visible denied under policy;
  - Policy is passed only into scoped Project capability facades.

- `src/lib/editor-shell/project-transaction-review.js`
  - Resource authority replacement changes Review revision so previous evidence becomes stale.

- `src/components/gui/gui.jsx`
  - creates/disposes one shared Review Policy;
  - wires it between Review Service and Provider Registry.

- `package.json`
  - WS-9I focused/Webpack/certification commands;
  - WS-9 total certification command.

## Tests / gates

- `test/unit/lib/editor-shell/privileged-mutation-review-policy.test.js`
- updated Project Command Provider tests for mandatory Review Evidence;
- updated Project/Resource provider tests for direct Resource mutation denial;
- `scripts/validate-ws9i-privileged-mutation-review-policy.js`
- `scripts/validate-ws9i-webpack-policy-entry.js`
- `scripts/validate-ws9-certification.js`

## Architecture / certification records

- `docs/architecture/workspace/WS-9I-PRIVILEGED-TOOL-MUTATION-REVIEW-POLICY.md`
- `docs/architecture/workspace/WS-9I-review-policy-matrix.csv`
- `docs/architecture/workspace/WS-9I-VERIFICATION.md`
- `docs/architecture/workspace/WS-9I-CERTIFICATE.json`
- `docs/architecture/workspace/WS-9-CERTIFICATION.md`
- `docs/architecture/workspace/WS-9-CERTIFICATE.json`

## Explicit non-goals

WS-9I does not add:

- Paint / IDE / Terminal production implementation;
- filesystem or process capability;
- browser/network capability;
- credential capability;
- direct binary Resource replacement;
- generic cross-domain atomic transactions;
- a second Project/Resource mutation authority;
- raw VM/Renderer/Scratch Target access.
