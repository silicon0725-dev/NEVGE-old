'use strict';

const {
    projectPointThroughHierarchy,
    projectPointsThroughHierarchy,
    unprojectPointThroughHierarchy,
    worldDeltaToNodeLocalDelta
} = require('../../../../src/lib/transform-system');

const transformComponent = (id, position, rotation = 0, scale = [1, 1]) => ({
    data: {position, rotation, scale},
    id: `transform:${id}`,
    typeId: 'ngvge.transform2d'
});

const makeHarness = () => {
    const nodes = new Map([
        ['parent', {components: [transformComponent('parent', [100, 20], 90, [2, 1])], id: 'parent', parentId: null}],
        ['child', {components: [transformComponent('child', [10, 0], 0, [1, 1])], id: 'child', parentId: 'parent'}]
    ]);
    return {
        runtimeNodeModel: {getNodeSnapshot: id => nodes.get(id) || null},
        transformRuntimeStore: {
            getRuntimeTransform: id => {
                const node = nodes.get(id);
                return node ? node.components[0].data : null;
            }
        }
    };
};

describe('Transform2D hierarchy world projection', () => {
    test('projects child-local points through parent translation/rotation/scale without flattening backend identity', () => {
        const {runtimeNodeModel, transformRuntimeStore} = makeHarness();
        expect(projectPointThroughHierarchy(
            [0, 0], 'child', runtimeNodeModel, transformRuntimeStore
        )).toEqual([100, 40]);
        const points = projectPointsThroughHierarchy(
            [[0, 0], [5, 0]], 'child', runtimeNodeModel, transformRuntimeStore
        );
        expect(points[0]).toEqual([100, 40]);
        expect(points[1][0]).toBeCloseTo(100);
        expect(points[1][1]).toBeCloseTo(50);
    });


    test('resolves one Transform hierarchy for an entire point batch instead of once per vertex', () => {
        const {runtimeNodeModel, transformRuntimeStore} = makeHarness();
        const originalGetNodeSnapshot = runtimeNodeModel.getNodeSnapshot;
        runtimeNodeModel.getNodeSnapshot = jest.fn(originalGetNodeSnapshot);
        const points = Array.from({length: 34}, (_, index) => [index, index / 2]);
        const projected = projectPointsThroughHierarchy(points, 'child', runtimeNodeModel, transformRuntimeStore);
        expect(projected).toHaveLength(34);
        // child + parent are resolved once for the whole batch. The old implementation repeated
        // this traversal for every Circle/Capsule vertex.
        expect(runtimeNodeModel.getNodeSnapshot).toHaveBeenCalledTimes(2);
    });

    test('converts world-space character motion back into parent-local translation delta', () => {
        const {runtimeNodeModel, transformRuntimeStore} = makeHarness();
        const local = worldDeltaToNodeLocalDelta([0, 20], 'child', runtimeNodeModel, transformRuntimeStore);
        expect(local[0]).toBeCloseTo(10);
        expect(local[1]).toBeCloseTo(0);
    });
    test('round-trips world points back into child-local authoring space', () => {
        const {runtimeNodeModel, transformRuntimeStore} = makeHarness();
        const local = [7, -3];
        const world = projectPointThroughHierarchy(local, 'child', runtimeNodeModel, transformRuntimeStore);
        const roundTrip = unprojectPointThroughHierarchy(world, 'child', runtimeNodeModel, transformRuntimeStore);
        expect(roundTrip[0]).toBeCloseTo(local[0]);
        expect(roundTrip[1]).toBeCloseTo(local[1]);
    });

});
