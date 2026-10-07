# Adaptive Scene Cache

Task: `0008.4.6`

The Scene System uses an in-memory cache to avoid repeatedly expanding the same scene snapshot before a scene switch. The cache is transient and does not change the persisted SB3-compatible scene snapshot format.

## Budget selection

The effective cache budget is resolved in this order:

1. Project-specific configured byte budget.
2. Electron `process.getSystemMemoryInfo()` when exposed by the host.
3. Browser `navigator.deviceMemory`.
4. A 16 MiB fallback.

Automatic tiers:

| Device class | Base budget |
| --- | ---: |
| Up to 2 GB | 8 MiB |
| Up to 4 GB | 32 MiB |
| 8 GB and above | 128 MiB |
| Unknown | 16 MiB |

When Electron system memory is available, the tier is capped to two percent of currently free system memory, with an automatic range of 8–128 MiB.

A single prepared scene may use at most 75 percent of the effective budget. Larger scenes remain loadable but are retained as cold entries instead of keeping expanded assets in memory.

## Cache levels

- **Hot**: the currently loaded scene snapshot. It is protected from normal LRU eviction.
- **Warm**: an expanded or parsed snapshot ready for a faster switch.
- **Cold**: metadata only. The compressed snapshot remains in the Scene System project data and must be expanded again before loading.

## Memory pressure

The cache manager derives pressure from Electron free memory and, when available, Chromium heap statistics.

- `low`: retain normal cache state.
- `medium`: remove cold index entries.
- `high`: demote non-active warm entries to cold.
- `critical`: retain only the active hot entry.

Budget and pressure are refreshed when the cache is accessed, populated, inspected or used to calculate preload depth. No background timer is required.

## Dynamic preloading

The Scene Selector and Scene Runtime ask the cache manager for the recommended preload count:

- low tier: one nearby scene;
- standard tier: two nearby scenes;
- high tier: up to five nearby scenes;
- zero-byte configured budget: preloading disabled.

When measured scene sizes are available, the count is reduced so the estimated preload set fits the current budget.

## Runtime API

```js
runtime.getCacheStatus();
runtime.getCacheConfiguration();
runtime.getRecommendedPreloadCount();
runtime.setCacheBudgetBytes(byteCount);
runtime.setCacheBudgetBytes(null); // return to automatic mode
```

The snapshot serializer exposes the corresponding lower-level methods plus `refreshCacheBudget()`.

## Persistence

A manual override is stored under:

```js
project.extensionData.sceneCache.budgetBytes
```

This lives inside Scene System module data. It is not injected into the sanitized Scratch `project.json` stored inside individual scene snapshots.
