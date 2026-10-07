const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    createRuntimeNodeModelHost
} = require('../../../../src/lib/runtime-nodes');
const {
    TRANSFORM2D_NATIVE_AUTHORITY_ID,
    TRANSFORM2D_SCRATCH_AUTHORITY_ID,
    createTransform2DPatchComponentCommand
} = require('../../../../src/core/transform2d');
const {
    NATIVE_TRANSFORM_COMMAND_BRIDGE_CONTRACT,
    TRANSFORM2D_WRITER_ROUTING_CONTRACT,
    createNativeTransformCommandBridge,
    createTransform2DComponentOptions,
    createTransform2DRuntimeStoreForModel,
    createTransform2DWriterRouter
} = require('../../../../src/lib/transform-system');
const {
    TRANSFORM2D_SCENE_ROUTE_KINDS,
    TRANSFORM2D_SCENE_ROUTE_RESOLVER_CONTRACT,
    createTransform2DSceneWriterRouteResolver
} = require('../../../../src/lib/scene-system/transform2d-writer-route-resolver');

const clone = value => JSON.parse(JSON.stringify(value));

const createSceneDataModel = () => {
    let project = {activeSceneId: 'scene-a', extensionData: {}, scenes: [{id: 'scene-a', name: 'Scene A'}]};
    const listeners = new Set();
    return {
        getStatus: () => ({readOnly: false}),
        readProject: () => clone(project),
        subscribe: listener => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        writeProject: next => {
            project = clone(next);
            listeners.forEach(listener => listener({type: 'data'}));
        },
        getProject: () => clone(project)
    };
};

const createNativeHarness = () => {
    const sceneDataModel = createSceneDataModel();
    const host = createRuntimeNodeModelHost(sceneDataModel);
    const createResult = host.publicCapability.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE_2D, {
        id: 'ngvge:node:native-transform',
        name: 'Native Node2D',
        sceneId: 'scene-a'
    });
    expect(createResult.applied).toBe(true);
    const store = createTransform2DRuntimeStoreForModel(host.publicCapability, host.typeRegistrationCapability);
    const componentResult = host.publicCapability.addComponent(
        'ngvge:node:native-transform',
        createTransform2DComponentOptions({
            componentId: 'runtime-component:native-transform',
            data: {position: [1, 2], rotation: 10, scale: [1, 1]}
        })
    );
    expect(componentResult.applied).toBe(true);
    store.hydrateNodeFromPersistent('ngvge:node:native-transform');
    return {host, sceneDataModel, store};
};

const createMockWriter = authorityId => {
    const commands = [];
    return {
        commands,
        executeCommand: command => {
            commands.push(command);
            return {
                kind: 'event',
                type: 'PatchComponentApplied',
                payload: {authorityId}
            };
        }
    };
};

describe('WS-10N1 Node-scoped Transform Writer Routing', () => {
    test('freezes node-scoped routing without changing backend identity ownership', () => {
        expect(TRANSFORM2D_WRITER_ROUTING_CONTRACT.scope).toBe('node');
        expect(TRANSFORM2D_WRITER_ROUTING_CONTRACT.identity).toEqual({
            backendHandleDeterminesRoute: false,
            nodeIdIsRoutingKey: true
        });
        expect(TRANSFORM2D_WRITER_ROUTING_CONTRACT.resolverBoundary.callerMaySelectAuthority).toBe(false);
        expect(TRANSFORM2D_SCENE_ROUTE_RESOLVER_CONTRACT.ownership).toEqual({
            bindingRecordOwnsCompatibilityRoute: true,
            missingScratchRuntimeTargetFallsBackToNative: false,
            runtimeDisconnectChangesOwnership: false
        });
        expect(NATIVE_TRANSFORM_COMMAND_BRIDGE_CONTRACT.currentAuthority.authorityId)
            .toBe(TRANSFORM2D_NATIVE_AUTHORITY_ID);
    });

    test('routes an unbound semantic NodeId to the native Transform writer', () => {
        const nativeWriter = createMockWriter(TRANSFORM2D_NATIVE_AUTHORITY_ID);
        const scratchWriter = createMockWriter(TRANSFORM2D_SCRATCH_AUTHORITY_ID);
        const adapter = {getBindingByNodeId: () => null};
        const router = createTransform2DWriterRouter({
            resolveRoute: createTransform2DSceneWriterRouteResolver(adapter),
            writers: {
                [TRANSFORM2D_NATIVE_AUTHORITY_ID]: nativeWriter,
                [TRANSFORM2D_SCRATCH_AUTHORITY_ID]: scratchWriter
            }
        });
        const command = createTransform2DPatchComponentCommand({
            componentId: 'component-a',
            nodeId: 'node-a',
            patch: {scale: [2, 0.5]}
        });

        expect(router.getRouteForNode('node-a')).toMatchObject({
            authorityId: TRANSFORM2D_NATIVE_AUTHORITY_ID,
            kind: TRANSFORM2D_SCENE_ROUTE_KINDS.NATIVE,
            nodeId: 'node-a'
        });
        expect(router.executeCommand(command).payload.authorityId).toBe(TRANSFORM2D_NATIVE_AUTHORITY_ID);
        expect(nativeWriter.commands).toHaveLength(1);
        expect(scratchWriter.commands).toHaveLength(0);
    });

    test.each(['bound', 'offline', 'missing'])(
        'keeps a Scratch-owned NodeId on Scratch Compatibility writer while binding status is %s',
        status => {
            const nativeWriter = createMockWriter(TRANSFORM2D_NATIVE_AUTHORITY_ID);
            const scratchWriter = createMockWriter(TRANSFORM2D_SCRATCH_AUTHORITY_ID);
            const adapter = {
                getBindingByNodeId: nodeId => ({
                    bindingId: 'binding-a',
                    nodeId,
                    sceneId: 'scene-a',
                    status,
                    targetRuntimeId: status === 'bound' ? 'volatile-target-a' : null
                })
            };
            const router = createTransform2DWriterRouter({
                resolveRoute: createTransform2DSceneWriterRouteResolver(adapter),
                writers: {
                    [TRANSFORM2D_NATIVE_AUTHORITY_ID]: nativeWriter,
                    [TRANSFORM2D_SCRATCH_AUTHORITY_ID]: scratchWriter
                }
            });
            const command = createTransform2DPatchComponentCommand({
                componentId: 'component-a',
                nodeId: 'node-a',
                patch: {position: [9, 4]}
            });

            const route = router.getRouteForNode('node-a');
            expect(route).toEqual({
                authorityId: TRANSFORM2D_SCRATCH_AUTHORITY_ID,
                bindingStatus: status,
                kind: TRANSFORM2D_SCENE_ROUTE_KINDS.SCRATCH_COMPATIBILITY,
                nodeId: 'node-a',
                reason: 'scratch-binding-owned'
            });
            expect(route.targetRuntimeId).toBeUndefined();
            expect(router.executeCommand(command).payload.authorityId).toBe(TRANSFORM2D_SCRATCH_AUTHORITY_ID);
            expect(nativeWriter.commands).toHaveLength(0);
            expect(scratchWriter.commands).toHaveLength(1);
        }
    );

    test('runtime Target recreation cannot change writer ownership for the same semantic NodeId', () => {
        let targetRuntimeId = 'target-old';
        const nativeWriter = createMockWriter(TRANSFORM2D_NATIVE_AUTHORITY_ID);
        const scratchWriter = createMockWriter(TRANSFORM2D_SCRATCH_AUTHORITY_ID);
        const adapter = {
            getBindingByNodeId: nodeId => ({
                bindingId: 'binding-stable',
                nodeId,
                sceneId: 'scene-a',
                status: 'bound',
                targetRuntimeId
            })
        };
        const router = createTransform2DWriterRouter({
            resolveRoute: createTransform2DSceneWriterRouteResolver(adapter),
            writers: {
                [TRANSFORM2D_NATIVE_AUTHORITY_ID]: nativeWriter,
                [TRANSFORM2D_SCRATCH_AUTHORITY_ID]: scratchWriter
            }
        });
        const first = router.getRouteForNode('node-a');
        targetRuntimeId = 'target-recreated';
        const second = router.getRouteForNode('node-a');
        expect(first.authorityId).toBe(TRANSFORM2D_SCRATCH_AUTHORITY_ID);
        expect(second.authorityId).toBe(TRANSFORM2D_SCRATCH_AUTHORITY_ID);
        expect(first.targetRuntimeId).toBeUndefined();
        expect(second.targetRuntimeId).toBeUndefined();
    });

    test('native writer accepts non-uniform and negative Transform2D scale and persists accepted state', () => {
        const harness = createNativeHarness();
        const bridge = createNativeTransformCommandBridge(harness.host.publicCapability, harness.store);
        const projectBefore = harness.sceneDataModel.getProject();
        const result = bridge.executeCommand(createTransform2DPatchComponentCommand({
            componentId: 'runtime-component:native-transform',
            nodeId: 'ngvge:node:native-transform',
            patch: {
                position: [40, -20],
                rotation: 135,
                scale: [-2, 0.25]
            }
        }));

        expect(result.kind).toBe('event');
        expect(result.type).toBe('PatchComponentApplied');
        expect(result.payload.authorityId).toBe(TRANSFORM2D_NATIVE_AUTHORITY_ID);
        expect(result.payload.transform).toEqual({
            position: [40, -20],
            rotation: 135,
            scale: [-2, 0.25]
        });
        expect(harness.store.getRuntimeTransform('ngvge:node:native-transform')).toEqual(result.payload.transform);
        expect(harness.store.getPersistentTransform('ngvge:node:native-transform')).toEqual(result.payload.transform);
        expect(harness.sceneDataModel.getProject()).not.toEqual(projectBefore);
        expect(JSON.stringify(harness.sceneDataModel.getProject())).not.toMatch(/targetRuntimeId|scratch-target/);

        bridge.dispose();
        harness.store.dispose();
        harness.host.dispose();
    });

    test('native writer fails closed on component identity mismatch without changing transform', () => {
        const harness = createNativeHarness();
        const bridge = createNativeTransformCommandBridge(harness.host.publicCapability, harness.store);
        const before = harness.store.getRuntimeTransform('ngvge:node:native-transform');
        const result = bridge.executeCommand(createTransform2DPatchComponentCommand({
            componentId: 'runtime-component:wrong',
            nodeId: 'ngvge:node:native-transform',
            patch: {position: [999, 999]}
        }));

        expect(result).toMatchObject({kind: 'error', code: 'NATIVE_TRANSFORM_COMMAND_COMPONENT_MISMATCH'});
        expect(harness.store.getRuntimeTransform('ngvge:node:native-transform')).toEqual(before);
        expect(harness.store.getPersistentTransform('ngvge:node:native-transform')).toEqual(before);

        bridge.dispose();
        harness.store.dispose();
        harness.host.dispose();
    });
});
