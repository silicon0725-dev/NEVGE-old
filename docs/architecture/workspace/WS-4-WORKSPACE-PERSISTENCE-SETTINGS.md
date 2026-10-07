# WS-4 | Workspace Persistence / Settings

**Status:** `COMPLETE / VERIFIED`
**Parent:** `ARC-0001 | Kernel Independence Contract`
**Predecessor:** `WS-3 | Dock Foundation — COMPLETE / VERIFIED`

## Purpose

WS-4 establishes NGVGE-owned, versioned Workspace persistence instead of continuing to treat legacy `localStorage` entries and draggable-window caches as Workspace authority.

Stable contracts:

- `ngvge.workspace-layout@1`
- `ngvge.workspace-preferences@1`
- `ngvge.workspace-persistence-host@1`
- `ngvge.workspace-storage-adapter.local@1`
- `ngvge.workspace-legacy-migration@1`

The persistence pipeline is:

```text
Legacy compatibility inputs
        ↓ read / validate / normalize
WorkspacePersistenceBootstrap
        ↓
WorkspaceLayoutSchema v1 + WorkspacePreferencesSchema v1
        ↓
WorkspacePersistenceHost
        ↓
Scope-separated storage adapter
```

## Scope ownership

WS-4 explicitly distinguishes these scopes:

```text
Project
Workspace
User
Device
Session
Secret
```

Workspace local persistence owns only Workspace/User/Device records. Project state continues through Project Lifecycle Authority. Session state stays in memory. Secret data remains outside Workspace persistence and under the credential containment/service boundary.

## WorkspaceLayoutSchema v1

The Layout document owns durable Workspace topology and geometry:

- persistable Window geometry and visible/minimized/maximized state;
- Dock pinned ToolIds and global order;
- Dock placement preference;
- Dock organization preference;
- tool-panel sizes;
- per-window presentation options such as Stage `autoFit`.

Dynamic Editor windows remain `persist:false` and therefore never become durable Workspace Window entries.

## WorkspacePreferencesSchema v1

Preferences are divided by scope:

Workspace:

- `mode`: `custom | classic`
- `dockPresentation`: `floating | sidebar | drawer | compact-shelf`
- `organizationMode`: `flat | grouped | custom`

User:

- editor background metadata;
- theme preference.

Device:

- migration version.

The local adapter uses separate records for Layout, Workspace preferences, User preferences and Device preferences. There is no WS-4 storage key for Project, Session or Secret.

## Settings

The 02Engine Settings surface is now a client of the active Workspace Persistence Host. It exposes:

- presets: Floating Dock, Left Sidebar, Compact Bottom, Bottom Drawer;
- Dock presentation;
- top / bottom / left / right placement;
- start / center / end alignment;
- offsetX / offsetY;
- flat / grouped / custom organization mode;
- Reset Workspace Layout.

Presets are operations over the same v1 preferences; they do not create a second preset state authority.

## Legacy migration

WS-4 reads these compatibility inputs when no new v1 record exists:

- `scratch-gui-window-states`;
- `tw:customUI`;
- `tw:editorBackground`;
- `tw:theme`;
- `tw:blockFlyoutWidth`.

Migration follows:

```text
read old
→ validate
→ normalize
→ write new
→ retain old fallback during migration window
```

New writers no longer rewrite those Legacy keys. Classic UI may continue consuming legacy window persistence during the migration window; Custom Workspace managed windows explicitly disable `DraggableWindow` legacy persistence.

## WS-3D round-trip closure

WS-4 serialization exposed a WS-3D defect: organization nodes emitted `schemaVersion` (and separators emitted `kind`) but the WS-3D normalizer previously rejected those same fields on reload. The normalizer now accepts and validates its own serialized node form. This is a round-trip correctness fix and does not change ToolId or organization authority.

## Authority constraints

WS-4 does not:

- persist Scratch Target, Renderer, VM or ExtensionManager identity;
- persist dynamic Editor Window instances;
- write Project state into Workspace storage;
- persist Session-only UI records;
- persist credentials/secrets;
- duplicate WindowManager semantic state authority;
- duplicate Dock pin/order/placement/organization ownership.

The Host serializes state from the existing WS models and restores those models during bootstrap.

## Verification

See `WS-4-VERIFICATION.md` and `WS-4-CERTIFICATE.json`.
