# NGVGE 0008.9.7 Preflight — Module Bootstrap Compatibility Fix Validation

## Root cause class
`createInitialState()` used lifecycle enums obtained from the aggregate `first-party-modules/constants.js` module. In an incremental overlay/build where `module-manager.js` and the aggregate constants surface are not from the same generation, `MODULE_ENABLE_COMPLETION` can be undefined and browser bootstrap fails before built-in module registration completes.

## Structural fix
Lifecycle state constants now live in a zero-dependency leaf contract. Module Manager imports the leaf directly. The aggregate constants module only re-exports those exact objects.

## Dedicated destructive regression
The validation script intentionally removes `MODULE_ENABLE_COMPLETION` and `MODULE_STATES` from the already-loaded aggregate constants export, reloads Module Manager, registers a module, and verifies the initial state remains:

- enableCompletion = `idle`
- state = `registered`
- enabled = false
- initialized = false

Result: PASS.

## Architecture regression
- Module Bootstrap Integrity: PASS
- Runtime Node Public Boundary: PASS
- Runtime Node Lifecycle full chain: PASS
- Runtime Component / Schema / Migration full chain through 0008.9.6.1.1: PASS
- Foundation Extensions: PASS
- touched JavaScript `node --check`: PASS
- package.json parse: PASS

## Limitations
The archive has no root `node_modules`. Full Jest, ESLint, Webpack build and browser integration execution were not performed in this environment. A Jest regression file is included for the next dependency-complete run.
