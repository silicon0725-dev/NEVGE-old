import {
    LEGACY_SPRITES_COMPATIBILITY_UI_ID,
    LEGACY_SPRITES_WINDOW_ID,
    RUNTIME_NODE_PRIMARY_MODE_ID,
    normalizeLegacySpritesWindowState,
    serializeLegacySpritesWindowState
} from '../../../../src/lib/editor-shell/runtime-node-primary-mode';

describe('Runtime Node Explorer primary mode policy', () => {
    test('uses stable semantic UI identities', () => {
        expect(RUNTIME_NODE_PRIMARY_MODE_ID).toBe('runtime-node-primary');
        expect(LEGACY_SPRITES_COMPATIBILITY_UI_ID).toBe('scratch-target-pane');
        expect(LEGACY_SPRITES_WINDOW_ID).toBe('targets');
    });

    test('demotes Legacy Sprites to hidden by default', () => {
        expect(normalizeLegacySpritesWindowState(null)).toEqual({
            visible: false,
            minimized: false
        });
        expect(normalizeLegacySpritesWindowState({isMinimized: true})).toEqual({
            visible: false,
            minimized: false
        });
    });

    test('restores only an explicitly visible compatibility window', () => {
        expect(normalizeLegacySpritesWindowState({
            visible: true,
            isMinimized: true
        })).toEqual({
            visible: true,
            minimized: true
        });
        expect(normalizeLegacySpritesWindowState({
            visible: true,
            isMinimized: false
        })).toEqual({
            visible: true,
            minimized: false
        });
    });

    test('does not persist a minimized state for a closed compatibility window', () => {
        expect(serializeLegacySpritesWindowState({
            visible: false,
            minimized: true
        })).toEqual({
            visible: false,
            isMinimized: false
        });
    });
});
