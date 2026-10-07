import {EventEmitter} from 'events';

import {
    createScratchSpriteNodeAdapterService,
    createScratchTransformCommandBridge,
    createScratchTransformProjectionService,
    transformRotationToScratchDirection,
    transformScaleToScratchSize
} from '../../../../src/lib/scratch-sprite-adapter';
import {
    createRuntimeNodeModelService,
    getRuntimeNodeModelHost
} from '../../../../src/lib/runtime-nodes';
import {
    TRANSFORM2D_COMMAND_CAPABILITY_ID,
    TRANSFORM2D_COMMAND_CONTRACT,
    createTransform2DCommandCapability,
    createTransform2DEditorClient,
    createTransform2DRuntimeStoreForModel
} from '../../../../src/lib/transform-system';
import {validateProtocolDTO} from '../../../../src/core/protocol';

const clone = value => JSON.parse(JSON.stringify(value));

const createScratchTarget = (id = 'target-runtime-a', overrides = {}) => {
    const target = Object.assign({
        direction: 90,
        id,
        isOriginal: true,
        isStage: false,
        size: 100,
        sprite: {name: 'Player'},
        x: 12,
        y: -8
    }, overrides);
    target.setXY = overrides.setXY || function (x, y) {
        this.x = x;
        this.y = y;
    };
    target.setDirection = overrides.setDirection || function (direction) {
        this.direction = direction;
    };
    target.setSize = overrides.setSize || function (size) {
        this.size = size;
    };
    return target;
};

const createHarness = (targetOverrides = {}) => {
    let project = {
        activeSceneId: 'scene-a',
        extensionData: {},
        scenes: [{id: 'scene-a', name: 'Scene A'}]
    };
    const sceneListeners = new Set();
    const sceneDataModel = {
        getStatus: () => ({}),
        readProject: () => clone(project),
        subscribe: listener => {
            sceneListeners.add(listener);
            return () => sceneListeners.delete(listener);
        },
        writeProject: nextProject => {
            project = clone(nextProject);
            sceneListeners.forEach(listener => listener({type: 'data'}));
        }
    };
    const runtimeNodeModel = createRuntimeNodeModelService(sceneDataModel);
    const runtimeNodeHost = getRuntimeNodeModelHost(runtimeNodeModel);
    const runtime = new EventEmitter();
    const vm = new EventEmitter();
    const target = createScratchTarget('target-runtime-a', targetOverrides);
    runtime.targets = [
        {id: 'stage-runtime', isOriginal: true, isStage: true, sprite: {name: 'Stage'}},
        target
    ];
    runtime.getTargetById = id => runtime.targets.find(candidate => candidate && candidate.id === id) || null;
    vm.runtime = runtime;
    const context = {vm};
    const adapter = createScratchSpriteNodeAdapterService(
        context,
        sceneDataModel,
        runtimeNodeHost.publicCapability,
        {
            bindingIdFactory: () => 'scratch-binding:player',
            componentIdFactory: () => 'runtime-component:scratch-binding-player',
            nodeIdFactory: () => 'runtime-node:scratch-player',
            nodeTypeRegistration: runtimeNodeHost.typeRegistrationCapability,
            persistenceController: runtimeNodeHost.persistenceController
        }
    );
    const transformRuntimeStore = createTransform2DRuntimeStoreForModel(
        runtimeNodeHost.publicCapability,
        runtimeNodeHost.typeRegistrationCapability
    );
    const projection = createScratchTransformProjectionService(
        context,
        sceneDataModel,
        runtimeNodeHost.publicCapability,
        runtimeNodeHost.typeRegistrationCapability,
        adapter,
        {transformRuntimeStore}
    );
    projection.bootstrapActiveScene();
    const bridge = createScratchTransformCommandBridge(
        context,
        sceneDataModel,
        runtimeNodeHost.publicCapability,
        adapter,
        projection
    );
    const capability = createTransform2DCommandCapability(bridge);
    const editor = createTransform2DEditorClient(capability);
    const component = runtimeNodeHost.publicCapability.getNodeSnapshot('runtime-node:scratch-player')
        .components.find(item => item.typeId === 'ngvge.transform2d');

    return {
        adapter,
        bridge,
        capability,
        component,
        editor,
        getProject: () => clone(project),
        projection,
        runtime,
        runtimeNodeHost,
        runtimeNodeModel: runtimeNodeHost.publicCapability,
        sceneDataModel,
        target,
        transformRuntimeStore
    };
};

const disposeHarness = harness => {
    harness.bridge.dispose();
    harness.projection.dispose();
    harness.transformRuntimeStore.dispose();
    harness.adapter.dispose();
    harness.runtimeNodeHost.dispose();
};

const patch = (harness, patchValue) => harness.editor.patchComponent({
    componentId: harness.component.id,
    nodeId: 'runtime-node:scratch-player',
    patch: patchValue
});

describe('0009-D Editor PatchComponent Compatibility Bridge', () => {
    test('exposes a backend-independent command capability and editor client', () => {
        const harness = createHarness();
        expect(harness.capability.capabilityId).toBe(TRANSFORM2D_COMMAND_CAPABILITY_ID);
        expect(TRANSFORM2D_COMMAND_CONTRACT.editorIntent).toEqual({
            commandType: 'PatchComponent',
            directBackendMutation: false,
            protocolRequired: true
        });
        expect(TRANSFORM2D_COMMAND_CONTRACT.currentAuthority).toMatchObject({
            authorityId: 'scratch.compat.transform',
            authorityReversalImplemented: false,
            bridgeImplementationReplaceable: true
        });
        disposeHarness(harness);
    });

    test('routes editor PatchComponent intent through Scratch Writer Authority and commits actual state', () => {
        const harness = createHarness();
        const projectBefore = harness.getProject();
        const result = patch(harness, {
            position: [40, -25],
            rotation: 135,
            scale: [1.5, 1.5]
        });

        expect(validateProtocolDTO(result).valid).toBe(true);
        expect(result).toMatchObject({
            kind: 'event',
            type: 'PatchComponentApplied',
            payload: {
                authorityId: 'scratch.compat.transform',
                componentId: harness.component.id,
                nodeId: 'runtime-node:scratch-player',
                requestedPatch: {
                    position: [40, -25],
                    rotation: 135,
                    scale: [1.5, 1.5]
                },
                transform: {
                    position: [40, -25],
                    rotation: 135,
                    scale: [1.5, 1.5]
                }
            }
        });
        expect(harness.target).toMatchObject({x: 40, y: -25, direction: -45, size: 150});
        expect(harness.transformRuntimeStore.getRuntimeTransform('runtime-node:scratch-player'))
            .toEqual(result.payload.transform);
        expect(harness.transformRuntimeStore.getPersistentTransform('runtime-node:scratch-player'))
            .toEqual(result.payload.transform);
        expect(harness.getProject()).not.toEqual(projectBefore);
        expect(JSON.stringify(harness.getProject())).not.toContain('target-runtime-a');
        disposeHarness(harness);
    });

    test('uses Scratch actual accepted size as the committed authority result', () => {
        const harness = createHarness({
            setSize (size) {
                this.size = Math.max(25, size);
            }
        });
        const result = patch(harness, {scale: [0.1, 0.1]});
        expect(harness.target.size).toBe(25);
        expect(result.payload.requestedPatch.scale).toEqual([0.1, 0.1]);
        expect(result.payload.transform.scale).toEqual([0.25, 0.25]);
        expect(harness.transformRuntimeStore.getPersistentTransform('runtime-node:scratch-player').scale)
            .toEqual([0.25, 0.25]);
        disposeHarness(harness);
    });

    test('supports partial position and rotation patches without mutating unrelated Scratch fields', () => {
        const harness = createHarness();
        patch(harness, {position: [77, 88]});
        expect(harness.target).toMatchObject({x: 77, y: 88, direction: 90, size: 100});
        patch(harness, {rotation: -90});
        expect(harness.target).toMatchObject({x: 77, y: 88, direction: 180, size: 100});
        expect(harness.transformRuntimeStore.getPersistentTransform('runtime-node:scratch-player')).toEqual({
            position: [77, 88],
            rotation: -90,
            scale: [1, 1]
        });
        disposeHarness(harness);
    });

    test('fails closed on non-uniform or negative scale before any Scratch mutation occurs', () => {
        const harness = createHarness();
        const before = {x: harness.target.x, y: harness.target.y, direction: harness.target.direction, size: harness.target.size};
        const nonUniform = patch(harness, {position: [999, 999], scale: [2, 1]});
        const negative = patch(harness, {scale: [-1, -1]});
        expect(nonUniform).toMatchObject({kind: 'error', code: 'SCRATCH_TRANSFORM_SCALE_UNREPRESENTABLE'});
        expect(negative).toMatchObject({kind: 'error', code: 'SCRATCH_TRANSFORM_SCALE_UNREPRESENTABLE'});
        expect(validateProtocolDTO(nonUniform).valid).toBe(true);
        expect(validateProtocolDTO(negative).valid).toBe(true);
        expect(harness.target).toMatchObject(before);
        expect(harness.transformRuntimeStore.getPersistentTransform('runtime-node:scratch-player')).toEqual({
            position: [12, -8],
            rotation: 0,
            scale: [1, 1]
        });
        disposeHarness(harness);
    });

    test('rejects a PatchComponent command that names the wrong component identity', () => {
        const harness = createHarness();
        const result = harness.editor.patchComponent({
            componentId: 'runtime-component:not-the-transform',
            nodeId: 'runtime-node:scratch-player',
            patch: {position: [2, 3]}
        });
        expect(result).toMatchObject({kind: 'error', code: 'SCRATCH_TRANSFORM_COMMAND_COMPONENT_MISMATCH'});
        expect(validateProtocolDTO(result).valid).toBe(true);
        expect(harness.target).toMatchObject({x: 12, y: -8});
        disposeHarness(harness);
    });

    test('rejects compatibility-only payload fields before resolving or mutating a Scratch Target', () => {
        const harness = createHarness();
        const command = {
            kind: 'command',
            payload: {
                componentId: harness.component.id,
                nodeId: 'runtime-node:scratch-player',
                patch: {position: [5, 6]},
                targetRuntimeId: 'must-not-cross-editor-protocol'
            },
            protocol: 'ngvge.engine-protocol',
            protocolVersion: 1,
            type: 'PatchComponent'
        };
        const result = harness.capability.executeCommand(command);
        expect(result).toMatchObject({kind: 'error', code: 'SCRATCH_TRANSFORM_COMMAND_PAYLOAD_UNSUPPORTED'});
        expect(validateProtocolDTO(result).valid).toBe(true);
        expect(harness.target).toMatchObject({x: 12, y: -8, direction: 90, size: 100});
        disposeHarness(harness);
    });

    test('forces explicit Editor position writes through Scratch drag guards', () => {
        let receivedForce = null;
        const harness = createHarness({
            setXY (x, y, force) {
                receivedForce = force;
                if (!force) return;
                this.x = x;
                this.y = y;
            }
        });
        const result = patch(harness, {position: [33, 44]});
        expect(result.kind).toBe('event');
        expect(receivedForce).toBe(true);
        expect(harness.target).toMatchObject({x: 33, y: 44});
        disposeHarness(harness);
    });

    test('rejects unsupported protocol commands instead of treating arbitrary payloads as editor mutations', () => {
        const harness = createHarness();
        const command = {
            kind: 'command',
            payload: {},
            protocol: 'ngvge.engine-protocol',
            protocolVersion: 1,
            type: 'DeleteNode'
        };
        const result = harness.capability.executeCommand(command);
        expect(result).toMatchObject({kind: 'error', code: 'SCRATCH_TRANSFORM_COMMAND_UNSUPPORTED'});
        expect(validateProtocolDTO(result).valid).toBe(true);
        disposeHarness(harness);
    });

    test('fails closed if the semantic node no longer has a live Scratch binding', () => {
        const harness = createHarness();
        harness.runtime.targets = [
            {id: 'stage-runtime', isOriginal: true, isStage: true, sprite: {name: 'Stage'}}
        ];
        harness.adapter.reconcileActiveScene({reason: 'target-removed', preserveMissing: true});
        const result = patch(harness, {position: [5, 6]});
        expect(result).toMatchObject({kind: 'error', code: 'SCRATCH_TRANSFORM_COMMAND_BINDING_UNAVAILABLE'});
        expect(validateProtocolDTO(result).valid).toBe(true);
        disposeHarness(harness);
    });

    test('returns a ProtocolError DTO and locally compensates if a Scratch setter fails mid-command', () => {
        let directionCalls = 0;
        const harness = createHarness({
            setDirection (direction) {
                directionCalls += 1;
                if (directionCalls === 1) throw Object.assign(new Error('direction write failed'), {code: 'TEST_DIRECTION_WRITE_FAILED'});
                this.direction = direction;
            }
        });
        const before = {x: harness.target.x, y: harness.target.y, direction: harness.target.direction, size: harness.target.size};
        const result = patch(harness, {position: [300, 200], rotation: 45});
        expect(result).toMatchObject({
            kind: 'error',
            code: 'TEST_DIRECTION_WRITE_FAILED',
            details: {
                authorityId: 'scratch.compat.transform',
                compensated: true,
                nodeId: 'runtime-node:scratch-player'
            }
        });
        expect(validateProtocolDTO(result).valid).toBe(true);
        expect(harness.target).toMatchObject(before);
        expect(harness.bridge.getStatus()).toMatchObject({compensationCount: 1, failureCount: 1});
        disposeHarness(harness);
    });

    test('provides explicit inverse conversion helpers for the current Scratch Authority representation', () => {
        expect(transformRotationToScratchDirection(0)).toBe(90);
        expect(transformRotationToScratchDirection(90)).toBe(0);
        expect(transformRotationToScratchDirection(-90)).toBe(180);
        expect(transformScaleToScratchSize([2.5, 2.5])).toBe(250);
        expect(() => transformScaleToScratchSize([2, 1])).toThrow(
            expect.objectContaining({code: 'SCRATCH_TRANSFORM_SCALE_UNREPRESENTABLE'})
        );
    });
});
