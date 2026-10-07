import React from 'react';
import renderer, {act} from 'react-test-renderer';

import ProjectInspector from '../../../src/components/project-inspector/project-inspector.jsx';
import {getInspectorRegistry} from '../../../src/lib/project-inspector/inspector-registry';
import {installNodeDatabase} from '../../../src/lib/project-nodes/node-database';
import {
    getColliderGizmoPreferences,
    getEditorTransformPreview
} from '../../../src/lib/editor-visualization';
import {createServiceFacadeFactory} from '../../../src/lib/first-party-modules/service-facade';

const createTarget = (id, name, layerOrder) => ({
    id,
    isOriginal: true,
    isStage: false,
    x: 10,
    y: -20,
    direction: 90,
    size: 100,
    rotationStyle: 'all around',
    visible: true,
    draggable: false,
    getName: () => name,
    getLayerOrder: () => layerOrder,
    goToFront: jest.fn(),
    goToBack: jest.fn(),
    goForwardLayers: jest.fn(),
    goBackwardLayers: jest.fn()
});

const createVM = () => {
    const player = createTarget('player', 'Player', 2);
    const enemy = createTarget('enemy', 'Enemy', 1);
    const listeners = {};
    const runtime = {
        targets: [player, enemy],
        getTargetById: id => runtime.targets.find(target => target.id === id),
        emitProjectChanged: jest.fn()
    };
    const vm = {
        runtime,
        editingTarget: player,
        postSpriteInfo: jest.fn(data => {
            Object.assign(player, data);
        }),
        renameSprite: jest.fn(),
        emitTargetsUpdate: jest.fn(),
        on: jest.fn((event, listener) => {
            listeners[event] = listener;
        }),
        off: jest.fn()
    };
    return {enemy, player, runtime, vm};
};

const mountedInspectors = [];
const renderInspector = (vm, props) => {
    let component;
    act(() => {
        component = renderer.create(
            <ProjectInspector
                editingTargetId="player"
                expandedSectionIds={[
                    'identity',
                    'transform',
                    'layer',
                    'extension:test'
                ]}
                vm={vm}
                onSelectTarget={() => {}}
                onToggleSection={() => {}}
                {...props}
            />
        );
    });
    mountedInspectors.push(component);
    return component;
};

describe('ProjectInspector', () => {
    afterEach(() => {
        while (mountedInspectors.length) {
            const component = mountedInspectors.pop();
            act(() => component.unmount());
        }
    });
    test('renders transform properties and layer manager', () => {
        const {vm} = createVM();
        const component = renderInspector(vm);
        const text = JSON.stringify(component.toJSON());

        expect(text).toContain('Inspector');
        expect(text).toContain('Transform');
        expect(text).toContain('Layer Manager');
        expect(text).toContain('Player');
        expect(text).toContain('Enemy');
        expect(text).toContain('Front');
        expect(text).toContain('Back');
    });

    test('posts transform changes through the VM', () => {
        const {vm} = createVM();
        const component = renderInspector(vm);
        const numberInputs = component.root.findAll(node => (
            node.type === 'input' && node.props.type === 'number'
        ));

        act(() => numberInputs[0].props.onChange({target: {value: '42'}}));
        const updatedNumberInput = component.root.findAll(node => (
            node.type === 'input' && node.props.type === 'number'
        ))[0];
        act(() => updatedNumberInput.props.onBlur());

        expect(vm.postSpriteInfo).toHaveBeenCalledWith({x: 42});
    });

    test('undoes and redoes an inspector property change', () => {
        const {vm} = createVM();
        const component = renderInspector(vm);
        const numberInputs = component.root.findAll(node => (
            node.type === 'input' && node.props.type === 'number'
        ));

        act(() => numberInputs[0].props.onChange({target: {value: '42'}}));
        const updatedNumberInput = component.root.findAll(node => (
            node.type === 'input' && node.props.type === 'number'
        ))[0];
        act(() => updatedNumberInput.props.onBlur());

        const undoButton = component.root.findAll(node => (
            node.type === 'button' && node.children.join('') === '↶ Undo'
        ))[0];
        act(() => undoButton.props.onClick());

        expect(vm.postSpriteInfo).toHaveBeenLastCalledWith({x: 10});

        const redoButton = component.root.findAll(node => (
            node.type === 'button' && node.children.join('') === 'Redo ↷'
        ))[0];
        act(() => redoButton.props.onClick());

        expect(vm.postSpriteInfo).toHaveBeenLastCalledWith({x: 42});
    });

    test('moves the selected target to the front layer', () => {
        const {player, vm} = createVM();
        const component = renderInspector(vm);
        const frontButton = component.root.findAll(node => (
            node.type === 'button' && node.children.join('') === 'Front'
        ))[0];

        act(() => frontButton.props.onClick());

        expect(player.goToFront).toHaveBeenCalledTimes(1);
        expect(vm.runtime.emitProjectChanged).toHaveBeenCalledTimes(1);
        expect(vm.emitTargetsUpdate).toHaveBeenCalledWith(false);
    });


    test('renders and edits an NGVGE child node', () => {
        const {player, vm} = createVM();
        const database = installNodeDatabase(vm);
        const playerNode = database.getNodeForTarget(player.id);
        const collider = database.createNode('ngvge.collider2d', playerNode.id, {name: 'Hitbox'});
        const component = renderInspector(vm, {
            expandedSectionIds: ['node:identity', 'node:properties', 'node:hierarchy'],
            selectedNodeId: collider.id
        });
        const text = JSON.stringify(component.toJSON());

        expect(text).toContain('Hitbox');
        expect(text).toContain('Collider2D');
        expect(text).toContain('Collision Layer');
        expect(text).toContain('Legacy Collider2D compatibility node');
        expect(text).toContain('Upgrade as StaticBody2D');
        expect(text).toContain('Upgrade as Area2D');

        const shapeSelect = component.root.findAll(node => (
            node.type === 'select' && node.props.value === 'rectangle'
        ))[0];
        act(() => shapeSelect.props.onChange({target: {value: 'circle'}}));

        expect(database.getNode(collider.id).properties.shape).toBe('circle');
    });

    test('upgrades a legacy Collider2D compatibility node into a Functional StaticBody2D', async () => {
        const {player, vm} = createVM();
        const database = installNodeDatabase(vm);
        const playerNode = database.getNodeForTarget(player.id);
        const legacyCollider = database.createNode('ngvge.collider2d', playerNode.id, {
            name: 'Legacy Hitbox',
            properties: {
                collisionLayer: 4,
                collisionMask: 8,
                height: 60,
                isTrigger: false,
                offsetX: 12,
                offsetY: -6,
                radius: 24,
                shape: 'rectangle',
                width: 140
            }
        });
        const createdRuntimeNode = {
            components: [{
                data: {},
                enabled: true,
                id: 'collider-component-upgraded',
                schemaVersion: 1,
                typeId: 'ngvge.collider2d'
            }],
            id: 'runtime-node:upgraded',
            name: 'Legacy Hitbox',
            parentId: 'runtime-node:sprite:player',
            sceneId: 'scene-test',
            scope: 'scene',
            typeId: 'ngvge.node2d'
        };
        const nodeCommandClient = {
            createNode: jest.fn(() => ({node: createdRuntimeNode})),
            destroyNode: jest.fn(() => ({destroyed: true})),
            patchNode: jest.fn(),
            selectNode: jest.fn()
        };
        const executeColliderCommand = jest.fn(() => ({
            kind: 'event',
            payload: {},
            protocol: 'ngvge.engine-protocol',
            protocolVersion: 1,
            type: 'Collider2DPatchApplied'
        }));
        const runtimeNodeModel = {
            getNodeSnapshot: () => null,
            getSceneRoot: () => ({id: 'runtime-node:scene-root:scene-test'}),
            subscribe: () => () => {}
        };
        vm.runtime.ngvgeFirstPartyModules = {
            getCapability: capabilityId => {
                if (capabilityId === 'ngvge.runtime-node-model') return runtimeNodeModel;
                if (capabilityId === 'ngvge.scratch-sprite-node-adapter') return {
                    getBindingByNodeId: () => null,
                    getBindingByTargetRuntimeId: targetId => targetId === 'player' ? {
                        nodeId: 'runtime-node:sprite:player',
                        sceneId: 'scene-test',
                        targetRuntimeId: 'player'
                    } : null
                };
                if (capabilityId === 'ngvge.functional-node-creation') return {
                    createPlan: () => ({
                        options: {components: createdRuntimeNode.components, name: 'Legacy Hitbox', scope: 'scene'},
                        runtimeTypeId: 'ngvge.node2d'
                    })
                };
                if (capabilityId === 'ngvge.collider2d-command') return {
                    capabilityId: 'ngvge.collider2d-command',
                    executeCommand: executeColliderCommand,
                    version: 1
                };
                return null;
            },
            getModuleData: () => ({
                activeSceneId: 'scene-test',
                scenes: [{id: 'scene-test', name: 'Scene Test'}]
            }),
            getModuleState: () => ({enabled: true})
        };

        const component = renderInspector(vm, {
            editingTargetId: null,
            expandedSectionIds: ['node:identity', 'node:properties'],
            nodeCommandClient,
            selectedNodeId: legacyCollider.id
        });
        const upgradeButton = component.root.findAll(node => (
            node.type === 'button' && node.children.join('') === 'Upgrade as StaticBody2D'
        ))[0];
        await act(async () => {
            await upgradeButton.props.onClick();
        });

        expect(nodeCommandClient.createNode).toHaveBeenCalledWith(expect.objectContaining({
            domain: 'runtime',
            parentId: 'runtime-node:sprite:player',
            typeId: 'ngvge.node2d'
        }));
        expect(executeColliderCommand).toHaveBeenCalledWith(expect.objectContaining({
            payload: expect.objectContaining({
                componentId: 'collider-component-upgraded',
                nodeId: 'runtime-node:upgraded',
                patch: expect.objectContaining({
                    collisionLayer: 4,
                    collisionMask: 8,
                    offset: [12, -6],
                    sensor: false,
                    shape: {size: [140, 60], type: 'rectangle'}
                })
            }),
            type: 'PatchCollider2D'
        }));
        expect(nodeCommandClient.destroyNode).toHaveBeenCalledWith({nodeId: legacyCollider.id});
        expect(nodeCommandClient.selectNode).toHaveBeenCalledWith({nodeId: createdRuntimeNode.id});
    });

    test('keeps the legacy Collider2D intact when Functional migration fails after Runtime creation', async () => {
        const {player, vm} = createVM();
        const database = installNodeDatabase(vm);
        const playerNode = database.getNodeForTarget(player.id);
        const legacyCollider = database.createNode('ngvge.collider2d', playerNode.id, {
            name: 'Legacy Trigger',
            properties: {height: 80, isTrigger: true, shape: 'rectangle', width: 120}
        });
        const createdRuntimeNode = {
            components: [{
                data: {},
                enabled: true,
                id: 'collider-component-failed-upgrade',
                schemaVersion: 1,
                typeId: 'ngvge.collider2d'
            }],
            id: 'runtime-node:failed-upgrade',
            name: 'Legacy Trigger',
            parentId: 'runtime-node:sprite:player',
            sceneId: 'scene-test',
            scope: 'scene',
            typeId: 'ngvge.node2d'
        };
        const nodeCommandClient = {
            createNode: jest.fn(() => ({node: createdRuntimeNode})),
            destroyNode: jest.fn(({nodeId}) => {
                if (nodeId === legacyCollider.id) database.destroyNode(nodeId);
                return {destroyed: true};
            }),
            patchNode: jest.fn(),
            selectNode: jest.fn()
        };
        const runtimeNodeModel = {
            getNodeSnapshot: () => null,
            getSceneRoot: () => ({id: 'runtime-node:scene-root:scene-test'}),
            subscribe: () => () => {}
        };
        vm.runtime.ngvgeFirstPartyModules = {
            getCapability: capabilityId => {
                if (capabilityId === 'ngvge.runtime-node-model') return runtimeNodeModel;
                if (capabilityId === 'ngvge.scratch-sprite-node-adapter') return {
                    getBindingByNodeId: () => null,
                    getBindingByTargetRuntimeId: () => ({
                        nodeId: 'runtime-node:sprite:player',
                        sceneId: 'scene-test',
                        targetRuntimeId: 'player'
                    })
                };
                if (capabilityId === 'ngvge.functional-node-creation') return {
                    createPlan: () => ({
                        options: {components: createdRuntimeNode.components, name: 'Legacy Trigger', scope: 'scene'},
                        runtimeTypeId: 'ngvge.node2d'
                    })
                };
                if (capabilityId === 'ngvge.collider2d-command') return {
                    capabilityId: 'ngvge.collider2d-command',
                    executeCommand: () => ({
                        code: 'COLLIDER_PATCH_REJECTED',
                        kind: 'error',
                        message: 'simulated migration failure',
                        protocol: 'ngvge.engine-protocol',
                        protocolVersion: 1
                    }),
                    version: 1
                };
                return null;
            },
            getModuleData: () => ({
                activeSceneId: 'scene-test',
                scenes: [{id: 'scene-test', name: 'Scene Test'}]
            }),
            getModuleState: () => ({enabled: true})
        };

        const component = renderInspector(vm, {
            editingTargetId: null,
            expandedSectionIds: ['node:identity', 'node:properties'],
            nodeCommandClient,
            selectedNodeId: legacyCollider.id
        });
        const upgradeButton = component.root.findAll(node => (
            node.type === 'button' && node.children.join('') === 'Upgrade as Area2D'
        ))[0];
        await act(async () => {
            await upgradeButton.props.onClick();
        });

        expect(database.getNode(legacyCollider.id)).not.toBeNull();
        expect(nodeCommandClient.destroyNode).toHaveBeenCalledWith({nodeId: createdRuntimeNode.id});
        expect(nodeCommandClient.destroyNode).not.toHaveBeenCalledWith({nodeId: legacyCollider.id});
        expect(nodeCommandClient.selectNode).not.toHaveBeenCalled();
        expect(JSON.stringify(component.toJSON())).toContain('simulated migration failure');
    });

    test('renders registered extension sections', () => {
        const {runtime, vm} = createVM();
        getInspectorRegistry(runtime).register({
            id: 'test',
            label: 'Test Properties',
            getFields: () => [{
                id: 'amount',
                label: 'Amount',
                type: 'number',
                value: 5
            }],
            setValue: jest.fn()
        });

        const component = renderInspector(vm);
        const text = JSON.stringify(component.toJSON());

        expect(text).toContain('Test Properties');
        expect(text).toContain('Amount');
    });

    test('renders and edits a native runtime node', () => {
        const {vm} = createVM();
        const runtimeNode = {
            components: [{id: 'component-1', typeId: 'example.logic'}],
            enabledSelf: true,
            id: 'runtime-node-1',
            name: 'GameManager',
            parentId: 'runtime-node:global-root',
            protected: false,
            sceneId: null,
            scope: 'global',
            typeId: 'ngvge.service-node'
        };
        const patchNode = jest.fn((nodeId, patch) => {
            Object.assign(runtimeNode, patch);
            return {
                applied: true,
                error: null,
                persisted: true,
                snapshot: Object.assign({}, runtimeNode)
            };
        });
        const runtimeNodeModel = {
            destroyNode: jest.fn(),
            getChildren: () => [],
            getNodeSnapshot: nodeId => nodeId === runtimeNode.id ? runtimeNode : null,
            getParent: () => ({id: 'runtime-node:global-root', name: 'Global', protected: true}),
            getNodeType: () => ({family: 'service', label: 'ServiceNode'}),
            patchNode,
            setNodeEnabled: jest.fn(),
            subscribe: () => () => {}
        };
        const executeRuntimeNodeCommand = jest.fn(command => {
            if (command.type === 'PatchNode') Object.assign(runtimeNode, command.payload.patch);
            return {
                kind: 'event',
                payload: {node: Object.assign({}, runtimeNode), nodeId: runtimeNode.id},
                protocol: 'ngvge.engine-protocol',
                protocolVersion: 1,
                type: command.type === 'DestroyNode' ? 'NodeDestroyed' : 'NodePatched'
            };
        });
        const runtimeNodeCommandCapability = {
            capabilityId: 'ngvge.runtime-node-command',
            executeCommand: executeRuntimeNodeCommand,
            version: 1
        };
        vm.runtime.ngvgeFirstPartyModules = {
            getCapability: capabilityId => {
                if (capabilityId === 'ngvge.runtime-node-model') return runtimeNodeModel;
                if (capabilityId === 'ngvge.runtime-node-command') return runtimeNodeCommandCapability;
                return null;
            },
            getModuleState: () => ({enabled: true})
        };
        const component = renderInspector(vm, {
            editingTargetId: null,
            expandedSectionIds: [
                'runtime-node:identity',
                'runtime-node:components',
                'runtime-node:hierarchy'
            ],
            selectedNodeId: runtimeNode.id
        });
        const text = JSON.stringify(component.toJSON());

        expect(text).toContain('GameManager');
        expect(text).toContain('ServiceNode');
        expect(text).toContain('example.logic');
        expect(text).toContain('Project global');

        const nameInput = component.root.findAll(node => (
            node.type === 'input' && node.props.value === 'GameManager'
        ))[0];
        act(() => nameInput.props.onChange({target: {value: 'AppManager'}}));
        act(() => nameInput.props.onBlur());

        expect(executeRuntimeNodeCommand).toHaveBeenCalledWith(expect.objectContaining({
            kind: 'command',
            payload: {nodeId: runtimeNode.id, patch: {name: 'AppManager'}},
            type: 'PatchNode'
        }));
        expect(patchNode).not.toHaveBeenCalled();
    });


    test('edits Runtime Transform2D through the semantic command capability', () => {
        const {vm} = createVM();
        const runtimeNode = {
            components: [{
                data: {position: [12, -23], rotation: 45, scale: [1.25, 1.25]},
                enabled: true,
                id: 'transform-component-1',
                schemaVersion: 1,
                typeId: 'ngvge.transform2d'
            }],
            enabledSelf: true,
            id: 'runtime-node:sprite:test-player',
            name: 'Player',
            parentId: 'runtime-node:scene-root:test',
            protected: false,
            sceneId: 'scene-test',
            scope: 'scene',
            typeId: 'ngvge.sprite-node'
        };
        let runtimeTransform = {
            position: [12, -23],
            rotation: 45,
            scale: [1.25, 1.25]
        };
        const runtimeNodeModel = {
            destroyNode: jest.fn(),
            getChildren: () => [],
            getNodeSnapshot: nodeId => nodeId === runtimeNode.id ? runtimeNode : null,
            getParent: () => ({id: 'runtime-node:scene-root:test', name: 'Scene', protected: true}),
            getNodeType: () => ({family: '2d', label: 'SpriteNode'}),
            patchNode: jest.fn(),
            setNodeEnabled: jest.fn(),
            subscribe: () => () => {}
        };
        const runtimeTransformCapability = {
            capabilityId: 'ngvge.transform2d-runtime',
            getRuntimeTransform: nodeId => nodeId === runtimeNode.id ? runtimeTransform : null,
            isRuntimeDivergedFromPersistent: () => false,
            subscribe: () => () => {}
        };
        const executeCommand = jest.fn(command => {
            if (command.payload.patch.position) runtimeTransform = Object.assign({}, runtimeTransform, {
                position: command.payload.patch.position.slice()
            });
            if (Object.prototype.hasOwnProperty.call(command.payload.patch, 'rotation')) {
                runtimeTransform = Object.assign({}, runtimeTransform, {rotation: command.payload.patch.rotation});
            }
            if (command.payload.patch.scale) runtimeTransform = Object.assign({}, runtimeTransform, {
                scale: command.payload.patch.scale.slice()
            });
            return {
                kind: 'event',
                payload: {},
                protocol: 'ngvge.engine-protocol',
                protocolVersion: 1,
                type: 'PatchComponentApplied'
            };
        });
        const transformCommandCapability = {
            capabilityId: 'ngvge.transform2d-command',
            executeCommand,
            version: 1
        };
        vm.runtime.ngvgeFirstPartyModules = {
            getCapability: capabilityId => {
                if (capabilityId === 'ngvge.runtime-node-model') return runtimeNodeModel;
                if (capabilityId === 'ngvge.transform2d-runtime') return runtimeTransformCapability;
                if (capabilityId === 'ngvge.transform2d-command') return transformCommandCapability;
                if (capabilityId === 'ngvge.scratch-sprite-node-adapter') return {
                    getBindingByNodeId: nodeId => nodeId === runtimeNode.id ? {
                        bindingId: 'binding:test-player',
                        nodeId: runtimeNode.id,
                        sceneId: runtimeNode.sceneId,
                        status: 'bound',
                        targetRuntimeId: 'player'
                    } : null
                };
                return null;
            },
            getModuleState: () => ({enabled: true})
        };

        const component = renderInspector(vm, {
            editingTargetId: null,
            expandedSectionIds: [
                'runtime-node:identity',
                'runtime-node:transform',
                'runtime-node:scratch-appearance',
                'runtime-node:components',
                'runtime-node:hierarchy'
            ],
            selectedNodeId: runtimeNode.id
        });
        const text = JSON.stringify(component.toJSON());

        expect(text).toContain('Transform2D');
        expect(text).toContain('Scratch Compatibility');
        expect(text).toContain('Sprite Appearance');
        expect(text).toContain('Rotation Style');
        expect(text).toContain('transform-component-1');

        const numberInputs = component.root.findAll(node => (
            node.type === 'input' && node.props.type === 'number'
        ));
        expect(numberInputs).toHaveLength(4);

        act(() => numberInputs[0].props.onChange({target: {value: '42'}}));
        const updatedXInput = component.root.findAll(node => (
            node.type === 'input' && node.props.type === 'number'
        ))[0];
        act(() => updatedXInput.props.onBlur());

        expect(executeCommand).toHaveBeenCalledTimes(1);
        const command = executeCommand.mock.calls[0][0];
        expect(command.kind).toBe('command');
        expect(command.type).toBe('PatchComponent');
        expect(command.payload.nodeId).toBe(runtimeNode.id);
        expect(command.payload.componentId).toBe('transform-component-1');
        expect(command.payload.patch).toEqual({position: [42, -23]});
        expect(vm.postSpriteInfo).not.toHaveBeenCalled();

        const transformPreview = getEditorTransformPreview(vm.runtime);
        act(() => {
            transformPreview.begin({
                authoredPosition: [42, -23],
                nodeId: runtimeNode.id,
                targetRuntimeId: 'player'
            });
            transformPreview.updatePosition([80, 35]);
        });
        const previewText = JSON.stringify(component.toJSON());
        expect(previewText).toContain('Editor Drag Preview');
        expect(previewText).toContain('Transient · commit on release');
        const previewNumberInputs = component.root.findAll(node => (
            node.type === 'input' && node.props.type === 'number'
        ));
        expect(previewNumberInputs[0].props.value).toBe('80');
        expect(previewNumberInputs[1].props.value).toBe('35');
        expect(executeCommand).toHaveBeenCalledTimes(1);
        act(() => { transformPreview.cancel('test-finish'); });

        const appearanceCheckboxes = component.root.findAll(node => node.type === 'input' && node.props.type === 'checkbox');
        expect(appearanceCheckboxes.length).toBeGreaterThanOrEqual(3);
        const visibleCheckbox = appearanceCheckboxes[1];
        expect(visibleCheckbox.props.checked).toBe(true);
        act(() => visibleCheckbox.props.onChange({target: {checked: false}}));
        expect(vm.postSpriteInfo).toHaveBeenCalledWith({visible: false});
    });


    test('renders native Node2D Transform with independent XY scale and native authority', () => {
        const {vm} = createVM();
        const runtimeNode = {
            components: [{
                data: {position: [0, 0], rotation: 0, scale: [2, 0.5]},
                enabled: true,
                id: 'transform-component-native',
                schemaVersion: 1,
                typeId: 'ngvge.transform2d'
            }],
            enabledSelf: true,
            id: 'runtime-node:native:node2d',
            name: 'Native Node2D',
            parentId: 'runtime-node:scene-root:test',
            protected: false,
            sceneId: 'scene-test',
            scope: 'scene',
            typeId: 'ngvge.node2d'
        };
        let runtimeTransform = {position: [0, 0], rotation: 0, scale: [2, 0.5]};
        const runtimeNodeModel = {
            getChildren: () => [],
            getNodeSnapshot: nodeId => nodeId === runtimeNode.id ? runtimeNode : null,
            getParent: () => ({id: runtimeNode.parentId, name: 'Scene', protected: true}),
            getNodeType: () => ({family: '2d', label: 'Node2D'}),
            subscribe: () => () => {}
        };
        const runtimeTransformCapability = {
            capabilityId: 'ngvge.transform2d-runtime',
            getRuntimeTransform: nodeId => nodeId === runtimeNode.id ? runtimeTransform : null,
            isRuntimeDivergedFromPersistent: () => false,
            subscribe: () => () => {}
        };
        const executeCommand = jest.fn(command => {
            if (command.payload.patch.scale) runtimeTransform = Object.assign({}, runtimeTransform, {
                scale: command.payload.patch.scale.slice()
            });
            return {
                kind: 'event',
                payload: {},
                protocol: 'ngvge.engine-protocol',
                protocolVersion: 1,
                type: 'PatchComponentApplied'
            };
        });
        vm.runtime.ngvgeFirstPartyModules = {
            getCapability: capabilityId => {
                if (capabilityId === 'ngvge.runtime-node-model') return runtimeNodeModel;
                if (capabilityId === 'ngvge.transform2d-runtime') return runtimeTransformCapability;
                if (capabilityId === 'ngvge.transform2d-command') return {
                    capabilityId: 'ngvge.transform2d-command',
                    executeCommand,
                    version: 1
                };
                if (capabilityId === 'ngvge.scratch-sprite-node-adapter') return {
                    getBindingByNodeId: () => null
                };
                return null;
            },
            getModuleState: () => ({enabled: true})
        };

        const component = renderInspector(vm, {
            editingTargetId: null,
            expandedSectionIds: ['runtime-node:identity', 'runtime-node:transform'],
            selectedNodeId: runtimeNode.id
        });
        const text = JSON.stringify(component.toJSON());

        expect(text).toContain('Scale X');
        expect(text).toContain('Scale Y');
        expect(text).toContain('NGVGE Native');
        const numberInputs = component.root.findAll(node => (
            node.type === 'input' && node.props.type === 'number'
        ));
        expect(numberInputs).toHaveLength(5);
        expect(numberInputs[3].props.min).toBeUndefined();
        expect(numberInputs[4].props.min).toBeUndefined();

        act(() => numberInputs[4].props.onChange({target: {value: '-2'}}));
        const updatedScaleY = component.root.findAll(node => (
            node.type === 'input' && node.props.type === 'number'
        ))[4];
        act(() => updatedScaleY.props.onBlur());

        expect(executeCommand).toHaveBeenCalledTimes(1);
        expect(executeCommand.mock.calls[0][0].payload.patch).toEqual({scale: [2, -2]});
    });


    test('renders and edits native Camera2D through semantic Camera command capability', () => {
        const {vm} = createVM();
        const runtimeNode = {
            components: [
                {
                    data: {position: [10, -5], rotation: 15, scale: [1, 1]},
                    enabled: true,
                    id: 'transform-component-camera',
                    schemaVersion: 1,
                    typeId: 'ngvge.transform2d'
                },
                {
                    data: {enabled: true, offset: [2, 3], priority: 4, zoom: [1.5, 0.75]},
                    enabled: true,
                    id: 'camera-component-1',
                    schemaVersion: 1,
                    typeId: 'ngvge.camera2d'
                }
            ],
            enabledSelf: true,
            id: 'runtime-node:native:camera',
            name: 'Main Camera',
            parentId: 'runtime-node:scene-root:test',
            protected: false,
            sceneId: 'scene-test',
            scope: 'scene',
            typeId: 'ngvge.node2d'
        };
        const runtimeNodeModel = {
            getChildren: () => [],
            getNodeSnapshot: nodeId => nodeId === runtimeNode.id ? runtimeNode : null,
            getParent: () => ({id: runtimeNode.parentId, name: 'Scene', protected: true}),
            getNodeType: () => ({family: '2d', label: 'Node2D'}),
            subscribe: () => () => {}
        };
        const runtimeTransformCapability = {
            capabilityId: 'ngvge.transform2d-runtime',
            getRuntimeTransform: () => ({position: [10, -5], rotation: 15, scale: [1, 1]}),
            isRuntimeDivergedFromPersistent: () => false,
            subscribe: () => () => {}
        };
        let camera = {
            componentId: 'camera-component-1',
            config: {enabled: true, offset: [2, 3], priority: 4, zoom: [1.5, 0.75]},
            name: 'Main Camera',
            nodeId: runtimeNode.id,
            sceneId: runtimeNode.sceneId,
            transform: {position: [10, -5], rotation: 15, scale: [1, 1]}
        };
        const cameraRuntimeCapability = {
            capabilityId: 'ngvge.camera2d-runtime',
            getCamera: () => camera,
            getViewportState: () => ({activeCameraNodeId: runtimeNode.id}),
            subscribe: () => () => {}
        };
        const executeCameraCommand = jest.fn(command => {
            camera = Object.assign({}, camera, {
                config: Object.assign({}, camera.config, command.payload.patch)
            });
            return {
                kind: 'event',
                payload: {},
                protocol: 'ngvge.engine-protocol',
                protocolVersion: 1,
                type: 'Camera2DPatchApplied'
            };
        });
        vm.runtime.ngvgeFirstPartyModules = {
            getCapability: capabilityId => {
                if (capabilityId === 'ngvge.runtime-node-model') return runtimeNodeModel;
                if (capabilityId === 'ngvge.transform2d-runtime') return runtimeTransformCapability;
                if (capabilityId === 'ngvge.transform2d-command') return {
                    capabilityId: 'ngvge.transform2d-command',
                    executeCommand: jest.fn(),
                    version: 1
                };
                if (capabilityId === 'ngvge.camera2d-runtime') return cameraRuntimeCapability;
                if (capabilityId === 'ngvge.camera2d-command') return {
                    capabilityId: 'ngvge.camera2d-command',
                    executeCommand: executeCameraCommand,
                    version: 1
                };
                if (capabilityId === 'ngvge.scratch-sprite-node-adapter') return {getBindingByNodeId: () => null};
                return null;
            },
            getModuleState: () => ({enabled: true})
        };

        const component = renderInspector(vm, {
            editingTargetId: null,
            expandedSectionIds: [
                'runtime-node:identity',
                'runtime-node:transform',
                'runtime-node:camera2d'
            ],
            selectedNodeId: runtimeNode.id
        });
        const text = JSON.stringify(component.toJSON());
        expect(text).toContain('Camera2D');
        expect(text).toContain('Active');
        expect(text).toContain('Zoom X');
        expect(text).toContain('Offset Y');
        expect(text).toContain('NGVGE native only');

        const numberInputs = component.root.findAll(node => node.type === 'input' && node.props.type === 'number');
        expect(numberInputs).toHaveLength(10);
        act(() => numberInputs[5].props.onChange({target: {value: '2.25'}}));
        const updatedNumberInputs = component.root.findAll(node => node.type === 'input' && node.props.type === 'number');
        act(() => updatedNumberInputs[5].props.onBlur());

        expect(executeCameraCommand).toHaveBeenCalledTimes(1);
        expect(executeCameraCommand.mock.calls[0][0]).toEqual(expect.objectContaining({
            kind: 'command',
            type: 'PatchCamera2D',
            payload: expect.objectContaining({
                componentId: 'camera-component-1',
                nodeId: runtimeNode.id,
                patch: {zoom: [2.25, 0.75]}
            })
        }));
    });


    test('edits Collider2D shape and editor gizmo visibility from the Runtime Inspector', () => {
        const {vm} = createVM();
        const runtimeNode = {
            components: [{
                data: {
                    collisionLayer: 1,
                    collisionMask: 1,
                    offset: [0, 0],
                    rotation: 0,
                    sensor: false,
                    shape: {size: [100, 100], type: 'rectangle'},
                    transformInheritance: 'inherit-node'
                },
                enabled: true,
                id: 'collider-component-1',
                schemaVersion: 1,
                typeId: 'ngvge.collider2d'
            }],
            enabledSelf: true,
            id: 'runtime-node:native:body',
            name: 'Body',
            parentId: 'runtime-node:scene-root:test',
            protected: false,
            sceneId: 'scene-test',
            scope: 'scene',
            typeId: 'ngvge.node2d'
        };
        let collider = {
            componentId: 'collider-component-1',
            config: runtimeNode.components[0].data,
            nodeId: runtimeNode.id,
            sceneId: runtimeNode.sceneId,
            worldPoints: [[-50, -50], [50, -50], [50, 50], [-50, 50]]
        };
        const runtimeNodeModel = {
            getChildren: () => [],
            getNodeSnapshot: nodeId => nodeId === runtimeNode.id ? runtimeNode : null,
            getParent: () => ({id: runtimeNode.parentId, name: 'Scene', protected: true}),
            getNodeType: () => ({family: '2d', label: 'StaticBody2D'}),
            subscribe: () => () => {}
        };
        const executeColliderCommand = jest.fn(command => {
            const patch = command.payload.patch;
            collider = Object.assign({}, collider, {
                config: Object.assign({}, collider.config, patch)
            });
            return {
                kind: 'event',
                payload: {},
                protocol: 'ngvge.engine-protocol',
                protocolVersion: 1,
                type: 'Collider2DPatchApplied'
            };
        });
        const rawCapabilities = new Map([
            ['ngvge.runtime-node-model', runtimeNodeModel],
            ['ngvge.collider2d-runtime', {
                capabilityId: 'ngvge.collider2d-runtime',
                getCollider: () => collider,
                getOverlaps: () => [],
                subscribe: () => () => {}
            }],
            ['ngvge.collider2d-command', {
                capabilityId: 'ngvge.collider2d-command',
                executeCommand: executeColliderCommand,
                version: 1
            }],
            ['ngvge.scratch-sprite-node-adapter', {getBindingByNodeId: () => null}]
        ]);
        const capabilities = new Map(Array.from(rawCapabilities, ([capabilityId, capability]) => [
            capabilityId,
            createServiceFacadeFactory({
                assertActive: () => {},
                boundaryKind: 'capability',
                serviceId: `capability:${capabilityId}`
            }).wrap(capability)
        ]));
        vm.runtime.ngvgeFirstPartyModules = {
            getCapability: capabilityId => capabilities.get(capabilityId) || null,
            getModuleState: () => ({enabled: true})
        };

        const component = renderInspector(vm, {
            editingTargetId: null,
            expandedSectionIds: ['runtime-node:collider2d'],
            selectedNodeId: runtimeNode.id
        });
        const text = JSON.stringify(component.toJSON());
        expect(text).toContain('Collider2D');
        expect(text).toContain('Shape');
        expect(text).toContain('Gizmo');
        expect(text).toContain('Selected Only');

        const colliderSection = component.root.findByProps({'data-inspector-section': 'runtime-node:collider2d'});
        const dimensionInputs = colliderSection.findAll(node => node.type === 'input' && node.props.type === 'number');
        act(() => dimensionInputs[0].props.onChange({target: {value: '140'}}));
        const refreshedWidth = colliderSection.findAll(node => node.type === 'input' && node.props.type === 'number')[0];
        act(() => refreshedWidth.props.onBlur());
        expect(executeColliderCommand).toHaveBeenCalledWith(expect.objectContaining({
            payload: expect.objectContaining({patch: {shape: {size: [140, 100], type: 'rectangle'}}}),
            type: 'PatchCollider2D'
        }));

        const selects = component.root.findAll(node => node.type === 'select');
        const shapeSelect = selects.find(node => node.props['data-ngvge-collider-shape-select'] === 'true');
        act(() => shapeSelect.props.onChange({target: {value: 'circle'}}));
        expect(executeColliderCommand).toHaveBeenCalledWith(expect.objectContaining({
            payload: expect.objectContaining({patch: {shape: {radius: 70, type: 'circle'}}}),
            type: 'PatchCollider2D'
        }));

        const gizmoSelect = component.root.findAll(node => node.type === 'select').find(node => (
            node.props.value === 'inherit'
        ));
        act(() => gizmoSelect.props.onChange({target: {value: 'hidden'}}));
        expect(getColliderGizmoPreferences(vm.runtime).getNodeVisibility(runtimeNode.id)).toBe('hidden');
        expect(executeColliderCommand).toHaveBeenCalledTimes(2);
    });

});
