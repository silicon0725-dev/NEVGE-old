import {
    PAINT_MODULE_REGISTRY_ID,
    PAINT_MODULE_SLOTS,
    createPaintModuleRegistry,
    getPaintModuleComponent
} from '../../../../src/lib/vendor/scratch-paint/src/modules/paint-module-registry';

const makeModule = slot => ({
    id: `test.${slot}@1`,
    version: 1,
    component: () => null
});

const BASE_MODULES = PAINT_MODULE_SLOTS.reduce((modules, slot) => {
    modules[slot] = makeModule(slot);
    return modules;
}, {});

const ReplacementPanel = () => null;

describe('WS-10P0M Scratch Paint module registry', () => {
    test('freezes the complete admitted module surface', () => {
        const registry = createPaintModuleRegistry(BASE_MODULES);
        expect(registry.id).toBe(PAINT_MODULE_REGISTRY_ID);
        expect(Object.isFrozen(registry)).toBe(true);
        expect(Object.keys(registry.slots).sort()).toEqual([...PAINT_MODULE_SLOTS].sort());
        PAINT_MODULE_SLOTS.forEach(slot => {
            const moduleRecord = registry.slots[slot];
            expect(Object.isFrozen(moduleRecord)).toBe(true);
            expect(typeof moduleRecord.id).toBe('string');
            expect(typeof moduleRecord.component).toBe('function');
        });
    });

    test('allows one slot to be replaced without mutating the base module records', () => {
        const registry = createPaintModuleRegistry(BASE_MODULES, {
            sidePanel: {
                id: 'ngvge.paint.layers-panel@1',
                version: 1,
                component: ReplacementPanel
            }
        });
        expect(getPaintModuleComponent(registry, 'sidePanel')).toBe(ReplacementPanel);
        expect(BASE_MODULES.sidePanel.component).not.toBe(ReplacementPanel);
    });

    test('rejects incomplete or invalid module records', () => {
        expect(() => createPaintModuleRegistry(BASE_MODULES, {
            bottomPanel: {id: 'broken'}
        })).toThrow(/React component/);
        expect(() => getPaintModuleComponent({}, 'workspace')).toThrow(/admitted Paint module registry/);
    });
});
