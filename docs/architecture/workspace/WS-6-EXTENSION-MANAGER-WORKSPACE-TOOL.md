# WS-6 | Extension Manager Workspace Tool

**Status:** `COMPLETE / VERIFIED`
**Parent:** `ARC-0001 | Kernel Independence Contract`
**Predecessor:** `WS-5 | Node Explorer Workspace Integration — COMPLETE / VERIFIED`

## Purpose

WS-6 introduces one first-party Workspace product surface for extension discovery and management without collapsing the three certified runtime host authorities into one generic plugin runtime.

The Workspace Tool identity is:

```text
ToolId:   ngvge.tool.extension-manager
WindowId: extension-manager
```

The stage establishes these supporting identities:

- `ngvge.workspace-extension-manager-model@1`
- `ngvge.workspace-extension-manager-runtime@1`
- `ngvge.workspace-extension-manager-discovery@1`
- `ngvge.workspace-extension-manager.legacy-addon-adapter@1`
- Extension Manager projection item schema `v1`

The product boundary is:

```text
Extension Manager Workspace Tool
        ↓ unified read/presentation model
WorkspaceExtensionManagerModel
        ├── NGVGE Modules
        │      ↓
        │   Module Manager client
        │
        ├── Scratch Extensions
        │      ↓
        │   ScratchExtensionHost
        │
        └── Legacy Addons
               ↓
            LegacyAddon adapter
               ↓
            SettingsStore + LegacyAddonHost descriptor boundary

Trust / capability / permission presentation
        ↓
LEX ExtensionDescriptor query boundary
```

The UI is unified. Runtime authority is not.

## Workspace Tool / Window integration

`ngvge.tool.extension-manager` is registered in the Workspace ToolRegistry as a first-party singleton Tool with command scope `extensions`.

It is default-hidden and not added to the default pinned Dock list. Because Launchpad inventories ToolRegistry dynamically, the new Tool automatically appears in `All Tools` and `First-party` without a Launchpad-specific tool list.

The singleton WindowDefinition uses `extension-manager` and is owned by WindowManager. The GUI opens/focuses/restores it through the existing Dock / Launchpad interaction authority. The component does not create a free-floating document-level application and does not own window state persistence.

WS-4 persists the registered WindowModel through the existing Workspace persistence contract; the DraggableWindow compatibility persistence path remains disabled.

## Unified product projection

The Extension Manager unifies only the product-level concepts required by WS-6:

- Discovery;
- Search;
- Classification;
- installed/enabled state;
- compact list presentation;
- detail inspection;
- Permission / Trust presentation.

It does not define a universal extension execution API.

### NGVGE Modules

Discovery/state comes from the first-party Module client. Enable and disable delegate to `moduleClient.enableModule()` / `moduleClient.disableModule()`.

The Manager never imports or mutates Module Manager private host state.

### Scratch Extensions

Discovery merges the existing Scratch/TurboWarp extension library content with the live Extension Hub registry. The registry now publishes lifecycle events so dynamic source registration can refresh the Workspace projection.

Installed/enabled state is derived from `ScratchExtensionHost.listLoadedExtensionIds()` / `isExtensionLoaded()`.

Load/unload delegates only to:

```text
ScratchExtensionHost.loadBuiltInExtension
ScratchExtensionHost.loadExtensionURL
ScratchExtensionHost.unloadExtension
```

The Workspace Manager never reads `_loadedExtensions` and never reaches Scratch's raw ExtensionManager.

### Legacy Addons

The Legacy Addon adapter projects bundled addon manifests and SettingsStore state. It registers each local addon with `LegacyAddonHost.registerAddon()` so the Workspace detail view can query a certified LEX ExtensionDescriptor.

`registerAddon()` is an idempotent descriptor upsert; constructing or rebuilding the Manager does not execute the addon.

Enable and setting mutation remain delegated to the Legacy Addon adapter / SettingsStore. Raw VM acquisition remains exclusively inside the existing LegacyAddonHost quarantine and is not exposed to WS-6.

## Trust and permission presentation

LEX remains the authority for effective trust, requested/effective execution mode, capabilities and permissions.

When an extension has a LEX ExtensionDescriptor, the Manager projects that descriptor. When a Scratch catalog item is only discoverable but has not entered a runtime host, the Manager deliberately exposes:

```text
Trust: Not evaluated
```

It does not infer or fabricate an effective trust level from catalog metadata.

This preserves the distinction between discovery metadata and security/containment decisions.

## Three-pane Workspace layout

The Workspace Tool follows the WS-6 product layout:

```text
Navigation                Compact List              Detail Inspector
All                       compact cards             Overview
Installed                                           Settings
Enabled                                             Permissions
Disabled                                            Compatibility
Updates                                             About
Categories
  NGVGE Modules
  Scratch Extensions
  Legacy Addons
```

Search filters the unified projection without changing host state.

The `Browse catalog` action may open the existing extension library for additional catalog/discovery sources. This does not give the Manager a second Scratch runtime loading authority.

## Settings boundary

Complete extension settings are never expanded inline inside the compact main list.

Settings are shown only in the Detail Inspector `Settings` tab. In WS-6 the generic setting bridge is deliberately limited to Legacy Addon settings already represented by SettingsStore. NGVGE Module and Scratch Extension host-specific settings require a future explicit host settings contract rather than ad-hoc private-object access.

## Updates boundary

`Updates` is a first-class navigation view in the Workspace UI. WS-6 defines the projection field `updateAvailable`, but does not invent a package/update authority where none is currently certified. Current first-party projections therefore report no update until a source/host supplies an explicit update signal.

## Persistence boundary

WS-6 creates no new localStorage or Workspace persistence schema.

- Window layout/state remains owned by WS-4.
- Extension installed/enabled state remains owned by the corresponding runtime host or existing addon settings system.
- LEX descriptors remain runtime containment records.
- Extension discovery state remains catalog/registry projection.

The Extension Manager does not serialize host-private objects into Workspace preferences.

## Explicit prohibitions

The WS-6 product model and UI must not acquire:

- `window.vm` authority;
- Scratch `_loadedExtensions` access;
- raw Scratch ExtensionManager access;
- Module Manager private host access;
- Legacy raw VM leases;
- a new generic extension execution host;
- a second localStorage persistence domain;
- WS-7 Agent mutation or ChangeSet authority.

## Verification

See:

- `WS-6-VERIFICATION.md`
- `WS-6-CERTIFICATE.json`
- `WS-6-extension-host-boundary-matrix.csv`
