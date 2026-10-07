const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    createRuntimeNodeModelHost
} = require('../../src/lib/runtime-nodes');

const clone = value => JSON.parse(JSON.stringify(value));

const createProjectService = () => {
    let project = {
        activeSceneId: 'scene-r8',
        extensionData: {},
        scenes: [{id: 'scene-r8', name: 'R8 Scene'}]
    };
    return {
        read: () => clone(project),
        service: {
            getStatus: () => ({}),
            readProject: () => clone(project),
            subscribe: () => () => {},
            writeProject: next => {
                project = clone(next);
            }
        }
    };
};

describe('R8 integration: Runtime Node -> project persistence -> reload', () => {
    test('commits a hierarchy to Project Source and restores it in a new host', () => {
        const project = createProjectService();
        let host = createRuntimeNodeModelHost(project.service);
        const model = host.publicCapability;

        expect(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'r8-parent',
            name: 'Parent',
            sceneId: 'scene-r8'
        }).persisted).toBe(true);
        expect(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'r8-child',
            name: 'Child',
            parentId: 'r8-parent',
            sceneId: 'scene-r8'
        }).persisted).toBe(true);

        const persisted = project.read().extensionData.runtimeNodeModel;
        expect(persisted.nodes.map(node => node.id)).toEqual(['r8-parent', 'r8-child']);
        expect(persisted.nodes.find(node => node.id === 'r8-child').parentId).toBe('r8-parent');

        host.dispose();
        host = createRuntimeNodeModelHost(project.service);
        try {
            const restored = host.publicCapability.getNodeSnapshot('r8-child');
            expect(restored).toBeTruthy();
            expect(restored.parentId).toBe('r8-parent');
            expect(restored.activeInHierarchy).toBe(true);
            expect(host.publicCapability.exportState()).toEqual(persisted);
        } finally {
            host.dispose();
        }
    });
});
