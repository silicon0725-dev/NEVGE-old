# ARC-C001 Persistent DTO Conformance

**Foundation:** ARC-C001.1-C
**Schema:** `ngvge-persistent-dto/v1`
**Enforcement:** Active / Manual
**Parent authority:** ARC-0001

## Semantic owner

`src/core/persistent` owns the repository definition of data that may enter NGVGE Project Source or another persistent semantic DTO boundary.

The legacy `src/lib/persistence/persistent-data.js` API is retained only as a compatibility facade and delegates validation/cloning to Core.

## Baseline value model

Persistent DTO values may contain only:

- `null`;
- strings;
- booleans;
- finite numbers;
- arrays;
- plain objects (`Object.prototype` or null prototype).

The foundation rejects:

- `undefined` (except explicit top-level compatibility opt-in);
- Function;
- Symbol and symbol keys;
- BigInt;
- NaN / Infinity;
- Promise and all other custom class instances;
- typed arrays / backend binary objects;
- accessors;
- non-enumerable object fields;
- sparse arrays;
- custom array properties;
- circular references.

Validation produces immutable structured issues (`code`, `path`, `message`, `valueType`).

## Fail-closed cloning

`clonePersistentDTO()` validates before cloning. It does not use JSON stringify/parse as a sanitization step. Invalid values must not become valid merely because JSON would silently drop or rewrite them.

Project Inspector persistence consumes this Core contract directly. A section that produces an invalid DTO is excluded by the existing section-failure isolation policy instead of having invalid members silently removed.

## Explicit deferrals

C001.1-C does **not** implement:

- Schema Registry lookup;
- field-level schema/type validation;
- migration graph validation;
- `PersistentDTO<T>` compile-time branding across the repository;
- protocol DTO semantics.

Those belong to C001.1-D / later C001 stages. C001.1-C establishes only the backend-independent structural persistence authority required before 0009.

## Active evidence

```text
test:conformance:persistent-dto
test:conformance:persistent-dto:self-test
test:conformance:c001.1-c
```

Permanent regression:

```text
persistent-dto-boundary
```
