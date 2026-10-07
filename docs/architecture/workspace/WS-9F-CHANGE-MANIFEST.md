# WS-9F Change Manifest

Baseline: WS-9E COMPLETE / VERIFIED  
Stage: WS-9F Project / Resource Capability Provider Foundation

## Added

- `WS-9F-APPLY-README.txt`
- `WS-9F-FILE-MANIFEST.txt`

- `src/lib/editor-shell/workspace-project-resource-capabilities.js`
  - portable Project read facade;
  - explicit unavailable Project command facade;
  - portable Resource descriptor normalization;
  - bounded Resource command proposal/mutation facades.
- `test/unit/lib/editor-shell/workspace-project-resource-capabilities.test.js`
- `scripts/validate-ws9f-project-resource-provider-foundation.js`
- `scripts/validate-ws9f-webpack-project-resource-entry.js`
- `docs/architecture/workspace/WS-9F-PROJECT-RESOURCE-CAPABILITY-PROVIDER-FOUNDATION.md`
- `docs/architecture/workspace/WS-9F-VERIFICATION.md`
- `docs/architecture/workspace/WS-9F-CERTIFICATE.json`
- `docs/architecture/workspace/WS-9F-provider-coverage-matrix.csv`
- `docs/architecture/workspace/WS-9F-CHANGE-MANIFEST.md`

## Modified

- `src/lib/project-assets/global-asset-database.js`
  - advances Global Asset persistence schema from v2 to v3;
  - introduces persistent canonical `ngvge:resource:*` identity for Global Asset records;
  - preserves ResourceId across backing-record replacement;
  - migrates legacy serialized records without canonical ResourceId;
  - adds ResourceId lookup/query seams while retaining `asset:*` as internal database identity.
- `src/components/project-assets/project-asset-manager.jsx`
  - projects canonical `selectedAsset.resourceId` into Workspace Context.
- `src/lib/editor-shell/workspace-context.js`
  - Resource domain now accepts canonical NGVGE ResourceId only.
- `src/lib/editor-shell/tool-capability.js`
  - descriptor request uniqueness becomes `capabilityId#access`, permitting legitimate propose + mutate surfaces while rejecting duplicate exact surfaces.
- `src/lib/editor-shell/workspace-capability-providers.js`
  - registers Project read, Project command diagnostic, Resource read and Resource command Providers;
  - separates read and command authority availability checks.
- `src/components/gui/gui.jsx`
  - supplies existing ProjectLifecycleHost and lazy Global Asset Database authority seams to the core Provider Registry.
- `test/unit/lib/project-assets-global-database.test.js`
  - verifies canonical ResourceId creation, persistence and legacy migration.
- `test/unit/components/project-asset-manager.test.jsx`
  - verifies canonical Resource Context projection.
- `test/unit/lib/editor-shell/workspace-context.test.js`
- `test/unit/lib/editor-shell/workspace-context-runtime.test.js`
  - historical Resource Context fixtures now use canonical ResourceId.
- `test/unit/lib/editor-shell/workspace-capability-provider.test.js`
  - evolves WS-9E Project/Resource expectations from `provider-missing` to registered Provider states.
- `scripts/validate-ws9c-context-source-integration.js`
  - evolves Asset Manager historical invariant to canonical ResourceId projection.
- `scripts/validate-ws9e-capability-provider-binding.js`
  - replaces the historical "Project/Resource providers must remain absent" non-goal with the permanent Provider-boundary invariant.
- `package.json`
  - adds WS-9F focused, cumulative, Webpack and certification commands.

## Explicitly unchanged

- Project semantic writer authority.
- Scratch project load/serialization compatibility semantics.
- Workspace Context writer ownership.
- Provider Registry remains a resolver/binding layer, not Project or Resource authority.
- Resource binary/content editing is not exposed.
- Agent ChangeSet / review / transaction path is unchanged.
- Todo production behavior is unchanged.
- Terminal/Paint remain PLANNED / UNADMITTED.
- No filesystem/process/network/browser/credential capability is introduced.
