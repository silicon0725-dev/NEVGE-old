# Validation — Scene System First-party Module

## Automated/source checks performed

- `module-gallery-adapter.js`, `index.js`, and the Scene System module definition pass Node syntax checks.
- Module gallery smoke test verifies:
  - required core modules are not exposed;
  - the Scene System appears while disabled;
  - enabling changes the real module manager state;
  - enabled state is present in serialized project metadata;
  - disabling changes the real module manager state back;
  - extension manifest version and NGVGE source metadata are correct.
- Translation JSON files parse successfully.
- JSX delimiter balance and CSS brace balance were checked.
- ZIP integrity is checked after packaging.

The supplied source tree does not contain the root `node_modules`, so full Jest, ESLint and Webpack execution was not possible in this environment.

## Manual acceptance flow

1. Start the editor with a normal SB3 project.
2. Confirm that no scene selector is visible initially.
3. Open **Extension Center → NGVGE Official**.
4. Confirm a **Scene System** card is present with:
   - NGVGE Official;
   - Native;
   - Experimental;
   - Partial SB3;
   - **Enable module** action.
5. Enable the module.
6. Confirm the Extension Center closes and the scene selector immediately appears in the menu bar.
7. Create at least two scenes and switch between them.
8. Reopen the Extension Center and confirm:
   - Scene System has the installed check mark;
   - the action reads **Disable module**;
   - it appears under Installed.
9. Save and reopen the project. Confirm the Scene System is enabled and the scenes remain available.
10. Disable the module. Confirm the scene selector disappears without deleting the current Scratch project state.
11. Re-enable it. Confirm the previous scene collection returns.
12. Open a plain SB3 with no NGVGE metadata. Confirm the Scene System starts disabled.

## Regression checks

- Normal Scratch extensions still load through `vm.extensionManager`.
- NGVGE Camera V2 and NGVGE XY Stretch remain ordinary compatible extensions.
- First-party modules cannot be selected for batch extension import.
- Planned first-party modules do not appear as usable cards.
- `ngvge.core` remains enabled and cannot be disabled from the UI.
