# NGVGE Task-0007.1 Validation

## Result

Task-0007.1 has been applied directly to the locally validated Task-0007 source.

## Implemented

- The complete Asset Manager has been removed from the Project Explorer tree.
- Project Explorer now shows a compact Assets provider summary:
  - image count;
  - sound count;
  - folder count;
  - `Open Asset Workspace` command.
- Clicking the Assets node opens the independent workspace.
- Asset Workspace is a separate 02Engine draggable window.
- It supports resize, maximize, minimize, close, restore, and reopen.
- Window position and size use the existing window-state persistence system.
- The layout was rebuilt as three distinct areas:
  - left: library categories and folder management;
  - center: search, grid/list browser, and asset cards;
  - right: preview, metadata, organization, actions, and references.
- Import, capture, Undo, and Redo are grouped in one top command bar.
- Low-frequency and destructive actions were moved into the right detail panel.
- The bottom status bar shows operation state and current target context.
- Existing Task-0007 asset metadata and normal SB3 save/load behavior are unchanged.

## Validation completed

- JavaScript/JSX parser validation: PASS
- CSS Module references: PASS
- Relative import resolution: PASS
- Explorer no longer embeds the full manager: PASS
- Independent window integration paths: PASS
- Patch application against clean Task-0007: PASS
- Patched result byte comparison: PASS
- ZIP integrity: PASS

## Recommended local test sequence

1. Start the editor.
2. Confirm `Asset Workspace` opens as an independent window.
3. Resize, move, minimize, maximize, and restore it.
4. Close it, then reopen it from `Project → Assets`.
5. Test image and sound import.
6. Test Library and Folder filters.
7. Test grid and list views.
8. Select an asset and confirm details appear in the right panel.
9. Test rename, folder movement, reuse, global replacement, unlink, delete, Undo, and Redo.
10. Save and reload an SB3 to confirm Task-0007 persistence remains unchanged.

## Not executed in this runtime

The source archive does not include `node_modules`, and Bun is unavailable here. The complete Jest, ESLint, and Webpack suites were therefore not executed.

Run locally:

```bash
bun run test:lint
bun run test:unit -- project-asset
bun run build
bun run start
```

## Suggested commit

```text
refactor(project-assets): move assets into independent workspace
```
