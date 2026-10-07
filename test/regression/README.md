# NGVGE Permanent Regression Layer

This directory contains fast, deterministic regression contracts for production defects closed during the 0008.9.7 Freeze Repair.

## Guarantees

The layer protects three defect families:

1. Runtime detached-node persistence remains deterministic for 0/1/2/many roots, mixed scopes, permutations, detached subtrees, and serialize/restore round-trips.
2. Git Myers Diff remains crash-free, minimal, deterministic, and identical between the main-thread and Worker implementations.
3. Git -> SB3 reconstruction remains fail-closed for malformed input and preserves the persisted block graph, assets, comments, extension IDs, and standard Scratch VM serialization semantics covered by the contract.

## Execution

Run all permanent regressions:

```sh
node test/regression/run-regressions.js
```

Or use the package entry point:

```sh
npm run test:regression
```

Individual suites are available through `test:regression:runtime-detached`, `test:regression:git-diff`, and `test:regression:git-sb3`.

## Design constraints

- No browser or DOM environment is required except the local XML parser shim used by the SB3 reconstruction contract.
- No network access is permitted or required.
- Tests run directly under Node and do not depend on the repository's Jest environment.
- Contracts must assert semantic correctness, not merely absence of exceptions.
- Historical Freeze Repair validators reuse these contracts; there is one source of truth for each invariant.
