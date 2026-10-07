# Stable Identity Foundation

**Authority:** ARC-0001 / ARC-C001.1-B

This directory owns NGVGE backend-independent stable identity semantics. It must remain inside the `src/core` Semantic Ownership Zone and therefore cannot depend on Scratch, React, DOM, execution storage or backend implementations.

## Canonical vocabulary

Current stable identity kinds:

```text
NodeId
SceneId
ResourceId
ModuleId
ComponentTypeId
BindingId
TransactionId
```

Canonical runtime representation:

```text
ngvge:<kind>:<opaque-token>
```

The opaque token has no backend meaning. Core validates/formats identity but does not own randomness, clocks or platform entropy. Creation receives an opaque-token factory from a Host adapter.

## C001.1-B boundary

`stable-identity.js` establishes the runtime/JSDoc semantic type authority while preserving the frozen R9 TypeScript trust boundary. C001.1-B does **not** widen `tsconfig.02agent.json` or introduce TypeScript source outside `src/addons/addons/02agent`.

The Project Node compatibility migration is implemented outside Core. Historical `target-node:<Scratch target.id>` values are migration-only input and are never a valid canonical Stable NodeId.
