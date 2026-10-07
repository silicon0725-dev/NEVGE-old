# Schema

`src/core/schema` is the NGVGE-owned, backend-independent Schema Authority established by **ARC-C001.1-D**.

Foundation contract:

- a semantic schema is identified by stable `typeId` + positive integer `version`;
- one `(typeId, version)` pair can be registered only once;
- a type may have multiple registered historical versions and the Registry resolves the highest version as current;
- schema descriptors and Registry query results are immutable Core data;
- property metadata covers `type`, `default`, `nullable`, numeric range, `unit`, `resourceType`, Persistent/Runtime-only classification, and portable validation metadata;
- schema/default/validation metadata must remain Persistent DTO data and cannot contain functions or backend/runtime objects;
- registration is fail-closed and batch registration is atomic.

C001.1-D intentionally does **not** define migration providers, migration graph execution, irreversible migration policy, custom Inspector/Gizmo registration, or full schema-aware record validation. Those are later ARC-C001 / ARC-0004 responsibilities.

The existing Runtime Component Type Registry remains a Runtime-specific consumer/evidence source. It is not the generic Schema Authority.
