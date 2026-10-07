# Collider2D Core Contract

`ngvge.collider2d@1` owns backend-independent 2D collision geometry, query filtering and sensor semantics.
Transform2D remains the Node transform authority; Collider2D contributes only local offset/rotation and an explicit transform-inheritance policy.

Collider2D is query-capable without Rigidbody2D. A future Rapier2D/Box2D backend may consume the same stable component but may never replace NodeId/ComponentId with backend handles.
Standard Scratch 3 has no native Collider2D/Area2D representation, so the component remains `.ne` native and `.sb3` compatibility analysis must report it as native-only/partial.
