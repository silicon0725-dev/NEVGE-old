# Task-0005 — Inspector persistence and undo/redo

## Scope

Task-0005 turns Inspector properties into project data instead of temporary editor state.

Implemented paths:

- Native Sprite properties continue to use Scratch VM serialization.
- Layer order continues to use the native `layerOrder` SB3 field.
- Inspector extension sections can serialize project-level and target-level metadata.
- Required custom extensions and their URLs are retained when an Inspector property is used without extension blocks.
- Inspector property changes have a 100-command in-memory undo/redo stack.
- Loading a project clears the previous project's history.

## Saved metadata shape

```json
{
  "ngvge": {
    "version": 1,
    "projectSections": {
      "camera": {}
    }
  },
  "targets": [
    {
      "ngvge": {
        "version": 1,
        "sections": {
          "camera": {},
          "stretch": {}
        }
      }
    }
  ]
}
```

The metadata is additive. Existing Scratch project fields and VM execution semantics are not replaced.

## Undo/redo coverage

- Sprite name
- X and Y
- Direction
- Size
- Rotation style
- Visibility
- Draggable state
- Layer ordering
- Registered extension fields, including Camera V2 and XY Stretch

Undo/redo history is intentionally not saved in the SB3 file.
