# Task-0007 — Asset Manager

## Status

Implementation complete; local runtime validation required.

## Goal

Turn the Task-0006 global costume list into an engineering-oriented Asset Manager while preserving normal Scratch SB3 asset storage and target-local costume/sound arrays.

## Implemented

### Direct file import

The Asset Manager accepts multiple image and audio files.

Image formats:

- SVG
- PNG
- JPEG
- BMP
- WebP
- GIF, imported as multiple image assets when animated

Audio formats:

- WAV
- MP3
- Other browser-decodable audio formats are converted through the existing 02Engine audio import path when possible

Imported files enter the project-level Global Asset Database without first being attached to a Sprite.

### Images and sounds

Global asset records now support:

- `kind: costume`
- `kind: sound`

A shared image can be attached as a costume or backdrop. A shared sound can be attached to any Stage or Sprite target.

Scratch target arrays remain the runtime compatibility layer:

- `target.costumes`
- `target.sounds`

NGVGE stores only the logical global-asset binding in additive target metadata.

### Asset folders

Project-level folders support:

- Create
- Rename
- Delete
- Move assets between folders
- Unfiled assets

Deleting a folder does not delete its assets. They move to Unfiled.

### Search and filters

The Asset Manager supports:

- Name, format, and hash search
- All / Images / Sounds filter
- Folder filter
- Grid / List views

### Preview

- Image thumbnail preview
- Audio type card
- Audio playback control when the asset data is loaded

### References

Each asset shows every target-local costume or sound that references it. A reference can be selected or unlinked individually.

### Asset operation history

A dedicated 100-step Asset Manager history records:

- Import
- Capture
- Attach to target
- Global image replacement
- Rename
- Folder operations
- Move
- Unlink
- Delete unused asset

This is separate from the Task-0005 Inspector property history.

## SB3 compatibility

The physical assets remain content-hash files:

```text
<assetId>.<dataFormat>
```

Ordinary Scratch costume and sound entries remain in each target. NGVGE project-level folders, asset IDs, and bindings are stored in the additive `ngvge` metadata section.

Zero-reference image and sound binaries are included in `vm.serializeAssets()` so a project-level asset does not disappear merely because no target currently uses it.

## Deferred

- Drag-and-drop folder reordering
- Multi-select and batch operations
- Waveform generation
- Animation collections
- Asset tags
- External linked files
- 02Engine compiled-project export integration
