# WS-10N3 | Scratch Role Manager Functional Parity Verification

Status: `FROZEN / MACHINE VERIFIED / BROWSER VERIFIED`

Architecture parent: `ARC-0001 | Kernel Independence Contract`
Depends on: `WS-10N0`, `WS-10N1`, `WS-10N2`, `WS-10N2-HF1`
Contract: `ngvge.scratch-role-manager-parity@1`

## Purpose

WS-10N3 makes the NGVGE Node Tree the semantic role-management surface for Scratch-backed Sprite nodes without promoting Scratch target IDs to project identity.

The stage closes the functional parity path for:

- Node Tree selection -> Scratch editing target projection;
- Legacy Scratch target selection -> stable semantic NodeId normalization;
- rename / duplicate / delete through the Runtime Node command boundary;
- semantic sibling ordering -> Scratch target ordering;
- real Scratch `duplicateSprite()` viability for functionally-created blank Sprites;
- Legacy Sprite ordering -> relative top-level bound Sprite Node ordering;
- Stage protection and stable NodeId preservation.

## Authority rules

- `NodeId` remains semantic selection identity.
- `Scratch target runtime ID` remains volatile backend identity.
- `NodeId != ScratchTargetId`.
- Project Explorer MUST NOT call `vm.renameSprite`, `vm.duplicateSprite`, `vm.deleteSprite`, or `vm.reorderTarget` directly.
- Scratch-backed mutations cross Runtime Node Command -> Scratch compatibility lifecycle authority.
- Nested NGVGE hierarchy remains NGVGE authority. Legacy target ordering may only reconcile the relative order of bound Sprite nodes already parented directly under the active Scene root.
- Stage remains a protected compatibility role.
- Scratch clones are runtime instances, not persistent Nodes.

## Implemented path

```text
Node Tree selection
    -> stable NodeId
    -> ngvge.scratch-role-manager-parity
    -> bound Scratch target runtime ID
    -> host onSelectTarget
    -> Scratch editingTarget

Legacy Sprite selection
    -> Scratch editingTarget ID
    -> ngvge.scratch-role-manager-parity
    -> stable NodeId
    -> Node Tree selection

Node rename / duplicate / delete / reorder
    -> Runtime Node Command
    -> Scratch compatibility lifecycle authority (when bound)
    -> Scratch VM mutation
    -> adapter reconciliation
    -> stable semantic Node projection
```


## Duplicate viability closure

N3 exposed a real Scratch VM invariant that the N2 creation path had not yet exercised: when `addSprite()` receives JSON with an empty `costumes` list, the single-sprite parser injects Scratch's blank costume metadata, but a JSON-only module call has no sprite ZIP containing the referenced SVG. The resulting costume has no live `asset`, and Scratch's own `duplicateSprite()` later fails while reloading costume assets.

Functional Sprite creation now carries the canonical blank Scratch SVG as portable plain-data asset bytes inside the `addSprite()` descriptor. Scratch Storage materializes the backend Asset when available, while the module boundary still transfers only portable data. N3 integration therefore executes real `scratch-vm` duplicate -> reconcile -> delete instead of accepting a mock-only duplicate path.

## Ordering policy

Node Tree sibling Move Up / Move Down and `Alt+ArrowUp/Down` issue `ReparentNode` with an explicit sibling `index`. For Scratch-owned nodes the command executor routes this through the Scratch lifecycle bridge. The bridge first commits semantic parent/order, then the Role Manager parity service projects the bound-Sprite DFS order into Scratch `reorderTarget`. If target-order projection rejects, the semantic reparent attempts rollback.

Reverse synchronization is intentionally narrower: Legacy Sprite target order may reorder only top-level bound Sprite Node slots under the active Scene root. Native nodes keep their slots and nested hierarchy is never flattened to match Scratch's target array.

## Browser evidence update — 2026-08-16

The real editor product-path pass initially isolated the advertised `Alt + ArrowUp / ArrowDown` reorder shortcut. `WS-10N3-HF1 | Node Reorder Keyboard Shortcut` moved keyboard admission to the Node Explorer local capture boundary. The user completed the HF1 browser re-test on 2026-08-16 and confirmed the shortcut and surrounding parity path pass. WS-10N3 is therefore frozen.

## Browser acceptance

1. Create two `Sprite2D` nodes, e.g. `Player` and `Enemy`.
2. Click `Player` in Node Explorer. Blocks / Scratch editing target must become exactly the bound `Player` target.
3. Click `Enemy` in Legacy Sprites. Node Explorer must select the stable bound `Enemy` Node, with no duplicate compatibility row.
4. Rename a bound Sprite from Node Explorer (F2/context menu). Legacy Sprites and Scratch name references must update through VM rename authority.
5. Duplicate a bound Sprite from Node Explorer. Exactly one new semantic bound Node and one Scratch original Sprite must appear.
6. Delete the duplicate from Node Explorer. Both semantic Node and bound Scratch target must disappear; Stage must remain.
7. Use Move Up / Move Down (or Alt+Arrow) on two top-level bound Sprites. Node Tree relative order and Legacy Sprite order must agree.
8. Reorder the same two Sprites from Legacy Sprites. Node Tree must reconcile their relative top-level bound order while preserving NodeId identity.
9. Confirm `data-ngvge-role-manager-parity="active"` on the Node Explorer root in DOM diagnostics.
10. Confirm Stage cannot be renamed/deleted/reinterpreted as a normal Sprite Node.

## Verification policy

Browser evidence is complete after the WS-10N3-HF1 re-test. Machine/unit/integration/Webpack evidence remains supporting evidence rather than a substitute for that browser pass.
