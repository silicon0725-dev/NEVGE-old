# 0008.7.2.2 Cross-Scene Projection & Empty-Node Crash Hotfix — Validation

## Reported regressions

1. With scenes A and B, a Scratch Sprite created in B disappeared from B's branch after returning to A.
2. A `Scratch Sprite · Bound` node with no children still displayed a disclosure triangle.
3. Clicking that empty node crashed the Project Explorer.

The decisive crash entry in the supplied log was:

```text
project-explorer.jsx:1224 Uncaught ReferenceError: visitVisibleNode is not defined
```

The asset-network failures, Chrome Built-In AI notice and deprecated React lifecycle warnings are separate diagnostics and were not the cause of this Project Explorer exception.

## Root causes

### Partial binding index hydration

The adapter kept inactive bindings only if those scenes had already been reconciled during the current service lifetime. On project reopen or after certain scene transitions, an inactive scene's sidecar could exist while its binding and Runtime adapter node were absent from the in-memory indexes. Project Explorer therefore had no node to render for that scene.

### Scene restore ordering race

During `loadScene`, Scratch VM Targets are reconstructed before the Scene Data Model commits the destination `activeSceneId`. Public `targetsUpdate` and Runtime `PROJECT_LOADED` events could therefore reconcile the destination scene's Targets against the source scene ID.

### JSX truthiness used as child detection

`TreeNode` used `Boolean(children)`. Conditional JSX expressions can produce a children container containing only `null`; that container is truthy even though no row is renderable, producing a false disclosure arrow.

### Block-scoped compatibility traversal

`visitVisibleNode` was declared inside `if (nodeDatabase)` but called from the Runtime traversal declared outside that block. Clicking/selecting the adapter row caused the visible-order calculation to enter that call path and throw a `ReferenceError`.

## Implemented corrections

### Project-wide binding projection

- Rebuild binding indexes from all scenes in `project.extensionData.scratchSpriteBindings`.
- Merge active live bindings with inactive persistent bindings.
- Ensure each inactive persistent record has a corresponding Runtime Scratch Sprite Adapter node.
- Mark inactive scene bindings `offline` with `targetRuntimeId: null`.
- Preserve stable `bindingId` and Runtime Node ID across scene changes and project reopen.

### Transition guard

The adapter now subscribes to Scene Runtime changes:

```text
before-load / before-reload
    -> mark project bindings offline
    -> defer Target reconciliation

loaded / reloaded
    -> reconcile the committed destination scene

load-error / reload-error
    -> reconcile the still-active scene
```

This prevents destination Targets from being written into the source scene while `activeSceneId` is still changing.

### Empty-row disclosure fix

`TreeNode` now uses:

```js
const normalizedChildren = React.Children.toArray(children);
const hasChildren = normalizedChildren.length > 0;
```

Only actual renderable children create a disclosure button and `aria-expanded` state.

### Crash fix

The compatibility traversal is now defined as `visitProjectVisibleNode` in the shared function scope. Both the legacy Project Node traversal and Runtime Adapter traversal call that same valid function.

### Version

Scene System version:

```text
0.7.2.2
```

No persistent binding schema change was required.

## Static checks

Passed:

```text
node --check scratch-sprite-node-adapter-service.js
node --check scene-system/module-definition.js
node --check scratch-sprite-node-adapter-lifecycle.test.js
node --check scratch-sprite-node-adapter-service.test.js
tsc JSX parse: project-explorer.jsx
tsc JSX parse: project-explorer.test.jsx
```

A source scan also confirmed that `project-explorer.jsx` contains no remaining reference to `visitVisibleNode`.

## Behavioral smoke checks

Passed:

1. Establish Scene A binding.
2. Begin A -> B transition before changing `activeSceneId`.
3. Replace VM Targets and emit `targetsUpdate` plus `PROJECT_LOADED`.
4. Confirm B is not reconciled under A during the transition.
5. Commit Scene B and confirm B Sprite becomes Bound.
6. Add a second B Sprite and confirm a second stable binding is created.
7. Return to A and confirm both B bindings remain present as Offline.
8. Confirm both B Runtime adapter nodes remain in the Runtime Graph.
9. Recreate the service from saved project data and confirm both inactive B nodes hydrate from the sidecar.

Smoke output:

```text
0008.7.2.2 cross-scene smoke passed
```

## Added regression coverage

- Project Explorer: a unified childless adapter row has no disclosure button or `aria-expanded` state and can be activated safely.
- Adapter lifecycle: VM events are deferred during Scene restore and inactive Scene bindings survive as Offline.
- Adapter service: inactive Scene bindings and Runtime nodes hydrate from project sidecars.

## Expected UI after the fix

While Scene A is active:

```text
Scene A · Active
└── A Sprite       Scratch Sprite · Bound

Scene B · Inactive
├── B Sprite       Scratch Sprite · offline
└── B Sprite 2     Scratch Sprite · offline
```

An adapter Sprite with no Runtime or compatibility children has no disclosure arrow.

## Environment limitation

The supplied project does not contain root `node_modules`, so the complete Jest, ESLint and Webpack suites were not executed. Modified JSX files passed TypeScript parse checks, CommonJS files passed Node syntax checks, and a focused cross-scene behavioral smoke test was executed independently.
