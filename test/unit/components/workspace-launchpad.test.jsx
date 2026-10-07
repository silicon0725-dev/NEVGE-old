import React from 'react';
import renderer, {act} from 'react-test-renderer';

import WorkspaceLaunchpad from '../../../src/components/workspace-launchpad/workspace-launchpad.jsx';
import {DockRuntimeModel} from '../../../src/lib/editor-shell/dock-runtime-model';
import {LaunchpadModel} from '../../../src/lib/editor-shell/launchpad-model';
import {TOOL_IDS, createCoreToolRegistry} from '../../../src/lib/editor-shell/tool-registry';
import {createWindowDescriptor} from '../../../src/lib/editor-shell/window-model';
import {WindowManager} from '../../../src/lib/editor-shell/window-manager';

const createFoundation = () => {
    const toolRegistry = createCoreToolRegistry();
    const windowManager = new WindowManager();
    const dockRuntimeModel = new DockRuntimeModel({
        toolRegistry,
        windowManager,
        pinnedToolIds: [TOOL_IDS.NODE_EXPLORER]
    });
    toolRegistry.list().filter(tool => tool.singleton).forEach(tool => {
        windowManager.registerWindow(createWindowDescriptor(tool), {visible: false});
    });
    const launchpadModel = new LaunchpadModel({toolRegistry, windowManager, dockRuntimeModel});
    const interactionController = {
        activateTool: jest.fn(),
        togglePin: jest.fn()
    };
    return {windowManager, launchpadModel, interactionController};
};

const renderLaunchpad = foundation => renderer.create(
    <WorkspaceLaunchpad
        interactionController={foundation.interactionController}
        launchpadModel={foundation.launchpadModel}
        placement={{placement: 'bottom'}}
        onClose={jest.fn()}
    />
);

describe('WS-3E WorkspaceLaunchpad presentation', () => {
    test('renders all required Launchpad categories from model counts', () => {
        const foundation = createFoundation();
        let tree;
        act(() => {
            tree = renderLaunchpad(foundation);
        });
        const tabs = tree.root.findAllByProps({role: 'tab'});
        expect(tabs.map(tab => tab.props.children[0].props.children)).toEqual([
            'All Tools',
            'Pinned',
            'Recent',
            'First-party',
            'Extensions',
            'Developer',
            'Compatibility'
        ]);
        expect(tree.root.findAllByProps({'data-tool-id': TOOL_IDS.LEGACY_SPRITES})).toHaveLength(1);
        expect(tree.root.findAllByProps({'data-tool-id': TOOL_IDS.AGENT})).toHaveLength(1);
        tree.unmount();
    });

    test('category selection uses LaunchpadModel filtering rather than a duplicate tool list', () => {
        const foundation = createFoundation();
        let tree;
        act(() => {
            tree = renderLaunchpad(foundation);
        });
        const compatibilityTab = tree.root.findAllByProps({role: 'tab'}).find(tab =>
            tab.props.children[0].props.children === 'Compatibility'
        );
        act(() => compatibilityTab.props.onClick());
        expect(tree.root.findAllByProps({'data-tool-id': TOOL_IDS.LEGACY_SPRITES})).toHaveLength(1);
        expect(tree.root.findAllByProps({'data-tool-id': TOOL_IDS.NODE_EXPLORER})).toHaveLength(0);
        tree.unmount();
    });

    test('Recent category reacts to WindowManager focus history and tool launch delegates to interaction authority', () => {
        const foundation = createFoundation();
        foundation.windowManager.open('project-inspector');
        let tree;
        act(() => {
            tree = renderLaunchpad(foundation);
        });
        const recentTab = tree.root.findAllByProps({role: 'tab'}).find(tab =>
            tab.props.children[0].props.children === 'Recent'
        );
        act(() => recentTab.props.onClick());
        const inspector = tree.root.findAllByType('button').find(button => button.props['aria-label'] === 'Open Inspector');
        act(() => inspector.props.onClick());
        expect(foundation.interactionController.activateTool).toHaveBeenCalledWith(TOOL_IDS.INSPECTOR);
        tree.unmount();
    });
});
