# Validation — 0008.4.6 Adaptive Scene Cache

## Automated/source checks performed

- Node syntax checks pass for all modified CommonJS source files.
- Adaptive budget smoke tests verify:
  - 2 GB devices select 8 MiB;
  - 4 GB devices select 32 MiB;
  - 8 GB devices select 128 MiB;
  - unknown devices fall back to 16 MiB;
  - Electron memory data applies the free-memory cap;
  - browser heap pressure reduces the effective browser budget;
  - project-specific configured budgets override automatic tiers.
- Cache-manager smoke tests verify:
  - byte-budgeted LRU demotion;
  - Hot/Warm/Cold transitions;
  - high-pressure Warm-to-Cold demotion;
  - critical-pressure removal reporting;
  - oversized entries remain Cold;
  - zero-byte budgets disable preloading;
  - recommended preload counts are 1 / 2 / 5 across the three tiers.
- Serializer integration smoke tests verify:
  - captured snapshots are cached without immediate re-decompression;
  - external preload and restore share one archive expansion;
  - restored scenes become Hot;
  - project-specific budget configuration persists and resets;
  - high pressure rejects background Warm retention while preserving the loaded foreground scene as Hot.
- First-party module smoke tests verify:
  - Scene System enables normally;
  - the runtime exposes adaptive-cache APIs;
  - cache configuration persists in serialized module data;
  - disabling the module revokes the capabilities.
- Changed-file and ZIP integrity checks are performed during packaging.

The source tree does not include root `node_modules`, so the full Jest, ESLint and Webpack suites could not be executed in this environment. Jest test files are included for execution in a complete checkout.

## Suggested automated command

Run from the project root after installing dependencies:

```bash
node ./node_modules/jest/bin/jest.js --runInBand \
  test/unit/lib/scene-system/scene-cache-budget.test.js \
  test/unit/lib/scene-system/scene-cache-manager.test.js \
  test/unit/lib/scene-system/scene-snapshot-serializer.test.js \
  test/unit/lib/scene-system/scene-runtime-manager.test.js \
  test/unit/components/scene-selector.test.jsx \
  test/unit/lib/scene-system/scene-system-module.test.js
```

Then run:

```bash
npm run test:lint
npm run build
```

## Manual acceptance flow

1. Open a normal project and enable **Scene System** from **Extension Center → NGVGE Official**.
2. Create at least six scenes with different asset sizes.
3. Open the Scene Selector and confirm nearby scenes preload without blocking scene-manager operations.
4. Switch repeatedly between nearby scenes and confirm preloaded scenes avoid repeated archive expansion.
5. Confirm the runtime cache report contains:
   - `budgetBytes`;
   - `usedBytes`;
   - `memoryPressure`;
   - Hot/Warm/Cold counts;
   - `recommendedPreloadCount`.
6. Set an 8 MiB override and confirm only one nearby scene is selected for automatic preload.
7. Set a 128 MiB override and confirm up to five nearby scenes can be selected when their estimated size fits.
8. Set the override to zero and confirm automatic preload stops while direct scene loading still works.
9. Reset the override to `null` and confirm automatic device-based selection returns.
10. Save and reopen the project; confirm a configured override persists.
11. Disable and re-enable Scene System; confirm scene data and the configured budget remain available.

## Regression checks

- Scene snapshots retain the existing `ngvge-sb3-scene` schema and Base64 archive representation.
- Standard SB3 sanitization is unchanged.
- Large scenes remain directly loadable when they cannot be retained as Warm entries.
- Concurrent preload requests for the same archive remain deduplicated.
- Legacy serializer options remain accepted.
- Scene Selector hover/focus preload remains functional.
- Scene System remains opt-in and disabled for plain SB3 projects without module metadata.
