# Task-0008.4.5 Scene Preload Optimization — Validation

## Automated tests

Run from the Scratch GUI project root:

```bash
node ./node_modules/jest/bin/jest.js --runInBand \
  test/unit/lib/scene-system/scene-snapshot-serializer.test.js \
  test/unit/lib/scene-system/scene-runtime-manager.test.js \
  test/unit/components/scene-selector.test.jsx
```

Expected coverage:

- A captured snapshot is immediately available in the warm cache.
- Explicit preload decompresses an external snapshot once.
- Restore reuses the materialized archive and reports `cacheHit: true`.
- Runtime deduplicates concurrent preload requests.
- Opening the selector requests preload for the nearest inactive scenes.
- Focusing a scene switch button requests preload for that scene.

## Manual acceptance

1. Start the editor and enable `ngvge.scene-system`.
2. Create at least three scenes; add several costumes or sounds to the second and third scenes.
3. Open the Scene Selector and leave it open briefly.
4. Switch to the next scene.
5. Return to the previous scene.
6. Create a new blank scene and switch to it.

Expected behavior:

- The selector opens immediately; preload work does not mark the Scene Manager as busy.
- Hovering or keyboard-focusing an inactive scene starts background preload.
- A preloaded scene switches without repeating archive decompression.
- A new blank scene uses the snapshot created in memory and does not decompress its just-created archive.
- Scene capture, active-scene selection and SB3-compatible snapshot persistence remain unchanged.
- After repeated switching, preload cache size does not exceed two entries.
- Snapshots larger than 16 MiB remain loadable and use the non-materialized cache path.

## Runtime inspection

The Scene Runtime capability now exposes:

```js
runtime.preloadScene(sceneId)
runtime.preloadScenes(sceneIds)
runtime.isPreloaded(sceneId)
runtime.getStatus().preloadedSceneIds
runtime.getStatus().preloadingSceneIds
```

`loadScene()` and `reloadScene()` return two additional diagnostic fields:

```js
{
    cacheHit,
    materialized
}
```
