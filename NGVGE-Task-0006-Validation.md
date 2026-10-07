# NGVGE Task-0006 Validation

## Result

Task-0006 has been applied directly to the working Task-0005 source.

## Implemented

- A project-level Global Asset Database for image costumes and backdrops.
- An `Assets` provider inside Project Explorer.
- Capture the current costume as a global asset.
- Reuse one global asset on multiple Stage or Sprite targets.
- Replace one global asset from the current costume and update every linked costume.
- Rename global assets.
- Unlink a costume into an independent local copy.
- Delete global assets only when they have no references.
- Display target/costume references for each global asset.
- Store logical global asset metadata under additive `ngvge` project data.
- Store costume-index bindings under additive per-target `ngvge` data.
- Retain Scratch's normal content-hash file names and ordinary costume arrays.
- Include zero-reference global asset binaries in `vm.serializeAssets()`.
- Restore zero-reference assets from the original SB3 JSZip archive.
- Keep the hidden persistence section out of the visible Inspector.

## Validation completed

- JavaScript syntax validation: PASS
- JSX parser validation: PASS
- Relative import resolution: PASS
- CSS module reference validation: PASS
- Global asset capture/link/replace behavioral tests: PASS
- Zero-reference asset serialization test: PASS
- Project/target metadata injection test: PASS
- SB3 archive hydration-context test: PASS
- Patch application against a clean Task-0005 source: PASS
- Patched result byte comparison: PASS
- ZIP integrity: PASS

## Local test sequence

1. Select a Sprite and choose one of its costumes.
2. Expand `Project → Assets`.
3. Click `Capture current costume`.
4. Select another Sprite and click `Use on selected`.
5. Confirm both targets contain costumes linked to the same global asset.
6. Select a different source costume and click `Replace globally`.
7. Confirm every linked costume changes.
8. Save the project as SB3, reload it, and confirm the asset list and references return.
9. Unlink every reference, save and reload again, and confirm the unused global asset remains available.

## Not executed in this runtime

The uploaded GUI archive does not include `node_modules`, and Bun is not available here. The complete Jest, ESLint, and Webpack suites were therefore not executed.

Run locally:

```bash
bun run test:lint
bun run test:unit -- project-assets
bun run build
bun run start
```

## Current scope

- Supported: image costumes and Stage backdrops.
- Deferred: sounds, folders, drag-and-drop asset organization, direct file import, asset collections/animation sets, and asset-operation Undo/Redo.
- Normal SB3 save/load is supported.
- 02Engine compiled-project export is not covered yet.

## Suggested commit

```text
feat(project-assets): add global costume asset database
```
