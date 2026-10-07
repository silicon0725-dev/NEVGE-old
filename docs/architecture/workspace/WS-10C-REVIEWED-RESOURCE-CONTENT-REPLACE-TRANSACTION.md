# WS-10C｜Reviewed Resource Content Replace Transaction

**Status:** `COMPLETE / VERIFIED`  
**Architecture Parent:** `ARC-0001 | Kernel Independence Contract`  
**Workspace Parent:** `WS-10B | COMPLETE / VERIFIED`  
**WS-9 Foundation:** `COMPLETE / CERTIFIED`

## Objective

WS-10C turns the transient Better Paint working copy into a reviewed Project mutation without giving the Paint Tool direct Scratch, renderer, storage, or Resource-writer authority.

The certified path is:

```text
Paint Working Copy
        ↓
resource.content.replace command v1
        ↓
Project Proposal
        ↓
Transaction Review
        ↓
fresh Review Evidence
        ↓
Project Command Host
        ↓
Resource content adapter
        ↓
Global Asset Resource Authority
        ↓
Scratch storage / renderer compatibility backend
```

No Tool-visible API receives a Scratch asset, costume, VM, renderer skin, storage handle, or backend object.

## Project command surface

WS-10C extends Project Command v1 with:

```text
resource.content.replace
```

The command is portable and canonical-ResourceId-addressed:

```text
ResourceContentReplaceCommand v1
├── schemaVersion = 1
├── kind = resource.content.replace
├── resourceId = ngvge:resource:*
├── expectedSourceAuthorityRevision
├── dataFormat = svg | png | jpg
├── bitmapResolution
├── rotationCenterX/Y
├── byteLength
└── content
    ├── svg-text
    └── data-uri
```

The payload is bounded to 32 MiB decoded/estimated image content and contains no raw backend objects.

## Per-Resource content revision

WS-10C deliberately does not use the Global Asset Database global revision as the image-content precondition. Rename/move metadata operations advance database history but do not change pixels/SVG.

Each image record therefore owns a runtime content revision:

```text
contentRevision = N
```

The WS-10B source snapshot exposes that value as:

```text
sourceAuthorityRevision
```

A replace command must carry the revision observed by its working copy:

```text
expectedSourceAuthorityRevision === current contentRevision
```

Otherwise the command/review fails visibly as stale.

`contentRevision` is a runtime transaction precondition in WS-10C. It is not promoted into the Global Asset Database v3 persisted project schema. A project reload establishes a new runtime content-revision epoch from the loaded authoritative content.

## Content authority boundary

The Project Command Host does not create Scratch assets and does not mutate renderer objects. It delegates through a Resource transaction adapter to:

```text
GlobalAssetDatabase.replaceImageResourceContent(ResourceId, command)
```

Only that Resource authority method may:

- validate the current per-Resource content revision;
- decode the portable payload;
- sanitize SVG at the commit boundary;
- create the Scratch storage asset used by the current compatibility backend;
- load/update the renderer-compatible costume representation;
- preserve the canonical ResourceId and Resource metadata identity;
- synchronize Resource bindings;
- advance the runtime content revision;
- emit the canonical Resource replacement event.

This keeps Scratch storage/renderer behavior below the NGVGE semantic Resource boundary.

## SVG / bitmap compatibility handling

### SVG

```text
portable svg-text
        ↓
UTF-8 bytes
        ↓
SVG sanitizer at commit boundary
        ↓
Scratch storage asset
```

The Tool cannot bypass commit-boundary sanitization.

### PNG / JPG

```text
portable image data URI
        ↓
validated MIME / bounded decode
        ↓
Scratch storage asset
```

The browser Paint working-copy adapter currently emits PNG for bitmap edits; JPG remains readable/replaceable as a portable supported source format.

## Project transaction semantics

Content replacement participates in the existing WS-9G Project transaction coordinator. A transaction may mix reviewed Resource metadata and image-content commands, for example:

```text
resource.rename
resource.content.replace
```

Both are committed under one Project transaction/history boundary.

Before execution, the Resource adapter prepares an inverse portable content command from authoritative Resource state. If a later command in the same transaction fails, the coordinator applies inverse commands before leaving the failed transaction boundary.

Explicit rollback still obeys WS-9G rollback-order ownership. If newer Resource history exists, rollback fails visibly rather than undoing another operation.

## Review semantics

WS-9H Review now distinguishes:

```text
resource.metadata
resource.content
```

For `resource.content.replace`, Review exposes only portable impact summaries:

```text
before
├── dataFormat
├── bitmapResolution
├── rotationCenter
├── sourceAuthorityRevision
└── byteLength

after
├── dataFormat
├── bitmapResolution
├── rotationCenter
├── sourceAuthorityRevision + 1
└── byteLength
```

The raw SVG or image data URI is not copied into the Review DTO.

Content replacement is marked:

```text
reversible = true
destructive = true
```

Blocking diagnostics include missing content authority, unsupported Resource kind and stale source revision.

## WS-9I Review Evidence remains mandatory

WS-10C does not introduce a new Paint-specific mutation bypass.

```text
Paint reviewChanges()
        ↓
project-command#propose
        ↓
reviewProposal()
        ↓
prepareMutationReview()
        ↓
fresh one-shot Review Evidence
        ↓
project-command#mutate.commit(...)
```

Evidence remains ToolId-, capability-lease-, Project-, review-revision-, subject- and operation-bound according to WS-9I.

Direct `resource-command#mutate` remains denied.

## Paint working-copy commit behavior

When the Paint working copy is dirty, `reviewChanges()` emits `resource.content.replace`. Metadata and content edits may share one Proposal.

After successful commit:

```text
Project transaction committed
        ↓
Paint reloads the authoritative Resource snapshot
        ↓
working copy becomes clean and non-stale
        ↓
sourceAuthorityRevision reflects committed content revision
```

After a reviewed rollback, Paint performs the same authoritative reload so the Tool session does not retain bytes that disagree with Project state.

If the Resource content changes externally before commit, Review returns a blocking stale diagnostic. The old working copy is never silently written over newer Project content.

## Direct mutation still forbidden

The Better Paint path does not call:

```text
vm.updateSvg(...)
vm.updateBitmap(...)
vm.renameCostume(...)
renderer mutation
raw Scratch asset mutation
```

The existence of a Scratch-compatible content adapter below Resource Authority does not make Scratch the semantic owner of the command.

## DoD

- [x] versioned `resource.content.replace` Project command;
- [x] canonical ResourceId required;
- [x] portable SVG/data-URI payload only;
- [x] 32 MiB payload bound;
- [x] per-Resource runtime content revision;
- [x] source-revision optimistic precondition;
- [x] metadata-only changes do not invalidate content revision;
- [x] content replacement advances content revision;
- [x] commit-boundary SVG sanitization;
- [x] storage/renderer compatibility remains inside Resource Authority;
- [x] content command participates in Project transaction commit/compensation/rollback;
- [x] Review exposes portable before/after content impact without raw bytes;
- [x] stale source is a blocking Review diagnostic;
- [x] content mutation still requires fresh WS-9I Review Evidence;
- [x] direct Resource mutation remains denied to Paint;
- [x] successful commit reloads authoritative Working Copy;
- [x] reviewed rollback reloads authoritative Working Copy;
- [x] no direct Paint `vm.updateSvg` / `vm.updateBitmap` path;
- [x] cumulative WS / architecture regression evidence;
- [x] WS-10C Certificate freeze.

## Explicit non-goals

WS-10C does not certify:

- persistent unsaved working-copy bytes across application restart;
- arbitrary filesystem import/export;
- multi-Resource atomic image transactions across independent authorities;
- full pixel-mode product UX;
- advanced Paint keyboard/focus/unsaved-close policy;
- Terminal activation.

Those product-level Paint completion items remain WS-10D responsibilities.
