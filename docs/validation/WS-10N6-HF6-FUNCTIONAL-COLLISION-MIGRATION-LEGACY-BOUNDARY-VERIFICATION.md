# WS-10N6-HF6 Functional Collision Projection & Legacy Boundary Verification

Machine status: PASS
Browser status: **BROWSER EVIDENCE PENDING**

## Machine evidence

- HF6 Conformance: 12/12 PASS
- N0 -> N6-HF5 inherited focused chain: PASS
- HF6 focused collision-boundary segment: 4 Node suites / 32 tests PASS + Project Explorer DOM 27/27 PASS; includes real `service-facade.js` array-like return values
- Full Unit Node: 193 suites / 1044 tests PASS
- Full Unit DOM: 3 suites / 33 tests PASS
- Integration: 10 suites / 11 tests PASS
- Smoke: 1/1 PASS
- Permanent Regression: 31/31 PASS
- TypeScript: PASS
- ESLint correctness: PASS
- ARC-C001.1 minimum baseline: PASS (7/7, 0 waivers, 0 blockers)
- 0009 Transform2D A/B/C/D/E + DoD: PASS (DoD 12/12)
- LRC-G1: PASS (15/15)
- LPL-G1: PASS (17/17)
- LEX-G1: PASS (19/19)
- LSC-G1: PASS (19/19)
- COL-0: PASS (15/15)
- Production Node Explorer Webpack: PASS (0 errors / 0 warnings)
- Full Editor Webpack: INCONCLUSIVE — the 300-second execution window elapsed without final success/failure stats; this is neither PASS nor FAIL.

## Browser Gate

Use the exact previously failing topology as the primary acceptance case.

1. Open a project containing an old Project Node `Collider2D` like the screenshot where the Explorer footer reports a compatibility node.
2. Selecting that node must show an explicit **Legacy Collider2D compatibility node** warning. Collision Shapes = All must not pretend that this old property record is a Runtime collider.
3. Independently select the already-real StaticBody2D visible in the same scene. With Collision Shapes = All, its real Collider2D must render even though `worldPoints` and other vectors arrive through the production Module capability facade. Inspector must also discover its real Runtime components through the facade.
4. For a legacy Trigger collider, choose **Upgrade as Area2D**. For a solid collider, choose **Upgrade as StaticBody2D**.
5. Only after a successful upgrade may the old compatibility node disappear. The replacement must appear as a Functional native node and own a real `ngvge.collider2d@1` component.
6. Legacy Width/Height/Radius, Offset, Collision Layer and Mask values must be retained by the migrated Collider2D. The screenshot's 100 x 100 Rectangle should remain 100 x 100.
7. With Collision Shapes = All, the migrated collider must immediately render on Stage. Selecting it must expose HF5 authoring handles.
8. Resizing/offset/rotation edits in Inspector or Stage must change the same real Collider2D geometry used by overlap queries and CharacterController2D.
9. Move two real colliders apart/together. `overlaps?` must track the visible geometry false/true.
10. Right-click the compatibility Stage or Scratch Sprite and choose Add Child Node. Legacy Collider2D and Legacy PhysicsBody2D must no longer be offered. The dialog must create Functional nodes under the active Scene/root or stable bound Sprite2D NodeId.
11. Reload an older project containing legacy collision records. They must remain loadable and their raw properties must not be discarded before explicit migration.
12. Force a migration failure (for example by removing the required Functional provider in a test/dev build). The legacy node must remain intact; a partial replacement must not silently replace it.
13. Existing real StaticBody2D / Area2D / CharacterBody2D colliders must continue to render, query and expose HF5 authoring handles without migration.

Only after these browser checks pass may HF6 contribute to WS-10N6 Freeze.
