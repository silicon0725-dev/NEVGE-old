# WS-10N6-HF1 | Collider2D Semantic-Parent World Projection Verification

Status: `IMPLEMENTED / MACHINE VERIFIED / BROWSER EVIDENCE PENDING`

## Browser regression that must pass

1. Create two Scratch-bound Sprite2D nodes and place them visibly far apart.
2. Create `StaticBody2D` as a child of the first Sprite2D.
3. Create `CharacterBody2D` as a child of the second Sprite2D.
4. Leave both body-local Transform2D positions at `[0,0]`.
5. Their Collider gizmos must appear at their respective parent Sprite world positions, not both at Stage origin.
6. `collider [CharacterBody2D] overlaps [StaticBody2D]?` must return `false` while the parents are separated.
7. Move the second Scratch-bound Sprite until the two world colliders overlap; the same reporter must then return `true`.
8. Moving either parent must update Area enter/exit state for descendant sensor Colliders.
9. Rotate and non-uniformly scale a parent. Descendant Collider geometry/gizmo must follow the complete semantic parent transform chain.
10. A nested CharacterBody2D world-space movement command must move by the requested world delta even under a rotated/scaled parent.
11. Scratch native `touching?` remains unchanged.

Browser evidence is mandatory before WS-10N6/HF1 can be frozen.
