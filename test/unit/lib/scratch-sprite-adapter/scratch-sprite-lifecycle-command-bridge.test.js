const {
    SCRATCH_SPRITE_LIFECYCLE_AUTHORITY_ID,
    SPRITE_LIFECYCLE_STATE_DOMAIN,
    createScratchSpriteLifecycleCommandBridge
} = require('../../../../src/lib/scratch-sprite-adapter');

const mutation = snapshot => ({
    applied: true,
    error: null,
    persisted: true,
    snapshot
});

const makeTarget = (id, name) => ({
    direction: 90,
    getName: () => name,
    id,
    isOriginal: true,
    isStage: false,
    name,
    size: 100,
    sprite: {name},
    x: 0,
    y: 0
});

const createHarness = () => {
    const targets = [];
    const nodes = new Map();
    const bindingByNodeId = new Map();
    const bindingByTargetId = new Map();
    let nextTarget = 1;
    let nextNode = 1;

    const facadeTargets = new Proxy({}, {
        get: (_target, property) => {
            if (property === 'length') return targets.length;
            const index = Number(property);
            return Number.isInteger(index) && index >= 0 ? targets[index] : undefined;
        }
    });

    const vm = {
        addSprite: jest.fn(async input => {
            const payload = typeof input === 'string' ? JSON.parse(input) : input;
            targets.push(makeTarget(`scratch-target:${nextTarget++}`, payload.name || payload.objName || 'Sprite'));
        }),
        duplicateSprite: jest.fn(async targetId => {
            const source = targets.find(target => target.id === targetId);
            targets.push(makeTarget(`scratch-target:${nextTarget++}`, `${source.getName()}2`));
        }),
        renameSprite: jest.fn((targetId, name) => {
            const target = targets.find(candidate => candidate.id === targetId);
            target.name = name;
            target.sprite.name = name;
            target.getName = () => name;
        }),
        runtime: {targets: facadeTargets}
    };

    const runtimeNodeModel = {
        addComponent: jest.fn((nodeId, component) => {
            const node = nodes.get(nodeId);
            const next = Object.assign({}, node, {
                components: (node.components || []).concat(Object.assign({
                    id: `component:${nodeId}:${component.typeId}`
                }, component))
            });
            nodes.set(nodeId, next);
            return mutation(next);
        }),
        getChildren: jest.fn(parentId => Array.from(nodes.values()).filter(node => node.parentId === parentId)),
        getNodeSnapshot: jest.fn(nodeId => nodes.get(nodeId) || null),
        getParent: jest.fn(nodeId => {
            const node = nodes.get(nodeId);
            return node && node.parentId ? nodes.get(node.parentId) || {id: node.parentId} : null;
        }),
        setParent: jest.fn((nodeId, parentId) => {
            const node = Object.assign({}, nodes.get(nodeId), {parentId});
            nodes.set(nodeId, node);
            return mutation(node);
        })
    };

    const reconcile = () => {
        targets.forEach(target => {
            let binding = bindingByTargetId.get(target.id);
            if (!binding) {
                const nodeId = `runtime-node:sprite:${nextNode++}`;
                binding = {
                    bindingId: `scratch-binding:${target.id}`,
                    nodeId,
                    sceneId: 'scene-a',
                    status: 'bound',
                    targetRuntimeId: target.id
                };
                bindingByTargetId.set(target.id, binding);
                bindingByNodeId.set(nodeId, binding);
                nodes.set(nodeId, {
                    components: [],
                    id: nodeId,
                    name: target.getName(),
                    parentId: 'runtime-node:scene-root:scene-a',
                    sceneId: 'scene-a',
                    typeId: 'ngvge.sprite-node'
                });
            } else {
                nodes.set(binding.nodeId, Object.assign({}, nodes.get(binding.nodeId), {name: target.getName()}));
            }
        });
    };

    const scratchSpriteAdapter = {
        destroyBindingByNodeId: jest.fn(async nodeId => {
            const binding = bindingByNodeId.get(nodeId);
            if (!binding) return false;
            const index = targets.findIndex(target => target.id === binding.targetRuntimeId);
            if (index >= 0) targets.splice(index, 1);
            bindingByNodeId.delete(nodeId);
            bindingByTargetId.delete(binding.targetRuntimeId);
            nodes.delete(nodeId);
            return true;
        }),
        getBindingByNodeId: jest.fn(nodeId => bindingByNodeId.get(nodeId) || null),
        getBindingByTargetRuntimeId: jest.fn(targetId => bindingByTargetId.get(targetId) || null),
        reconcileActiveScene: jest.fn(() => {
            reconcile();
            return {bindings: Array.from(bindingByNodeId.values())};
        })
    };

    const sceneDataModel = {
        readProject: jest.fn(() => ({activeSceneId: 'scene-a', scenes: [{id: 'scene-a'}]}))
    };
    const context = {getService: jest.fn(serviceId => serviceId === 'vm' ? vm : null)};
    const roleManagerParity = {
        syncTargetOrderFromSceneTree: jest.fn(async sceneId => ({changed: true, sceneId}))
    };
    const bridge = createScratchSpriteLifecycleCommandBridge(
        context,
        sceneDataModel,
        runtimeNodeModel,
        scratchSpriteAdapter,
        {roleManagerParity}
    );

    return {
        bridge,
        bindingByNodeId,
        nodes,
        roleManagerParity,
        runtimeNodeModel,
        scratchSpriteAdapter,
        targets,
        vm
    };
};

describe('Scratch Sprite Lifecycle Command Bridge', () => {
    test('declares Scratch compatibility as the current SpriteLifecycle writer seam', () => {
        const {bridge} = createHarness();
        expect(bridge.authorityId).toBe(SCRATCH_SPRITE_LIFECYCLE_AUTHORITY_ID);
        expect(bridge.stateDomain).toBe(SPRITE_LIFECYCLE_STATE_DOMAIN);
        expect(bridge.handlesCreateType('ngvge.sprite-node')).toBe(true);
        expect(bridge.handlesCreateType('ngvge.node2d')).toBe(false);
    });

    test('creates a semantic Sprite through VM authority and establishes a stable binding', async () => {
        const {bridge, runtimeNodeModel, targets, vm} = createHarness();
        expect(Array.isArray(vm.runtime.targets)).toBe(false);

        const node = await bridge.createNode({
            options: {
                name: 'Player',
                parentId: 'runtime-node:parent',
                sceneId: 'scene-a',
                scope: 'scene'
            },
            typeId: 'ngvge.sprite-node'
        });

        expect(vm.addSprite).toHaveBeenCalledTimes(1);
        const spriteDescriptor = vm.addSprite.mock.calls[0][0];
        expect(spriteDescriptor).toEqual(expect.objectContaining({
            isStage: false,
            name: 'Player',
            costumes: [expect.objectContaining({
                asset: expect.objectContaining({
                    assetType: expect.objectContaining({name: 'ImageVector', runtimeFormat: 'svg'}),
                    data: expect.any(Array),
                    dataFormat: 'svg'
                }),
                assetId: 'cd21514d0531fdffb22204e0ec5ed84a',
                dataFormat: 'svg',
                md5ext: 'cd21514d0531fdffb22204e0ec5ed84a.svg'
            })],
            sounds: []
        }));
        expect(spriteDescriptor.costumes[0].asset.data.length).toBeGreaterThan(0);
        expect(spriteDescriptor).not.toBeInstanceOf(ArrayBuffer);
        expect(targets).toHaveLength(1);
        expect(node.name).toBe('Player');
        expect(node.parentId).toBe('runtime-node:parent');
        expect(bridge.ownsNode(node.id)).toBe(true);
        expect(runtimeNodeModel.setParent).toHaveBeenCalledWith(
            node.id,
            'runtime-node:parent',
            expect.objectContaining({transactionId: expect.any(String)})
        );
    });

    test('provisions semantic Transform2D after establishing the stable Scratch binding', async () => {
        const {bridge, runtimeNodeModel} = createHarness();
        const transformComponent = {
            data: {position: [0, 0], rotation: 0, scale: [1, 1]},
            enabled: true,
            schemaVersion: 1,
            typeId: 'ngvge.transform2d'
        };

        const node = await bridge.createNode({
            options: {
                components: [transformComponent],
                name: 'Player',
                sceneId: 'scene-a'
            },
            typeId: 'ngvge.sprite-node'
        });

        expect(runtimeNodeModel.addComponent).toHaveBeenCalledWith(
            node.id,
            transformComponent,
            expect.objectContaining({transactionId: expect.any(String)})
        );
        expect(node.components).toEqual([expect.objectContaining({
            data: transformComponent.data,
            typeId: 'ngvge.transform2d'
        })]);
        expect(Object.prototype.hasOwnProperty.call(node, 'targetRuntimeId')).toBe(false);
    });

    test('rolls back the new Scratch target when semantic component provisioning fails', async () => {
        const {bridge, runtimeNodeModel, scratchSpriteAdapter, targets} = createHarness();
        runtimeNodeModel.addComponent.mockImplementation(() => {
            const error = new Error('component provisioning failed');
            error.code = 'TEST_COMPONENT_PROVISION_FAILED';
            throw error;
        });

        await expect(bridge.createNode({
            options: {
                components: [{
                    data: {position: [0, 0], rotation: 0, scale: [1, 1]},
                    enabled: true,
                    schemaVersion: 1,
                    typeId: 'ngvge.transform2d'
                }],
                name: 'Broken Sprite',
                sceneId: 'scene-a'
            },
            typeId: 'ngvge.sprite-node'
        })).rejects.toMatchObject({code: 'TEST_COMPONENT_PROVISION_FAILED'});

        expect(scratchSpriteAdapter.destroyBindingByNodeId).toHaveBeenCalledWith(
            expect.stringMatching(/^runtime-node:sprite:/),
            {reason: 'runtime-node-command-create-sprite-rollback'}
        );
        expect(targets).toHaveLength(0);
    });

    test('renames a bound Sprite through VM authority and reprojects the semantic name', async () => {
        const {bridge, targets, vm} = createHarness();
        const node = await bridge.createNode({
            options: {name: 'Before', sceneId: 'scene-a'},
            typeId: 'ngvge.sprite-node'
        });

        const renamed = bridge.patchNode({nodeId: node.id, patch: {name: 'After'}});
        expect(vm.renameSprite).toHaveBeenCalledWith(targets[0].id, 'After');
        expect(renamed.name).toBe('After');
        expect(() => bridge.patchNode({nodeId: node.id, patch: {enabled: false}})).toThrow(
            expect.objectContaining({code: 'NGVGE_SPRITE_LIFECYCLE_PATCH_UNSUPPORTED'})
        );
    });

    test('reparents and reorders a bound Sprite through semantic Node authority, then projects Scratch order', async () => {
        const {bridge, roleManagerParity, runtimeNodeModel} = createHarness();
        const node = await bridge.createNode({
            options: {name: 'Player', parentId: 'runtime-node:parent', sceneId: 'scene-a'},
            typeId: 'ngvge.sprite-node'
        });
        roleManagerParity.syncTargetOrderFromSceneTree.mockClear();

        const moved = await bridge.reparentNode({
            nodeId: node.id,
            parentId: 'runtime-node:parent',
            options: {index: 0}
        });

        expect(runtimeNodeModel.setParent).toHaveBeenCalledWith(
            node.id,
            'runtime-node:parent',
            expect.objectContaining({index: 0})
        );
        expect(roleManagerParity.syncTargetOrderFromSceneTree).toHaveBeenCalledWith('scene-a');
        expect(moved.id).toBe(node.id);
    });

    test('duplicates and destroys a bound Sprite without exposing target identity to the caller', async () => {
        const {bridge, scratchSpriteAdapter, targets, vm} = createHarness();
        const source = await bridge.createNode({
            options: {name: 'Source', parentId: 'runtime-node:parent', sceneId: 'scene-a'},
            typeId: 'ngvge.sprite-node'
        });

        const duplicate = await bridge.duplicateNode({nodeId: source.id});
        expect(vm.duplicateSprite).toHaveBeenCalledTimes(1);
        expect(duplicate.id).not.toBe(source.id);
        expect(duplicate.parentId).toBe('runtime-node:parent');
        expect(targets).toHaveLength(2);
        expect(Object.prototype.hasOwnProperty.call(duplicate, 'targetRuntimeId')).toBe(false);

        const destroyed = await bridge.destroyNode({nodeId: source.id});
        expect(destroyed).toEqual({destroyed: true, nodeId: source.id});
        expect(scratchSpriteAdapter.destroyBindingByNodeId).toHaveBeenCalledWith(source.id, {
            reason: 'runtime-node-command-destroy-sprite'
        });
    });
});
