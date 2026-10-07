import {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    NODE_SCOPES,
    SEMANTIC_RUNTIME_NODE_TYPE_IDS,
    RuntimeNode,
    RuntimeNode2D,
    RuntimeServiceNode,
    SpriteRuntimeNode,
    createRuntimeNodeTypeRegistry
} from '../../../../src/lib/runtime-nodes';

describe('RuntimeNodeTypeRegistry', () => {
    test('registers the built-in runtime node families', () => {
        const registry = createRuntimeNodeTypeRegistry();

        expect(registry.get(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE).ctor).toBe(RuntimeNode);
        expect(registry.get(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE_2D).ctor).toBe(RuntimeNode2D);
        expect(registry.get(BUILTIN_RUNTIME_NODE_TYPE_IDS.SERVICE_NODE).ctor).toBe(RuntimeServiceNode);
        expect(registry.get(SEMANTIC_RUNTIME_NODE_TYPE_IDS.SPRITE).ctor).toBe(SpriteRuntimeNode);
        expect(registry.list().map(type => type.id)).toEqual([
            BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE,
            BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE_2D,
            BUILTIN_RUNTIME_NODE_TYPE_IDS.SERVICE_NODE
        ]);
        expect(registry.list({includeHidden: true})).toHaveLength(7);
    });

    test('enforces the scopes declared by each node type', () => {
        const registry = createRuntimeNodeTypeRegistry();

        expect(() => registry.create(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE_2D, {
            id: 'global-2d',
            scope: NODE_SCOPES.GLOBAL
        })).toThrow(/does not support scope/i);

        expect(registry.create(BUILTIN_RUNTIME_NODE_TYPE_IDS.SERVICE_NODE, {
            id: 'global-service',
            scope: NODE_SCOPES.GLOBAL
        })).toBeInstanceOf(RuntimeServiceNode);
    });

    test('rejects duplicate registrations unless the same owner explicitly replaces them', () => {
        const registry = createRuntimeNodeTypeRegistry();
        class PluginNode extends RuntimeNode {}
        const definition = {
            allowedScopes: [NODE_SCOPES.SCENE],
            ctor: PluginNode,
            id: 'plugin.example-node',
            label: 'Example Node',
            owner: 'plugin.example'
        };

        registry.register(definition);

        let duplicateError = null;
        try {
            registry.register(Object.assign({}, definition, {label: 'Duplicate'}));
        } catch (error) {
            duplicateError = error;
        }
        expect(duplicateError).toMatchObject({code: 'RUNTIME_NODE_TYPE_ALREADY_EXISTS'});

        let ownerError = null;
        try {
            registry.register(Object.assign({}, definition, {
                label: 'Hostile replacement',
                owner: 'plugin.other',
                replace: true
            }));
        } catch (error) {
            ownerError = error;
        }
        expect(ownerError).toMatchObject({code: 'RUNTIME_NODE_TYPE_OWNER_MISMATCH'});

        registry.register(Object.assign({}, definition, {
            label: 'Example Node v2',
            replace: true,
            version: '2'
        }));
        expect(registry.get('plugin.example-node')).toMatchObject({
            label: 'Example Node v2',
            owner: 'plugin.example',
            version: '2'
        });
    });


    test('requires an explicit owner for replacement', () => {
        const registry = createRuntimeNodeTypeRegistry();
        registry.register({
            allowedScopes: [NODE_SCOPES.SCENE],
            ctor: RuntimeNode,
            id: 'anonymous.example-node',
            label: 'Anonymous Node'
        });

        let replacementError = null;
        try {
            registry.register({
                allowedScopes: [NODE_SCOPES.SCENE],
                ctor: RuntimeNode,
                id: 'anonymous.example-node',
                label: 'Anonymous Node v2',
                replace: true
            });
        } catch (error) {
            replacementError = error;
        }

        expect(replacementError).toMatchObject({
            code: 'RUNTIME_NODE_TYPE_REPLACE_OWNER_REQUIRED',
            typeId: 'anonymous.example-node'
        });
    });

    test('increments revision and publishes registry changes', () => {
        const registry = createRuntimeNodeTypeRegistry();
        const initialRevision = registry.getRevision();
        const changes = [];
        registry.subscribe(change => changes.push(change));

        const unregister = registry.register({
            allowedScopes: [NODE_SCOPES.SCENE],
            ctor: RuntimeNode,
            id: 'plugin.dynamic-node',
            label: 'Dynamic Node',
            owner: 'plugin.dynamic'
        });

        expect(registry.getRevision()).toBe(initialRevision + 1);
        expect(changes[0]).toMatchObject({
            owner: 'plugin.dynamic',
            revision: initialRevision + 1,
            type: 'register',
            typeId: 'plugin.dynamic-node'
        });

        unregister();
        expect(registry.getRevision()).toBe(initialRevision + 2);
        expect(changes[1]).toMatchObject({type: 'unregister', typeId: 'plugin.dynamic-node'});
    });

});
