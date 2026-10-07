# NGVGE Task 0008.6.1 Validation

## Root causes

### Runtime synchronization recursion

`RuntimeNodeModelService` subscribed to both Scene Data `data` and `status` events. Its synchronization path called `readProject()`, which emitted another `status` event. A normal read could therefore cause hundreds of nested graph synchronizations and unstable capability/UI state.

Fixes:

- Scene Data status events are emitted only when status actually changes.
- Runtime scene graph synchronization reacts only to data mutations.
- A reentrancy guard prevents nested synchronization.
- Status changes update service diagnostics without rebuilding the graph.

### Project Explorer was not connected to Scene ownership

The Runtime Node Model was created as an independent in-memory layer, while Project Explorer continued to read only the legacy `project-nodes` authoring database. No Scene roots were rendered.

Fixes:

- Project Explorer reads Scene System capabilities when the module is enabled.
- The active Scratch targets and authoring nodes are grouped under the active Scene root.
- A persistent Global root is shown.
- Inactive Scene roots are shown and can trigger a scene load.
- The old Entities layout remains unchanged when Scene System is disabled.

### Scene Selector failure was invisible

The selector returned `null` whenever Scene Manager or Scene Runtime capabilities were temporarily unavailable.

Fix:

- Enabled/error module states now render a disabled `Unavailable` selector with the module error in its title instead of silently disappearing.

## Automated checks performed

- `node --check` passed for all modified CommonJS runtime files.
- TypeScript parser check passed for the modified JSX and test files using `tsc --allowJs --jsx react --noEmit`.
- Runtime smoke test confirmed Scene System reaches `enabled` state and provides manager, runtime, and node model capabilities.
- Repeated `readProject()` calls produced zero Runtime Graph revisions after initialization.
- ZIP integrity checks passed for the incremental patch and complete project archives.

## Full dependency-suite limitation

The provided project archive does not contain `node_modules`, so full Jest, ESLint, and Webpack execution was not available in this environment. Regression tests were added for recursive synchronization and Project Explorer Scene grouping.

## Manual acceptance

1. Open the NGVGE editor with a normal single-scene project.
2. Enable Scene System from NGVGE Official modules.
3. Confirm the Scene Selector remains visible in the menu bar.
4. Confirm Project Explorer changes from `Entities` to `Global` plus named Scene roots.
5. Expand the active Scene and confirm Stage, Sprites, and authoring nodes appear beneath it.
6. Create a second Scene and confirm it appears as another Scene root.
7. Select the inactive Scene root and confirm the editor loads that Scene.
8. Disable Scene System and confirm Project Explorer returns to the legacy Entities layout.
