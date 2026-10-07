import {
    NODE_SCOPES,
    RuntimeComponent,
    RuntimeNode,
    RuntimeNodeGraph,
    createRuntimeNodeModelHost,
    createRuntimeNodeTypeRegistry
} from '../../../../src/lib/runtime-nodes';

const {replaceRuntimeNodeGraphBinding} = require('../../../../src/lib/runtime-nodes/runtime-node');
const {
    replaceRuntimeComponentContainerGraphBinding,
    replaceRuntimeComponentGraphBinding
} = require('../../../../src/lib/runtime-nodes/component-container');

const clone = value => JSON.parse(JSON.stringify(value));
const createSceneDataModel = () => {
    let project = {
        activeSceneId: 'scene-a',
        extensionData: {},
        scenes: [{id: 'scene-a', name: 'Scene A'}]
    };
    let writeCount = 0;
    const listeners = new Set();
    return {
        getProject: () => clone(project),
        getStatus: () => ({readOnly: false}),
        getWriteCount: () => writeCount,
        readProject: () => clone(project),
        subscribe: listener => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        writeProject: next => {
            writeCount += 1;
            project = clone(next);
            listeners.forEach(listener => listener({type: 'data'}));
            return clone(project);
        }
    };
};

describe('Runtime internal dispatch integrity and Provider Graph isolation', () => {
    test('captures and freezes Node and Component base lifecycle operations', () => {
        let capturedGraph = null;
        ['_bindGraph', '_transition', '_invoke'].forEach(methodName => {
            expect(Object.getOwnPropertyDescriptor(RuntimeNode.prototype, methodName)).toMatchObject({
                configurable: false,
                writable: false
            });
            expect(() => Object.defineProperty(RuntimeNode.prototype, methodName, {
                value: graph => { capturedGraph = graph; }
            })).toThrow();
        });
        ['_create', '_attach', '_ready', '_setActive', '_detach', '_destroy'].forEach(methodName => {
            expect(Object.getOwnPropertyDescriptor(RuntimeComponent.prototype, methodName)).toMatchObject({
                configurable: false,
                writable: false
            });
        });

        class CaptureNode extends RuntimeNode {
            _bindGraph (graph) {
                capturedGraph = graph;
                return super._bindGraph(graph);
            }
            _transition () {
                throw new Error('override must not execute');
            }
        }
        let componentGraph = null;
        class CaptureComponent extends RuntimeComponent {
            _create (owner, graph) {
                componentGraph = graph;
                return super._create(owner, graph);
            }
            _attach (owner, graph) {
                componentGraph = graph;
                return super._attach(owner, graph);
            }
            _destroy (owner, graph, extra) {
                componentGraph = graph;
                return super._destroy(owner, graph, extra);
            }
        }
        const registry = createRuntimeNodeTypeRegistry();
        registry.register({
            allowedScopes: [NODE_SCOPES.SCENE],
            ctor: CaptureNode,
            defaultScope: NODE_SCOPES.SCENE,
            id: 'test.capture',
            label: 'Capture',
            owner: 'test.owner'
        });
        const graph = new RuntimeNodeGraph({
            activeSceneId: 'scene-a',
            scenes: [{id: 'scene-a', name: 'Scene A'}],
            typeRegistry: registry
        });
        const node = graph.createNode('test.capture', {id: 'capture', sceneId: 'scene-a'});
        node.addComponent(new CaptureComponent({id: 'capture-component', typeId: 'test.capture-component'}));
        node.removeComponent('capture-component');

        expect(capturedGraph).toBeNull();
        expect(componentGraph).toBeNull();
        graph.dispose();
    });

    test('makes Model-managed live objects read-only outside Graph mutation authority', () => {
        let retainedNode = null;
        class ManagedNode extends RuntimeNode {
            constructor (options) {
                super(options);
                retainedNode = this;
            }
        }
        const registry = createRuntimeNodeTypeRegistry();
        registry.register({
            allowedScopes: [NODE_SCOPES.SCENE],
            ctor: ManagedNode,
            defaultScope: NODE_SCOPES.SCENE,
            id: 'test.managed',
            label: 'Managed',
            owner: 'test.owner'
        });
        const dataModel = createSceneDataModel();
        const host = createRuntimeNodeModelHost(dataModel, {typeRegistry: registry});
        expect(host.publicCapability.createNode('test.managed', {
            id: 'managed',
            sceneId: 'scene-a'
        })).toMatchObject({applied: true, persisted: true});

        expect(() => replaceRuntimeNodeGraphBinding(retainedNode, null)).toThrow(
            expect.objectContaining({code: 'RUNTIME_NODE_INTERNAL_AUTHORITY_REQUIRED'})
        );
        expect(() => replaceRuntimeComponentContainerGraphBinding(retainedNode.components, null)).toThrow(
            expect.objectContaining({code: 'RUNTIME_COMPONENT_INTERNAL_AUTHORITY_REQUIRED'})
        );

        const beforeProject = dataModel.getProject();
        const beforeWrites = dataModel.getWriteCount();
        expect(() => { retainedNode.name = 'bypass'; }).toThrow(
            expect.objectContaining({code: 'RUNTIME_NODE_MODEL_AUTHORITY_REQUIRED'})
        );
        expect(() => retainedNode.addComponent({id: 'bypass', typeId: 'test.bypass'})).toThrow(
            expect.objectContaining({code: 'RUNTIME_NODE_MODEL_AUTHORITY_REQUIRED'})
        );
        expect(dataModel.getProject()).toEqual(beforeProject);
        expect(dataModel.getWriteCount()).toBe(beforeWrites);

        expect(host.publicCapability.addComponent('managed', {
            id: 'managed-component',
            typeId: 'test.component'
        })).toMatchObject({applied: true, persisted: true});
        const component = retainedNode.getComponentById('managed-component');
        expect(() => replaceRuntimeComponentGraphBinding(component, null)).toThrow(
            expect.objectContaining({code: 'RUNTIME_COMPONENT_INTERNAL_AUTHORITY_REQUIRED'})
        );
        const beforeComponentProject = dataModel.getProject();
        const beforeComponentWrites = dataModel.getWriteCount();
        expect(() => component.patchData({value: 1})).toThrow(
            expect.objectContaining({code: 'RUNTIME_COMPONENT_MODEL_AUTHORITY_REQUIRED'})
        );
        expect(() => { component.data.value = 2; }).toThrow(
            expect.objectContaining({code: 'RUNTIME_COMPONENT_MODEL_AUTHORITY_REQUIRED'})
        );
        expect(dataModel.getProject()).toEqual(beforeComponentProject);
        expect(dataModel.getWriteCount()).toBe(beforeComponentWrites);

        expect(host.publicCapability.patchComponentData('managed', 'managed-component', {value: 3}))
            .toMatchObject({applied: true, persisted: true});
        expect(component.data.value).toBe(3);
        host.dispose();
    });
});
