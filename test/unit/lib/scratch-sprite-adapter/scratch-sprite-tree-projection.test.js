import {createScratchSpriteTreeProjection} from '../../../../src/lib/scratch-sprite-adapter';

describe('Scratch Sprite editor tree projection', () => {
    test('projects bindings through semantic owner nodes and hides only bound Scratch target rows', () => {
        const playerBinding = {
            bindingId: 'binding-player',
            nodeId: 'node-player',
            sceneId: 'scene-a',
            status: 'bound',
            targetRuntimeId: 'target-player'
        };
        const staleBinding = {
            bindingId: 'binding-stale',
            nodeId: 'node-missing',
            sceneId: 'scene-a',
            status: 'bound',
            targetRuntimeId: 'target-stale'
        };
        const projection = createScratchSpriteTreeProjection({
            bindings: [playerBinding, staleBinding],
            runtimeNodes: [{id: 'node-player', typeId: 'ngvge.sprite-node'}]
        });

        expect(projection.bindings).toEqual([playerBinding]);
        expect(projection.bindingByNodeId.get('node-player')).toBe(playerBinding);
        expect(projection.bindingByTargetRuntimeId.get('target-player')).toBe(playerBinding);
        expect(projection.bindingByNodeId.get('node-missing')).toBeNull();
        expect(projection.bindingByTargetRuntimeId.has('target-stale')).toBe(false);
        expect(projection.hiddenTargetRuntimeIds).toEqual(['target-player']);
        expect(Object.isFrozen(projection)).toBe(true);
    });

    test('does not infer ownership from a Scratch-specific node type', () => {
        const projection = createScratchSpriteTreeProjection({
            bindings: [],
            runtimeNodes: [{id: 'legacy-looking-node', typeId: 'ngvge.scratch-sprite-node'}]
        });

        expect(projection.bindingByNodeId.has('legacy-looking-node')).toBe(false);
        expect(projection.hiddenTargetRuntimeIds).toEqual([]);
    });
});
