# NGVGE Inspector Extension API v0.2

Unsandboxed extensions can add schema-driven property sections to the NGVGE Inspector through:

```js
const registry = Scratch.vm.runtime.ngvgeInspector;
```

A minimal section descriptor contains:

```js
registry.register({
    id: 'example',
    label: 'Example',
    order: 100,
    appliesTo: target => !target.isStage,
    getFields: target => [
        {
            id: 'amount',
            label: 'Amount',
            type: 'number',
            value: 100,
            step: 1
        }
    ],
    setValue: (target, fieldId, value, context) => {
        // Update runtime state, redraw, and mark the project changed.
        context.runtime.emitProjectChanged();
        context.registry.notify({
            sectionId: 'example',
            targetId: target.id
        });
    }
});
```

Supported field types:

- `number`
- `text`
- `boolean`
- `select`

## Automatic Inspector history

Changes committed through an Inspector field are automatically added to the NGVGE property-history stack. Undo and redo call the section's `setValue` function again with the previous or next value.

For predictable history behavior, `setValue` should be deterministic and should accept values previously returned by `getFields`.

## Project persistence

A section can opt into SB3 persistence by implementing target-level or project-level serialization hooks.

```js
registry.register({
    id: 'example',
    extensionId: 'exampleExtension',
    label: 'Example',
    getFields: target => [],
    setValue: (target, fieldId, value, context) => {},

    serializeTarget: (target, context) => ({
        amount: target.exampleAmount
    }),

    deserializeTarget: (target, data, context) => {
        target.exampleAmount = Number(data.amount) || 0;
    },

    serializeProject: context => ({
        sharedPreset: 'default'
    }),

    deserializeProject: (data, context) => {
        // Restore data shared by all targets before target data is applied.
    }
});
```

`serializeProject` and `deserializeProject` are intended for shared systems such as camera definitions. `serializeTarget` and `deserializeTarget` are intended for per-target values such as camera binding, stretch, physics material, or tags.

When serialized data is returned and `extensionId` is set, the persistence layer adds that extension to the saved project and preserves its custom extension URL when available. This allows an Inspector-only property to keep its extension dependency even when no block from that extension exists in the workspace.

NGVGE stores this metadata in an additive `ngvge` field inside `project.json`. Standard Scratch fields remain unchanged. Unknown or unavailable Inspector sections are skipped instead of preventing the project from loading.

## Registry utility methods

```js
registry.getSection('example');
registry.listSections();
registry.getSections(target, context);
registry.subscribe(listener);
registry.notify(change);
```

The bundled `NGVGE Camera V2` and `NGVGE XY Stretch` extensions demonstrate project-level and target-level persistence.
