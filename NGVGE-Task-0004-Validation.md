# NGVGE Task-0004 Validation

## Result

Task-0004 was applied directly to the Task-0003 `scratch-gui-main` source.

## Implemented

- A right-side Inspector in the original layout.
- A draggable, resizable and minimizable Inspector window in 02Engine custom UI.
- Direct editing for sprite name, X, Y, direction, size, rotation style, visibility and draggable state.
- Native layer management: front, up, down, back, plus a front-to-back layer list.
- A runtime Inspector registry for extension-defined property sections.
- Bundled `NGVGE Camera V2` and `NGVGE XY Stretch` extensions in the extension library.
- Camera properties: bound camera, camera X/Y, zoom and direction.
- Stretch properties: independent X and Y stretch.

## Validation completed

- TypeScript parser for all changed JavaScript and JSX: PASS
- Node syntax checks: PASS
- Reducer behavior: PASS
- Inspector registry behavior: PASS
- GUI/Redux integration markers: PASS
- CSS module reference coverage: PASS
- Git patch apply and exact-output comparison: PASS
- ZIP integrity: PASS

## Local validation still required

The uploaded source did not include `node_modules`, so Jest, ESLint and Webpack were not executed here. Run:

```bash
bun install
bun run test:lint
bun run test:unit -- project-inspector
bun run build
bun run start
```

## Extension usage

Open the extension library and load:

```text
NGVGE Camera V2
NGVGE XY Stretch
```

Their property sections will appear automatically in Inspector for the selected target. Do not load the original and NGVGE-adapted version of the same extension simultaneously.

## Source note

The uploaded Stretch source ended immediately after `getY` and lacked the final class closure, extension registration and IIFE closure. The adapted file completes those endings before registering the Inspector bridge.

## Suggested commit

```text
feat(inspector): add property editing and layer management
```
