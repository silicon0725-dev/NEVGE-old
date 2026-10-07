import {
    NATIVE_PAINT_SHELL_ID,
    NATIVE_PAINT_SHELL_SLOT_ORDER,
    NATIVE_PAINT_SHELL_SLOTS,
    createNativePaintShellDescriptor
} from '../../../../src/lib/editor-shell/native-paint-shell';

describe('WS-10F2B Native Paint shell contract', () => {
    test('freezes a stable shell identity and ordered presentation slots', () => {
        expect(NATIVE_PAINT_SHELL_ID).toBe('ngvge.native-paint-shell@1');
        expect(NATIVE_PAINT_SHELL_SLOT_ORDER).toEqual([
            'context-toolbar',
            'tool-rail',
            'canvas-chrome',
            'panel-rail',
            'status-bar'
        ]);
        expect(NATIVE_PAINT_SHELL_SLOTS.CANVAS_CHROME).toBe('canvas-chrome');
    });

    test('keeps the shell presentation-only and backend-neutral', () => {
        const descriptor = createNativePaintShellDescriptor({mode: 'vector'});
        expect(descriptor.shellId).toBe(NATIVE_PAINT_SHELL_ID);
        expect(descriptor.mode).toBe('vector');
        expect(descriptor.compatibility).toBe(false);
        expect(Object.values(descriptor.authority)).toEqual([false, false, false, false, false]);
        expect(descriptor.slots).toEqual(NATIVE_PAINT_SHELL_SLOT_ORDER);
    });
});
