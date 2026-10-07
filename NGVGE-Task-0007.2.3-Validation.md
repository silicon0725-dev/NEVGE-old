# NGVGE Task-0007.2.3 Validation

## Result

Task-0007.2.3 has been applied to the Task-0007.2.2 NES Studio source.

## Implemented

- Create New Node and Rename Node dialogs now render through a document-body portal.
- Modal and context-menu stacking levels are above Stage, Inspector, Asset Workspace, and other floating windows.
- The built-in project now starts blank: one required Stage target, one blank backdrop, no sprites, scripts, variables, lists, broadcasts, or sounds.
- The legacy `override-default-project.sb3` and `02engine.svg` starter assets were removed from the complete package.
- The empty scene tree shows 2D Node, User Interface Node, and a disabled 3D Node placeholder only when there are no custom nodes and no sprite targets.
- Right-click creation is reduced to one Add Node / Add Child Node command.
- The node picker searches all registered node types and groups results by node family and category.
- Child creation stores the parent node ID instead of relying on a stale object reference.
- Node context menus now include Rename, Duplicate, Enable/Disable, Reparent to Scene Root, Expand/Collapse, and Delete.
- Node subtree duplication is implemented as one undoable database mutation.

## Validation completed

- Changed JavaScript and JSX parser validation using TypeScript: PASS
- CSS Module class reference coverage: PASS
- Relative import resolution: PASS
- Git whitespace validation: PASS
- Patch application to a clean Task-0007.2.2 tree: PASS
- Patched result byte comparison: PASS
- Full and update ZIP integrity: checked during packaging

## Local acceptance sequence

1. Stop the current development server and install the update.
2. Start NES Studio and confirm the default project contains only Stage.
3. Confirm the empty node area shows the three root preset buttons.
4. Create a 2D root node and confirm the preset buttons disappear.
5. Open Stage, Asset Workspace, and Inspector windows, then open Create New Node and confirm the dialog stays above them.
6. Right-click a node, choose Add Child Node, search for `Collider2D`, and create it.
7. Test Rename, Duplicate, Enable/Disable, Reparent, Expand/Collapse, and Delete.
8. Save and reload the project and confirm the hierarchy remains intact.

## Small update cleanup

The update ZIP contains `CLEANUP-LEGACY-DEFAULT-PROJECT.bat`. Run it from the project root after extracting the update if you also want the obsolete demo files physically removed. The new code no longer loads them even when they remain on disk.

## Not executed here

The uploaded source package does not contain `node_modules`, and Bun is unavailable in this runtime. The complete Jest, ESLint, and Webpack suites were therefore not executed. Run locally:

```bash
bun run test:lint
bun run test:unit -- project-explorer project-nodes default-project
bun run build
bun run start
```

## Suggested commit

```text
refactor(project-nodes): align node workflow with searchable scene tree creation
```
