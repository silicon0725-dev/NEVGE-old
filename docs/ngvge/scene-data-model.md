# NGVGE Scene Data Model v1

Task: `0008.4.1 Scene Data Model`

This stage defines the persistent contract used by the first-party `ngvge.scene-system` module. It does not switch Scratch VM targets, capture scene snapshots, add a scene selector, or change SB3 export behavior yet.

## Compatibility boundary

The Scratch-compatible core remains the source of truth for the currently loaded Stage, sprites, scripts, costumes, sounds, global variables and target-local variables. Scene System data is stored in the module-private project section created by Task 0008.3.

The Scene System module is experimental and opt-in. When disabled, a normal project remains fully SB3-compatible. When enabled, compatibility is reported as partial because standard SB3 can eventually contain only one selected scene.

## Project schema

```json
{
  "schemaVersion": 1,
  "activeSceneId": "scene_...",
  "startupSceneId": "scene_...",
  "scenes": [
    {
      "id": "scene_...",
      "name": "Scene 1",
      "snapshot": null,
      "variables": {
        "schemaVersion": 1,
        "items": []
      },
      "metadata": {
        "color": null,
        "tags": [],
        "thumbnailAssetId": null
      },
      "extensionData": {}
    }
  ],
  "extensionData": {}
}
```

`scenes` array order is the canonical editor order. `activeSceneId` identifies the scene represented by the live Scratch VM in future switching stages. `startupSceneId` identifies the scene that should run first. A null `snapshot` means that no off-VM Scratch snapshot has been captured yet; Task 0008.4.2 will define its payload.

## Variable ownership

The model defines three stable scope identifiers:

- `global`: owned by the Scratch project and shared between scenes.
- `scene`: owned by one Scene System record.
- `target`: owned by one Scratch Stage or sprite target.

Only scene-scoped variable records are stored in this module. Global variables are not duplicated, and target variables remain inside Scratch target data.

## Version policy

Unversioned provisional data is migrated to schema v1. Malformed v1 data is normalized conservatively. Data with a schema version newer than the editor supports is preserved byte-for-byte in module storage and exposed read-only; it is never silently downgraded.

## 0008.8 persistence hardening

Task `0008.8` changes the persistence path from permissive JSON cloning to strict plain-data validation.

Before `writeProject()` changes module storage, it rejects non-finite numbers, nested `undefined`, functions, symbols, BigInt, class instances, accessors, sparse arrays and circular references. The error includes the exact object path. This prevents `JSON.stringify()` from silently deleting or rewriting project state.

The write pipeline is now:

```text
validatePersistentData(raw input)
→ normalizeSceneProject()
→ validateSceneProject()
→ write module data
```

The Scene System also exposes `ngvge.scene-persistence-review@1`, which audits the Scene project together with Runtime Node and Scratch Binding extension records.
