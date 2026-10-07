import {
    MEMORY_PRESSURE_LEVELS,
    calculateSceneCacheBudget
} from '../../../../src/lib/scene-system';

const MIB = 1024 * 1024;
const GIB_IN_KIB = 1024 * 1024;

describe('NGVGE adaptive scene cache budget', () => {
    test.each([
        [2, 8 * MIB],
        [4, 32 * MIB],
        [8, 128 * MIB]
    ])('uses the device-memory tier for %s GB devices', (deviceMemory, expectedBudget) => {
        const status = calculateSceneCacheBudget({
            navigatorObject: {deviceMemory},
            performanceObject: null,
            processObject: null
        });

        expect(status.source).toBe('device-memory');
        expect(status.budgetBytes).toBe(expectedBudget);
        expect(status.memoryPressure).toBe(MEMORY_PRESSURE_LEVELS.LOW);
    });

    test('falls back to 16 MiB when device memory cannot be detected', () => {
        const status = calculateSceneCacheBudget({
            navigatorObject: null,
            performanceObject: null,
            processObject: null
        });

        expect(status.source).toBe('fallback');
        expect(status.budgetBytes).toBe(16 * MIB);
    });

    test('uses Electron system memory and caps the tier to two percent of free memory', () => {
        const status = calculateSceneCacheBudget({
            getSystemMemoryInfo: () => ({
                free: GIB_IN_KIB,
                total: 16 * GIB_IN_KIB
            }),
            navigatorObject: null,
            performanceObject: null
        });

        expect(status.source).toBe('electron');
        expect(status.baseBudgetBytes).toBe(Math.floor(1024 * MIB * 0.02));
        expect(status.budgetBytes).toBe(status.baseBudgetBytes);
        expect(status.memoryPressure).toBe(MEMORY_PRESSURE_LEVELS.HIGH);
    });

    test('allows an explicit project or user override', () => {
        const status = calculateSceneCacheBudget({
            cacheBudgetBytes: 48 * MIB,
            navigatorObject: {deviceMemory: 2},
            performanceObject: null,
            processObject: null
        });

        expect(status.source).toBe('configured');
        expect(status.budgetBytes).toBe(48 * MIB);
    });

    test('reads a live configured budget callback', () => {
        let configuredBudget = 24 * MIB;
        const options = {
            getConfiguredBudgetBytes: () => configuredBudget,
            navigatorObject: {deviceMemory: 8},
            performanceObject: null,
            processObject: null
        };

        expect(calculateSceneCacheBudget(options).budgetBytes).toBe(24 * MIB);
        configuredBudget = null;
        expect(calculateSceneCacheBudget(options).budgetBytes).toBe(128 * MIB);
    });

    test('detects browser heap pressure and reduces a non-Electron budget', () => {
        const status = calculateSceneCacheBudget({
            navigatorObject: {deviceMemory: 8},
            performanceObject: {
                memory: {
                    jsHeapSizeLimit: 1000,
                    usedJSHeapSize: 850
                }
            },
            processObject: null
        });

        expect(status.memoryPressure).toBe(MEMORY_PRESSURE_LEVELS.HIGH);
        expect(status.budgetBytes).toBe(64 * MIB);
    });
});
