NGVGE Task-0008.4.5 — Scene Preload Optimization

Base: Task-0008.4.5 Scene Selector UI project.
Copy this archive's src/ and test/ directories over the project root.

Main changes:
- Scene snapshot LRU preload cache.
- Newly captured and newly created blank snapshots are cached before compression output is consumed.
- Small scene archives are fully materialized in memory, avoiding repeated ZIP decompression during loading.
- Large snapshots automatically fall back to parsed-archive caching.
- Scene Runtime exposes preloadScene(), preloadScenes() and isPreloaded().
- Opening the Scene Selector preloads the two nearest scenes.
- Hovering or focusing a scene switch button preloads that scene.
- Loading a scene reuses a pending preload instead of starting duplicate work.
- Adjacent scenes are preloaded after a successful switch.
- Cache entries are bounded and cleared when the module is disposed.

Default memory policy:
- Maximum cached archives: 2
- Maximum fully materialized snapshot: 16 MiB

The Scene System module version is updated from 0.5.0 to 0.5.1.
See NGVGE-Task-0008.4.5-Preload-Validation.md for acceptance steps.
