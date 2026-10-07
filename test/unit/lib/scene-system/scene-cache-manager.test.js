import {
    MEMORY_PRESSURE_LEVELS,
    SCENE_CACHE_LEVELS,
    createSceneCacheManager
} from '../../../../src/lib/scene-system';

const MIB = 1024 * 1024;

const createBudgetProvider = budgetBytes => ({
    getStatus: () => ({
        baseBudgetBytes: budgetBytes,
        budgetBytes,
        memoryPressure: MEMORY_PRESSURE_LEVELS.LOW,
        source: 'test'
    })
});

describe('NGVGE scene cache manager', () => {
    test('uses byte-budgeted LRU demotion instead of a fixed per-scene limit', () => {
        const cache = createSceneCacheManager({
            budgetProvider: createBudgetProvider(32 * MIB),
            maxEntries: 6
        });

        cache.put('archive-a', {id: 'a'}, {
            archiveByteLength: MIB,
            sceneId: 'scene-a',
            sizeBytes: 10 * MIB
        });
        cache.put('archive-b', {id: 'b'}, {
            archiveByteLength: MIB,
            sceneId: 'scene-b',
            sizeBytes: 20 * MIB
        });
        cache.put('archive-c', {id: 'c'}, {
            archiveByteLength: MIB,
            sceneId: 'scene-c',
            sizeBytes: 10 * MIB
        });

        const status = cache.getStatus();
        expect(status.usedBytes).toBe(30 * MIB);
        expect(status.counts).toEqual({cold: 1, hot: 0, warm: 2});
        expect(cache.hasPrepared('archive-a')).toBe(false);
        expect(cache.hasPrepared('archive-b')).toBe(true);
    });

    test('keeps the active hot scene while high pressure demotes warm scenes', () => {
        const cache = createSceneCacheManager({
            budgetProvider: createBudgetProvider(128 * MIB)
        });
        cache.put('archive-a', {id: 'a'}, {sceneId: 'scene-a', sizeBytes: 8 * MIB});
        cache.put('archive-b', {id: 'b'}, {sceneId: 'scene-b', sizeBytes: 8 * MIB});
        cache.markSceneHot('scene-a');
        cache.applyMemoryPressure(MEMORY_PRESSURE_LEVELS.HIGH);

        expect(cache.get('archive-a').level).toBe(SCENE_CACHE_LEVELS.HOT);
        expect(cache.hasPrepared('archive-b')).toBe(false);
        expect(cache.getStatus().counts).toEqual({cold: 1, hot: 1, warm: 0});
    });

    test.each([
        [8, 1],
        [32, 2],
        [128, 5]
    ])('recommends %s MiB tier preloading count', (budgetMiB, expectedCount) => {
        const cache = createSceneCacheManager({
            budgetProvider: createBudgetProvider(budgetMiB * MIB)
        });
        expect(cache.getRecommendedPreloadCount()).toBe(expectedCount);
    });

    test('stores oversized prepared scenes as cold metadata', () => {
        const cache = createSceneCacheManager({
            budgetProvider: createBudgetProvider(8 * MIB)
        });
        const result = cache.put('archive-large', {id: 'large'}, {
            archiveByteLength: 10 * MIB,
            sceneId: 'scene-large',
            sizeBytes: 10 * MIB
        });

        expect(result.cached).toBe(false);
        expect(result.entry.level).toBe(SCENE_CACHE_LEVELS.COLD);
        expect(cache.hasPrepared('archive-large')).toBe(false);
    });

    test('allows a zero-byte configured budget to disable automatic preloading', () => {
        const cache = createSceneCacheManager({
            budgetProvider: createBudgetProvider(0)
        });

        expect(cache.getRecommendedPreloadCount()).toBe(0);
        expect(cache.put('archive', {id: 'scene'}, {sceneId: 'scene', sizeBytes: 1}).cached).toBe(false);
    });

    test('does not report an entry as cached when critical pressure removes it immediately', () => {
        const cache = createSceneCacheManager({
            budgetProvider: {
                getStatus: () => ({
                    baseBudgetBytes: 32 * MIB,
                    budgetBytes: 8 * MIB,
                    memoryPressure: MEMORY_PRESSURE_LEVELS.CRITICAL,
                    source: 'test'
                })
            }
        });

        const result = cache.put('archive', {id: 'scene'}, {
            level: SCENE_CACHE_LEVELS.HOT,
            sceneId: 'scene',
            sizeBytes: MIB
        });
        expect(result.cached).toBe(false);
        expect(cache.hasPrepared('archive')).toBe(false);
    });
});
