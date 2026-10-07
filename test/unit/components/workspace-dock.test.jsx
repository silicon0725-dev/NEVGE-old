import React from 'react';
import renderer, {act} from 'react-test-renderer';

import WorkspaceDock from '../../../src/components/workspace-dock/workspace-dock.jsx';
import {TOOL_IDS, createCoreToolRegistry} from '../../../src/lib/editor-shell/tool-registry';
import {createWindowDescriptor} from '../../../src/lib/editor-shell/window-model';
import {WindowManager} from '../../../src/lib/editor-shell/window-manager';
import {DockRuntimeModel} from '../../../src/lib/editor-shell/dock-runtime-model';
import {DockPlacementModel} from '../../../src/lib/editor-shell/dock-placement-model';
import {DockOrganizationModel} from '../../../src/lib/editor-shell/dock-organization-model';
import {DockInteractionController} from '../../../src/lib/editor-shell/dock-interaction-controller';
import {LaunchpadModel} from '../../../src/lib/editor-shell/launchpad-model';

describe('WS-3B WorkspaceDock presentation', () => {
    const createFoundation = ({pinnedToolIds = []} = {}) => {
        const toolRegistry = createCoreToolRegistry();
        const windowManager = new WindowManager();
        const dockRuntimeModel = new DockRuntimeModel({
            toolRegistry,
            windowManager,
            pinnedToolIds,
            order: pinnedToolIds
        });
        const placementModel = new DockPlacementModel();
        const organizationModel = new DockOrganizationModel({toolRegistry, dockRuntimeModel});
        const launchpadModel = new LaunchpadModel({toolRegistry, windowManager, dockRuntimeModel});
        const launchTool = jest.fn();
        const interactionController = new DockInteractionController({
            toolRegistry,
            windowManager,
            dockRuntimeModel,
            launchTool
        });
        return {
            toolRegistry,
            windowManager,
            dockRuntimeModel,
            placementModel,
            organizationModel,
            launchpadModel,
            launchTool,
            interactionController
        };
    };

    const renderDock = foundation => renderer.create(
        <WorkspaceDock
            dockRuntimeModel={foundation.dockRuntimeModel}
            interactionController={foundation.interactionController}
            launchpadModel={foundation.launchpadModel}
            organizationModel={foundation.organizationModel}
            placementModel={foundation.placementModel}
        />
    );

    test('renders running/minimized/active state and restores through WindowManager', () => {
        const foundation = createFoundation({pinnedToolIds: [TOOL_IDS.NODE_EXPLORER]});
        const descriptor = createWindowDescriptor(foundation.toolRegistry.require(TOOL_IDS.NODE_EXPLORER));
        foundation.windowManager.registerWindow(descriptor, {visible: true});
        foundation.windowManager.minimize(descriptor.windowId);
        let tree;
        act(() => {
            tree = renderDock(foundation);
        });
        const slot = tree.root.findByProps({'data-tool-id': TOOL_IDS.NODE_EXPLORER});
        expect(slot.props['data-running']).toBe('true');
        expect(slot.props['data-minimized']).toBe('true');
        const toolButton = tree.root.findAllByType('button').find(button =>
            String(button.props['aria-label']).startsWith('Node Explorer')
        );
        act(() => toolButton.props.onClick());
        expect(foundation.windowManager.requireState(descriptor.windowId)).toMatchObject({
            visible: true,
            minimized: false,
            active: true
        });
        expect(foundation.launchTool).not.toHaveBeenCalled();
        tree.unmount();
    });

    test('launches a stopped pinned tool and toggles pin metadata without WindowManager authority duplication', () => {
        const foundation = createFoundation({pinnedToolIds: [TOOL_IDS.ASSETS]});
        let tree;
        act(() => {
            tree = renderDock(foundation);
        });
        const buttons = tree.root.findAllByType('button');
        const toolButton = buttons.find(button => button.props['aria-label'] === 'Asset Workspace');
        const pinButton = buttons.find(button => button.props['aria-label'] === 'Unpin Asset Workspace');
        act(() => toolButton.props.onClick());
        expect(foundation.launchTool).toHaveBeenCalledWith(
            TOOL_IDS.ASSETS,
            expect.objectContaining({id: TOOL_IDS.ASSETS})
        );
        const managerRevision = foundation.windowManager.revision;
        act(() => pinButton.props.onClick({stopPropagation: jest.fn()}));
        expect(foundation.dockRuntimeModel.isPinned(TOOL_IDS.ASSETS)).toBe(false);
        expect(foundation.windowManager.revision).toBe(managerRevision);
        tree.unmount();
    });

    test('drag reorder updates Dock order and leaves WindowManager untouched', () => {
        const foundation = createFoundation({
            pinnedToolIds: [TOOL_IDS.NODE_EXPLORER, TOOL_IDS.INSPECTOR, TOOL_IDS.ASSETS]
        });
        let tree;
        act(() => {
            tree = renderDock(foundation);
        });
        const source = tree.root.findByProps({'data-tool-id': TOOL_IDS.ASSETS});
        const target = tree.root.findByProps({'data-tool-id': TOOL_IDS.NODE_EXPLORER});
        const dataTransfer = {
            effectAllowed: '',
            setData: jest.fn()
        };
        act(() => source.props.onDragStart({dataTransfer}));
        act(() => target.props.onDrop({preventDefault: jest.fn()}));
        expect(foundation.dockRuntimeModel.getOrder()).toEqual([
            TOOL_IDS.ASSETS,
            TOOL_IDS.NODE_EXPLORER,
            TOOL_IDS.INSPECTOR
        ]);
        expect(foundation.windowManager.revision).toBe(0);
        tree.unmount();
    });
    test('projects placement/alignment/offset geometry through data attributes and CSS variables', () => {
        const foundation = createFoundation({pinnedToolIds: [TOOL_IDS.NODE_EXPLORER]});
        foundation.placementModel.setPreference({
            placement: 'right',
            alignment: 'end',
            offsetX: -10,
            offsetY: 24
        });
        let tree;
        act(() => {
            tree = renderDock(foundation);
        });
        const dock = tree.root.findByType('nav');
        expect(dock.props).toMatchObject({
            'data-placement': 'right',
            'data-alignment': 'end',
            'data-orientation': 'vertical',
            'aria-label': 'Workspace Dock'
        });
        expect(dock.props.style).toEqual({
            '--ngvge-dock-offset-x': '-10px',
            '--ngvge-dock-offset-y': '24px'
        });
        expect(tree.root.findByProps({role: 'toolbar'}).props['aria-orientation']).toBe('vertical');
        tree.unmount();
    });

    test('uses orientation-aware keyboard reorder for vertical docks', () => {
        const foundation = createFoundation({
            pinnedToolIds: [TOOL_IDS.NODE_EXPLORER, TOOL_IDS.INSPECTOR, TOOL_IDS.ASSETS]
        });
        foundation.placementModel.setPlacement('left');
        let tree;
        act(() => {
            tree = renderDock(foundation);
        });
        const inspectorButton = tree.root.findAllByType('button').find(button =>
            String(button.props['aria-label']).startsWith('Inspector')
        );
        act(() => inspectorButton.props.onKeyDown({
            altKey: true,
            key: 'ArrowDown',
            preventDefault: jest.fn()
        }));
        expect(foundation.dockRuntimeModel.getOrder()).toEqual([
            TOOL_IDS.NODE_EXPLORER,
            TOOL_IDS.ASSETS,
            TOOL_IDS.INSPECTOR
        ]);
        tree.unmount();
    });


    test('renders group, separator and folder topology without changing ToolId projections', () => {
        const foundation = createFoundation({
            pinnedToolIds: [TOOL_IDS.NODE_EXPLORER, TOOL_IDS.INSPECTOR, TOOL_IDS.ASSETS, TOOL_IDS.STAGE]
        });
        const group = foundation.organizationModel.createGroup({
            label: 'Project',
            toolIds: [TOOL_IDS.NODE_EXPLORER, TOOL_IDS.INSPECTOR]
        });
        const folder = foundation.organizationModel.createFolder({
            label: 'Creation',
            toolIds: [TOOL_IDS.ASSETS]
        });
        foundation.organizationModel.createSeparator({beforeToolId: TOOL_IDS.ASSETS});
        let tree;
        act(() => {
            tree = renderDock(foundation);
        });
        expect(tree.root.findByProps({'data-organization-id': group.id})).toBeTruthy();
        expect(tree.root.findByProps({'data-organization-id': folder.id})).toBeTruthy();
        expect(tree.root.findAllByProps({role: 'separator'})).toHaveLength(1);
        expect(tree.root.findByProps({'data-tool-id': TOOL_IDS.NODE_EXPLORER})).toBeTruthy();
        expect(foundation.toolRegistry.require(TOOL_IDS.NODE_EXPLORER).id).toBe(TOOL_IDS.NODE_EXPLORER);
        tree.unmount();
    });

    test('publishes stable Dock target geometry markers for tools and collapsed folders', () => {
        const foundation = createFoundation({pinnedToolIds: [TOOL_IDS.NODE_EXPLORER, TOOL_IDS.ASSETS]});
        const folder = foundation.organizationModel.createFolder({
            label: 'Creation',
            toolIds: [TOOL_IDS.ASSETS]
        });
        let tree;
        act(() => {
            tree = renderDock(foundation);
        });
        const explorerSlot = tree.root.findByProps({'data-tool-id': TOOL_IDS.NODE_EXPLORER});
        expect(explorerSlot.props['data-ngvge-dock-transition-targets']).toBe(TOOL_IDS.NODE_EXPLORER);
        const folderButton = tree.root.findAllByType('button').find(button =>
            button.props['aria-label'] === 'Creation, 1 tools'
        );
        expect(folderButton.props['data-ngvge-dock-transition-targets']).toContain(TOOL_IDS.ASSETS);
        expect(tree.root.findByProps({'data-organization-id': folder.id})).toBeTruthy();
        tree.unmount();
    });

    test('folder click expands member tools and exposes aggregate running state', () => {
        const foundation = createFoundation({pinnedToolIds: [TOOL_IDS.ASSETS]});
        const folder = foundation.organizationModel.createFolder({
            label: 'Creation',
            toolIds: [TOOL_IDS.ASSETS]
        });
        const descriptor = createWindowDescriptor(foundation.toolRegistry.require(TOOL_IDS.ASSETS));
        foundation.windowManager.registerWindow(descriptor, {visible: true});
        let tree;
        act(() => {
            tree = renderDock(foundation);
        });
        const folderNode = tree.root.findByProps({'data-organization-id': folder.id});
        expect(folderNode.props['data-running']).toBe('true');
        const button = tree.root.findAllByType('button').find(candidate => candidate.props['aria-label'] === 'Creation, 1 tools');
        act(() => button.props.onClick());
        expect(tree.root.findByProps({'data-organization-id': folder.id}).props['data-expanded']).toBe('true');
        expect(tree.root.findByProps({role: 'group', 'aria-label': 'Creation'})).toBeTruthy();
        expect(tree.root.findByProps({'data-tool-id': TOOL_IDS.ASSETS})).toBeTruthy();
        tree.unmount();
    });

    test('context organization menu can create a group and insert/remove separator without WindowManager mutations', () => {
        const foundation = createFoundation({pinnedToolIds: [TOOL_IDS.NODE_EXPLORER, TOOL_IDS.ASSETS]});
        let tree;
        act(() => {
            tree = renderDock(foundation);
        });
        const slot = tree.root.findByProps({'data-tool-id': TOOL_IDS.NODE_EXPLORER});
        const managerRevision = foundation.windowManager.revision;
        act(() => slot.props.onContextMenu({preventDefault: jest.fn(), clientX: 40, clientY: 50}));
        const createGroup = tree.root.findAllByType('button').find(button => button.props.children === 'Create group');
        act(() => createGroup.props.onClick());
        expect(foundation.organizationModel.getMembership(TOOL_IDS.NODE_EXPLORER)).toMatchObject({kind: 'group'});
        expect(foundation.windowManager.revision).toBe(managerRevision);
        const groupedSlot = tree.root.findByProps({'data-tool-id': TOOL_IDS.NODE_EXPLORER});
        act(() => groupedSlot.props.onContextMenu({preventDefault: jest.fn(), clientX: 40, clientY: 50}));
        const insertSeparator = tree.root.findAllByType('button').find(button => button.props.children === 'Insert separator before');
        act(() => insertSeparator.props.onClick());
        expect(foundation.organizationModel.getSeparatorBefore(TOOL_IDS.NODE_EXPLORER)).not.toBeNull();
        expect(foundation.windowManager.revision).toBe(managerRevision);
        tree.unmount();
    });


    test('opens Launchpad from the Dock and launches tools through the existing interaction controller', () => {
        const foundation = createFoundation({pinnedToolIds: [TOOL_IDS.NODE_EXPLORER]});
        let tree;
        act(() => {
            tree = renderDock(foundation);
        });
        const launchpadButton = tree.root.findAllByType('button').find(button =>
            button.props['aria-label'] === 'Open Workspace Launchpad'
        );
        expect(launchpadButton.props['aria-expanded']).toBe(false);
        act(() => launchpadButton.props.onClick());
        expect(tree.root.findByProps({'aria-label': 'Workspace Launchpad'})).toBeTruthy();
        const assetsCard = tree.root.findAllByType('button').find(button => button.props['aria-label'] === 'Open Asset Workspace');
        act(() => assetsCard.props.onClick());
        expect(foundation.launchTool).toHaveBeenCalledWith(
            TOOL_IDS.ASSETS,
            expect.objectContaining({id: TOOL_IDS.ASSETS})
        );
        tree.unmount();
    });

    test('Launchpad pin action updates DockRuntimeModel without owning WindowManager state', () => {
        const foundation = createFoundation({pinnedToolIds: [TOOL_IDS.NODE_EXPLORER]});
        let tree;
        act(() => {
            tree = renderDock(foundation);
        });
        const launchpadButton = tree.root.findAllByType('button').find(button =>
            button.props['aria-label'] === 'Open Workspace Launchpad'
        );
        act(() => launchpadButton.props.onClick());
        const managerRevision = foundation.windowManager.revision;
        const pinAssets = tree.root.findAllByType('button').find(button => button.props['aria-label'] === 'Pin Asset Workspace');
        act(() => pinAssets.props.onClick({stopPropagation: jest.fn()}));
        expect(foundation.dockRuntimeModel.isPinned(TOOL_IDS.ASSETS)).toBe(true);
        expect(foundation.windowManager.revision).toBe(managerRevision);
        tree.unmount();
    });

});
