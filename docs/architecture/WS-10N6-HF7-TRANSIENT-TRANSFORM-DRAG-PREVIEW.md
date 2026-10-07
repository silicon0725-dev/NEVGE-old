# WS-10N6-HF7｜Transient Transform Drag Preview

Status: **IMPLEMENTED / MACHINE VERIFIED / BROWSER EVIDENCE PENDING**

## Problem

Scratch editor-drag mode moves an extracted drag canvas continuously but commits the Sprite x/y only on pointer release. NGVGE Collider2D gizmos are projected from semantic Transform2D state, so a dragged Sprite and its child colliders visibly separate until release.

HF7 treats this as an Editor preview problem, not as permission to mutate Scratch Runtime/Project authority on every pointer move.

## Frozen boundary

```text
Authored Transform2D
        !=
Transient Editor Transform Preview
```

During an editor drag:

```text
Scratch visual drag canvas
        +
Editor Transform Preview
        ├─ Inspector X/Y preview
        ├─ Collider2D semantic-subtree projection
        └─ preview-only overlap visualization
```

On pointer release:

```text
preview final position
        ↓
ngvge.transform2d-command
        ↓
NodeId Writer Router
        ↓
scratch.compat.transform
        ↓
one authored commit
```

Scratch blocks continue to observe Scratch Runtime state until the release commit. Preview data is never serialized.

## Drag lifecycle

- Pointer move updates the editor-only preview store.
- Camera2D-aware drag coordinates use `screenToWorld()`.
- A semantic Sprite binding is resolved by Scratch Target runtime ID, but stable `NodeId` is the preview/command identity.
- Every Collider2D in the dragged Node subtree receives the same world translation delta for editor projection.
- Preview collision highlighting is recomputed from projected convex geometry without mutating Collider Runtime overlap state.
- Pointer release commits exactly one Transform2D position command.
- Property History records one `Move Sprite` undo entry for the complete drag.
- Escape and window blur cancel the preview and restore the original authored position because no position mutation occurred during the drag.
- Unbound legacy Scratch targets retain the old compatibility fallback; Functional Sprite2D must use the semantic writer path.

## Non-goals

HF7 does not:

- change Scratch block semantics during an editor drag;
- persist transient transform data;
- introduce a second Transform2D Writer Authority;
- implement multi-node transform tools;
- implement native visual-node picking/dragging;
- replace WS-10N8 Physics2D.

## Browser acceptance

1. Put a real Collider2D under a Scratch-bound Sprite2D.
2. Set Collision Shapes to All.
3. Drag the Sprite without releasing: Sprite art and collider must remain aligned every frame.
4. Drag into another collider: preview collision highlighting must update before release.
5. Inspector X/Y must update during drag and show `Editor Drag Preview`.
6. Release: preview label disappears and final authored X/Y equals the preview position.
7. One full drag adds one Undo entry; Undo returns to the drag-start position in one action.
8. Press Escape while dragging: Sprite/collider return to authored position and no position command is committed.
9. With Camera2D translation/rotation/zoom active, drag/collider/Inspector coordinates remain aligned.
10. Scratch scripts reading x/y must not receive editor preview coordinates before release.
