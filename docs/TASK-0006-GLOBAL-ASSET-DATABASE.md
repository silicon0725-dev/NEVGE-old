# Task-0006 — Global Asset Database

## Goal

Move NGVGE from target-private costume management toward a project-level asset model while retaining normal SB3 compatibility.

Scratch still receives ordinary costume entries on each Stage or Sprite. NGVGE adds a logical project-wide record above those entries so multiple targets can reference the same image asset and respond to one global replacement operation.

## Project Explorer workflow

The Project Explorer now contains:

```text
Project
├── Entities
└── Assets
```

Under **Assets**:

- **Capture current costume** creates or reuses a global asset and links the current costume.
- **Use on selected** adds the selected global asset to the current Stage or Sprite.
- **Replace globally** uses the current costume as the new source and updates every linked costume.
- **Unlink current** keeps the current costume but converts it back to an independent local copy.
- **Delete unused** deletes a global record only after all costume references have been unlinked.
- The reference list shows each target and costume currently linked to the selected asset.

## Storage model

Physical SB3 image files keep Scratch's content-addressed file names:

```text
<assetId>.<dataFormat>
```

NGVGE does not rename those physical files. It stores a stable logical asset ID and metadata in the additive `ngvge` project data:

```json
{
  "ngvge": {
    "projectSections": {
      "ngvge-global-assets": {
        "version": 1,
        "assets": [
          {
            "id": "asset:<uuid>",
            "name": "Player Idle",
            "kind": "costume",
            "assetId": "<content hash>",
            "dataFormat": "svg",
            "md5ext": "<content hash>.svg",
            "bitmapResolution": 1,
            "rotationCenterX": 24,
            "rotationCenterY": 24
          }
        ]
      }
    }
  }
}
```

Each target stores costume-index bindings in its own additive `ngvge` section. Ordinary Scratch costume arrays remain intact, so a non-NGVGE editor can still open and run the SB3.

## Orphan assets

A project-level asset may exist with zero target references. Task-0006 wraps `vm.serializeAssets()` so the binary is still included in the SB3 archive. During load, the persistence layer passes the original JSZip archive to the global asset database, allowing unreferenced binaries to be restored from `<assetId>.<dataFormat>`.

## Compatibility boundary

- Normal SB3 save/load: supported.
- Stage backdrops and Sprite costumes: supported as global image assets.
- Sounds: not included in Task-0006.
- Folder hierarchy, drag-and-drop reordering, import directly from disk, and automatic asset dependency analysis: deferred.
- Asset database operations are not yet commands in Task-0005's property history. Native costume additions remain normal Scratch project changes, but global capture/rename/link/replace actions do not currently support Undo/Redo.
- 02Engine compiled-project export remains outside the supported persistence path.

## Suggested commit

```text
feat(project-assets): add global costume asset database
```
