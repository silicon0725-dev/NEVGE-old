const {
    MEMORY_PRESSURE_LEVELS,
    createSceneCacheBudgetProvider
} = require('./scene-cache-budget');

const SCENE_CACHE_LEVELS = Object.freeze({
    COLD: 'cold',
    HOT: 'hot',
    WARM: 'warm'
});

const DEFAULT_MAX_CACHE_ENTRIES = 6;
const DEFAULT_MAX_PRELOAD_COUNT = 5;
const DEFAULT_MAX_ENTRY_BUDGET_RATIO = 0.75;

const normalizeLevel = level => (
    Object.values(SCENE_CACHE_LEVELS).includes(level) ? level : SCENE_CACHE_LEVELS.WARM
);

const createSceneCacheManager = (options = {}) => {
    const entries = new Map();
    const budgetProvider = options.budgetProvider || createSceneCacheBudgetProvider(options);
    const maxEntries = Number.isInteger(options.maxEntries) ?
        Math.max(0, options.maxEntries) : DEFAULT_MAX_CACHE_ENTRIES;
    const maxPreloadCount = Number.isInteger(options.maxPreloadCount) ?
        Math.max(1, options.maxPreloadCount) : DEFAULT_MAX_PRELOAD_COUNT;
    const maxEntryBudgetRatio = Number.isFinite(options.maxEntryBudgetRatio) ?
        Math.max(0, Math.min(1, options.maxEntryBudgetRatio)) : DEFAULT_MAX_ENTRY_BUDGET_RATIO;
    const legacyMaxEntryBytes = Number.isFinite(options.maxEntryBytes) ?
        Math.max(0, options.maxEntryBytes) : null;
    let activeSceneId = null;
    let budgetStatus = budgetProvider.getStatus();

    const getUsedBytes = () => Array.from(entries.values()).reduce((total, entry) => total + entry.sizeBytes, 0);
    const getPreparedEntryCount = () => Array.from(entries.values()).filter(entry => entry.value !== null).length;
    const touch = entry => {
        entries.delete(entry.key);
        entry.lastUsed = Date.now();
        entries.set(entry.key, entry);
        return entry;
    };
    const getMaxEntryBytes = () => {
        const ratioLimit = Math.floor(budgetStatus.budgetBytes * maxEntryBudgetRatio);
        return legacyMaxEntryBytes === null ? ratioLimit : Math.min(ratioLimit, legacyMaxEntryBytes);
    };
    const toCold = entry => {
        entry.level = SCENE_CACHE_LEVELS.COLD;
        entry.sizeBytes = 0;
        entry.value = null;
        return entry;
    };
    const findOldest = predicate => {
        for (const entry of entries.values()) {
            if (predicate(entry)) return entry;
        }
        return null;
    };
    const trimEntryCount = () => {
        if (maxEntries < 1) {
            entries.clear();
            return;
        }
        while (entries.size > maxEntries) {
            const candidate = findOldest(entry => (
                entry.sceneId !== activeSceneId && entry.level === SCENE_CACHE_LEVELS.COLD
            )) ||
                findOldest(entry => entry.sceneId !== activeSceneId && entry.level !== SCENE_CACHE_LEVELS.HOT);
            if (!candidate) break;
            entries.delete(candidate.key);
        }
    };
    const trimBudget = () => {
        while (getUsedBytes() > budgetStatus.budgetBytes || getPreparedEntryCount() > maxEntries) {
            const candidate = findOldest(entry => entry.value !== null && entry.level !== SCENE_CACHE_LEVELS.HOT);
            if (!candidate) break;
            toCold(candidate);
        }
        trimEntryCount();
    };
    const applyPressure = pressure => {
        if (pressure === MEMORY_PRESSURE_LEVELS.MEDIUM) {
            Array.from(entries.values())
                .filter(entry => entry.level === SCENE_CACHE_LEVELS.COLD && entry.sceneId !== activeSceneId)
                .forEach(entry => entries.delete(entry.key));
        } else if (pressure === MEMORY_PRESSURE_LEVELS.HIGH) {
            Array.from(entries.values())
                .filter(entry => entry.level === SCENE_CACHE_LEVELS.WARM && entry.sceneId !== activeSceneId)
                .forEach(toCold);
        } else if (pressure === MEMORY_PRESSURE_LEVELS.CRITICAL) {
            Array.from(entries.values()).forEach(entry => {
                if (entry.sceneId === activeSceneId && entry.level === SCENE_CACHE_LEVELS.HOT) return;
                entries.delete(entry.key);
            });
        }
        trimBudget();
    };
    const refreshBudget = () => {
        budgetStatus = budgetProvider.getStatus();
        applyPressure(budgetStatus.memoryPressure);
        return budgetStatus;
    };
    const getEntry = (key, optionsForGet = {}) => {
        refreshBudget();
        const entry = entries.get(key);
        if (!entry) return null;
        touch(entry);
        if (entry.value === null && optionsForGet.includeCold !== true) return null;
        return entry;
    };
    const put = (key, value, metadata = {}) => {
        refreshBudget();
        const level = normalizeLevel(metadata.level);
        const requestedSizeBytes = Number.isFinite(metadata.sizeBytes) ? Math.max(0, metadata.sizeBytes) : 0;
        const canPrepare = value !== null && requestedSizeBytes <= getMaxEntryBytes() && maxEntries > 0 &&
            budgetStatus.budgetBytes > 0;
        const entry = {
            archiveByteLength: Number.isFinite(metadata.archiveByteLength) ? metadata.archiveByteLength : 0,
            createdAt: Date.now(),
            key,
            lastUsed: Date.now(),
            level: canPrepare ? level : SCENE_CACHE_LEVELS.COLD,
            sceneId: typeof metadata.sceneId === 'string' ? metadata.sceneId : null,
            sizeBytes: canPrepare ? requestedSizeBytes : 0,
            value: canPrepare ? value : null
        };
        entries.delete(key);
        entries.set(key, entry);
        applyPressure(budgetStatus.memoryPressure);
        const retained = entries.get(key) === entry && entry.value !== null;
        return {
            cached: retained,
            entry,
            reason: retained ? null : 'entry-too-large-cache-disabled-or-memory-pressure'
        };
    };
    const markSceneHot = sceneId => {
        activeSceneId = sceneId || null;
        Array.from(entries.values()).forEach(entry => {
            if (entry.level === SCENE_CACHE_LEVELS.HOT && entry.sceneId !== activeSceneId) {
                entry.level = entry.value === null ? SCENE_CACHE_LEVELS.COLD : SCENE_CACHE_LEVELS.WARM;
            }
            if (entry.sceneId === activeSceneId && entry.value !== null) entry.level = SCENE_CACHE_LEVELS.HOT;
        });
        trimBudget();
    };
    const markHot = (key, sceneId) => {
        activeSceneId = sceneId || null;
        Array.from(entries.values()).forEach(entry => {
            if (entry.level === SCENE_CACHE_LEVELS.HOT && entry.key !== key) {
                entry.level = entry.value === null ? SCENE_CACHE_LEVELS.COLD : SCENE_CACHE_LEVELS.WARM;
            }
        });
        const entry = entries.get(key);
        if (entry) {
            entry.sceneId = activeSceneId;
            if (entry.value !== null) entry.level = SCENE_CACHE_LEVELS.HOT;
            touch(entry);
        }
        trimBudget();
    };
    const invalidate = key => entries.delete(key);
    const invalidateScene = sceneId => {
        Array.from(entries.values())
            .filter(entry => entry.sceneId === sceneId)
            .forEach(entry => entries.delete(entry.key));
    };
    const clear = clearOptions => {
        if (!clearOptions || clearOptions.preserveHot !== true) {
            entries.clear();
            return;
        }
        Array.from(entries.values())
            .filter(entry => entry.level !== SCENE_CACHE_LEVELS.HOT)
            .forEach(entry => entries.delete(entry.key));
    };
    const calculateRecommendedPreloadCount = averageSceneSize => {
        if (budgetStatus.budgetBytes <= 0) return 0;
        let tierLimit = 2;
        if (budgetStatus.budgetBytes <= 8 * 1024 * 1024) tierLimit = 1;
        else if (budgetStatus.budgetBytes >= 64 * 1024 * 1024) tierLimit = maxPreloadCount;

        const measuredAverage = Number.isFinite(averageSceneSize) && averageSceneSize > 0 ?
            averageSceneSize : (() => {
                const measured = Array.from(entries.values())
                    .map(entry => entry.sizeBytes || entry.archiveByteLength)
                    .filter(size => Number.isFinite(size) && size > 0);
                if (!measured.length) return null;
                return measured.reduce((sum, size) => sum + size, 0) / measured.length;
            })();
        if (!measuredAverage) return tierLimit;
        return Math.max(1, Math.min(tierLimit, maxPreloadCount,
            Math.floor(budgetStatus.budgetBytes / measuredAverage)));
    };
    const getRecommendedPreloadCount = averageSceneSize => {
        refreshBudget();
        return calculateRecommendedPreloadCount(averageSceneSize);
    };
    const getStatus = () => {
        refreshBudget();
        const counts = {
            [SCENE_CACHE_LEVELS.COLD]: 0,
            [SCENE_CACHE_LEVELS.HOT]: 0,
            [SCENE_CACHE_LEVELS.WARM]: 0
        };
        const publicEntries = Array.from(entries.values()).map(entry => {
            counts[entry.level] += 1;
            return {
                archiveByteLength: entry.archiveByteLength,
                lastUsed: entry.lastUsed,
                level: entry.level,
                sceneId: entry.sceneId,
                sizeBytes: entry.sizeBytes
            };
        });
        return {
            activeSceneId,
            baseBudgetBytes: budgetStatus.baseBudgetBytes,
            budgetBytes: budgetStatus.budgetBytes,
            budgetSource: budgetStatus.source,
            counts,
            entries: publicEntries,
            maxEntries,
            maxEntryBytes: getMaxEntryBytes(),
            memoryPressure: budgetStatus.memoryPressure,
            recommendedPreloadCount: calculateRecommendedPreloadCount(),
            usedBytes: getUsedBytes()
        };
    };

    return Object.freeze({
        applyMemoryPressure: applyPressure,
        clear,
        get: getEntry,
        getMaxEntryBytes,
        getRecommendedPreloadCount,
        getStatus,
        hasPrepared: key => Boolean(entries.get(key) && entries.get(key).value !== null),
        invalidate,
        invalidateScene,
        markHot,
        markSceneHot,
        put,
        refreshBudget
    });
};

module.exports = {
    DEFAULT_MAX_CACHE_ENTRIES,
    DEFAULT_MAX_ENTRY_BUDGET_RATIO,
    DEFAULT_MAX_PRELOAD_COUNT,
    SCENE_CACHE_LEVELS,
    createSceneCacheManager
};
