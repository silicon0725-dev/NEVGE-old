# Authority

`src/core/authority` is the NGVGE-owned, backend-independent State Domain Authority foundation established by **ARC-C001.1-E**.

It owns the generic vocabulary and Registry rules required to express:

```text
StateDomainId
AuthorityRegistration
writer | projection | observer
projectionDirection
single active writer per State Domain
```

The Registry is not a Scratch, Runtime Component, Module Capability, Editor, or Backend registry. Existing capability/provider ownership remains Runtime/Module-specific evidence and may later consume this Core contract; it does not define the generic Authority model.

C001.1-E intentionally does **not** implement Projection Loop Prevention, Mutation Context, Authority Switch transactions, write authorization, or Transform2D authority wiring. Those remain later ARC-C001.3 / ARC-0003 and 0009 work.
