# NGVGE Task 0008.9.6 Validation

## Result

`0008.9.6 Runtime Revision and Snapshot Consistency Contract` passes its dedicated destructive validation, historical Architecture gates and clean-baseline reconstruction.

## Verified semantics

- Scene System publishes `ngvge.runtime-node-snapshot@1` without changing `ngvge.runtime-node-model@1.3.1`.
- Revision identity is exactly `(runtimeGeneration, graphRevision, registryRevision)`.
- Revision Tokens are deeply frozen portable data with an exact field set.
- Unknown token fields, invalid generations and invalid revisions are rejected.
- Graph mutation invalidates the previous Graph revision.
- Runtime Node Descriptor/provider changes invalidate the Registry revision without changing Graph revision.
- Component Descriptor and migration-edge changes advance Component Registry revision.
- Whole-Graph Import adoption advances Runtime generation.
- Graph, Scene, Node, Component, Subtree, Node-list and Node-types snapshots share one frozen envelope contract.
- Snapshot collections use canonical stable-ID ordering while hierarchy order remains semantic.
- Snapshot construction verifies equal before/after tokens and never returns a mixed-revision payload.
- Snapshot Envelope construction clones portable inputs and cannot retain caller-owned mutable objects.
- Runtime observer events carry a frozen Revision Token and explicit generation/Graph/Registry fields.
- Graph, Node Type Registry and Component Type Registry revision state cannot be forged through raw instance fields.
- Registry semantic Maps and usage/listener state are module-private and Registry instances are sealed.
- Persistent format remains `1`; Revision counters are Runtime-only.

## Dedicated destructive scenarios

```text
Graph _revision assignment spoof                         PASS
Node Registry raw Map injection                          PASS
Component Registry raw Descriptor Map injection          PASS
Node Descriptor register/unregister revision             PASS
Component Descriptor revision                            PASS
Migration bind/unbind revision                           PASS
Caller-owned Envelope input mutation                     PASS
Revision Token extra-field injection                     PASS
Graph mutation stale-token detection                     PASS
Registry-only stale-token detection                      PASS
Whole-Graph generation invalidation                      PASS
Canonical Node / Component / Type ordering               PASS
Portable deep-freeze validation                          PASS
```

## Architecture results

```text
Runtime Node first-party alias gate                  PASS
0008.7.3 Scratch Adapter                             PASS
0008.8 Persistence                                   PASS
0008.9.1 Public Boundary                             PASS
0008.9.2 Lifecycle chain                             PASS
0008.9.3 Component Boundary chain                    PASS
0008.9.4 Schema / Migration chain                    PASS
0008.9.5 Runtime Error / Diagnostic Contract         PASS
0008.9.6 Revision / Snapshot Consistency             PASS
Foundation Extensions                               PASS
npm run test:architecture:runtime-component-boundary PASS
```

## Reconstruction and static validation

The final values are recorded after archive construction:

```text
Baseline                                      0008.9.5
Changed project files                         34
Reconstructed source files                    3314
Reconstruction byte equivalence               PASS
Changed/new JavaScript node --check            21 / 21 PASS
package.json parse                             PASS
Root node_modules                              ABSENT
Incremental file SHA-256                       PASS
Incremental ZIP CRC                            PASS
Full Source ZIP CRC                            PASS
```

## Commands

```text
node scripts/validate-ngvge-task-0008.9.6.js
npm run test:architecture:runtime-snapshot-contract
npm run test:architecture:runtime-component-boundary
```

The source archive has no root `node_modules`; complete Jest, ESLint, Webpack and browser integration execution is therefore not claimed. A Jest regression file is included.
