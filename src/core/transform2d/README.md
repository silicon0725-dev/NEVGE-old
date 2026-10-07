# Transform2D Semantic Contract

`src/core/transform2d` owns the backend-independent Transform2D vocabulary introduced by runtime milestone 0009.

The initial contract is deliberately narrow:

- `ngvge.transform2d@1` contains persistent `position`, `rotation`, and `scale` fields;
- all values are portable finite DTO data;
- the initial Transform2D Writer Authority is `scratch.compat.transform`;
- the semantic projection is declared `authority-to-projection`, corresponding to Scratch → NGVGE;
- editor mutation can be represented as the generic Engine Protocol `PatchComponent` command;
- no Scratch Target, renderer Drawable, VM object, or backend handle is part of the Transform2D data contract.

This folder does **not** implement live Scratch projection, runtime transform storage, write authorization, Mutation Context, Projection Loop Prevention, or Authority switching. Those are later 0009 / ARC-C001.3 responsibilities.
