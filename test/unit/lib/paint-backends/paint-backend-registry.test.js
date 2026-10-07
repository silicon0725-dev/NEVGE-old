import {PaintBackendRegistry} from '../../../../src/lib/paint-backends/paint-backend-registry';
import {
    PAINT_BACKEND_CANDIDATES,
    SVG_EDIT_BACKEND_ID,
    MINIPAINT_BACKEND_ID,
    PISKEL_BACKEND_ID,
    SCRATCH_PAINT_COMPAT_BACKEND_ID
} from '../../../../src/lib/paint-backends/paint-backend-candidates';

describe('PaintBackendRegistry', () => {
    test('registers formal intake descriptors without activating runtime implementations', () => {
        const registry = new PaintBackendRegistry();
        PAINT_BACKEND_CANDIDATES.forEach(candidate => registry.register(candidate));
        expect(registry.list()).toHaveLength(4);
        expect(registry.get(SVG_EDIT_BACKEND_ID).admission).toBe('approved-for-poc');
        expect(registry.get(MINIPAINT_BACKEND_ID).integrationMode).toBe('controlled-fork');
        expect(registry.get(PISKEL_BACKEND_ID).kind).toBe('pixel');
        expect(registry.get(SCRATCH_PAINT_COMPAT_BACKEND_ID).admission).toBe('compatibility-only');
    });

    test('filters by kind and admission', () => {
        const registry = new PaintBackendRegistry();
        PAINT_BACKEND_CANDIDATES.forEach(candidate => registry.register(candidate));
        expect(registry.list({kind: 'vector'}).map(item => item.backendId)).toEqual([SVG_EDIT_BACKEND_ID]);
        expect(registry.list({admission: 'conditional-poc'}).map(item => item.backendId).sort()).toEqual([
            MINIPAINT_BACKEND_ID,
            PISKEL_BACKEND_ID
        ].sort());
    });

    test('rejects duplicate backend identity', () => {
        const registry = new PaintBackendRegistry();
        registry.register(PAINT_BACKEND_CANDIDATES[0]);
        expect(() => registry.register(PAINT_BACKEND_CANDIDATES[0])).toThrow(/already registered/i);
    });

    test('disposes descriptors without owning backend runtime state', () => {
        const registry = new PaintBackendRegistry();
        registry.register(PAINT_BACKEND_CANDIDATES[0]);
        expect(registry.dispose()).toBe(true);
        expect(() => registry.list()).toThrow(/disposed/i);
    });
});
