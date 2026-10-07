# NGVGE 0008.9.7 UI Integration Hotfix 2 Validation

## Scope

This hotfix addresses three real GUI integration failures found after 0008.9.7:

1. Scene creation failed at `capability:ngvge.scene-runtime` with a sanitized `promise:reject`.
2. Extension Library remote CCW requests could call `setState()` after the component unmounted.
3. The GUI ErrorBoundary implemented `componentDidCatch()` without `getDerivedStateFromError()`.

## Root causes and fixes

### Scene runtime restore boundary

The scene snapshot serializer passed a module-created `JSZip` instance through the `vm` Service facade into `vm.deserializeProject(projectJSON, zip)`. The Service membrane correctly rejects opaque class instances with `MODULE_SERVICE_ARGUMENT_UNSUPPORTED`.

A Host-owned `vm-project-io` Service now accepts only portable `projectJSON + base64 archive` data. The Host adapter reconstructs JSZip and invokes Scratch VM internally. Scene restore rollback uses the same boundary.

### Extension Library asynchronous lifetime

`fetchAndSetCCWItems()` and initial gallery loading could complete after `ExtensionLibrary` unmounted. The container now tracks mounted state and request generation, clears pending gallery timeout state, and discards late CCW/gallery completions.

### ErrorBoundary React contract

`ErrorBoundary` now implements `static getDerivedStateFromError()`. `componentDidCatch()` records the first component stack and retains the existing restore-point behavior.

## Focused real integration

A real `scratch-vm + Module Manager + Scene System Capability facade` test creates a blank scene and loads it through `ngvge.scene-runtime` without sending JSZip through the Module Service membrane.

## Validation

- Runtime Node Public Boundary: PASS
- Runtime Node Lifecycle chain: PASS
- Component / Schema / Migration / Error / Snapshot / 0008.9.7 architecture chain: PASS
- Focused NGVGE + Scene + GUI Jest: 44 suites / 191 tests PASS
- WDS development compilation: PASS (`Compiled successfully`)
- New scene Service-boundary integration: PASS
- ExtensionLibrary post-unmount CCW result suppression: PASS
- ErrorBoundary derived error-state contract: PASS

## Full unit-suite note

The complete repository `test/unit` run remains blocked by the pre-existing ProjectExplorer Node-Jest environment issue (`document is not defined` in passive effects). This is unrelated to this hotfix and was not modified here.

## Non-blocking external asset warning

`https://sharkpoolextensions.02studio.xyz/extension-thumbs/Example.svg` may still return HTTP 404. This is a remote thumbnail availability issue and is not involved in NGVGE module lifecycle or scene runtime authority.
