# NGVGE Task 0008.9.3.1.1 Validation

## Task

`0008.9.3.1.1 | Component Cardinality Authority Transition Hotfix`

## Result

```text
Cardinality transition lock:          Passed
Descriptor unregister in-use lock:    Passed
Preconstructed instance validation:   Passed
Direct Registry bypass closure:       Passed
Public persistence confirmation:      Passed
Canonical round-trip regression:      Passed
Historical architecture regression:  Passed
Component Contract Freeze:            Passed
```

## Version state

```text
Scene System:                    0.8.9.3.1.1
Runtime Node public API:         1.3.1
Runtime Component contract:     ngvge.runtime-component@1
Runtime Node persistent format:  1
```

No public method was added or removed and no persistent field was changed.

## Implemented closure

- Component Type Registry registration rejects a Cardinality change while any bound Graph owns an instance of the `typeId`.
- Component Type Registry unregister rejects removal while any bound Graph owns an instance of the `typeId`.
- Registry usage is aggregated across Graphs sharing one Registry.
- Graph adoption transfers Registry authority bindings without leaving stale resolvers.
- Graph disposal removes its usage resolver.
- `RuntimeComponentContainer.add()` resolves the Graph Descriptor even for an already constructed `RuntimeComponent` and rejects a mismatch before Container mutation.
- Same-Cardinality implicit-to-explicit Descriptor promotion remains valid.
- Cardinality may change only after every instance of that `typeId` has been removed.

## Dedicated destructive validation

`scripts/validate-ngvge-task-0008.9.3.1.1.js` covers:

- implicit `one` → explicit `many` with one live instance;
- explicit `many` → explicit `one` with one live instance;
- Descriptor unregister while in use;
- removal, unregister, and legal registration with a different Cardinality;
- preconstructed Component versus Graph Descriptor mismatch;
- direct local Registry replacement and unregister attempts;
- `applied === true` and `persisted === true` for successful public mutations;
- Export → Import → Export deep equality after every scenario.

A Jest regression file was added at:

```text
test/unit/lib/runtime-nodes/
runtime-component-cardinality-authority-transition.test.js
```

## Freeze declaration

```text
TASK 0008.9.3
Implemented / Component Boundary Frozen

Any live Graph has exactly one Cardinality meaning per Component typeId.
```

## Executed regression suite

```text
Runtime Node first-party alias gate                         PASS
0008.7.3 Scratch Adapter conformance                        PASS
0008.8 Scene Graph persistence                              PASS
0008.9.1 Runtime Node API Freeze                            PASS
0008.9.1.1 Public Boundary Cleanup                          PASS
0008.9.2 Lifecycle Conformance                              PASS
0008.9.2.1 Reentrancy / Generation Closure                  PASS
0008.9.2.2 Observation Boundary Closure                     PASS
0008.9.2.2.1 Local Host Dispose Preflight                   PASS
0008.9.3 Component Boundary                                 PASS
0008.9.3.1 Identity / Cardinality / Persistence Closure     PASS
0008.9.3.1.1 Cardinality Authority Transition Hotfix        PASS
EXT-0001 Foundation Extension validation                    PASS
```

## Static validation

```text
Changed/new JavaScript files:  12
node --check:                  12 / 12 PASS
package.json parse:            PASS
```

The supplied project archive has no root `node_modules`. Full Jest, ESLint, Webpack, and browser integration tests were therefore not executed and are not claimed here.
