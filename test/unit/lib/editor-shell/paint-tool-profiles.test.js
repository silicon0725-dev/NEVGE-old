import {
    PAINT_MODE_IDS,
    PAINT_TOOL_IDS,
    PAINT_TOOL_DESCRIPTORS,
    getPaintModeLabel,
    getPaintToolDescriptor,
    getPaintToolsForMode
} from '../../../../src/lib/editor-shell/paint-tool-profiles';

describe('WS-10G0 shared Paint tool profiles', () => {
    test('preserves the verified Vector tool order while moving metadata out of the React shell', () => {
        expect(getPaintToolsForMode(PAINT_MODE_IDS.VECTOR)).toEqual([
            'select',
            'direct-select',
            'freehand',
            'line',
            'rect',
            'ellipse',
            'path',
            'text',
            'hand',
            'zoom'
        ]);
        expect(getPaintModeLabel(PAINT_MODE_IDS.VECTOR)).toBe('Vector');
        expect(getPaintToolDescriptor(PAINT_TOOL_IDS.FREEHAND).label).toBe('Pencil');
    });

    test('shares interaction-level tools across Vector, Bitmap, and Pixel without pretending their backends are identical', () => {
        const vector = new Set(getPaintToolsForMode(PAINT_MODE_IDS.VECTOR));
        const bitmap = new Set(getPaintToolsForMode(PAINT_MODE_IDS.BITMAP));
        const pixel = new Set(getPaintToolsForMode(PAINT_MODE_IDS.PIXEL));

        ['select', 'line', 'rect', 'ellipse', 'hand', 'zoom'].forEach(toolId => {
            expect(vector.has(toolId)).toBe(true);
            expect(bitmap.has(toolId)).toBe(true);
            expect(pixel.has(toolId)).toBe(true);
        });
        expect(bitmap.has('brush')).toBe(true);
        expect(pixel.has('pencil')).toBe(true);
        expect(vector.has('path')).toBe(true);
        expect(bitmap.has('path')).toBe(false);
        expect(pixel.has('path')).toBe(false);
    });

    test('keeps tool descriptors immutable and backend-neutral', () => {
        expect(Object.isFrozen(PAINT_TOOL_DESCRIPTORS)).toBe(true);
        Object.values(PAINT_TOOL_DESCRIPTORS).forEach(descriptor => {
            expect(Object.isFrozen(descriptor)).toBe(true);
            expect(descriptor).not.toHaveProperty('backendId');
            expect(descriptor).not.toHaveProperty('resourceId');
            expect(descriptor).not.toHaveProperty('documentId');
        });
    });
});
