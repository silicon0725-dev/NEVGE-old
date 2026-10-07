# Persistent DTO Foundation

`src/core/persistent` owns the backend-independent definition of data that may cross into NGVGE Project Source.

ARC-C001.1-C establishes `ngvge-persistent-dto/v1` with these baseline rules:

- only `null`, strings, booleans, finite numbers, arrays and plain objects are persistent DTO values;
- functions, symbols, BigInt, `undefined`, custom class instances, accessors, non-enumerable object fields, sparse arrays, custom array properties and circular references are rejected;
- validation returns immutable structured issues;
- cloning happens only after validation and does not use `JSON.stringify()` as a sanitization step;
- schema-aware field/type/version validation is intentionally deferred to ARC-C001.1-D.

This directory must remain independent of Scratch, React, DOM, Runtime execution storage and backend objects. Project/adapter layers may depend on this contract; Core must not depend on them.
