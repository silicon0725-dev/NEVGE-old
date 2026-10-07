# NGVGE Task-0007 Validation

## Result

Task-0007 has been applied directly to the locally validated Task-0006 source.

## Implemented

- Direct multi-file import into the project-level asset database.
- Global image assets: SVG, PNG, JPEG, BMP, WebP, and GIF frames.
- Global sound assets: WAV, MP3, and formats supported by the existing audio conversion path.
- Attach one shared image or sound to multiple Stage/Sprite targets.
- Project-level asset folders.
- Create, rename, and delete folders.
- Deleting a folder moves contained assets to Unfiled.
- Search by asset name, format, or content hash.
- All / Images / Sounds filters.
- Folder filtering.
- Grid and List views.
- Image thumbnails and audio playback when data is loaded.
- Per-reference navigation and unlinking.
- A dedicated 100-step Asset Manager Undo/Redo history.
- Serialized image and sound bindings in additive NGVGE target metadata.
- Zero-reference image and sound binaries retained in normal SB3 export.
- Task-0006 metadata remains readable.

## Behavior checks completed

- Image capture, attachment, reference tracking: PASS
- Sound import, attachment, reference tracking: PASS
- Folder creation and asset movement: PASS
- Concurrent import transaction queue: PASS
- Undo and Redo snapshot restoration: PASS
- Orphan image and sound asset serialization: PASS
- JavaScript and JSX parsing: PASS
- CSS Module references: PASS
- Relative imports: PASS
- Patch application and byte comparison: PASS
- ZIP integrity: PASS

## Recommended local test sequence

1. Expand `Project → Assets`.
2. Import an image and an audio file.
3. Confirm both appear in the grid with different type indicators.
4. Create a folder and move both assets into it.
5. Search for each asset by name.
6. Attach the image and sound to two different Sprites.
7. Confirm the reference counts update.
8. Unlink one reference.
9. Use Undo and Redo.
10. Save as SB3 and reload.
11. Confirm folders, assets, references, and zero-reference assets return.

## Not executed in this runtime

The uploaded GUI archive does not contain `node_modules`, and Bun is not available here. The complete Jest, ESLint, and Webpack suites were therefore not executed.

Run locally:

```bash
bun run test:lint
bun run test:unit -- project-asset
bun run build
bun run start
```

## Current scope

Normal SB3 save/load is covered. The separate 02Engine compiled-project export path is still not covered.

## Suggested commit

```text
feat(project-assets): add asset manager workflow
```
