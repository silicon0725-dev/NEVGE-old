const {
    SCRATCH_ROLE_MANAGER_PARITY_CAPABILITY_ID,
    SCRATCH_ROLE_MANAGER_PARITY_CONTRACT_ID,
    createScratchRoleManagerParityService
} = require('../../../../src/lib/scratch-sprite-adapter');

const makeNode = (id, parentId, sceneId = 'scene-a') => ({id, parentId, sceneId});

const createHarness = () => {
    const root = makeNode('runtime-node:scene-root:scene-a', null);
    const spriteA = makeNode('runtime-node:sprite-a', root.id);
    const spriteB = makeNode('runtime-node:sprite-b', root.id);
    const nodes = new Map([[root.id, root], [spriteA.id, spriteA], [spriteB.id, spriteB]]);
    const childOrder = [spriteB.id, spriteA.id];
    const targets = [
        {id: 'stage', isStage: true, isOriginal: true},
        {id: 'target-a', isStage: false, isOriginal: true},
        {id: 'target-b', isStage: false, isOriginal: true}
    ];
    const bindings = [
        {nodeId: spriteA.id, role: 'sprite', sceneId: 'scene-a', status: 'bound', targetRuntimeId: 'target-a'},
        {nodeId: spriteB.id, role: 'sprite', sceneId: 'scene-a', status: 'bound', targetRuntimeId: 'target-b'}
    ];
    const vm = {
        reorderTarget: jest.fn((sourceIndex, destinationIndex) => {
            const [target] = targets.splice(sourceIndex, 1);
            targets.splice(destinationIndex, 0, target);
        }),
        runtime: {targets}
    };
    const runtimeNodeModel = {
        getChildren: jest.fn(parentId => parentId === root.id ? childOrder.map(id => nodes.get(id)) : []),
        getNodeSnapshot: jest.fn(nodeId => nodes.get(nodeId) || null),
        getSceneRoot: jest.fn(() => root)
    };
    const scratchSpriteAdapter = {
        getBindingByNodeId: jest.fn(nodeId => bindings.find(binding => binding.nodeId === nodeId) || null),
        getBindingByTargetRuntimeId: jest.fn(targetRuntimeId =>
            bindings.find(binding => binding.targetRuntimeId === targetRuntimeId) || null),
        listBindings: jest.fn(() => bindings.slice())
    };
    const service = createScratchRoleManagerParityService({
        vm,
        runtimeNodeModel,
        scratchSpriteAdapter
    });
    return {service, spriteA, spriteB, targets, vm};
};

describe('Scratch Role Manager parity', () => {
    test('keeps NodeId as authority while resolving the compatibility target in both directions', () => {
        const {service, spriteA} = createHarness();
        expect(service.capabilityId).toBe(SCRATCH_ROLE_MANAGER_PARITY_CAPABILITY_ID);
        expect(service.contractId).toBe(SCRATCH_ROLE_MANAGER_PARITY_CONTRACT_ID);
        expect(service.resolveTargetRuntimeIdForNode(spriteA.id)).toBe('target-a');
        expect(service.resolveNodeIdForTarget('target-a', 'scene-a')).toBe(spriteA.id);
    });

    test('projects semantic Sprite tree order to Scratch original-target order without touching Stage identity', async () => {
        const {service, targets, vm} = createHarness();
        const result = await service.syncTargetOrderFromSceneTree('scene-a');

        expect(result.changed).toBe(true);
        expect(vm.reorderTarget).toHaveBeenCalledWith(2, 1);
        expect(targets.map(target => target.id)).toEqual(['stage', 'target-b', 'target-a']);
        expect(service.getBoundTargetIdsInTreeOrder('scene-a')).toEqual(['target-b', 'target-a']);
    });
});
