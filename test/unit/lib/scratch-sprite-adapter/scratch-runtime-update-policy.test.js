const {
    PASSIVE_SCRATCH_TARGET_UI_REFRESH_MS,
    PASSIVE_SCRATCH_TARGET_LIST_REFRESH_MS,
    SCRATCH_STAGE_RECT_CACHE_MAX_AGE_MS,
    createScratchTargetTopologySignature,
    hasActiveScratchThreads
} = require('../../../../src/lib/scratch-sprite-adapter/scratch-runtime-update-policy');

const target = (id, name, isStage = false) => ({
    id,
    isOriginal: true,
    isStage,
    x: 0,
    y: 0,
    getName () {
        return name.value;
    }
});

describe('Scratch runtime update policy', () => {
    test('ignores runtime transform churn in target topology signatures', () => {
        const stageName = {value: 'Stage'};
        const spriteName = {value: 'Sprite1'};
        const stage = target('stage', stageName, true);
        const sprite = target('sprite', spriteName, false);
        const vm = {runtime: {targets: [stage, sprite], threads: []}};
        const before = createScratchTargetTopologySignature(vm);

        sprite.x = 120;
        sprite.y = -40;
        expect(createScratchTargetTopologySignature(vm)).toBe(before);

        spriteName.value = 'Renamed';
        expect(createScratchTargetTopologySignature(vm)).not.toBe(before);
    });

    test('detects target add/remove and active Scratch execution', () => {
        const stage = target('stage', {value: 'Stage'}, true);
        const sprite = target('sprite', {value: 'Sprite1'});
        const vm = {runtime: {targets: [stage, sprite], threads: []}};
        const before = createScratchTargetTopologySignature(vm);
        vm.runtime.targets.push(target('sprite-2', {value: 'Sprite2'}));
        expect(createScratchTargetTopologySignature(vm)).not.toBe(before);
        expect(hasActiveScratchThreads(vm)).toBe(false);
        vm.runtime.threads.push({id: 'thread'});
        expect(hasActiveScratchThreads(vm)).toBe(true);
        expect(PASSIVE_SCRATCH_TARGET_UI_REFRESH_MS).toBeGreaterThanOrEqual(50);
        expect(PASSIVE_SCRATCH_TARGET_LIST_REFRESH_MS).toBeGreaterThanOrEqual(200);
        expect(SCRATCH_STAGE_RECT_CACHE_MAX_AGE_MS).toBeGreaterThanOrEqual(100);
    });
});
