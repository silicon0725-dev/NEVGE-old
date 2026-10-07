# WS-10N3-HF1 | Node Reorder Keyboard Shortcut Verification

Status: `FROZEN / MACHINE VERIFIED / BROWSER VERIFIED`

Parent: `WS-10N3 | Scratch Role Manager Functional Parity`

## Browser evidence that triggered HF1

The WS-10N3 product-path browser pass confirmed functional Sprite creation, stable NodeId/target binding, role selection, rename, duplicate/delete and visible Node Explorer ↔ Legacy Sprite parity. The remaining acceptance failure was the advertised `Alt + ArrowUp / ArrowDown` sibling reorder shortcut.

The context-menu Move Up / Move Down command path was already valid. The failure was in keyboard event admission: the implementation depended on a document-level listener plus `document.activeElement` containment. That makes the shortcut unnecessarily dependent on outer document/focus routing in the composed editor shell.

## HF1 rule

Node Explorer keyboard commands are scoped to the Node Explorer presentation boundary itself.

```text
focused Node Explorer descendant
        ↓
Node Explorer onKeyDownCapture
        ↓
selected stable Runtime NodeId
        ↓
handleMoveRuntimeNode
        ↓
Runtime Node ReparentNode(index)
        ↓
WS-10N3 Scratch order projection
```

The shortcut does not mutate Scratch target arrays directly and does not create a second ordering authority.

## Fixed behavior

- `Alt + ArrowUp` moves the selected editable Runtime Node one sibling earlier when possible.
- `Alt + ArrowDown` moves it one sibling later when possible.
- The handled key event calls both `preventDefault()` and `stopPropagation()` so browser/default or parent Dock ordering behavior cannot consume the same command.
- Search inputs, textareas, selects and contenteditable surfaces are explicitly excluded.
- Context-menu Move Up / Move Down and keyboard reorder continue to converge on the same `handleMoveRuntimeNode → workspaceNodeCommandClient.reparentNode({options: {index}})` path.
- Stable `NodeId` remains the semantic selection/order identity. Scratch target runtime identity remains a projection binding only.

## Permanent evidence

Machine gate:

```text
npm run test:node-plan:ws10n3-hf1:machine
```

Focused gate:

```text
npm run test:node-plan:ws10n3-hf1:focused
```

The DOM regression covers both the positive `Alt+ArrowDown` reorder and the negative text-input case.

## Browser re-test

1. Create two top-level bound Sprite2D nodes under the active Scene, e.g. `Player` and `Enemy`.
2. Click `Player` directly in Node Explorer so its tree row owns keyboard focus.
3. Press `Alt + ArrowDown` once.
4. Confirm Node Explorer order changes to `Enemy`, then `Player`.
5. Confirm Legacy Sprites reflects the same relative Sprite order.
6. Press `Alt + ArrowUp`; confirm the order returns.
7. Put the caret in the Node Explorer search field and press `Alt + ArrowUp/Down`; no node reorder may occur.
8. Confirm Stage remains protected and no duplicate compatibility node appears.

Browser re-test completed successfully on 2026-08-16. WS-10N3 + HF1 are frozen.
