import React from 'react';
import renderer, {act} from 'react-test-renderer';

import WorkspaceExtensionManager from '../../../src/components/workspace-extension-manager/workspace-extension-manager.jsx';
import {
    EXTENSION_MANAGER_CATEGORIES,
    EXTENSION_MANAGER_ITEM_STATUS
} from '../../../src/lib/editor-shell/extension-manager-model';

const makeItem = overrides => ({
    capabilities: [],
    category: EXTENSION_MANAGER_CATEGORIES.SCRATCH_EXTENSIONS,
    compatibility: {legacy: false, quarantine: false},
    description: 'Extension description',
    descriptorId: 'ngvge.extension.test',
    enabled: false,
    extensionId: 'test-extension',
    hostKind: EXTENSION_MANAGER_CATEGORIES.SCRATCH_EXTENSIONS,
    iconURL: null,
    installed: false,
    itemId: `${EXTENSION_MANAGER_CATEGORIES.SCRATCH_EXTENSIONS}:test-extension`,
    name: 'Test Extension',
    permissions: [],
    settings: [],
    source: {kind: 'builtin-id', value: null},
    status: EXTENSION_MANAGER_ITEM_STATUS.DISABLED,
    tags: [],
    trust: {
        effectiveExecutionMode: null,
        evaluated: false,
        level: null,
        requestedExecutionMode: null
    },
    updateAvailable: false,
    version: null,
    ...overrides
});

const createModel = items => {
    const listeners = new Set();
    const model = {
        revision: 1,
        getItem: jest.fn(itemId => items.find(item => item.itemId === itemId) || null),
        listItems: jest.fn(() => items),
        setEnabled: jest.fn(() => Promise.resolve()),
        setSetting: jest.fn(),
        subscribe: jest.fn(listener => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        })
    };
    return model;
};

const getText = node => {
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (!node || !node.children) return '';
    return node.children.map(getText).join('');
};

const renderManager = model => {
    let tree;
    act(() => {
        tree = renderer.create(
            <WorkspaceExtensionManager
                model={model}
                onBrowseCatalog={jest.fn()}
            />
        );
    });
    return tree;
};

const getButtonByText = (tree, label) => tree.root.findAllByType('button')
    .find(button => getText(button) === label);

const makeFixtureItems = () => [
    makeItem({
        category: EXTENSION_MANAGER_CATEGORIES.LEGACY_ADDONS,
        compatibility: {legacy: true, quarantine: true},
        descriptorId: 'ngvge.extension.legacy.demo',
        enabled: true,
        extensionId: 'legacy-demo',
        hostKind: EXTENSION_MANAGER_CATEGORIES.LEGACY_ADDONS,
        installed: true,
        itemId: `${EXTENSION_MANAGER_CATEGORIES.LEGACY_ADDONS}:legacy-demo`,
        name: 'Legacy Demo',
        settings: [{
            id: 'turbo',
            name: 'Turbo mode',
            type: 'boolean',
            value: true
        }],
        source: {kind: 'bundled-legacy-addon', value: null},
        status: EXTENSION_MANAGER_ITEM_STATUS.ENABLED,
        trust: {
            effectiveExecutionMode: 'legacy-quarantine',
            evaluated: true,
            level: 'legacy-quarantined',
            requestedExecutionMode: 'legacy'
        }
    }),
    makeItem({
        extensionId: 'scratch-demo',
        itemId: `${EXTENSION_MANAGER_CATEGORIES.SCRATCH_EXTENSIONS}:scratch-demo`,
        name: 'Scratch Demo'
    }),
    makeItem({
        category: EXTENSION_MANAGER_CATEGORIES.NGVGE_MODULES,
        descriptorId: 'ngvge.extension.module.demo',
        extensionId: 'module-demo',
        hostKind: EXTENSION_MANAGER_CATEGORIES.NGVGE_MODULES,
        installed: true,
        itemId: `${EXTENSION_MANAGER_CATEGORIES.NGVGE_MODULES}:module-demo`,
        name: 'Module Demo',
        source: {kind: 'built-in-module', value: '1.0.0'},
        trust: {
            effectiveExecutionMode: 'native',
            evaluated: true,
            level: 'first-party',
            requestedExecutionMode: 'native'
        },
        version: '1.0.0'
    })
];

describe('WS-6 WorkspaceExtensionManager presentation', () => {
    test('renders the required navigation, categories and detail inspector tabs', () => {
        const tree = renderManager(createModel(makeFixtureItems()));
        const buttons = tree.root.findAllByType('button').map(getText);
        expect(buttons).toEqual(expect.arrayContaining([
            'All3',
            'Installed2',
            'Enabled1',
            'Disabled2',
            'Updates0',
            'NGVGE Modules1',
            'Scratch Extensions1',
            'Legacy Addons1'
        ]));
        const detailTabs = tree.root.findAllByProps({role: 'tab'}).map(getText);
        expect(detailTabs).toEqual(['Overview', 'Settings', 'Permissions', 'Compatibility', 'About']);
        tree.unmount();
    });

    test('keeps complete settings out of the compact list and exposes them only in the Settings detail tab', () => {
        const tree = renderManager(createModel(makeFixtureItems()));
        expect(getText(tree.root).includes('Turbo mode')).toBe(false);
        const settingsTab = getButtonByText(tree, 'Settings');
        act(() => settingsTab.props.onClick());
        expect(getText(tree.root)).toContain('Turbo mode');
        tree.unmount();
    });

    test('presents unevaluated trust for discovery-only Scratch extensions', () => {
        const tree = renderManager(createModel(makeFixtureItems()));
        const scratchCard = tree.root.findByProps({
            'data-extension-item-id': `${EXTENSION_MANAGER_CATEGORIES.SCRATCH_EXTENSIONS}:scratch-demo`
        });
        act(() => scratchCard.props.onClick());
        expect(getText(tree.root)).toContain('Trust not evaluated');
        expect(getText(tree.root)).toContain('Effective trust is evaluated by LEX');
        tree.unmount();
    });

    test('routes enable and disable actions through the model instead of host-private APIs', async () => {
        const model = createModel(makeFixtureItems());
        const tree = renderManager(model);
        const enableScratch = tree.root.findByProps({'aria-label': 'Enable Scratch Demo'});
        await act(async () => {
            enableScratch.props.onClick({stopPropagation: jest.fn()});
        });
        expect(model.setEnabled).toHaveBeenCalledWith(
            `${EXTENSION_MANAGER_CATEGORIES.SCRATCH_EXTENSIONS}:scratch-demo`,
            true
        );
        tree.unmount();
    });
});
