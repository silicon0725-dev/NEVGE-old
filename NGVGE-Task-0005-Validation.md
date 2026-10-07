# NGVGE Task-0005 Validation

## Result

Task-0005 has been applied directly to the working Task-0004 source.

## Implemented

- Inspector Undo and Redo controls.
- A 100-command in-memory property history.
- Undo/redo for name, transform, visibility, draggable state, layer order, Camera, XY Stretch, and other registered extension fields.
- Native Scratch properties continue to use native SB3 serialization.
- Extension sections can persist project-level and target-level metadata through optional Inspector Registry hooks.
- Custom Inspector metadata is stored under an additive `ngvge` field in `project.json`.
- Extension IDs and custom extension URLs are retained when an Inspector-only property is used without extension blocks.
- Camera definitions persist at project level.
- Camera binding and XY Stretch persist per target.
- The previous project's undo/redo history is cleared when another project loads.
- Persistence is installed before the GUI project manager begins loading a project.
- Restored extension data is applied after the complete `vm.loadProject` lifecycle.

## Validation completed

- JavaScript/JSX parser validation: PASS
- Node syntax validation: PASS
- CSS module references: PASS
- Relative imports: PASS
- Property-history behavioral test: PASS
- Project persistence behavioral test: PASS
- Post-load restore ordering test: PASS
- Required extension URL preservation: PASS
- Patch application against a clean Task-0004 source: PASS
- Patched result byte comparison: PASS
- ZIP integrity: PASS

## Not executed in this runtime

The uploaded GUI archive does not include `node_modules`, and Bun is not available here. The complete Jest, ESLint, and Webpack suites were therefore not executed.

Run locally:

```bash
bun run test:lint
bun run test:unit -- project-inspector
bun run build
bun run start
```

## Persistence scope

Task-0005 covers normal SB3 save/load through `vm.toJSON` and `vm.loadProject`.

The separate 02Engine compiled-project persistence path is not covered by this task and should receive its own integration work before being treated as supported.

## Suggested commit

```text
feat(project-inspector): persist properties and add undo redo
```
