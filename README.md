# NGVGE Task 0008.9.1 — Runtime Node API Freeze

Apply this patch over:

```text
scratch-gui-main-task-0008.8-scene-graph-persistence-review.zip
```

The patch freezes the public Runtime Node Model capability boundary while preserving persistent format version `1`.

Key additions:

- Runtime Node public API version `1.1`;
- frozen API contract descriptor;
- canonical `getNodeSnapshot`, `getComponentSnapshot`, `getSceneSnapshot` queries;
- canonical `patchComponent` and explicit `reorderChild` mutations;
- compatibility aliases for existing callers;
- first-party Editor and Scratch Adapter migration to canonical snapshot queries;
- unit and standalone smoke validation.

See `NGVGE-Task-0008.9.1-Validation.md` for executed validation and limitations.
