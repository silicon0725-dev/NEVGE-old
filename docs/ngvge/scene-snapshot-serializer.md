# NGVGE Scene Snapshot Serializer v1

Task: `0008.4.2 Scene Snapshot Serializer`

This stage adds a self-contained Scratch VM capture and restore primitive to the experimental first-party `ngvge.scene-system` module. It does not add scene tabs, automatic switching, scene creation UI, or runtime scene transition blocks.

## Snapshot contract

Each scene snapshot is a versioned JSON envelope:

```json
{
  "schemaVersion": 1,
  "format": "ngvge-sb3-scene",
  "encoding": "base64",
  "byteLength": 12345,
  "archive": "...",
  "metadata": {
    "capturedAt": "2026-08-03T00:00:00.000Z",
    "sceneId": "scene_...",
    "projectVersion": 3,
    "targetCount": 2,
    "spriteCount": 1,
    "assetCount": 3,
    "hasStage": true
  }
}
```

`archive` contains a compressed SB3-compatible ZIP encoded as Base64. It includes the sanitized `project.json` plus all Scratch costumes, sounds, and custom font assets returned by `saveProjectSb3DontZip()`.

## Capture pipeline

```text
Scratch VM
  -> saveProjectSb3DontZip()
  -> parse project.json
  -> remove ngvge-first-party-modules project section
  -> preserve target-level NGVGE metadata
  -> ZIP project.json and assets
  -> Base64 snapshot envelope
  -> Scene.snapshot
```

The first-party module project section is excluded to prevent a scene snapshot from embedding the Scene System collection that contains the snapshot itself. Without this sanitization, repeated captures would recursively grow the project data.

## Restore pipeline

```text
Snapshot envelope
  -> validate schema and format
  -> decode ZIP
  -> read project.json
  -> stop current runtime
  -> vm.deserializeProject(projectJSON, zip)
  -> runtime.handleProjectLoaded()
```

Restore intentionally uses `deserializeProject()` instead of `loadProject()`. The NGVGE module framework wraps `loadProject()` to reset project modules before a new external project is opened. A scene restore must replace Scratch VM targets while preserving the live Scene System module and its complete scene collection.

## Capability

The module exposes:

```js
const snapshots = modules.getCapability('ngvge.scene-snapshot-serializer');
```

Public operations:

- `capture()`
- `captureScene(sceneId)`
- `captureActiveScene()`
- `restore(snapshot)`
- `restoreScene(sceneId)`
- `validate(snapshot)`
- `getStatus()`
- `subscribe(listener)`

Capture and restore are asynchronous and mutually exclusive. Starting another operation while one is in progress throws `SCENE_SNAPSHOT_BUSY`.

## Current limitation

Scene snapshots currently store a complete Scratch project state, including Stage-level variables. The later variable-scope and switching stages will preserve project-global values across scene restores and keep scene-scoped values in Scene System data.

## 0008.8 transactional restore protection

Before a destructive restore, the serializer captures the currently loaded Scratch project as an in-memory rollback point when `saveProjectSb3DontZip()` is available.

A failed target restore attempts to deserialize that rollback point and attaches the result to the original error:

```js
try {
    await snapshots.restore(snapshot);
} catch (error) {
    console.log(error.rollback);
    // {attempted: true, succeeded: true, error: null}
}
```

`restore()` returns `rollbackProtected: true` when protection was available. `getStatus()` exposes the last rollback result. Callers can pass `rollbackOnFailure: false` to opt out or `requireRollback: true` to reject a restore when a rollback point cannot be prepared.

The rollback point is sanitized with the same first-party module exclusion as normal scene snapshots, remains in memory and is discarded after the operation.
