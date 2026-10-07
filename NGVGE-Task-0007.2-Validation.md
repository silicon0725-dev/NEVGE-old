# NGVGE Task-0007.2 Validation

## Result

Task-0007.2 has been applied to the NES-branded Task-0007.1 source.

## Implemented

- A project-level hierarchical Node Tree database.
- Stable logical node IDs independent of Scratch runtime target IDs.
- Stage and Sprite target-backed nodes.
- Root-node creation and child-node creation.
- Built-in node types:
  - `Node2D`
  - `PhysicsBody2D`
  - `Collider2D`
  - `Marker2D`
- Recursive node display in Project Explorer.
- A node-type and optional-name creation panel.
- Child creation under the selected compatible parent.
- Selecting a child node keeps its nearest Sprite as the active Scratch editing target.
- Node Inspector support for identity, enabled state, type fields, hierarchy, and deletion.
- Shared Task-0005 Undo/Redo support for create, rename, property edit, enable/disable, reparent, and delete.
- Additive project persistence under the hidden `ngvge-node-tree` project section.
- Target rebinding by original-target order when runtime target IDs change after loading.
- Node database reset when opening another project.
- A versioned node-type registry designed for the future NGVGE plugin host.
- Missing plugin node types preserve raw data rather than deleting it.

## Validation completed

- JavaScript and JSX parsing: PASS
- Relative import resolution: PASS
- CSS Module reference coverage: PASS
- Target synchronization: PASS
- Nested PhysicsBody2D / Collider2D creation: PASS
- Node property updates: PASS
- Undo and Redo: PASS
- Node project-section serialization: PASS
- Runtime target-ID rebinding: PASS
- Project load reset: PASS
- Plugin node-type registration: PASS
- Patch application and byte comparison: PASS

## Recommended local test sequence

1. Start the editor and expand `Project → Entities`.
2. Select a Sprite.
3. Choose `Physics · PhysicsBody2D`, enter a name, and click `+ Child Node`.
4. Select the new body node.
5. Choose `Physics · Collider2D` and create another child.
6. Select the collider and edit its shape, dimensions, trigger flag, layer, and mask in Inspector.
7. Create a root `Node2D` and verify it remains selectable independently of the active Sprite.
8. Rename, disable, and delete nodes.
9. Test Undo and Redo after each operation.
10. Save as SB3, reopen it, and verify node hierarchy and properties return.
11. Open a different project and confirm old custom nodes do not leak into it.

## Runtime boundary

`PhysicsBody2D` and `Collider2D` are currently data nodes. This version does not run physics, resolve collisions, or draw collision shapes on the Stage. Those behaviors will be attached through the later runtime/component/plugin system.

## Not executed in this runtime

The source archive does not include `node_modules`, and Bun is unavailable. The complete Jest, ESLint, and Webpack suites were not executed.

Run locally:

```bash
bun run test:lint
bun run test:unit -- project-node
bun run build
bun run start
```

## Suggested commit

```text
feat(project-nodes): add hierarchical node tree foundation
```
