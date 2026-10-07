const {
    hasLegacyAddonDomBridge,
    refreshLegacyAddonDomAfterRemount,
    registerLegacyAddonDomBridge
} = require('../../../../src/lib/extension-containment');

describe('LEX-1 Legacy Addon DOM bridge', () => {
    test('keeps addon remount coordination module-local instead of window global state', () => {
        const bridge = {refreshAfterDomRemount: jest.fn()};
        const dispose = registerLegacyAddonDomBridge(bridge);
        expect(hasLegacyAddonDomBridge()).toBe(true);
        expect(refreshLegacyAddonDomAfterRemount()).toBe(true);
        expect(bridge.refreshAfterDomRemount).toHaveBeenCalledTimes(1);
        dispose();
        expect(refreshLegacyAddonDomAfterRemount()).toBe(false);
    });
});
