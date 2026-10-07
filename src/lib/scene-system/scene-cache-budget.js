const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

const DEFAULT_SCENE_CACHE_BUDGET_BYTES = 16 * MIB;
const LOW_END_SCENE_CACHE_BUDGET_BYTES = 8 * MIB;
const STANDARD_SCENE_CACHE_BUDGET_BYTES = 32 * MIB;
const HIGH_END_SCENE_CACHE_BUDGET_BYTES = 128 * MIB;
const MIN_SCENE_CACHE_BUDGET_BYTES = 8 * MIB;
const MAX_SCENE_CACHE_BUDGET_BYTES = 128 * MIB;

const MEMORY_PRESSURE_LEVELS = Object.freeze({
    CRITICAL: 'critical',
    HIGH: 'high',
    LOW: 'low',
    MEDIUM: 'medium'
});

const PRESSURE_RANK = Object.freeze({
    [MEMORY_PRESSURE_LEVELS.LOW]: 0,
    [MEMORY_PRESSURE_LEVELS.MEDIUM]: 1,
    [MEMORY_PRESSURE_LEVELS.HIGH]: 2,
    [MEMORY_PRESSURE_LEVELS.CRITICAL]: 3
});

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const getGlobalValue = propertyName => {
    if (typeof globalThis === 'undefined') return null;
    return globalThis[propertyName] || null;
};

const normalizeSystemMemoryInfo = memoryInfo => {
    if (!memoryInfo || !Number.isFinite(memoryInfo.total) || memoryInfo.total <= 0) return null;
    const totalBytes = memoryInfo.total * 1024;
    const freeBytes = Number.isFinite(memoryInfo.free) && memoryInfo.free >= 0 ? memoryInfo.free * 1024 : null;
    return {
        freeBytes,
        totalBytes
    };
};

const getSystemMemoryInfo = options => {
    if (typeof options.getSystemMemoryInfo === 'function') {
        try {
            return normalizeSystemMemoryInfo(options.getSystemMemoryInfo());
        } catch {
            return null;
        }
    }

    const processObject = Object.prototype.hasOwnProperty.call(options, 'processObject') ?
        options.processObject : getGlobalValue('process');
    if (!processObject || typeof processObject.getSystemMemoryInfo !== 'function') return null;
    try {
        return normalizeSystemMemoryInfo(processObject.getSystemMemoryInfo());
    } catch {
        return null;
    }
};

const getDeviceMemory = options => {
    const navigatorObject = Object.prototype.hasOwnProperty.call(options, 'navigatorObject') ?
        options.navigatorObject : getGlobalValue('navigator');
    if (!navigatorObject || !Number.isFinite(navigatorObject.deviceMemory)) return null;
    return navigatorObject.deviceMemory;
};

const getPerformanceMemory = options => {
    const performanceObject = Object.prototype.hasOwnProperty.call(options, 'performanceObject') ?
        options.performanceObject : getGlobalValue('performance');
    if (!performanceObject || !performanceObject.memory) return null;
    const memory = performanceObject.memory;
    if (!Number.isFinite(memory.jsHeapSizeLimit) || memory.jsHeapSizeLimit <= 0 ||
        !Number.isFinite(memory.usedJSHeapSize) || memory.usedJSHeapSize < 0) {
        return null;
    }
    return {
        heapLimitBytes: memory.jsHeapSizeLimit,
        heapUsedBytes: memory.usedJSHeapSize
    };
};

const getBudgetTierForDeviceMemory = deviceMemory => {
    if (!Number.isFinite(deviceMemory)) return DEFAULT_SCENE_CACHE_BUDGET_BYTES;
    if (deviceMemory <= 2) return LOW_END_SCENE_CACHE_BUDGET_BYTES;
    if (deviceMemory <= 4) return STANDARD_SCENE_CACHE_BUDGET_BYTES;
    return HIGH_END_SCENE_CACHE_BUDGET_BYTES;
};

const getBudgetTierForSystemMemory = totalBytes => {
    if (!Number.isFinite(totalBytes)) return DEFAULT_SCENE_CACHE_BUDGET_BYTES;
    if (totalBytes <= 4 * GIB) return LOW_END_SCENE_CACHE_BUDGET_BYTES;
    if (totalBytes <= 8 * GIB) return STANDARD_SCENE_CACHE_BUDGET_BYTES;
    return HIGH_END_SCENE_CACHE_BUDGET_BYTES;
};

const getPressureFromSystemMemory = systemMemoryInfo => {
    if (!systemMemoryInfo || !Number.isFinite(systemMemoryInfo.freeBytes)) return MEMORY_PRESSURE_LEVELS.LOW;
    const freeRatio = systemMemoryInfo.freeBytes / systemMemoryInfo.totalBytes;
    if (freeRatio <= 0.05 || systemMemoryInfo.freeBytes <= 256 * MIB) return MEMORY_PRESSURE_LEVELS.CRITICAL;
    if (freeRatio <= 0.1 || systemMemoryInfo.freeBytes <= 512 * MIB) return MEMORY_PRESSURE_LEVELS.HIGH;
    if (freeRatio <= 0.2 || systemMemoryInfo.freeBytes <= GIB) return MEMORY_PRESSURE_LEVELS.MEDIUM;
    return MEMORY_PRESSURE_LEVELS.LOW;
};

const getPressureFromPerformanceMemory = performanceMemory => {
    if (!performanceMemory) return MEMORY_PRESSURE_LEVELS.LOW;
    const usedRatio = performanceMemory.heapUsedBytes / performanceMemory.heapLimitBytes;
    if (usedRatio >= 0.9) return MEMORY_PRESSURE_LEVELS.CRITICAL;
    if (usedRatio >= 0.8) return MEMORY_PRESSURE_LEVELS.HIGH;
    if (usedRatio >= 0.65) return MEMORY_PRESSURE_LEVELS.MEDIUM;
    return MEMORY_PRESSURE_LEVELS.LOW;
};

const getHigherPressure = (first, second) => (
    PRESSURE_RANK[first] >= PRESSURE_RANK[second] ? first : second
);

const applyPressureToBudget = (budgetBytes, pressure) => {
    if (pressure === MEMORY_PRESSURE_LEVELS.CRITICAL) return Math.floor(budgetBytes * 0.25);
    if (pressure === MEMORY_PRESSURE_LEVELS.HIGH) return Math.floor(budgetBytes * 0.5);
    if (pressure === MEMORY_PRESSURE_LEVELS.MEDIUM) return Math.floor(budgetBytes * 0.75);
    return budgetBytes;
};

const calculateSceneCacheBudget = (options = {}) => {
    let configuredValue = options.cacheBudgetBytes;
    if (typeof options.getConfiguredBudgetBytes === 'function') {
        try {
            configuredValue = options.getConfiguredBudgetBytes();
        } catch {
            configuredValue = null;
        }
    }
    const configuredBudget = Number.isFinite(configuredValue) ? Math.max(0, configuredValue) : null;
    const systemMemoryInfo = getSystemMemoryInfo(options);
    const deviceMemory = getDeviceMemory(options);
    const performanceMemory = getPerformanceMemory(options);
    let source = 'fallback';
    let baseBudgetBytes = DEFAULT_SCENE_CACHE_BUDGET_BYTES;

    if (configuredBudget !== null) {
        source = 'configured';
        baseBudgetBytes = configuredBudget;
    } else if (systemMemoryInfo) {
        source = 'electron';
        baseBudgetBytes = getBudgetTierForSystemMemory(systemMemoryInfo.totalBytes);
        if (Number.isFinite(systemMemoryInfo.freeBytes)) {
            const pressureLimit = clamp(
                Math.floor(systemMemoryInfo.freeBytes * 0.02),
                MIN_SCENE_CACHE_BUDGET_BYTES,
                MAX_SCENE_CACHE_BUDGET_BYTES
            );
            baseBudgetBytes = Math.min(baseBudgetBytes, pressureLimit);
        }
    } else if (Number.isFinite(deviceMemory)) {
        source = 'device-memory';
        baseBudgetBytes = getBudgetTierForDeviceMemory(deviceMemory);
    }

    const systemPressure = getPressureFromSystemMemory(systemMemoryInfo);
    const heapPressure = getPressureFromPerformanceMemory(performanceMemory);
    const memoryPressure = getHigherPressure(systemPressure, heapPressure);
    let budgetBytes = options.adjustBudgetForPressure === false || source === 'electron' ?
        baseBudgetBytes : applyPressureToBudget(baseBudgetBytes, memoryPressure);

    if (configuredBudget === null || options.clampConfiguredBudget === true) {
        budgetBytes = clamp(budgetBytes, MIN_SCENE_CACHE_BUDGET_BYTES, MAX_SCENE_CACHE_BUDGET_BYTES);
    } else {
        budgetBytes = Math.max(0, budgetBytes);
    }

    return Object.freeze({
        baseBudgetBytes,
        budgetBytes,
        deviceMemory,
        memoryPressure,
        performanceMemory,
        source,
        systemMemoryInfo
    });
};

const createSceneCacheBudgetProvider = (options = {}) => ({
    getStatus: () => calculateSceneCacheBudget(options)
});

module.exports = {
    DEFAULT_SCENE_CACHE_BUDGET_BYTES,
    HIGH_END_SCENE_CACHE_BUDGET_BYTES,
    LOW_END_SCENE_CACHE_BUDGET_BYTES,
    MAX_SCENE_CACHE_BUDGET_BYTES,
    MEMORY_PRESSURE_LEVELS,
    MIN_SCENE_CACHE_BUDGET_BYTES,
    STANDARD_SCENE_CACHE_BUDGET_BYTES,
    applyPressureToBudget,
    calculateSceneCacheBudget,
    createSceneCacheBudgetProvider,
    getBudgetTierForDeviceMemory,
    getBudgetTierForSystemMemory,
    getPressureFromPerformanceMemory,
    getPressureFromSystemMemory,
    normalizeSystemMemoryInfo
};
