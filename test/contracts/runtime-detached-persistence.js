'use strict';

const assert = require('assert');
const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    NODE_SCOPES,
    createRuntimeNodeModelHost
} = require('../../../src/lib/runtime-nodes');

const clone = value => JSON.parse(JSON.stringify(value));

const createSceneDataModel = () => {
    let project = {
        activeSceneId: 'scene-a',
        extensionData: {},
        scenes: [{id: 'scene-a', name: 'Scene A'}]
    };

    return {
        getProject: () => clone(project),
        service: {
            getStatus: () => ({}),
            readProject: () => clone(project),
            subscribe: () => () => {},
            writeProject: nextProject => {
                project = clone(nextProject);
            }
        }
    };
};

const getPersistedRuntimeState = data => {
    const project = data.getProject();
    return project.extensionData && project.extensionData.runtimeNodeModel || null;
};

const assertMutationCommitted = (result, label) => {
    assert(result, `${label} returned no mutation result.`);
    assert.strictEqual(result.applied, true, `${label} was not applied.`);
    assert.strictEqual(result.persisted, true, `${label} was not persisted.`);
    assert.strictEqual(result.error, null, `${label} returned an unexpected error.`);
};

const getDetachedIds = state => state.nodes
    .filter(node => node.parentId === null)
    .map(node => node.id);

const assertRestoresExactly = (data, expectedState, detachedIds, label) => {
    const host = createRuntimeNodeModelHost(data.service);
    try {
        const model = host.publicCapability;
        assert.deepStrictEqual(model.exportState(), expectedState,
            `${label}: serialize -> restore -> serialize was not stable.`);
        detachedIds.forEach(nodeId => {
            const snapshot = model.getNodeSnapshot(nodeId);
            assert(snapshot, `${label}: restored detached node ${nodeId} is missing.`);
            assert.strictEqual(snapshot.parentId, null,
                `${label}: restored detached node ${nodeId} regained a parent.`);
            assert.strictEqual(snapshot.activeInHierarchy, false,
                `${label}: restored detached node ${nodeId} became active in hierarchy.`);
        });
    } finally {
        host.dispose();
    }
};

const assertDetachedCardinality = ({detachOrder, expectedDetachedOrder, label}) => {
    const data = createSceneDataModel();
    let host = createRuntimeNodeModelHost(data.service);
    try {
        const model = host.publicCapability;
        assertMutationCommitted(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: `${label}-parent`,
            name: `${label}-parent`,
            sceneId: 'scene-a'
        }), `${label}: create parent`);

        expectedDetachedOrder.forEach(nodeId => {
            assertMutationCommitted(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
                id: nodeId,
                name: nodeId,
                parentId: `${label}-parent`,
                sceneId: 'scene-a'
            }), `${label}: create ${nodeId}`);
        });

        detachOrder.forEach(nodeId => {
            assertMutationCommitted(model.detachNode(nodeId), `${label}: detach ${nodeId}`);
        });

        const persisted = getPersistedRuntimeState(data);
        assert(persisted, `${label}: Runtime state was not persisted.`);
        assert.deepStrictEqual(getDetachedIds(persisted), expectedDetachedOrder,
            `${label}: detached roots are not in canonical id order.`);
        assert.deepStrictEqual(
            persisted.nodes.filter(node => node.parentId === `${label}-parent`).map(node => node.id),
            [],
            `${label}: detached nodes still appear as children of their previous parent.`
        );
        const exported = model.exportState();
        assert.deepStrictEqual(exported, persisted, `${label}: live export differs from Project Source.`);

        host.dispose();
        host = null;
        assertRestoresExactly(data, persisted, expectedDetachedOrder, label);
        return persisted;
    } finally {
        if (host) host.dispose();
    }
};

const runDetachedPermutation = ({createOrder, detachOrder}) => {
    const data = createSceneDataModel();
    const host = createRuntimeNodeModelHost(data.service);
    try {
        const model = host.publicCapability;
        assertMutationCommitted(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'permutation-parent',
            name: 'permutation-parent',
            sceneId: 'scene-a'
        }), 'permutation: create parent');
        createOrder.forEach(nodeId => {
            assertMutationCommitted(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
                id: nodeId,
                name: nodeId,
                parentId: 'permutation-parent',
                sceneId: 'scene-a'
            }), `permutation: create ${nodeId}`);
        });
        detachOrder.forEach(nodeId => {
            assertMutationCommitted(model.detachNode(nodeId), `permutation: detach ${nodeId}`);
        });
        const persisted = getPersistedRuntimeState(data);
        assert.deepStrictEqual(getDetachedIds(persisted), ['permutation-a', 'permutation-b', 'permutation-c']);
        return persisted;
    } finally {
        host.dispose();
    }
};

const assertPermutationIndependence = () => {
    const variants = [
        {
            createOrder: ['permutation-a', 'permutation-b', 'permutation-c'],
            detachOrder: ['permutation-a', 'permutation-b', 'permutation-c']
        },
        {
            createOrder: ['permutation-c', 'permutation-a', 'permutation-b'],
            detachOrder: ['permutation-b', 'permutation-c', 'permutation-a']
        },
        {
            createOrder: ['permutation-b', 'permutation-c', 'permutation-a'],
            detachOrder: ['permutation-c', 'permutation-a', 'permutation-b']
        }
    ];
    const states = variants.map(runDetachedPermutation);
    states.slice(1).forEach((state, index) => {
        assert.deepStrictEqual(state, states[0],
            `Detached persistence changed across creation/detach permutation ${index + 2}.`);
    });
};

const assertMixedScopeDetachedOrdering = () => {
    const data = createSceneDataModel();
    let host = createRuntimeNodeModelHost(data.service);
    try {
        const model = host.publicCapability;
        const nodes = [
            {id: 'mixed-d-scene', sceneId: 'scene-a'},
            {id: 'mixed-a-global', scope: NODE_SCOPES.GLOBAL},
            {id: 'mixed-c-global', scope: NODE_SCOPES.GLOBAL},
            {id: 'mixed-b-scene', sceneId: 'scene-a'}
        ];
        nodes.forEach(options => {
            assertMutationCommitted(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, Object.assign({
                name: options.id
            }, options)), `mixed-scope: create ${options.id}`);
        });
        ['mixed-c-global', 'mixed-d-scene', 'mixed-a-global', 'mixed-b-scene'].forEach(nodeId => {
            assertMutationCommitted(model.detachNode(nodeId), `mixed-scope: detach ${nodeId}`);
        });

        const persisted = getPersistedRuntimeState(data);
        const expectedOrder = ['mixed-a-global', 'mixed-b-scene', 'mixed-c-global', 'mixed-d-scene'];
        assert.deepStrictEqual(getDetachedIds(persisted), expectedOrder,
            'Detached roots from global and scene scopes are not canonically ordered together.');
        expectedOrder.forEach(nodeId => {
            const record = persisted.nodes.find(node => node.id === nodeId);
            assert(record, `mixed-scope: persisted record ${nodeId} is missing.`);
            assert.strictEqual(record.parentId, null);
        });

        host.dispose();
        host = null;
        assertRestoresExactly(data, persisted, expectedOrder, 'mixed-scope');
    } finally {
        if (host) host.dispose();
    }
};

const assertDetachedSubtreeDurability = () => {
    const data = createSceneDataModel();
    let host = createRuntimeNodeModelHost(data.service);
    try {
        const model = host.publicCapability;
        assertMutationCommitted(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'subtree-root',
            name: 'subtree-root',
            sceneId: 'scene-a'
        }), 'subtree: create root');
        assertMutationCommitted(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'subtree-child',
            name: 'subtree-child',
            parentId: 'subtree-root',
            sceneId: 'scene-a'
        }), 'subtree: create child');
        assertMutationCommitted(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'detached-peer',
            name: 'detached-peer',
            sceneId: 'scene-a'
        }), 'subtree: create peer');
        assertMutationCommitted(model.detachNode('subtree-root'), 'subtree: detach root');
        assertMutationCommitted(model.detachNode('detached-peer'), 'subtree: detach peer');

        const persisted = getPersistedRuntimeState(data);
        assert.deepStrictEqual(persisted.nodes.map(node => node.id), [
            'detached-peer',
            'subtree-root',
            'subtree-child'
        ], 'Detached subtree traversal did not preserve canonical root ordering plus child order.');
        assert.strictEqual(persisted.nodes.find(node => node.id === 'subtree-root').parentId, null);
        assert.strictEqual(persisted.nodes.find(node => node.id === 'subtree-child').parentId, 'subtree-root');

        host.dispose();
        host = null;
        assertRestoresExactly(data, persisted, ['detached-peer', 'subtree-root'], 'detached-subtree');
        const restoredHost = createRuntimeNodeModelHost(data.service);
        try {
            assert.strictEqual(restoredHost.publicCapability.getNodeSnapshot('subtree-child').parentId, 'subtree-root');
        } finally {
            restoredHost.dispose();
        }
    } finally {
        if (host) host.dispose();
    }
};

const assertRuntimeDetachedPersistenceContract = () => {
    const cases = [
        {detachOrder: [], expectedDetachedOrder: [], label: 'cardinality-0'},
        {detachOrder: ['cardinality-1-a'], expectedDetachedOrder: ['cardinality-1-a'], label: 'cardinality-1'},
        {
            detachOrder: ['cardinality-2-b', 'cardinality-2-a'],
            expectedDetachedOrder: ['cardinality-2-a', 'cardinality-2-b'],
            label: 'cardinality-2'
        },
        {
            detachOrder: ['cardinality-many-d', 'cardinality-many-b', 'cardinality-many-a', 'cardinality-many-c'],
            expectedDetachedOrder: [
                'cardinality-many-a',
                'cardinality-many-b',
                'cardinality-many-c',
                'cardinality-many-d'
            ],
            label: 'cardinality-many'
        }
    ];

    cases.forEach(assertDetachedCardinality);
    assertPermutationIndependence();
    assertMixedScopeDetachedOrdering();
    assertDetachedSubtreeDurability();

    return Object.freeze({
        cardinalities: ['0', '1', '2', 'many'],
        mixedScopes: true,
        permutationVariants: 3,
        restoreRoundTrip: true,
        subtreeDurability: true
    });
};

module.exports = {
    assertRuntimeDetachedPersistenceContract
};
