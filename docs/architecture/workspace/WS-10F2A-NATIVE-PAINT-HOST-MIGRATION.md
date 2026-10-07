# WS-10F2A｜Native Paint Host Migration

**Status:** `COMPLETE / VERIFIED`  
**Parent:** `WS-10F | Vector Backend Integration`  
**Architecture Parent:** `ARC-0001 | Kernel Independence Contract`

## Decision

The primary Better Paint presentation is the existing native Costume / Backdrop editor host. Better Paint is a paint system, not a standalone app/window requirement.

```text
Sprite -> Costumes
Stage  -> Backdrops
        |
        v
Native CostumeTab / AssetPanel
        |
        +-- SVG    -> NGVGE PaintSession -> SVG-Edit backend
        `-- Raster -> legacy Scratch Paint compatibility surface (WS-10F2A only)
```

The existing `ngvge.tool.paint` capability identity and Paint session remain valid infrastructure. The standalone Better Paint window is retained only as a compatibility/development presentation during migration and is not the semantic owner of Paint state.

## Native host identity

```text
Host             ngvge.native-paint-host@1
Presentation     ngvge.paint-presentation.costume-tab@1
Paint session    ngvge.workspace-paint-tool-session@1
```

The host owns only presentation coordination. It does not own Project, Resource, transaction, SVG, renderer or VM mutation authority.

## Canonical Resource adoption

Legacy Scratch costumes may not yet have a canonical Resource binding. The native Vector host therefore performs one-time compatibility adoption through the Global Asset Resource authority:

```text
Scratch costume
    |
    | unbound
    v
Global Asset Resource authority
    |
    +-- new internal asset:* record
    +-- new canonical ngvge:resource:* identity
    `-- costume binding
```

Native adoption is intentionally **not content-deduplicating**. Two byte-identical unbound costumes become two distinct canonical Resources unless the user explicitly created/shared a Global Asset binding. This prevents editing one native costume from unexpectedly mutating another identical costume.

`getCostumeResourceId()` is read-only. `ensureCostumeResource()` performs adoption only when no valid binding exists and is idempotent afterward.

## Vector path

```text
CostumeTab selection
        |
        v
NativePaintHost
        |
        v
canonical ResourceId
        |
        v
PaintSession.selectResource(ResourceId)
        |
        v
Working Copy
        |
        v
WorkspaceVectorEditor
        |
        v
SVG-Edit adapter
```

Vector edits remain working-copy edits. The native host never calls `vm.updateSvg()`, `vm.renameCostume()`, renderer setters or raw Scratch asset mutation for the Vector path.

Commit remains:

```text
Working Copy -> Review -> Evidence -> Project Transaction -> Resource Authority
```

## Raster compatibility path

WS-10F2A does **not** pretend Bitmap integration is complete. PNG/JPG/etc. continue to render the existing native `PaintEditorWrapper` compatibility surface. Raster is not auto-adopted into the new PaintSession in this stage, because the legacy Scratch Paint callback still mutates VM content directly and binding it prematurely would create Resource/VM divergence.

Raster migration is owned by WS-10G.

## Dirty switching rule

A dirty canonical Paint working copy blocks native costume switching, deletion, duplication and export of the current costume until the user reviews/commits or discards the pending working copy. This avoids hiding a dirty Vector working copy behind a different native costume.

The full unsaved-change dialog/workflow is deferred to WS-10F2E; WS-10F2A establishes the fail-closed boundary.

## Presentation ownership

The native Costume / Backdrop page already provides:

- target context;
- costume/backdrop resource list;
- item selection;
- upload/library/create actions;
- editor content slot.

WS-10F2A reuses that host instead of creating another window/layout authority. Professional unified tool rail/context toolbar/panels are deferred to WS-10F2B onward.

## Non-goals

- no miniPaint integration;
- no Piskel integration;
- no raster Working Copy migration;
- no pixel mode;
- no animation timeline;
- no Illustrator-inspired professional shell yet;
- no final standalone Paint window removal yet;
- no new Project/Resource authority.

## Exit criteria

- native Costume/Backdrop host renders the new Vector backend;
- selected SVG costume resolves/adopts a canonical ResourceId;
- native Vector edit continues through the existing Paint Working Copy;
- two identical unbound costumes do not become an implicit shared Resource;
- dirty working copy blocks unsafe native item switching;
- raster remains explicitly compatibility-only;
- standalone Paint window is documented as compatibility/development presentation;
- focused unit/DOM tests and production entry Webpack pass.
