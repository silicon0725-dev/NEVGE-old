# ARC-C001 Import Boundary Conformance

**Status:** Active Foundation / Manual Gate
**Parent:** ARC-C001 / ARC-0001
**Introduced:** ARC-C001.1-A

## Purpose

This gate enforces the first executable boundary around the NGVGE Semantic Ownership Zone (`src/core`). ARC-0001 requires backend-specific representation to terminate at adapter/backend boundaries and forbids Core semantics from depending on Scratch, Editor, DOM, execution-storage, or backend implementation identity.

C001.1-A enforces this structurally by making `src/core` self-contained.

## Rules

### C001-IMPORT-001｜Core-local dependency closure

A relative dependency referenced by a source file under `src/core` MUST resolve within `src/core`.

Core → `src/lib`, `src/components`, `src/containers`, Compatibility Adapter code, Backend code, or any other repository zone is forbidden.

### C001-IMPORT-002｜Bare imports default deny

Bare package imports from `src/core` are denied unless the package name appears in the explicit allowlist in:

`tools/conformance/import-boundary-policy.json`

The C001.1-A allowlist is empty.

Adding a package to this allowlist is an architecture policy change and must document why the dependency is backend-independent semantic infrastructure.

### C001-IMPORT-003｜Static dependency auditability

`require()` and dynamic `import()` inside Core must use string literals. Computed module paths are forbidden because the import graph cannot be statically certified.

### C001-IMPORT-004｜Filesystem escape prevention

Symbolic links inside `src/core` are forbidden. Existing local imports are realpath-checked to prevent filesystem indirection from escaping the ownership zone.

### C001-IMPORT-005｜Re-export is dependency

`export ... from` and `export * from` are treated exactly like imports. Re-exporting a forbidden source cannot hide backend/editor provenance.

### C001-IMPORT-006｜Ambient backend/editor globals are forbidden

Core must not bypass import policy by reading ambient Scratch, React, DOM, or browser-platform globals. The policy therefore rejects unbound references such as `Scratch`, `document`, `window`, `HTMLElement`, and related configured identifiers. Locally bound identifiers with the same spelling are not treated as ambient dependencies.

## Parsed dependency forms

The gate recognizes:

- ECMAScript `import ... from`;
- side-effect imports;
- `export ... from`;
- `export * from`;
- CommonJS `require()`;
- `require.resolve()`;
- dynamic `import()`;
- TypeScript import types.

The implementation uses the project-declared Babel parser through `@babel/core`; no new parser dependency is introduced.

## Execution

```text
bun run test:conformance:import-boundary
bun run test:conformance:import-boundary:self-test
bun run test:conformance:c001.1-a
```

The gate is active and executable but is not yet wired into the aggregate test command or blocking GitHub CI. Blocking enforcement remains governed by later ARC-C001 activation work.

## C001.1-A exit condition

C001.1-A may complete when:

- `src/core` exists as a self-contained ownership zone;
- the import boundary gate passes on the repository;
- the gate self-test proves allowed and forbidden dependency cases;
- no pre-existing Runtime/Scene behavior is changed;
- C001.1-B through C001.1-F remain unimplemented rather than being silently copied from legacy layers.
