import React from 'react';
import renderer, {act} from 'react-test-renderer';
import ReactDOM from 'react-dom';
import {IntlProvider} from 'react-intl';

import {
    createPortableProjectPayload,
    encodeBase64Bytes,
    encodeUTF8
} from '../../../src/lib/first-party-modules/portable-project-files';

import ProjectExplorer, {
    ASSETS_ROOT_NODE_ID,
    ENTITIES_ROOT_NODE_ID,
    PROJECT_ROOT_NODE_ID
} from '../../../src/components/project-explorer/project-explorer.jsx';
import {installNodeDatabase} from '../../../src/lib/project-nodes/node-database';
import {createRuntimeNodeCommandExecutor} from '../../../src/lib/runtime-nodes';

const defaultTargets = {
    editingTargetId: 'stage-id',
    stage: {
        id: 'stage-id',
        isStage: true,
        name: 'Stage'
    },
    sprites: {
        player: {
            id: 'player',
            name: 'Player',
            order: 0
        },
        enemy: {
            id: 'enemy',
            name: 'Enemy',
            order: 1
        }
    }
};

const getRenderedText = node => node.children.map(child => {
    if (child === null || typeof child === 'undefined') return '';
    if (typeof child === 'string' || typeof child === 'number') return String(child);
    return getRenderedText(child);
}).join(' ');


const createSceneSnapshot = ({sceneId = 'scene-b'} = {}) => {
    const projectJSON = {
        targets: [
            {isStage: true, name: 'Stage B'},
            {isStage: false, name: 'Player B'}
        ],
        ngvge: {
            projectSections: {
                'ngvge-node-tree': {
                    nodes: [
                        {childIds: [], enabled: true, id: 'target-stage-b', name: 'Stage B', parentId: null, typeId: 'ngvge.stage-target'},
                        {childIds: ['health-b'], enabled: true, id: 'target-player-b', name: 'Player B', parentId: null, typeId: 'ngvge.sprite-target'},
                        {childIds: [], enabled: true, id: 'health-b', name: 'Health B', parentId: 'target-player-b', typeId: 'ngvge.node2d'},
                        {childIds: [], enabled: true, id: 'scene-service-b', name: 'Scene Service B', parentId: null, typeId: 'ngvge.service-node'}
                    ],
                    targetBindings: ['target-stage-b', 'target-player-b'],
                    version: 1
                }
            }
        }
    };
    const payload = createPortableProjectPayload([{
        data: encodeBase64Bytes(encodeUTF8(JSON.stringify(projectJSON))),
        name: 'project.json'
    }]);
    return {
        byteLength: payload.length,
        metadata: {capturedAt: 100, sceneId, spriteCount: 1},
        payload,
        schemaVersion: 2
    };
};


const createRuntimeModuleFixture = ({startEnabled = true} = {}) => {
    const globalRoot = {
        activeInHierarchy: true,
        childIds: [],
        enabledSelf: true,
        id: 'runtime-node:global-root',
        name: 'Global',
        parentId: null,
        protected: true,
        sceneId: null,
        scope: 'global',
        typeId: 'ngvge.global-root'
    };
    const sceneRoot = {
        activeInHierarchy: true,
        childIds: [],
        enabledSelf: true,
        id: 'runtime-node:scene-root:scene-a',
        name: 'Scene A',
        parentId: null,
        protected: true,
        sceneId: 'scene-a',
        scope: 'scene',
        typeId: 'ngvge.scene-root'
    };
    const nodeTypes = [{
        abstract: false,
        allowChildren: true,
        allowedScopes: ['global', 'scene'],
        category: 'Core',
        family: 'node',
        id: 'ngvge.node',
        label: 'Node'
    }, {
        abstract: false,
        allowChildren: true,
        allowedScopes: ['scene'],
        category: 'Core',
        family: '2d',
        id: 'ngvge.node2d',
        label: 'Node2D'
    }, {
        abstract: false,
        allowChildren: true,
        allowedScopes: ['global', 'scene'],
        category: 'Core',
        family: 'service',
        id: 'ngvge.service-node',
        label: 'ServiceNode'
    }];
    const typeById = new Map(nodeTypes.map(nodeType => [nodeType.id, nodeType]));
    const runtimeListeners = new Set();
    const createNode = jest.fn((typeId, options) => ({
        applied: true,
        error: null,
        persisted: true,
        snapshot: {
            activeInHierarchy: true,
            childIds: [],
            enabledSelf: true,
            id: 'runtime-node:new',
            name: options.name || typeById.get(typeId).label,
            parentId: options.parentId,
            protected: false,
            sceneId: options.sceneId || null,
            scope: options.scope,
            typeId
        }
    }));
    const runtimeNodeModel = {
        createNode,
        destroyNode: jest.fn(nodeId => ({
            applied: true,
            error: null,
            persisted: true,
            snapshot: {destroyed: true, nodeId}
        })),
        duplicateNode: jest.fn(nodeId => ({
            applied: true,
            error: null,
            persisted: true,
            snapshot: Object.assign({}, runtimeNodeModel.getNodeSnapshot(nodeId), {
                id: 'runtime-node:duplicate',
                name: 'Duplicate',
                protected: false
            })
        })),
        getChildren: () => [],
        getGlobalRoot: () => globalRoot,
        getNodeSnapshot: nodeId => {
            if (nodeId === globalRoot.id) return globalRoot;
            if (nodeId === sceneRoot.id) return sceneRoot;
            return null;
        },
        getParent: () => null,
        getSceneRoot: () => sceneRoot,
        getNodeType: typeId => typeById.get(typeId) || null,
        listNodes: () => [],
        getImportStatus: () => ({lastResult: null}),
        listNodeTypes: ({scope}) => nodeTypes.filter(nodeType => nodeType.allowedScopes.includes(scope)),
        patchNode: jest.fn((nodeId, patch) => ({
            applied: true,
            error: null,
            persisted: true,
            snapshot: Object.assign({}, runtimeNodeModel.getNodeSnapshot(nodeId), patch)
        })),
        setParent: jest.fn((nodeId, parentId) => ({
            applied: true,
            error: null,
            persisted: true,
            snapshot: Object.assign({}, runtimeNodeModel.getNodeSnapshot(nodeId), {parentId})
        })),
        subscribe: listener => {
            runtimeListeners.add(listener);
            return () => runtimeListeners.delete(listener);
        },
        traverse: (nodeId, visitor) => visitor(nodeId === globalRoot.id ? globalRoot : sceneRoot)
    };
    const runtimeNodeCommandExecutor = createRuntimeNodeCommandExecutor(runtimeNodeModel);
    const executeRuntimeNodeCommand = jest.fn(command => runtimeNodeCommandExecutor.executeCommand(command));
    const runtimeNodeCommandCapability = {
        capabilityId: 'ngvge.runtime-node-command',
        executeCommand: executeRuntimeNodeCommand,
        version: 1
    };
    const sceneDataModel = {
        readProject: () => ({
            activeSceneId: 'scene-a',
            scenes: [{id: 'scene-a', name: 'Scene A', snapshot: null}]
        })
    };
    const functionalNodeCreation = {
        createPlan: jest.fn((archetypeId, options) => ({
            archetypeId,
            options: Object.assign({
                components: [{
                    data: {position: [0, 0], rotation: 0, scale: [1, 1]},
                    enabled: true,
                    schemaVersion: 1,
                    typeId: 'ngvge.transform2d'
                }]
            }, options),
            runtimeTypeId: 'ngvge.node2d'
        })),
        isArchetype: archetypeId => archetypeId === 'ngvge.archetype.node2d',
        listArchetypes: ({scope}) => scope === 'scene' ? [{
            abstract: false,
            allowedScopes: ['scene'],
            baseRuntimeTypeId: 'ngvge.node2d',
            category: '2D',
            family: '2d',
            id: 'ngvge.archetype.node2d',
            label: 'Node2D'
        }] : []
    };
    let moduleEnabled = startEnabled;
    const moduleListeners = new Set();
    const enableModule = jest.fn(moduleId => {
        if (moduleId !== 'ngvge.scene-system') return false;
        moduleEnabled = true;
        moduleListeners.forEach(listener => listener({moduleId, type: 'module:enable'}));
        return true;
    });
    const moduleManager = {
        enableModule,
        getCapability: capabilityId => {
            if (!moduleEnabled) return null;
            if (capabilityId === 'ngvge.scene-controller') return {
                execute: jest.fn(() => Promise.resolve('{}'))
            };
            if (capabilityId === 'ngvge.runtime-node-model') return runtimeNodeModel;
            if (capabilityId === 'ngvge.runtime-node-command') return runtimeNodeCommandCapability;
            if (capabilityId === 'ngvge.functional-node-creation') return functionalNodeCreation;
            return null;
        },
        getModuleData: () => moduleEnabled ? sceneDataModel.readProject() : null,
        getModuleState: () => ({enabled: moduleEnabled, state: moduleEnabled ? 'enabled' : 'disabled'}),
        subscribe: listener => {
            moduleListeners.add(listener);
            return () => moduleListeners.delete(listener);
        }
    };
    const vm = {
        on: jest.fn(),
        runtime: {
            emitProjectChanged: jest.fn(),
            getTargetById: jest.fn(),
            ngvgeFirstPartyModules: moduleManager,
            targets: []
        },
        serializeAssets: jest.fn(() => [])
    };
    const registerRuntimeNodeType = nodeType => {
        nodeTypes.push(nodeType);
        typeById.set(nodeType.id, nodeType);
        runtimeListeners.forEach(listener => listener({type: 'registry:change', typeId: nodeType.id}));
    };
    return {
        createNode,
        enableModule,
        executeRuntimeNodeCommand,
        functionalNodeCreation,
        globalRoot,
        registerRuntimeNodeType,
        runtimeNodeModel,
        sceneRoot,
        vm
    };
};

const createBoundRuntimeSpriteFixture = () => {
    const sceneRoot = {
        activeInHierarchy: true,
        childIds: ['runtime-node:sprite:player'],
        enabledSelf: true,
        id: 'runtime-node:scene-root:scene-a',
        name: 'Scene A',
        parentId: null,
        protected: true,
        sceneId: 'scene-a',
        scope: 'scene',
        typeId: 'ngvge.scene-root'
    };
    const globalRoot = {
        activeInHierarchy: true,
        childIds: [],
        enabledSelf: true,
        id: 'runtime-node:global-root',
        name: 'Global',
        parentId: null,
        protected: true,
        sceneId: null,
        scope: 'global',
        typeId: 'ngvge.global-root'
    };
    const spriteNode = {
        activeInHierarchy: true,
        childIds: [],
        enabledSelf: true,
        id: 'runtime-node:sprite:player',
        name: 'Player',
        parentId: sceneRoot.id,
        protected: false,
        sceneId: 'scene-a',
        scope: 'scene',
        typeId: 'ngvge.sprite-node'
    };
    const runtimeNodeModel = {
        getChildren: nodeId => nodeId === sceneRoot.id ? [spriteNode] : [],
        getGlobalRoot: () => globalRoot,
        getImportStatus: () => ({lastResult: null}),
        getNodeSnapshot: nodeId => [globalRoot, sceneRoot, spriteNode].find(node => node.id === nodeId) || null,
        getNodeType: typeId => typeId === 'ngvge.sprite-node' ? {
            allowChildren: true,
            family: '2d',
            id: typeId,
            label: 'Sprite'
        } : null,
        getParent: nodeId => nodeId === spriteNode.id ? sceneRoot : null,
        getSceneRoot: () => sceneRoot,
        listNodes: () => [spriteNode],
        subscribe: () => () => {},
        traverse: (nodeId, visitor) => visitor(nodeId === spriteNode.id ? spriteNode : sceneRoot)
    };
    const scratchSpriteAdapter = {
        destroyBindingByNodeId: jest.fn(),
        listBindings: () => [{
            bindingId: 'binding-player',
            nodeId: spriteNode.id,
            sceneId: 'scene-a',
            status: 'bound',
            targetRuntimeId: 'player'
        }],
        subscribe: () => () => {}
    };
    const executeRuntimeNodeCommand = jest.fn(command => {
        if (command.type === 'DuplicateNode') {
            return Promise.resolve({
                kind: 'event',
                payload: {node: Object.assign({}, spriteNode, {id: 'runtime-node:sprite:copy', name: 'Player2'})},
                protocol: 'ngvge.engine-protocol',
                protocolVersion: 1,
                type: 'NodeDuplicated'
            });
        }
        if (command.type === 'DestroyNode') {
            return Promise.resolve({
                kind: 'event',
                payload: {destroyed: true, nodeId: spriteNode.id},
                protocol: 'ngvge.engine-protocol',
                protocolVersion: 1,
                type: 'NodeDestroyed'
            });
        }
        if (command.type === 'PatchNode') {
            if (command.payload && command.payload.patch && command.payload.patch.name) {
                spriteNode.name = command.payload.patch.name;
            }
            return {
                kind: 'event',
                payload: {node: spriteNode, nodeId: spriteNode.id},
                protocol: 'ngvge.engine-protocol',
                protocolVersion: 1,
                type: 'NodePatched'
            };
        }
        return {
            kind: 'error', code: 'TEST_UNSUPPORTED', message: command.type,
            protocol: 'ngvge.engine-protocol', protocolVersion: 1, type: 'Error'
        };
    });
    const runtimeNodeCommandCapability = {
        capabilityId: 'ngvge.runtime-node-command',
        executeCommand: executeRuntimeNodeCommand,
        version: 1
    };
    const sceneDataModel = {
        readProject: () => ({
            activeSceneId: 'scene-a',
            scenes: [{id: 'scene-a', name: 'Scene A', snapshot: null}]
        })
    };
    const scratchRoleManagerParity = {
        resolveNodeIdForTarget: jest.fn(targetRuntimeId => targetRuntimeId === 'player' ? spriteNode.id : null),
        resolveTargetRuntimeIdForNode: jest.fn(nodeId => nodeId === spriteNode.id ? 'player' : null)
    };
    const moduleManager = {
        getCapability: capabilityId => {
            if (capabilityId === 'ngvge.scene-controller') return {
                execute: jest.fn(() => Promise.resolve('{}'))
            };
            if (capabilityId === 'ngvge.runtime-node-model') return runtimeNodeModel;
            if (capabilityId === 'ngvge.runtime-node-command') return runtimeNodeCommandCapability;
            if (capabilityId === 'ngvge.scratch-sprite-node-adapter') return scratchSpriteAdapter;
            if (capabilityId === 'ngvge.scratch-role-manager-parity') return scratchRoleManagerParity;
            return null;
        },
        getModuleData: () => sceneDataModel.readProject(),
        getModuleState: () => ({enabled: true, state: 'enabled'}),
        subscribe: () => () => {}
    };
    const targets = [{
        getName: () => 'Stage',
        id: 'stage-id',
        isOriginal: true,
        isStage: true
    }, {
        getName: () => 'Player',
        id: 'player',
        isOriginal: true,
        isStage: false
    }];
    const vm = {
        on: jest.fn(),
        runtime: {
            emitProjectChanged: jest.fn(),
            getTargetById: id => targets.find(target => target.id === id) || null,
            ngvgeFirstPartyModules: moduleManager,
            targets
        },
        serializeAssets: jest.fn(() => [])
    };
    return {
        executeRuntimeNodeCommand,
        globalRoot,
        runtimeNodeModel,
        sceneRoot,
        scratchRoleManagerParity,
        scratchSpriteAdapter,
        spriteNode,
        targets,
        vm
    };
};

const createBoundRuntimeSpritePairFixture = () => {
    const fixture = createBoundRuntimeSpriteFixture();
    const spriteNode2 = {
        activeInHierarchy: true,
        childIds: [],
        enabledSelf: true,
        id: 'runtime-node:sprite:enemy',
        name: 'Enemy',
        parentId: fixture.sceneRoot.id,
        protected: false,
        sceneId: 'scene-a',
        scope: 'scene',
        typeId: 'ngvge.sprite-node'
    };
    const spriteNodes = [fixture.spriteNode, spriteNode2];
    fixture.sceneRoot.childIds = spriteNodes.map(node => node.id);
    fixture.runtimeNodeModel.getChildren = nodeId => nodeId === fixture.sceneRoot.id ? spriteNodes.slice() : [];
    fixture.runtimeNodeModel.getNodeSnapshot = nodeId => [
        fixture.globalRoot,
        fixture.sceneRoot,
        fixture.spriteNode,
        spriteNode2
    ].find(node => node.id === nodeId) || null;
    fixture.runtimeNodeModel.getParent = nodeId => spriteNodes.some(node => node.id === nodeId) ? fixture.sceneRoot : null;
    fixture.runtimeNodeModel.listNodes = () => spriteNodes.slice();
    fixture.runtimeNodeModel.traverse = (nodeId, visitor) => {
        const node = fixture.runtimeNodeModel.getNodeSnapshot(nodeId);
        if (node) visitor(node);
    };
    fixture.scratchSpriteAdapter.listBindings = () => [{
        bindingId: 'binding-player',
        nodeId: fixture.spriteNode.id,
        sceneId: 'scene-a',
        status: 'bound',
        targetRuntimeId: 'player'
    }, {
        bindingId: 'binding-enemy',
        nodeId: spriteNode2.id,
        sceneId: 'scene-a',
        status: 'bound',
        targetRuntimeId: 'enemy'
    }];
    fixture.scratchRoleManagerParity.resolveNodeIdForTarget.mockImplementation(targetRuntimeId => {
        if (targetRuntimeId === 'player') return fixture.spriteNode.id;
        if (targetRuntimeId === 'enemy') return spriteNode2.id;
        return null;
    });
    fixture.scratchRoleManagerParity.resolveTargetRuntimeIdForNode.mockImplementation(nodeId => {
        if (nodeId === fixture.spriteNode.id) return 'player';
        if (nodeId === spriteNode2.id) return 'enemy';
        return null;
    });
    fixture.targets.push({
        getName: () => 'Enemy',
        id: 'enemy',
        isOriginal: true,
        isStage: false
    });
    fixture.executeRuntimeNodeCommand.mockImplementation(command => {
        if (command.type === 'ReparentNode') {
            return Promise.resolve({
                kind: 'event',
                payload: {
                    node: Object.assign({}, fixture.spriteNode, {
                        parentId: command.payload.parentId
                    }),
                    nodeId: fixture.spriteNode.id,
                    parentId: command.payload.parentId
                },
                protocol: 'ngvge.engine-protocol',
                protocolVersion: 1,
                type: 'NodeReparented'
            });
        }
        return {
            kind: 'error', code: 'TEST_UNSUPPORTED', message: command.type,
            protocol: 'ngvge.engine-protocol', protocolVersion: 1, type: 'Error'
        };
    });
    return Object.assign(fixture, {spriteNode2});
};

const mountedExplorers = [];
const renderExplorer = props => {
    const component = renderer.create(
        <IntlProvider locale="en">
            <ProjectExplorer
                expandedNodeIds={[PROJECT_ROOT_NODE_ID, ENTITIES_ROOT_NODE_ID, ASSETS_ROOT_NODE_ID]}
                onToggleNode={() => {}}
                {...defaultTargets}
                {...props}
            />
        </IntlProvider>
    );
    mountedExplorers.push(component);
    return component;
};

describe('ProjectExplorer', () => {
    afterEach(() => {
        while (mountedExplorers.length) {
            const component = mountedExplorers.pop();
            act(() => component.unmount());
        }
        jest.restoreAllMocks();
    });
    test('renders real Stage and Sprite entity nodes', () => {
        const component = renderExplorer();
        const text = JSON.stringify(component.toJSON());

        expect(text).toContain('Node Explorer');
        expect(text).toContain('Project');
        expect(text).toContain('Entities');
        expect(text).toContain('Assets');
        expect(text).toContain('Global asset services are not available.');
        expect(text).toContain('Stage');
        expect(text).toContain('Player');
        expect(text).toContain('Enemy');
        const renderedText = getRenderedText(component.root).replace(/\s+/g, ' ').trim();
        expect(renderedText).toContain('3 targets');
        expect(renderedText).toContain('0 compatibility nodes');
        expect(renderedText).toContain('0 native nodes');
    });

    test('groups the active Scratch nodes under Scene roots when Scene System is enabled', () => {
        const loadScene = jest.fn(() => Promise.resolve());
        const sceneDataModel = {
            readProject: () => ({
                activeSceneId: 'scene-a',
                scenes: [
                    {id: 'scene-a', name: 'Scene A', snapshot: null},
                    {
                        id: 'scene-b',
                        name: 'Scene B',
                        snapshot: {metadata: {spriteCount: 2}}
                    }
                ]
            })
        };
        const moduleManager = {
            getCapability: capabilityId => {
                if (capabilityId === 'ngvge.scene-controller') return {
                    execute: jest.fn((command, optionsJSON) => {
                        const options = JSON.parse(optionsJSON);
                        if (command === 'enter') return loadScene(options.sceneId).then(() => '{}');
                        return Promise.resolve('{}');
                    })
                };
                return null;
            },
            getModuleData: () => sceneDataModel.readProject(),
            getModuleState: () => ({enabled: true, state: 'enabled'}),
            subscribe: () => () => {}
        };
        const vm = {
            on: jest.fn(),
            runtime: {
                emitProjectChanged: jest.fn(),
                getTargetById: jest.fn(),
                ngvgeFirstPartyModules: moduleManager,
                targets: []
            },
            serializeAssets: jest.fn(() => [])
        };
        const component = renderExplorer({
            expandedNodeIds: [PROJECT_ROOT_NODE_ID, 'scene:scene-a', ASSETS_ROOT_NODE_ID],
            vm
        });
        const text = JSON.stringify(component.toJSON());

        expect(text).toContain('Global');
        expect(text).toContain('Scene A');
        expect(text).toContain('Scene B');
        expect(text).toContain('Player');
        expect(text).not.toContain('Entities');

        component.root.findByProps({'data-node-id': 'scene:scene-b'}).props.onClick();
        expect(loadScene).not.toHaveBeenCalled();
    });


    test('projects inactive scene nodes and enters a scene only from its context-menu command', async () => {
        const portalSpy = jest.spyOn(ReactDOM, 'createPortal').mockImplementation(children => children);
        const sceneRootA = {
            activeInHierarchy: true, childIds: [], enabledSelf: true, id: 'runtime-node:scene-root:scene-a',
            name: 'Scene A', parentId: null, protected: true, sceneId: 'scene-a', scope: 'scene', typeId: 'ngvge.scene-root'
        };
        const sceneRootB = {
            activeInHierarchy: false, childIds: ['runtime-node:sprite-b'], enabledSelf: true, id: 'runtime-node:scene-root:scene-b',
            name: 'Scene B', parentId: null, protected: true, sceneId: 'scene-b', scope: 'scene', typeId: 'ngvge.scene-root'
        };
        const spriteB = {
            activeInHierarchy: false, childIds: [], enabledSelf: true, id: 'runtime-node:sprite-b',
            name: 'Player B', parentId: sceneRootB.id, protected: false, sceneId: 'scene-b', scope: 'scene',
            typeId: 'ngvge.scratch-sprite'
        };
        const getChildren = jest.fn(() => []);
        const runtimeNodeModel = {
            getChildren,
            getGlobalRoot: () => null,
            getImportStatus: () => ({lastResult: null}),
            getNodeType: typeId => ({
                allowChildren: true, category: 'Scene', family: typeId === 'ngvge.scratch-sprite' ? '2d' : 'node',
                label: typeId === 'ngvge.scratch-sprite' ? 'Scratch Sprite' : 'Node', typeId
            }),
            getSceneRoot: sceneId => sceneId === 'scene-b' ? sceneRootB : sceneRootA,
            listNodes: () => [spriteB],
            subscribe: () => () => {}
        };
        const scratchSpriteAdapter = {
            listBindings: () => [{
                bindingId: 'binding-b',
                nodeId: spriteB.id,
                sceneId: 'scene-b',
                serializedTargetIndex: 1,
                status: 'offline',
                targetRuntimeId: null
            }],
            subscribe: () => () => {}
        };
        const execute = jest.fn(() => Promise.resolve(JSON.stringify({loadedSceneId: 'scene-b'})));
        const project = {
            activeSceneId: 'scene-a',
            scenes: [
                {id: 'scene-a', name: 'Scene A', snapshot: null},
                {id: 'scene-b', name: 'Scene B', snapshot: createSceneSnapshot()}
            ]
        };
        const moduleManager = {
            getCapability: capabilityId => {
                if (capabilityId === 'ngvge.scene-controller') return {execute};
                if (capabilityId === 'ngvge.runtime-node-model') return runtimeNodeModel;
                if (capabilityId === 'ngvge.scratch-sprite-node-adapter') return scratchSpriteAdapter;
                return null;
            },
            getModuleData: () => project,
            getModuleState: () => ({enabled: true, state: 'enabled'}),
            subscribe: () => () => {}
        };
        const vm = {
            on: jest.fn(),
            runtime: {emitProjectChanged: jest.fn(), getTargetById: jest.fn(), ngvgeFirstPartyModules: moduleManager, targets: []},
            serializeAssets: jest.fn(() => [])
        };
        const component = renderExplorer({
            expandedNodeIds: [
                PROJECT_ROOT_NODE_ID, 'scene:scene-a', 'scene:scene-b', spriteB.id, ASSETS_ROOT_NODE_ID
            ],
            vm
        });
        const rendered = JSON.stringify(component.toJSON());

        expect(rendered).toContain('Player B');
        expect(rendered).toContain('Health B');
        expect(rendered).toContain('Stage B');
        expect(rendered).toContain('Scene Service B');
        expect(getChildren).not.toHaveBeenCalled();

        act(() => component.root.findByProps({'data-node-id': 'scene:scene-b'}).props.onClick({
            currentTarget: {focus: jest.fn()}
        }));
        expect(execute).not.toHaveBeenCalled();

        const contextEvent = {
            clientX: 20, clientY: 30, preventDefault: jest.fn(), stopPropagation: jest.fn()
        };
        act(() => component.root.findByProps({'data-node-id': 'scene:scene-b'}).props.onContextMenu(contextEvent));
        const enterButton = component.root.findAll(node => (
            node.type === 'button' && getRenderedText(node) === 'Enter Scene'
        ))[0];
        expect(enterButton).toBeTruthy();
        await act(async () => {
            enterButton.props.onClick({preventDefault: jest.fn(), stopPropagation: jest.fn()});
            await Promise.resolve();
        });
        expect(execute).toHaveBeenCalledWith('enter', JSON.stringify({sceneId: 'scene-b'}));
        portalSpy.mockRestore();
    });


    test('renders an adapter-bound Scratch sprite as one unified tree row', () => {
        const {spriteNode, vm} = createBoundRuntimeSpriteFixture();
        const component = renderExplorer({
            expandedNodeIds: [PROJECT_ROOT_NODE_ID, 'scene:scene-a', spriteNode.id, ASSETS_ROOT_NODE_ID],
            vm
        });
        const playerRows = component.root.findAll(node => node.props['data-target-id'] === 'player');

        expect(playerRows).toHaveLength(1);
        expect(playerRows[0].props['data-node-id']).toBe(spriteNode.id);
        expect(playerRows[0].props['aria-expanded']).toBeUndefined();
        expect(playerRows[0].findAllByType('button')).toHaveLength(0);
        expect(() => act(() => playerRows[0].props.onClick({
            currentTarget: {focus: jest.fn()}
        }))).not.toThrow();
    });

    test('routes bound Sprite duplicate and delete actions through Runtime Node commands, not the Scratch adapter', async () => {
        const portalSpy = jest.spyOn(ReactDOM, 'createPortal').mockImplementation(children => children);
        const fixture = createBoundRuntimeSpriteFixture();
        const previousConfirm = window.confirm;
        window.confirm = jest.fn(() => true);
        const component = renderExplorer({
            editingTargetId: 'player',
            expandedNodeIds: [PROJECT_ROOT_NODE_ID, 'scene:scene-a', fixture.spriteNode.id, ASSETS_ROOT_NODE_ID],
            vm: fixture.vm
        });
        const contextEvent = {clientX: 20, clientY: 20, preventDefault: jest.fn(), stopPropagation: jest.fn()};

        act(() => component.root.findByProps({'data-node-id': fixture.spriteNode.id}).props.onContextMenu(contextEvent));
        const duplicate = component.root.findAll(node => (
            node.type === 'button' && getRenderedText(node).trim() === 'Duplicate'
        ))[0];
        expect(duplicate.props.disabled).toBe(false);
        await act(async () => duplicate.props.onClick({preventDefault: jest.fn(), stopPropagation: jest.fn()}));
        expect(fixture.executeRuntimeNodeCommand).toHaveBeenCalledWith(expect.objectContaining({
            type: 'DuplicateNode',
            payload: expect.objectContaining({nodeId: fixture.spriteNode.id})
        }));

        act(() => component.root.findByProps({'data-node-id': fixture.spriteNode.id}).props.onContextMenu(contextEvent));
        const deleteButton = component.root.findAll(node => (
            node.type === 'button' && getRenderedText(node).trim() === 'Delete Node'
        ))[0];
        await act(async () => deleteButton.props.onClick({preventDefault: jest.fn(), stopPropagation: jest.fn()}));
        expect(fixture.executeRuntimeNodeCommand).toHaveBeenCalledWith(expect.objectContaining({
            type: 'DestroyNode',
            payload: expect.objectContaining({nodeId: fixture.spriteNode.id})
        }));
        expect(fixture.scratchSpriteAdapter.destroyBindingByNodeId).not.toHaveBeenCalled();
        window.confirm = previousConfirm;
        portalSpy.mockRestore();
    });

    test('moves a bound Sprite sibling through Runtime Node reparent order instead of mutating Scratch directly', async () => {
        const portalSpy = jest.spyOn(ReactDOM, 'createPortal').mockImplementation(children => children);
        const fixture = createBoundRuntimeSpritePairFixture();
        const component = renderExplorer({
            editingTargetId: 'player',
            expandedNodeIds: [PROJECT_ROOT_NODE_ID, 'scene:scene-a', ASSETS_ROOT_NODE_ID],
            vm: fixture.vm
        });
        const contextEvent = {clientX: 20, clientY: 20, preventDefault: jest.fn(), stopPropagation: jest.fn()};

        act(() => component.root.findByProps({'data-node-id': fixture.spriteNode.id}).props.onContextMenu(contextEvent));
        const moveDown = component.root.findAll(node => (
            node.type === 'button' && getRenderedText(node).trim() === 'Move Down'
        ))[0];
        expect(moveDown.props.disabled).toBe(false);
        await act(async () => moveDown.props.onClick({preventDefault: jest.fn(), stopPropagation: jest.fn()}));

        expect(fixture.executeRuntimeNodeCommand).toHaveBeenCalledWith(expect.objectContaining({
            type: 'ReparentNode',
            payload: expect.objectContaining({
                nodeId: fixture.spriteNode.id,
                options: {index: 1},
                parentId: fixture.sceneRoot.id
            })
        }));
        portalSpy.mockRestore();
    });

    test('reorders the selected Runtime Sprite with Explorer-local Alt+Arrow keyboard capture', async () => {
        const fixture = createBoundRuntimeSpritePairFixture();
        const component = renderExplorer({
            editingTargetId: 'player',
            expandedNodeIds: [PROJECT_ROOT_NODE_ID, 'scene:scene-a', ASSETS_ROOT_NODE_ID],
            vm: fixture.vm
        });
        const playerRow = component.root.findByProps({'data-node-id': fixture.spriteNode.id});
        const explorer = component.root.findByProps({'aria-label': 'Node Explorer'});
        const focus = jest.fn();

        act(() => playerRow.props.onClick({currentTarget: {focus}}));
        expect(focus).toHaveBeenCalled();

        const keyboardEvent = {
            altKey: true,
            key: 'ArrowDown',
            preventDefault: jest.fn(),
            stopPropagation: jest.fn(),
            target: {isContentEditable: false, tagName: 'DIV'}
        };
        await act(async () => {
            explorer.props.onKeyDownCapture(keyboardEvent);
            await Promise.resolve();
        });

        expect(keyboardEvent.preventDefault).toHaveBeenCalled();
        expect(keyboardEvent.stopPropagation).toHaveBeenCalled();
        expect(fixture.executeRuntimeNodeCommand).toHaveBeenCalledWith(expect.objectContaining({
            type: 'ReparentNode',
            payload: expect.objectContaining({
                nodeId: fixture.spriteNode.id,
                options: {index: 1},
                parentId: fixture.sceneRoot.id
            })
        }));
    });

    test('does not reorder Runtime Nodes while Alt+Arrow originates from an Explorer text field', () => {
        const fixture = createBoundRuntimeSpritePairFixture();
        const component = renderExplorer({
            editingTargetId: 'player',
            expandedNodeIds: [PROJECT_ROOT_NODE_ID, 'scene:scene-a', ASSETS_ROOT_NODE_ID],
            vm: fixture.vm
        });
        const playerRow = component.root.findByProps({'data-node-id': fixture.spriteNode.id});
        const explorer = component.root.findByProps({'aria-label': 'Node Explorer'});

        act(() => playerRow.props.onClick({currentTarget: {focus: jest.fn()}}));
        act(() => explorer.props.onKeyDownCapture({
            altKey: true,
            key: 'ArrowDown',
            preventDefault: jest.fn(),
            stopPropagation: jest.fn(),
            target: {isContentEditable: false, tagName: 'INPUT'}
        }));

        expect(fixture.executeRuntimeNodeCommand).not.toHaveBeenCalledWith(expect.objectContaining({
            type: 'ReparentNode'
        }));
    });

    test('treats Runtime NodeId as the primary selection and projects a bound target exactly once', () => {
        const {spriteNode, vm} = createBoundRuntimeSpriteFixture();
        const onSelectNode = jest.fn();
        const onSelectTarget = jest.fn();
        const onSelectionContextChange = jest.fn();
        const component = renderExplorer({
            editingTargetId: 'stage-id',
            expandedNodeIds: [PROJECT_ROOT_NODE_ID, 'scene:scene-a', spriteNode.id, ASSETS_ROOT_NODE_ID],
            onSelectNode,
            onSelectTarget,
            onSelectionContextChange,
            vm
        });
        const playerRow = component.root.findByProps({'data-node-id': spriteNode.id});

        act(() => playerRow.props.onClick({currentTarget: {focus: jest.fn()}}));

        expect(onSelectNode).toHaveBeenCalledWith(spriteNode.id);
        expect(vm.runtime.ngvgeFirstPartyModules.getCapability('ngvge.scratch-role-manager-parity'))
            .not.toBeNull();
        expect(component.root.findByProps({'aria-label': 'Node Explorer'}).props['data-ngvge-role-manager-parity'])
            .toBe('active');
        expect(onSelectTarget).toHaveBeenCalledTimes(1);
        expect(onSelectTarget).toHaveBeenCalledWith('player');
        expect(onSelectionContextChange).toHaveBeenLastCalledWith([spriteNode.id], spriteNode.id);
    });

    test('normalizes an external bound Scratch target selection to its stable Runtime NodeId', () => {
        const {spriteNode, vm} = createBoundRuntimeSpriteFixture();
        const onSelectNode = jest.fn();

        act(() => {
            renderExplorer({
                editingTargetId: 'player',
                expandedNodeIds: [PROJECT_ROOT_NODE_ID, 'scene:scene-a', spriteNode.id, ASSETS_ROOT_NODE_ID],
                onSelectNode,
                selectedNodeId: null,
                vm
            });
        });

        expect(onSelectNode).toHaveBeenCalledWith(spriteNode.id);
    });

    test('does not let a compatibility target echo replace the NodeId selected by the Explorer', () => {
        const {spriteNode, vm} = createBoundRuntimeSpriteFixture();
        const nodeDatabase = installNodeDatabase(vm);
        const targetNode = nodeDatabase.getNodeForTarget('player');
        const compatibilityChild = nodeDatabase.createNode('ngvge.node2d', targetNode.id, {name: 'Compatibility Child'});
        const onSelectNode = jest.fn();
        const onSelectTarget = jest.fn();
        const baseProps = {
            editingTargetId: 'stage-id',
            expandedNodeIds: [PROJECT_ROOT_NODE_ID, 'scene:scene-a', spriteNode.id, ASSETS_ROOT_NODE_ID],
            onSelectNode,
            onSelectTarget,
            selectedNodeId: null,
            vm
        };
        const component = renderExplorer(baseProps);
        const childRow = component.root.findByProps({'data-node-id': compatibilityChild.id});
        act(() => {});
        onSelectNode.mockClear();
        onSelectTarget.mockClear();

        act(() => childRow.props.onClick({currentTarget: {focus: jest.fn()}}));
        expect(onSelectNode).toHaveBeenLastCalledWith(compatibilityChild.id);
        expect(onSelectTarget).toHaveBeenCalledWith('player');

        onSelectNode.mockClear();
        act(() => component.update(
            <IntlProvider locale="en">
                <ProjectExplorer
                    {...defaultTargets}
                    {...baseProps}
                    editingTargetId="player"
                    selectedNodeId={compatibilityChild.id}
                    onToggleNode={() => {}}
                />
            </IntlProvider>
        ));

        expect(onSelectNode).not.toHaveBeenCalledWith(spriteNode.id);
    });

    test('renders scene tree search and multi-select semantics', () => {
        const component = renderExplorer();
        const searchInput = component.root.findByProps({'aria-label': 'Search scene nodes'});
        const tree = component.root.findByProps({role: 'tree'});

        expect(searchInput.props.placeholder).toBe('Search nodes...');
        expect(tree.props['aria-multiselectable']).toBe('true');
    });

    test('marks the current editing target as selected', () => {
        const component = renderExplorer();
        const selectedNodes = component.root.findAll(node => node.props['aria-selected'] === true);

        expect(selectedNodes).toHaveLength(1);
        expect(getRenderedText(selectedNodes[0])).toContain('Stage');
    });

    test('requests target selection when an entity node is activated', () => {
        const onSelectTarget = jest.fn();
        const component = renderExplorer({onSelectTarget});
        const playerNode = component.root.findByProps({'data-target-id': 'player'});

        playerNode.props.onClick();

        expect(onSelectTarget).toHaveBeenCalledWith('player');
    });

    test('supports keyboard activation for entity nodes', () => {
        const onSelectTarget = jest.fn();
        const component = renderExplorer({onSelectTarget});
        const enemyNode = component.root.findByProps({'data-target-id': 'enemy'});
        const preventDefault = jest.fn();

        enemyNode.props.onKeyDown({
            key: 'Enter',
            preventDefault
        });

        expect(preventDefault).toHaveBeenCalledTimes(1);
        expect(onSelectTarget).toHaveBeenCalledWith('enemy');
    });

    test('notifies when a node is toggled', () => {
        const onToggleNode = jest.fn();
        const component = renderExplorer({onToggleNode});
        const toggleButtons = component.root.findAllByProps({'aria-label': 'Collapse'});

        toggleButtons[0].props.onClick({stopPropagation: () => {}});

        expect(onToggleNode).toHaveBeenCalledWith(PROJECT_ROOT_NODE_ID, false);
    });

    test('notifies when the embedded panel is closed', () => {
        const onClose = jest.fn();
        const component = renderExplorer({onClose});
        const closeButton = component.root.findByProps({
            'aria-label': 'Close Node Explorer'
        });

        closeButton.props.onClick();

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('omits the internal header when hosted in a draggable window', () => {
        const component = renderExplorer({showHeader: false});

        expect(component.root.findAllByProps({
            'aria-label': 'Close Node Explorer'
        })).toHaveLength(0);
    });

    test('exposes Legacy Sprites only as an explicit compatibility launcher', () => {
        const onOpenLegacySprites = jest.fn();
        const component = renderExplorer({onOpenLegacySprites});
        const launcher = component.root.findByProps({
            'data-ngvge-compatibility-launcher': 'scratch-target-pane'
        });

        launcher.props.onClick();

        expect(launcher.props['aria-label']).toBe('Open Legacy Sprites compatibility view');
        expect(onOpenLegacySprites).toHaveBeenCalledTimes(1);
        expect(component.root.findByProps({
            'aria-label': 'Node Explorer'
        }).props['data-ngvge-selection-authority']).toBe('node-id');
    });

    test('opens the independent Asset Workspace from the Assets node', () => {
        const onOpenAssetManager = jest.fn();
        const component = renderExplorer({onOpenAssetManager});
        const assetsNode = component.root.findByProps({'data-node-id': ASSETS_ROOT_NODE_ID});

        assetsNode.props.onClick();

        expect(onOpenAssetManager).toHaveBeenCalledTimes(1);
    });

    test('shows root node presets only for a blank stage-only project', () => {
        const blankComponent = renderExplorer({
            editingTargetId: 'stage-id',
            sprites: {}
        });
        const blankText = JSON.stringify(blankComponent.toJSON());

        expect(blankText).toContain('Create the first scene root.');
        expect(blankText).toContain('2D Node');
        expect(blankText).toContain('User Interface Node');
        expect(blankText).toContain('3D Node');

        const populatedComponent = renderExplorer();
        const populatedText = JSON.stringify(populatedComponent.toJSON());
        expect(populatedText).not.toContain('Create the first scene root.');
    });

    test('shows root node presets before targets are available', () => {
        const component = renderExplorer({
            editingTargetId: null,
            sprites: {},
            stage: {}
        });
        const text = JSON.stringify(component.toJSON());

        expect(text).toContain('Create the first scene root.');
    });
    test('creates native child nodes from Global and Scene root context menus', () => {
        const portalSpy = jest.spyOn(ReactDOM, 'createPortal').mockImplementation(children => children);
        const {createNode, executeRuntimeNodeCommand, globalRoot, vm} = createRuntimeModuleFixture();
        const onToggleNode = jest.fn();
        const component = renderExplorer({
            expandedNodeIds: [PROJECT_ROOT_NODE_ID, 'scope:global', 'scene:scene-a', ASSETS_ROOT_NODE_ID],
            onToggleNode,
            vm
        });
        const contextEvent = {
            clientX: 20,
            clientY: 30,
            preventDefault: jest.fn(),
            stopPropagation: jest.fn()
        };

        act(() => component.root.findByProps({'data-node-id': 'scope:global'}).props.onContextMenu(contextEvent));
        const addGlobalButton = component.root.findAll(node => (
            node.type === 'button' && getRenderedText(node) === '+ Add Global Node'
        ))[0];
        act(() => addGlobalButton.props.onClick({preventDefault: jest.fn(), stopPropagation: jest.fn()}));

        const serviceTypeButton = component.root.findAll(node => (
            node.type === 'button' && getRenderedText(node).includes('ServiceNode')
        ))[0];
        act(() => serviceTypeButton.props.onClick());
        const nameInput = component.root.findByProps({placeholder: 'ServiceNode'});
        act(() => nameInput.props.onChange({target: {value: 'GameManager'}}));
        const createButton = component.root.findAll(node => (
            node.type === 'button' && getRenderedText(node) === 'Create'
        ))[0];
        act(() => createButton.props.onClick());

        expect(executeRuntimeNodeCommand).toHaveBeenCalledWith(expect.objectContaining({
            kind: 'command',
            type: 'CreateNode'
        }));
        expect(createNode).toHaveBeenCalledWith('ngvge.service-node', expect.objectContaining({
            name: 'GameManager',
            parentId: globalRoot.id,
            scope: 'global'
        }));
        expect(onToggleNode).toHaveBeenCalledWith('scope:global', true);

        act(() => component.root.findByProps({'data-node-id': 'scene:scene-a'}).props.onContextMenu(contextEvent));
        expect(component.root.findAll(node => (
            node.type === 'button' && getRenderedText(node) === '+ Add Scene Node'
        ))).toHaveLength(1);
        portalSpy.mockRestore();
    });


    test('routes Add Child from a compatibility Stage target into the Functional Scene tree', () => {
        const portalSpy = jest.spyOn(ReactDOM, 'createPortal').mockImplementation(children => children);
        const fixture = createRuntimeModuleFixture();
        const stageTarget = {
            getName: () => 'Stage',
            id: 'stage-id',
            isOriginal: true,
            isStage: true
        };
        fixture.vm.runtime.targets = [stageTarget];
        fixture.vm.runtime.getTargetById = id => id === stageTarget.id ? stageTarget : null;
        const component = renderExplorer({
            expandedNodeIds: [PROJECT_ROOT_NODE_ID, 'scene:scene-a', ASSETS_ROOT_NODE_ID],
            vm: fixture.vm
        });
        const contextEvent = {clientX: 20, clientY: 30, preventDefault: jest.fn(), stopPropagation: jest.fn()};
        const stageRow = component.root.findByProps({'data-target-id': 'stage-id'});

        act(() => stageRow.props.onContextMenu(contextEvent));
        const addChildButton = component.root.findAll(node => (
            node.type === 'button' && getRenderedText(node) === '+ Add Child Node'
        ))[0];
        act(() => addChildButton.props.onClick({preventDefault: jest.fn(), stopPropagation: jest.fn()}));

        expect(component.root.findAll(node => (
            node.type === 'button' && getRenderedText(node).includes('Node2D')
        ))).toHaveLength(1);
        expect(component.root.findAll(node => (
            node.type === 'button' && getRenderedText(node).includes('Legacy Collider2D')
        ))).toHaveLength(0);
        portalSpy.mockRestore();
    });

    test('primary add-node launcher activates Scene System instead of creating legacy compatibility Node2D', () => {
        const portalSpy = jest.spyOn(ReactDOM, 'createPortal').mockImplementation(children => children);
        const {enableModule, vm} = createRuntimeModuleFixture({startEnabled: false});
        const component = renderExplorer({vm});

        expect(getRenderedText(component.root)).toContain('Entities');
        const launcher = component.root.findByProps({'data-ngvge-functional-node-launcher': 'scene'});
        act(() => {
            launcher.props.onClick();
        });

        expect(enableModule).toHaveBeenCalledWith('ngvge.scene-system');
        expect(getRenderedText(component.root)).toContain('Scene A');
        expect(component.root.findAll(node => (
            node.type === 'button' && getRenderedText(node).includes('Node2D')
        ))).toHaveLength(1);
        portalSpy.mockRestore();
    });

    test('creates Node2D from the functional archetype plan and provisions Transform2D', () => {
        const portalSpy = jest.spyOn(ReactDOM, 'createPortal').mockImplementation(children => children);
        const {createNode, functionalNodeCreation, vm} = createRuntimeModuleFixture();
        const component = renderExplorer({
            expandedNodeIds: [PROJECT_ROOT_NODE_ID, 'scene:scene-a', ASSETS_ROOT_NODE_ID],
            vm
        });
        const contextEvent = {
            clientX: 20,
            clientY: 30,
            preventDefault: jest.fn(),
            stopPropagation: jest.fn()
        };

        act(() => component.root.findByProps({'data-node-id': 'scene:scene-a'}).props.onContextMenu(contextEvent));
        const addSceneButton = component.root.findAll(node => (
            node.type === 'button' && getRenderedText(node) === '+ Add Scene Node'
        ))[0];
        act(() => addSceneButton.props.onClick({preventDefault: jest.fn(), stopPropagation: jest.fn()}));

        const node2dButtons = component.root.findAll(node => (
            node.type === 'button' && getRenderedText(node).includes('Node2D')
        ));
        expect(node2dButtons).toHaveLength(1);
        act(() => node2dButtons[0].props.onClick());
        const nameInput = component.root.findByProps({placeholder: 'Node2D'});
        act(() => nameInput.props.onChange({target: {value: 'World'}}));
        const createButton = component.root.findAll(node => (
            node.type === 'button' && getRenderedText(node) === 'Create'
        ))[0];
        act(() => createButton.props.onClick());

        expect(functionalNodeCreation.createPlan).toHaveBeenCalledWith(
            'ngvge.archetype.node2d',
            expect.objectContaining({name: 'World', sceneId: 'scene-a', scope: 'scene'})
        );
        expect(createNode).toHaveBeenCalledWith('ngvge.node2d', expect.objectContaining({
            components: [expect.objectContaining({typeId: 'ngvge.transform2d'})],
            name: 'World',
            parentId: 'runtime-node:scene-root:scene-a',
            sceneId: 'scene-a',
            scope: 'scene'
        }));
        const createdOptions = createNode.mock.calls[0][1];
        expect(createdOptions.archetypeId).toBeUndefined();
        expect(createdOptions.targetRuntimeId).toBeUndefined();
        portalSpy.mockRestore();
    });

    test('refreshes the runtime creation menu when a plugin registers a node type', () => {
        const portalSpy = jest.spyOn(ReactDOM, 'createPortal').mockImplementation(children => children);
        const {registerRuntimeNodeType, vm} = createRuntimeModuleFixture();
        const component = renderExplorer({
            expandedNodeIds: [PROJECT_ROOT_NODE_ID, 'scene:scene-a', ASSETS_ROOT_NODE_ID],
            vm
        });
        const contextEvent = {
            clientX: 20,
            clientY: 30,
            preventDefault: jest.fn(),
            stopPropagation: jest.fn()
        };

        act(() => component.root.findByProps({'data-node-id': 'scene:scene-a'}).props.onContextMenu(contextEvent));
        const addSceneButton = component.root.findAll(node => (
            node.type === 'button' && getRenderedText(node) === '+ Add Scene Node'
        ))[0];
        act(() => addSceneButton.props.onClick({preventDefault: jest.fn(), stopPropagation: jest.fn()}));
        expect(JSON.stringify(component.toJSON())).not.toContain('Dialogue NPC');

        act(() => registerRuntimeNodeType({
            abstract: false,
            allowChildren: true,
            allowedScopes: ['scene'],
            category: 'Gameplay',
            family: 'node',
            id: 'plugin.dialogue-node',
            label: 'Dialogue NPC'
        }));

        expect(JSON.stringify(component.toJSON())).toContain('Dialogue NPC');
        portalSpy.mockRestore();
    });

});
