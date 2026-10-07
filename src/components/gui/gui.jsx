import classNames from 'classnames';
import omit from 'lodash.omit';
import PropTypes from 'prop-types';
import React from 'react';
import {defineMessages, FormattedMessage, injectIntl, intlShape} from 'react-intl';
import {connect} from 'react-redux';
import MediaQuery from 'react-responsive';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';
import tabStyles from 'react-tabs/style/react-tabs.css';
import VM from 'scratch-vm';

import DraggableWindow from '../draggable-window/draggable-window.jsx';
import MinimizedBar from '../draggable-window/minimized-bar.jsx';
import ProjectExporter from '../../lib/project-exporter.js';
import windowStateStorage from '../../lib/window-state-storage';
import {refreshLegacyAddonDomAfterRemount} from '../../lib/extension-containment';
import {
    LEGACY_SPRITES_COMPATIBILITY_UI_ID,
    serializeLegacySpritesWindowState
} from '../../lib/editor-shell/runtime-node-primary-mode';
import {
    WORKSPACE_SHELL_ACCENT_POLICY,
    WORKSPACE_SHELL_ICON_POLICY,
    WORKSPACE_SHELL_VISUAL_FOUNDATION_ID,
    WORKSPACE_SHELL_VISUAL_MODE,
    WORKSPACE_SHELL_WINDOW_CHROME
} from '../../lib/editor-shell/workspace-visual-foundation';
import {WORKSPACE_TOOL_REGISTRY_ID, TOOL_IDS, createCoreToolRegistry} from '../../lib/editor-shell/tool-registry';
import {createCoreToolEcosystemRegistry} from '../../lib/editor-shell/tool-ecosystem-manifests';
import {createCoreWorkspaceToolCapabilityHost} from '../../lib/editor-shell/tool-capability-descriptors';
import {createWorkspaceProjectCommandHost} from '../../lib/editor-shell/project-command-host';
import {createWorkspaceProjectTransactionReviewService} from '../../lib/editor-shell/project-transaction-review';
import {
    createWorkspacePrivilegedMutationReviewPolicy
} from '../../lib/editor-shell/privileged-mutation-review-policy';
import {createWorkspaceToolPersistenceService} from '../../lib/editor-shell/workspace-tool-persistence';
import {
    createCoreWorkspaceCapabilityProviderRegistry
} from '../../lib/editor-shell/workspace-capability-providers';
import {TodoToolModel} from '../../lib/editor-shell/todo-tool-model';
import {createWorkspacePaintToolSession} from '../../lib/editor-shell/paint-tool-runtime';
import {activateWorkspacePaintBackend} from '../../lib/tw-scratch-paint';
import {
    createWorkspaceNodeCommandClient,
    createWorkspaceNodeCommandHostForVM
} from '../../lib/editor-shell/node-workspace-command';
import {WORKSPACE_EXTENSION_MANAGER_MODEL_ID} from '../../lib/editor-shell/extension-manager-model';
import {createWorkspaceExtensionManagerModelForVM} from '../../lib/editor-shell/extension-manager-runtime';
import {createWorkspaceAgentRuntime} from '../../lib/editor-shell/agent-workspace-runtime';
import {WORKSPACE_WINDOW_MODEL_ID, createWindowDescriptor} from '../../lib/editor-shell/window-model';
import {WORKSPACE_WINDOW_MANAGER_ID, WindowManager} from '../../lib/editor-shell/window-manager';
import {WorkspaceContextService} from '../../lib/editor-shell/workspace-context';
import {admitWorkspaceContextConsumer} from '../../lib/editor-shell/workspace-context-consumer';
import {
    WORKSPACE_CONTEXT_RUNTIME_BINDING_ID,
    createWorkspaceContextRuntimeBinding
} from '../../lib/editor-shell/workspace-context-runtime';
import {WORKSPACE_DOCK_RUNTIME_MODEL_ID, DockRuntimeModel} from '../../lib/editor-shell/dock-runtime-model';
import {
    WORKSPACE_DOCK_ORGANIZATION_MODEL_ID,
    DockOrganizationModel
} from '../../lib/editor-shell/dock-organization-model';
import {
    WORKSPACE_DOCK_PLACEMENT_MODEL_ID,
    DockPlacementModel
} from '../../lib/editor-shell/dock-placement-model';
import {
    WORKSPACE_DOCK_INTERACTION_CONTROLLER_ID,
    DockInteractionController
} from '../../lib/editor-shell/dock-interaction-controller';
import {WORKSPACE_LAUNCHPAD_MODEL_ID, LaunchpadModel} from '../../lib/editor-shell/launchpad-model';
import {
    WORKSPACE_DOCK_TRANSITION_MODEL_ID,
    DockTransitionModel
} from '../../lib/editor-shell/dock-transition-model';
import {
    WORKSPACE_PERSISTENCE_HOST_ID,
    WorkspacePersistenceHost,
    WorkspaceStorageAdapter,
    createWorkspacePersistenceBootstrap,
    setActiveWorkspacePersistenceHost
} from '../../lib/editor-shell/workspace-persistence';
import computedStyleToInlineStyle from 'computed-style-to-inline-style';

import Blocks from '../../containers/blocks.jsx';
import CostumeTab from '../../containers/costume-tab.jsx';
import TargetPane from '../../containers/target-pane.jsx';
import SoundTab from '../../containers/sound-tab.jsx';
import StageWrapper from '../../containers/stage-wrapper.jsx';
import Loader from '../loader/loader.jsx';
import Box from '../box/box.jsx';
import MenuBar from '../menu-bar/menu-bar.jsx';
import SceneSelector from '../scene-selector/scene-selector.jsx';
import CostumeLibrary from '../../containers/costume-library.jsx';
import BackdropLibrary from '../../containers/backdrop-library.jsx';
import Watermark from '../../containers/watermark.jsx';
import ProjectExplorer from '../project-explorer/project-explorer.jsx';
import ProjectInspector from '../project-inspector/project-inspector.jsx';
import ProjectAssetManager from '../project-assets/project-asset-manager.jsx';
import WorkspaceDock from '../workspace-dock/workspace-dock.jsx';
import WorkspaceExtensionManager from '../workspace-extension-manager/workspace-extension-manager.jsx';
import WorkspaceAgent from '../workspace-agent/workspace-agent.jsx';
import WorkspaceTodo from '../workspace-todo/workspace-todo.jsx';
import WorkspacePaint from '../workspace-paint/workspace-paint.jsx';
import WorkspaceWindowTransitionLayer from '../workspace-window-transition/workspace-window-transition.jsx';

import Backpack from '../../containers/backpack.jsx';
import BrowserModal from '../browser-modal/browser-modal.jsx';
import TipsLibrary from '../../containers/tips-library.jsx';
import Cards from '../../containers/cards.jsx';
import Alerts from '../../containers/alerts.jsx';
import DragLayer from '../../containers/drag-layer.jsx';
import ConnectionModal from '../../containers/connection-modal.jsx';
import TelemetryModal from '../telemetry-modal/telemetry-modal.jsx';
import TWUsernameModal from '../../containers/tw-username-modal.jsx';
import TWSettingsModal, {TW02EngineSettingsModal} from '../../containers/tw-settings-modal.jsx';
import TWSecurityManager from '../../containers/tw-security-manager.jsx';
import TWCustomExtensionModal from '../../containers/tw-custom-extension-modal.jsx';
import TWCCWExtensionModal from '../../containers/tw-ccw-extension-modal.jsx';
import TWExtensionImportModal from '../../containers/tw-extension-import-modal.jsx';
import TWRestorePointManager from '../../containers/tw-restore-point-manager.jsx';
import TWFontsModal from '../../containers/tw-fonts-modal.jsx';
import TWUnknownPlatformModal from '../../containers/tw-unknown-platform-modal.jsx';
import TWInvalidProjectModal from '../../containers/tw-invalid-project-modal.jsx';
import TWGitModal from '../../containers/tw-git-modal.jsx';
import TWToolboxLayoutModal from '../../containers/tw-toolbox-layout-modal.jsx';
import SpriteLayerModal from '../../containers/sprite-layer-modal.jsx';
import CollaborationContainer from '../../containers/collaboration-container.jsx';
import DebugWindow from '../../containers/debug-window.jsx';

import {STAGE_SIZE_MODES, FIXED_WIDTH, UNCONSTRAINED_NON_STAGE_WIDTH} from '../../lib/layout-constants';
import {resolveStageSize} from '../../lib/screen-utils';
import getCostumeUrl from '../../lib/get-costume-url';
import {Theme} from '../../lib/themes';
import {getGlobalAssetDatabase, installGlobalAssetDatabase} from '../../lib/project-assets/global-asset-database';
import {installProjectLifecycleHost} from '../../lib/project-lifecycle';
import {BLOCKS_TAB_INDEX, COSTUMES_TAB_INDEX, SOUNDS_TAB_INDEX} from '../../reducers/editor-tab';
import {
    setProjectExplorerNodeExpanded,
    setProjectExplorerSelectedNode,
    setProjectExplorerVisible,
    setProjectExplorerWidth
} from '../../reducers/project-explorer';
import {
    setProjectInspectorSectionExpanded,
    setProjectInspectorVisible,
    setProjectInspectorWidth
} from '../../reducers/project-inspector';
import {
    EDITOR_BACKGROUND_TARGETS,
    getEditorBackgroundStyle,
    hasEditorBackgroundTarget
} from '../../lib/editor-background';

import {isRendererSupported, isBrowserSupported} from '../../lib/tw-environment-support-prober';

import styles from './gui.css';
import workspaceStyles from '../workspace-shell/workspace-shell.css';
import addExtensionIcon from './icon--extensions.svg';
import codeIcon from '!../../lib/tw-recolor/build!./icon--code.svg';
import costumesIcon from '!../../lib/tw-recolor/build!./icon--costumes.svg';
import soundsIcon from '!../../lib/tw-recolor/build!./icon--sounds.svg';

const NodeExplorerLauncherIcon = () => (
    <svg aria-hidden="true" viewBox="0 0 20 20">
        <circle cx="5" cy="5" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="15" cy="5" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="10" cy="15" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6.8 6.2L8.9 12.9M13.2 6.2L11.1 12.9M7 5h6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

const InspectorLauncherIcon = () => (
    <svg aria-hidden="true" viewBox="0 0 20 20">
        <path d="M4 5h12M4 10h12M4 15h12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="5" r="1.7" fill="currentColor" />
        <circle cx="13" cy="10" r="1.7" fill="currentColor" />
        <circle cx="7" cy="15" r="1.7" fill="currentColor" />
    </svg>
);

const AssetLauncherIcon = () => (
    <svg aria-hidden="true" viewBox="0 0 20 20">
        <path d="M3.5 5.5h5l1.5 2h6.5v8.5h-13z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M3.5 7.5h13" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
);

const LegacySpritesWindowIcon = () => (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="22" height="22">
        <rect x="3" y="4" width="14" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="8" cy="9" r="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5.5 14c.5-1.8 1.5-2.7 2.5-2.7s2 .9 2.5 2.7M12 8.5h3M12 11.5h3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
);

const messages = defineMessages({
    addExtension: {
        id: 'gui.gui.addExtension',
        description: 'Button to add an extension in the target pane',
        defaultMessage: 'Add Extension'
    },
    stageTargetName: {
        id: 'tw.gui.stageTargetName',
        description: 'Display name for the stage target in newUI editor windows',
        defaultMessage: 'Stage'
    },
    editorWindowLock: {
        id: 'tw.gui.editorWindowLock',
        description: 'Tooltip for the lock button in a newUI editor window',
        defaultMessage: 'Lock window: switching targets opens a new editor'
    },
    editorWindowUnlock: {
        id: 'tw.gui.editorWindowUnlock',
        description: 'Tooltip for the unlock button in a newUI editor window',
        defaultMessage: 'Unlock window: switching targets reuses this editor'
    },
    editorWindowPreviewHint: {
        id: 'tw.gui.editorWindowPreviewHint',
        description: 'Hint shown inside inactive editor windows in newUI',
        defaultMessage: 'Click this window to activate the editor'
    },
    editorWindowNoPreview: {
        id: 'tw.gui.editorWindowNoPreview',
        description: 'Fallback text for targets without a current costume preview',
        defaultMessage: 'No current costume preview'
    }
});

const WORKSPACE_TOOL_REGISTRY = createCoreToolRegistry();
const WORKSPACE_TOOL_ECOSYSTEM_REGISTRY = createCoreToolEcosystemRegistry(WORKSPACE_TOOL_REGISTRY);
const NODE_EXPLORER_TOOL = WORKSPACE_TOOL_REGISTRY.require(TOOL_IDS.NODE_EXPLORER);
const INSPECTOR_TOOL = WORKSPACE_TOOL_REGISTRY.require(TOOL_IDS.INSPECTOR);
const ASSETS_TOOL = WORKSPACE_TOOL_REGISTRY.require(TOOL_IDS.ASSETS);
const STAGE_TOOL = WORKSPACE_TOOL_REGISTRY.require(TOOL_IDS.STAGE);
const LEGACY_SPRITES_TOOL = WORKSPACE_TOOL_REGISTRY.require(TOOL_IDS.LEGACY_SPRITES);
const EXTENSION_MANAGER_TOOL = WORKSPACE_TOOL_REGISTRY.require(TOOL_IDS.EXTENSION_MANAGER);
const AGENT_TOOL = WORKSPACE_TOOL_REGISTRY.require(TOOL_IDS.AGENT);
const TODO_TOOL = WORKSPACE_TOOL_REGISTRY.require(TOOL_IDS.TODO);
const PAINT_TOOL = WORKSPACE_TOOL_REGISTRY.require(TOOL_IDS.PAINT);
const TODO_ECOSYSTEM_MANIFEST = WORKSPACE_TOOL_ECOSYSTEM_REGISTRY.require(TOOL_IDS.TODO);
const EDITOR_TOOL = WORKSPACE_TOOL_REGISTRY.require(TOOL_IDS.EDITOR);
const NODE_EXPLORER_WINDOW = createWindowDescriptor(NODE_EXPLORER_TOOL);
const INSPECTOR_WINDOW = createWindowDescriptor(INSPECTOR_TOOL);
const ASSETS_WINDOW = createWindowDescriptor(ASSETS_TOOL);
const STAGE_WINDOW = createWindowDescriptor(STAGE_TOOL);
const LEGACY_SPRITES_WINDOW = createWindowDescriptor(LEGACY_SPRITES_TOOL);
const EXTENSION_MANAGER_WINDOW = createWindowDescriptor(EXTENSION_MANAGER_TOOL);
const AGENT_WINDOW = createWindowDescriptor(AGENT_TOOL);
const TODO_WINDOW = createWindowDescriptor(TODO_TOOL);
const PAINT_WINDOW = createWindowDescriptor(PAINT_TOOL);
const DEFAULT_DOCK_PINNED_TOOL_IDS = Object.freeze([
    TOOL_IDS.NODE_EXPLORER,
    TOOL_IDS.INSPECTOR,
    TOOL_IDS.ASSETS,
    TOOL_IDS.STAGE,
    TOOL_IDS.EDITOR
]);

const snapshotViewportRect = element => {
    if (!element || typeof element.getBoundingClientRect !== 'function') return null;
    const rect = element.getBoundingClientRect();
    if (![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) {
        return null;
    }
    return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
    };
};

const resolveDockTargetGeometry = toolId => {
    if (typeof document === 'undefined') return null;
    const targets = Array.from(document.querySelectorAll('[data-ngvge-dock-transition-targets]'));
    let containerFallback = null;
    for (const target of targets) {
        const ids = String(target.getAttribute('data-ngvge-dock-transition-targets') || '')
            .split(/\s+/)
            .filter(Boolean);
        if (!ids.includes(toolId)) continue;
        const geometry = snapshotViewportRect(target);
        if (!geometry) continue;
        if (ids.length === 1) return geometry;
        if (!containerFallback) containerFallback = geometry;
    }
    return containerFallback;
};

const TARGET_PANE_WINDOW_Z_INDEX = 470;
const STAGE_WINDOW_Z_INDEX = 475;
const FULLSCREEN_STAGE_Z_INDEX = 100000;
const EDITOR_WINDOW_DEFAULT_SIZE = EDITOR_TOOL.window.defaultSize;
const EDITOR_WINDOW_MIN_SIZE = EDITOR_TOOL.window.minSize;
const EDITOR_WINDOW_MAX_SIZE = EDITOR_TOOL.window.maxSize;
const EDITOR_WINDOW_INITIAL_MARGIN_X = 12;
const EDITOR_WINDOW_INITIAL_MARGIN_BOTTOM = 12;
const EDITOR_WINDOW_INITIAL_TOP_OFFSET = 40;
const EDITOR_WINDOW_INITIAL_CASCADE_X = 24;
const EDITOR_WINDOW_INITIAL_CASCADE_Y = 18;
const clampIndex = (value, length) => {
    if (!length) {
        return 0;
    }
    return Math.min(Math.max(value || 0, 0), length - 1);
};

const WindowLockIcon = props => (
    <svg
        aria-hidden="true"
        height="14"
        viewBox="0 0 16 16"
        width="14"
        {...props}
    >
        <path
            d="M5 7V5.8A3 3 0 0 1 8 2.9a3 3 0 0 1 3 2.9V7"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.4"
        />
        <rect
            fill="none"
            height="6.5"
            rx="1.4"
            stroke="currentColor"
            strokeWidth="1.4"
            width="8"
            x="4"
            y="7"
        />
        <circle cx="8" cy="10.2" fill="currentColor" r="1" />
    </svg>
);

const getFullscreenBackgroundColor = () => {
    const params = new URLSearchParams(location.search);
    if (params.has('fullscreen-background')) {
        return params.get('fullscreen-background');
    }
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return '#111';
    }
    return 'white';
};

const fullscreenBackgroundColor = getFullscreenBackgroundColor();

const SNAPSHOT_REFERENCE_ATTRIBUTE_NAMES = [
    'fill',
    'stroke',
    'filter',
    'mask',
    'clip-path',
    'marker-start',
    'marker-mid',
    'marker-end',
    'href',
    'xlink:href',
    'aria-labelledby',
    'aria-describedby',
    'for'
];

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const replaceSnapshotIdReferences = (value, idMap) => {
    if (typeof value !== 'string' || !value) {
        return value;
    }

    let nextValue = value;
    idMap.forEach((nextId, previousId) => {
        const escapedPreviousId = escapeRegExp(previousId);
        nextValue = nextValue.replace(new RegExp(`url\\(#${escapedPreviousId}\\)`, 'g'), `url(#${nextId})`);
        if (nextValue === `#${previousId}`) {
            nextValue = `#${nextId}`;
        }
    });

    return nextValue;
};

const sanitizeSnapshotDom = (snapshotRoot, snapshotNamespace) => {
    if (!snapshotRoot) {
        return;
    }

    snapshotRoot.setAttribute('data-editor-window-snapshot', 'true');
    snapshotRoot.setAttribute('aria-hidden', 'true');

    const idMap = new Map();
    snapshotRoot.querySelectorAll('[id]').forEach((element, index) => {
        const previousId = element.getAttribute('id');
        if (!previousId) {
            return;
        }
        const nextId = `${snapshotNamespace}-${index}-${previousId}`;
        idMap.set(previousId, nextId);
        element.setAttribute('id', nextId);
    });

    if (idMap.size) {
        [snapshotRoot].concat(Array.from(snapshotRoot.querySelectorAll('*'))).forEach(element => {
            SNAPSHOT_REFERENCE_ATTRIBUTE_NAMES.forEach(attributeName => {
                const attributeValue = element.getAttribute(attributeName);
                if (!attributeValue) {
                    return;
                }
                element.setAttribute(attributeName, replaceSnapshotIdReferences(attributeValue, idMap));
            });

            const inlineStyle = element.getAttribute('style');
            if (inlineStyle) {
                element.setAttribute('style', replaceSnapshotIdReferences(inlineStyle, idMap));
            }
        });
    }
};

const GUIComponent = props => {
    const {
        accountNavOpen,
        activeTabIndex,
        alertsVisible,
        authorId,
        authorThumbnailUrl,
        authorUsername,
        basePath,
        backdropLibraryVisible,
        backpackHost,
        backpackVisible,
        blocksId,
        blocksTabVisible,
        cardsVisible,
        canChangeLanguage,
        canChangeTheme,
        canCreateNew,
        canEditTitle,
        canManageFiles,
        canRemix,
        canSave,
        canCreateCopy,
        canShare,
        canUseCloud,
        children,
        connectionModalVisible,
        costumeLibraryVisible,
        costumesTabVisible,
        customStageSize,
        enableCommunity,
        intl,
        isCreating,
        isEmbedded,
        isFullScreen,
        isPlayerOnly,
        isRtl,
        isShared,
        isWindowFullScreen,
        isTelemetryEnabled,
        isTotallyNormal,
        loading,
        logo,
        renderLogin,
        onClickAbout,
        onClickAccountNav,
        onCloseAccountNav,
        onClickAddonSettings,
        onClickDesktopSettings,
        onClickNewWindow,
        onClickPackager,
        onLogOut,
        onOpenRegistration,
        onToggleLoginOpen,
        onActivateCostumesTab,
        onActivateSoundsTab,
        onActivateTab,
        onActivateWorkspacePaintBackend,
        onClickLogo,
        onExtensionButtonClick,
        onOpenCustomExtensionModal,
        onOpenExtensionImportMethodModal,
        onSetSelectedExtension,
        onProjectTelemetryEvent,
        onSetProjectExplorerNodeExpanded,
        onSetProjectExplorerSelectedNode,
        onSetProjectExplorerVisible,
        onSetProjectExplorerWidth,
        onSetProjectInspectorSectionExpanded,
        onSetProjectInspectorVisible,
        onSetProjectInspectorWidth,
        onRequestCloseBackdropLibrary,
        onRequestCloseCostumeLibrary,
        onRequestCloseTelemetryModal,
        onSeeCommunity,
        onShare,
        onShowPrivacyPolicy,
        onStartSelectingFileUpload,
        onTelemetryModalCancel,
        onTelemetryModalOptIn,
        onTelemetryModalOptOut,
        securityManager,
        showComingSoon,
        showOpenFilePicker,
        showSaveFilePicker,
        soundsTabVisible,
        stageSizeMode,
        targetIsStage,
        telemetryModalVisible,
        theme,
        tipsLibraryVisible,
        usernameModalVisible,
        settingsModalVisible,
        engineSettingsModalVisible,
        toolboxLayoutModalVisible,
        spriteLayerModalVisible,
        customExtensionModalVisible,
        ccwExtensionModalVisible,
        extensionImportMethodModalVisible,
        fontsModalVisible,
        unknownPlatformModalVisible,
        invalidProjectModalVisible,
    gitModalVisible,
    onRequestCloseGitModal,
    collaborationModalVisible,
    onRequestCloseCollaborationModal,
    vm,
        customUI,
        editorBackground,
        editingTargetId,
        projectExplorerExpandedNodeIds,
        projectExplorerSelectedNodeId,
        projectExplorerVisible,
        projectExplorerWidth,
        projectInspectorExpandedSectionIds,
        projectInspectorVisible,
        projectInspectorWidth,
        sprites,
        stage,
        ...componentProps
    } = omit(props, 'dispatch');

    const workspaceSurfaceRef = React.useRef(null);
    const workspaceStorageAdapterRef = React.useRef(null);
    if (!workspaceStorageAdapterRef.current) {
        workspaceStorageAdapterRef.current = new WorkspaceStorageAdapter();
    }
    const workspaceStorageAdapter = workspaceStorageAdapterRef.current;
    const workspacePersistenceBootstrapRef = React.useRef(null);
    if (!workspacePersistenceBootstrapRef.current) {
        workspacePersistenceBootstrapRef.current = createWorkspacePersistenceBootstrap({
            toolRegistry: WORKSPACE_TOOL_REGISTRY,
            storageAdapter: workspaceStorageAdapter,
            defaultPinnedToolIds: DEFAULT_DOCK_PINNED_TOOL_IDS
        });
    }
    const workspacePersistenceBootstrap = workspacePersistenceBootstrapRef.current;
    const persistedWindowById = React.useMemo(() => new Map(
        workspacePersistenceBootstrap.layout.windows.map(state => [state.windowId, state])
    ), [workspacePersistenceBootstrap]);
    const knownToolIds = React.useMemo(() => new Set(
        WORKSPACE_TOOL_REGISTRY.list().map(tool => tool.id)
    ), []);
    const persistedPinnedToolIds = workspacePersistenceBootstrap.layout.dock.pinnedToolIds
        .filter(toolId => knownToolIds.has(toolId));
    const persistedDockOrder = workspacePersistenceBootstrap.layout.dock.order
        .filter(toolId => knownToolIds.has(toolId));
    const windowManagerRef = React.useRef(null);
    if (!windowManagerRef.current) {
        const manager = new WindowManager({zIndexBase: 500});
        const registerStaticWindow = (descriptor, visible, initialZIndex) => {
            const persisted = persistedWindowById.get(descriptor.windowId);
            manager.registerWindow(descriptor, persisted || {visible}, {initialZIndex});
        };
        registerStaticWindow(NODE_EXPLORER_WINDOW, projectExplorerVisible, 465);
        registerStaticWindow(INSPECTOR_WINDOW, projectInspectorVisible, 466);
        registerStaticWindow(ASSETS_WINDOW, ASSETS_WINDOW.defaultVisible, 467);
        registerStaticWindow(EXTENSION_MANAGER_WINDOW, false, 468);
        registerStaticWindow(AGENT_WINDOW, false, 469);
        registerStaticWindow(TODO_WINDOW, false, 470);
        registerStaticWindow(PAINT_WINDOW, false, 471);
        registerStaticWindow(LEGACY_SPRITES_WINDOW, false, TARGET_PANE_WINDOW_Z_INDEX);
        registerStaticWindow(STAGE_WINDOW, true, STAGE_WINDOW_Z_INDEX);
        windowManagerRef.current = manager;
    }
    const windowManager = windowManagerRef.current;
    const workspaceContextServiceRef = React.useRef(null);
    if (!workspaceContextServiceRef.current) {
        workspaceContextServiceRef.current = new WorkspaceContextService();
    }
    const workspaceContextService = workspaceContextServiceRef.current;
    const workspaceToolPersistenceService = React.useMemo(
        () => createWorkspaceToolPersistenceService(),
        []
    );
    const workspaceToolCapabilityHostRef = React.useRef(null);
    if (!workspaceToolCapabilityHostRef.current) {
        workspaceToolCapabilityHostRef.current = createCoreWorkspaceToolCapabilityHost({
            toolRegistry: WORKSPACE_TOOL_REGISTRY,
            ecosystemRegistry: WORKSPACE_TOOL_ECOSYSTEM_REGISTRY
        });
    }
    const workspaceToolCapabilityHost = workspaceToolCapabilityHostRef.current;
    React.useEffect(() => () => workspaceToolCapabilityHost.dispose(), [workspaceToolCapabilityHost]);
    const getWorkspaceResourceDatabase = React.useCallback(() => (
        vm && vm.runtime ? (getGlobalAssetDatabase(vm.runtime) || installGlobalAssetDatabase(vm)) : null
    ), [vm]);
    const workspaceProjectCommandHostRef = React.useRef(null);
    if (!workspaceProjectCommandHostRef.current) {
        workspaceProjectCommandHostRef.current = createWorkspaceProjectCommandHost({
            contextService: workspaceContextService,
            getResourceDatabase: getWorkspaceResourceDatabase
        });
    }
    const workspaceProjectCommandHost = workspaceProjectCommandHostRef.current;
    React.useEffect(() => () => workspaceProjectCommandHost.dispose(), [workspaceProjectCommandHost]);
    const workspaceProjectTransactionReviewRef = React.useRef(null);
    if (!workspaceProjectTransactionReviewRef.current) {
        workspaceProjectTransactionReviewRef.current = createWorkspaceProjectTransactionReviewService({
            projectCommandHost: workspaceProjectCommandHost,
            contextService: workspaceContextService,
            getResourceDatabase: getWorkspaceResourceDatabase
        });
    }
    const workspaceProjectTransactionReview = workspaceProjectTransactionReviewRef.current;
    React.useEffect(() => () => workspaceProjectTransactionReview.dispose(), [workspaceProjectTransactionReview]);
    const workspacePrivilegedMutationReviewPolicyRef = React.useRef(null);
    if (!workspacePrivilegedMutationReviewPolicyRef.current) {
        workspacePrivilegedMutationReviewPolicyRef.current = createWorkspacePrivilegedMutationReviewPolicy({
            projectTransactionReviewService: workspaceProjectTransactionReview
        });
    }
    const workspacePrivilegedMutationReviewPolicy = workspacePrivilegedMutationReviewPolicyRef.current;
    React.useEffect(
        () => () => workspacePrivilegedMutationReviewPolicy.dispose(),
        [workspacePrivilegedMutationReviewPolicy]
    );
    const workspaceCapabilityProviderRegistryRef = React.useRef(null);
    if (!workspaceCapabilityProviderRegistryRef.current) {
        workspaceCapabilityProviderRegistryRef.current = createCoreWorkspaceCapabilityProviderRegistry({
            capabilityHost: workspaceToolCapabilityHost,
            contextService: workspaceContextService,
            workspaceToolPersistenceService,
            projectLifecycleHost: vm && vm.runtime ? installProjectLifecycleHost(vm) : null,
            projectCommandHost: workspaceProjectCommandHost,
            projectTransactionReviewService: workspaceProjectTransactionReview,
            privilegedMutationReviewPolicy: workspacePrivilegedMutationReviewPolicy,
            getResourceDatabase: getWorkspaceResourceDatabase
        });
    }
    const workspaceCapabilityProviderRegistry = workspaceCapabilityProviderRegistryRef.current;
    React.useEffect(() => () => workspaceCapabilityProviderRegistry.dispose(), [workspaceCapabilityProviderRegistry]);
    const workspaceContextRuntimeBindingRef = React.useRef(null);
    if (!workspaceContextRuntimeBindingRef.current) {
        workspaceContextRuntimeBindingRef.current = createWorkspaceContextRuntimeBinding({
            contextService: workspaceContextService,
            vm,
            windowManager
        });
    }
    const workspaceContextRuntimeBinding = workspaceContextRuntimeBindingRef.current;
    React.useEffect(() => () => workspaceContextRuntimeBinding.dispose(), [workspaceContextRuntimeBinding]);
    const [workspaceContextRevision, setWorkspaceContextRevision] = React.useState(workspaceContextService.revision);
    React.useEffect(() => workspaceContextService.subscribe(event => {
        setWorkspaceContextRevision(event.revision);
    }), [workspaceContextService]);
    const handleWorkspaceNodeSelectionContextChange = React.useCallback((selectedNodeIds, primaryNodeId) => {
        workspaceContextRuntimeBinding.setNodeSelection(selectedNodeIds, primaryNodeId);
    }, [workspaceContextRuntimeBinding]);
    const handleWorkspaceResourceSelectionContextChange = React.useCallback(resourceId => {
        workspaceContextRuntimeBinding.setResourceSelection(resourceId);
    }, [workspaceContextRuntimeBinding]);
    React.useEffect(() => {
        if (projectExplorerSelectedNodeId) {
            workspaceContextRuntimeBinding.setNodeSelection(
                [projectExplorerSelectedNodeId],
                projectExplorerSelectedNodeId
            );
        } else {
            workspaceContextRuntimeBinding.clearNodeSelection();
        }
    }, [projectExplorerSelectedNodeId, workspaceContextRuntimeBinding]);
    const dockRuntimeModelRef = React.useRef(null);
    if (!dockRuntimeModelRef.current) {
        dockRuntimeModelRef.current = new DockRuntimeModel({
            toolRegistry: WORKSPACE_TOOL_REGISTRY,
            windowManager,
            pinnedToolIds: persistedPinnedToolIds,
            order: persistedDockOrder
        });
    }
    const dockRuntimeModel = dockRuntimeModelRef.current;
    const dockOrganizationModelRef = React.useRef(null);
    if (!dockOrganizationModelRef.current) {
        dockOrganizationModelRef.current = new DockOrganizationModel({
            toolRegistry: WORKSPACE_TOOL_REGISTRY,
            dockRuntimeModel,
            preference: workspacePersistenceBootstrap.layout.dock.organization
        });
    }
    const dockOrganizationModel = dockOrganizationModelRef.current;
    const dockPlacementModelRef = React.useRef(null);
    if (!dockPlacementModelRef.current) {
        dockPlacementModelRef.current = new DockPlacementModel({
            preference: workspacePersistenceBootstrap.layout.dock.placement
        });
    }
    const dockPlacementModel = dockPlacementModelRef.current;
    const workspacePersistenceHostRef = React.useRef(null);
    if (!workspacePersistenceHostRef.current) {
        workspacePersistenceHostRef.current = new WorkspacePersistenceHost({
            toolRegistry: WORKSPACE_TOOL_REGISTRY,
            windowManager,
            dockRuntimeModel,
            dockPlacementModel,
            dockOrganizationModel,
            bootstrap: workspacePersistenceBootstrap,
            storageAdapter: workspaceStorageAdapter,
            defaultPinnedToolIds: DEFAULT_DOCK_PINNED_TOOL_IDS
        });
    }
    const workspacePersistenceHost = workspacePersistenceHostRef.current;
    React.useEffect(() => {
        workspacePersistenceHost.start();
        setActiveWorkspacePersistenceHost(workspacePersistenceHost);
        return () => workspacePersistenceHost.dispose();
    }, [workspacePersistenceHost]);
    const launchpadModelRef = React.useRef(null);
    if (!launchpadModelRef.current) {
        launchpadModelRef.current = new LaunchpadModel({
            toolRegistry: WORKSPACE_TOOL_REGISTRY,
            windowManager,
            dockRuntimeModel
        });
    }
    const launchpadModel = launchpadModelRef.current;
    React.useEffect(() => () => launchpadModel.dispose(), [launchpadModel]);
    const dockTransitionModelRef = React.useRef(null);
    if (!dockTransitionModelRef.current) {
        dockTransitionModelRef.current = new DockTransitionModel({
            windowManager,
            getWorkspaceViewportGeometry: () => snapshotViewportRect(workspaceSurfaceRef.current),
            getDockTargetGeometry: resolveDockTargetGeometry
        });
    }
    const dockTransitionModel = dockTransitionModelRef.current;
    React.useEffect(() => () => dockTransitionModel.dispose(), [dockTransitionModel]);
    const [windowManagerRevision, setWindowManagerRevision] = React.useState(windowManager.revision);
    const [dockRuntimeRevision, setDockRuntimeRevision] = React.useState(dockRuntimeModel.revision);
    const [dockOrganizationRevision, setDockOrganizationRevision] = React.useState(dockOrganizationModel.revision);
    const [dockPlacementRevision, setDockPlacementRevision] = React.useState(dockPlacementModel.revision);
    const [workspacePersistenceRevision, setWorkspacePersistenceRevision] = React.useState(
        workspacePersistenceHost.revision
    );
    React.useEffect(() => windowManager.subscribe(event => {
        setWindowManagerRevision(event.revision);
    }), [windowManager]);
    React.useEffect(() => dockRuntimeModel.subscribe(event => {
        setDockRuntimeRevision(event.revision);
    }), [dockRuntimeModel]);
    React.useEffect(() => dockOrganizationModel.subscribe(event => {
        setDockOrganizationRevision(event.revision);
    }), [dockOrganizationModel]);
    React.useEffect(() => dockPlacementModel.subscribe(event => {
        setDockPlacementRevision(event.revision);
    }), [dockPlacementModel]);
    React.useEffect(() => workspacePersistenceHost.subscribe(event => {
        setWorkspacePersistenceRevision(event.revision);
    }), [workspacePersistenceHost]);
    const workspacePreferences = workspacePersistenceHost.getPreferences();
    const workspaceNodeCommandHost = React.useMemo(() => createWorkspaceNodeCommandHostForVM({
        selectionWriter: onSetProjectExplorerSelectedNode,
        vm
    }), [onSetProjectExplorerSelectedNode, vm]);
    const nodeExplorerCommandClient = React.useMemo(() => createWorkspaceNodeCommandClient(
        workspaceNodeCommandHost,
        TOOL_IDS.NODE_EXPLORER
    ), [workspaceNodeCommandHost]);
    const inspectorNodeCommandClient = React.useMemo(() => createWorkspaceNodeCommandClient(
        workspaceNodeCommandHost,
        TOOL_IDS.INSPECTOR
    ), [workspaceNodeCommandHost]);
    const agentContextConsumerRef = React.useRef(null);
    if (!agentContextConsumerRef.current) {
        agentContextConsumerRef.current = admitWorkspaceContextConsumer({
            capabilityHost: workspaceToolCapabilityHost,
            providerRegistry: workspaceCapabilityProviderRegistry,
            toolId: TOOL_IDS.AGENT
        });
    }
    const agentContextConsumer = agentContextConsumerRef.current;
    React.useEffect(() => () => agentContextConsumer.dispose(), [agentContextConsumer]);
    const agentRuntime = React.useMemo(() => createWorkspaceAgentRuntime({
        workspaceNodeCommandHost,
        contextReadCapability: agentContextConsumer.contextRead
    }), [agentContextConsumer, workspaceNodeCommandHost]);
    React.useEffect(() => () => agentRuntime.dispose(), [agentRuntime]);
    const agentModel = agentRuntime.model;
    const todoModel = React.useMemo(() => new TodoToolModel({
        persistenceService: workspaceToolPersistenceService
    }), [workspaceToolPersistenceService]);
    const paintSession = React.useMemo(() => createWorkspacePaintToolSession({
        capabilityHost: workspaceToolCapabilityHost,
        providerRegistry: workspaceCapabilityProviderRegistry
    }), [workspaceCapabilityProviderRegistry, workspaceToolCapabilityHost]);
    React.useEffect(() => () => paintSession.dispose(), [paintSession]);
    const extensionManagerModel = React.useMemo(
        () => createWorkspaceExtensionManagerModelForVM(vm),
        [vm]
    );
    React.useEffect(() => () => extensionManagerModel.dispose(), [extensionManagerModel]);
    React.useEffect(() => {
        if (!customUI) return;
        const toolPanels = workspacePersistenceBootstrap.layout.toolPanels;
        if (Number.isFinite(toolPanels.projectExplorerWidth)) {
            onSetProjectExplorerWidth(toolPanels.projectExplorerWidth);
        }
        if (Number.isFinite(toolPanels.projectInspectorWidth)) {
            onSetProjectInspectorWidth(toolPanels.projectInspectorWidth);
        }
    }, [
        customUI,
        onSetProjectExplorerWidth,
        onSetProjectInspectorWidth,
        workspacePersistenceBootstrap
    ]);

    const stageWindowState = windowManager.requireState(STAGE_WINDOW.windowId);
    const targetPaneWindowState = windowManager.requireState(LEGACY_SPRITES_WINDOW.windowId);
    const projectExplorerWindowState = windowManager.requireState(NODE_EXPLORER_WINDOW.windowId);
    const projectInspectorWindowState = windowManager.requireState(INSPECTOR_WINDOW.windowId);
    const assetManagerWindowState = windowManager.requireState(ASSETS_WINDOW.windowId);
    const extensionManagerWindowState = windowManager.requireState(EXTENSION_MANAGER_WINDOW.windowId);
    const agentWindowState = windowManager.requireState(AGENT_WINDOW.windowId);
    const todoWindowState = windowManager.requireState(TODO_WINDOW.windowId);
    const paintWindowState = windowManager.requireState(PAINT_WINDOW.windowId);
    const stageWindowPosition = stageWindowState.position;
    const stageWindowSize = stageWindowState.size;
    const stageWindowMinimized = stageWindowState.minimized;
    const targetPaneWindowPosition = targetPaneWindowState.position;
    const targetPaneWindowSize = targetPaneWindowState.size;
    const targetPaneWindowMinimized = targetPaneWindowState.minimized;
    const legacySpritesWindowVisible = targetPaneWindowState.visible;
    const projectExplorerWindowMinimized = projectExplorerWindowState.minimized;
    const projectInspectorWindowMinimized = projectInspectorWindowState.minimized;
    const assetManagerVisible = assetManagerWindowState.visible;
    const assetManagerWindowMinimized = assetManagerWindowState.minimized;
    const extensionManagerWindowVisible = extensionManagerWindowState.visible;
    const extensionManagerWindowMinimized = extensionManagerWindowState.minimized;
    const agentWindowVisible = agentWindowState.visible;
    const agentWindowMinimized = agentWindowState.minimized;
    const todoWindowVisible = todoWindowState.visible;
    const todoWindowMinimized = todoWindowState.minimized;
    const paintWindowVisible = paintWindowState.visible;
    const paintWindowMinimized = paintWindowState.minimized;
    const [stageWindowContentSize, setStageWindowContentSize] = React.useState({width: 0, height: 0});
    const [stageWindowAutoFit, setStageWindowAutoFit] = React.useState(() => {
        const options = workspacePersistenceBootstrap.layout.windowOptions[STAGE_WINDOW.windowId];
        return Boolean(options && options.autoFit);
    });
    const [menuBarCollapsed, setMenuBarCollapsed] = React.useState(false);
    const [debugWindowVisible, setDebugWindowVisible] = React.useState(false);
    const handleToggleDebugWindow = React.useCallback(() => {
        setDebugWindowVisible(prev => !prev);
    }, []);
    const handleOpenProjectExplorer = React.useCallback(() => {
        windowManager.open(NODE_EXPLORER_WINDOW.windowId);
        onSetProjectExplorerVisible(true);
    }, [onSetProjectExplorerVisible, windowManager]);
    const handleCloseProjectExplorer = React.useCallback(() => {
        windowManager.close(NODE_EXPLORER_WINDOW.windowId);
        onSetProjectExplorerVisible(false);
    }, [onSetProjectExplorerVisible, windowManager]);
    const handleOpenProjectInspector = React.useCallback(() => {
        windowManager.open(INSPECTOR_WINDOW.windowId);
        onSetProjectInspectorVisible(true);
    }, [onSetProjectInspectorVisible, windowManager]);
    const handleCloseProjectInspector = React.useCallback(() => {
        windowManager.close(INSPECTOR_WINDOW.windowId);
        onSetProjectInspectorVisible(false);
    }, [onSetProjectInspectorVisible, windowManager]);
    const handleOpenAssetManager = React.useCallback(() => {
        windowManager.open(ASSETS_WINDOW.windowId);
    }, [windowManager]);
    const handleCloseAssetManager = React.useCallback(() => {
        windowManager.close(ASSETS_WINDOW.windowId);
    }, [windowManager]);
    const handleOpenExtensionManager = React.useCallback(() => {
        windowManager.open(EXTENSION_MANAGER_WINDOW.windowId);
    }, [windowManager]);
    const handleCloseExtensionManager = React.useCallback(() => {
        windowManager.close(EXTENSION_MANAGER_WINDOW.windowId);
    }, [windowManager]);
    const handleOpenAgent = React.useCallback(() => {
        windowManager.open(AGENT_WINDOW.windowId);
    }, [windowManager]);
    const handleCloseAgent = React.useCallback(() => {
        windowManager.close(AGENT_WINDOW.windowId);
    }, [windowManager]);
    const handleOpenTodo = React.useCallback(() => {
        windowManager.open(TODO_WINDOW.windowId);
    }, [windowManager]);
    const handleCloseTodo = React.useCallback(() => {
        windowManager.close(TODO_WINDOW.windowId);
    }, [windowManager]);
    const handleOpenPaint = React.useCallback(() => {
        windowManager.open(PAINT_WINDOW.windowId);
    }, [windowManager]);
    const handleClosePaint = React.useCallback(() => {
        windowManager.close(PAINT_WINDOW.windowId);
    }, [windowManager]);
    const handleOpenLegacySprites = React.useCallback(() => {
        windowManager.open(LEGACY_SPRITES_WINDOW.windowId);
    }, [windowManager]);
    const handleCloseLegacySprites = React.useCallback(() => {
        windowManager.close(LEGACY_SPRITES_WINDOW.windowId);
    }, [windowManager]);
    const handleLegacySpritesMinimizeToggle = React.useCallback((id, minimized) => {
        if (minimized) windowManager.minimize(id);
        else windowManager.restore(id, {activate: false});
    }, [windowManager]);
    const handleRestoreLegacySprites = React.useCallback(() => {
        windowManager.restore(LEGACY_SPRITES_WINDOW.windowId);
    }, [windowManager]);

    const handleManagedWindowActivate = React.useCallback(windowId => {
        windowManager.activate(windowId);
    }, [windowManager]);
    const handleManagedWindowMinimizeToggle = React.useCallback((windowId, minimized) => {
        if (minimized) windowManager.minimize(windowId);
        else windowManager.restore(windowId, {activate: false});
    }, [windowManager]);
    const handleManagedWindowDragStop = React.useCallback((windowId, position) => {
        windowManager.move(windowId, position);
    }, [windowManager]);
    const handleManagedWindowResizeStop = React.useCallback((windowId, size) => {
        windowManager.resize(windowId, size);
        if (windowId === NODE_EXPLORER_WINDOW.windowId) {
            onSetProjectExplorerWidth(size.width);
            workspacePersistenceHost.setToolPanelSize('projectExplorerWidth', size.width);
        }
        if (windowId === INSPECTOR_WINDOW.windowId) {
            onSetProjectInspectorWidth(size.width);
            workspacePersistenceHost.setToolPanelSize('projectInspectorWidth', size.width);
        }
    }, [
        onSetProjectExplorerWidth,
        onSetProjectInspectorWidth,
        windowManager,
        workspacePersistenceHost
    ]);
    const handleManagedWindowFullScreenToggle = React.useCallback((windowId, currentlyFullScreen) => {
        if (currentlyFullScreen || windowManager.requireState(windowId).maximized) {
            windowManager.restoreMaximized(windowId);
            return;
        }
        windowManager.maximize(windowId, {
            position: {x: 50, y: 50},
            size: {
                width: Math.max(0, window.innerWidth - 100),
                height: Math.max(0, window.innerHeight - 100)
            }
        });
        windowManager.activate(windowId);
    }, [windowManager]);
    const assetDatabase = React.useMemo(() => (
        vm && vm.runtime ? (getGlobalAssetDatabase(vm.runtime) || installGlobalAssetDatabase(vm)) : null
    ), [vm]);
    const assetManagerTarget = vm && vm.runtime && editingTargetId ?
        vm.runtime.getTargetById(editingTargetId) : null;
    const [editorWindowSessions, setEditorWindowSessions] = React.useState([]);
    const [activeEditorWindowId, setActiveEditorWindowId] = React.useState(null);
    const editorWindowSessionsRef = React.useRef(editorWindowSessions);
    const activeEditorWindowIdRef = React.useRef(activeEditorWindowId);
    const editorWindowIdCounterRef = React.useRef(0);
    const lastRequestedEditingTargetIdRef = React.useRef(null);
    const pendingEditorWindowSyncRef = React.useRef(null);
    const previousCustomUIRef = React.useRef(customUI);
    const editorDesktopRef = React.useRef(null);
    const menuBarCollapsedRef = React.useRef(menuBarCollapsed);
    const activeEditorContentRef = React.useRef(null);
    const editorLayoutRefreshFrameRef = React.useRef(null);
    const addonEditorDomRefreshFrameRef = React.useRef(null);
    const snapshotNamespaceCounterRef = React.useRef(0);

    const handleStageWindowContentResize = React.useCallback((id, contentSize) => {
        setStageWindowContentSize(prevSize => {
            if (prevSize.width === contentSize.width && prevSize.height === contentSize.height) {
                return prevSize;
            }
            return contentSize;
        });
    }, []);

    const handleToggleStageWindowAutoFit = React.useCallback(() => {
        setStageWindowAutoFit(value => !value);
    }, []);

    React.useEffect(() => {
        if (customUI) {
            workspacePersistenceHost.setWindowOption(STAGE_WINDOW.windowId, {autoFit: stageWindowAutoFit});
            return;
        }
        const previous = windowStateStorage.getWindowState(STAGE_WINDOW.windowId) || {};
        windowStateStorage.saveWindowState(STAGE_WINDOW.windowId, {...previous, autoFit: stageWindowAutoFit});
    }, [customUI, stageWindowAutoFit, workspacePersistenceHost]);

    React.useEffect(() => {
        if (customUI) return;
        const previous = windowStateStorage.getWindowState(LEGACY_SPRITES_WINDOW.windowId) || {};
        windowStateStorage.saveWindowState(LEGACY_SPRITES_WINDOW.windowId, {
            ...previous,
            ...serializeLegacySpritesWindowState(targetPaneWindowState)
        });
    }, [customUI, targetPaneWindowState]);

    React.useEffect(() => {
        if (customUI) return;
        const managerState = windowManager.requireState(NODE_EXPLORER_WINDOW.windowId);
        if (projectExplorerVisible && !managerState.visible) {
            windowManager.open(NODE_EXPLORER_WINDOW.windowId, {activate: false});
        } else if (!projectExplorerVisible && managerState.visible) {
            windowManager.close(NODE_EXPLORER_WINDOW.windowId);
        }
    }, [customUI, projectExplorerVisible, windowManager]);

    React.useEffect(() => {
        if (customUI) return;
        const managerState = windowManager.requireState(INSPECTOR_WINDOW.windowId);
        if (projectInspectorVisible && !managerState.visible) {
            windowManager.open(INSPECTOR_WINDOW.windowId, {activate: false});
        } else if (!projectInspectorVisible && managerState.visible) {
            windowManager.close(INSPECTOR_WINDOW.windowId);
        }
    }, [customUI, projectInspectorVisible, windowManager]);

    const handleMenuBarCollapseChange = React.useCallback(collapsed => {
        menuBarCollapsedRef.current = collapsed;
        setMenuBarCollapsed(collapsed);
    }, []);

    React.useEffect(() => {
        menuBarCollapsedRef.current = menuBarCollapsed;
    }, [menuBarCollapsed]);

    const scheduleAddonEditorDomRefresh = React.useCallback(() => {
        if (addonEditorDomRefreshFrameRef.current !== null) {
            cancelAnimationFrame(addonEditorDomRefreshFrameRef.current);
        }
        const refreshAddons = () => {
            addonEditorDomRefreshFrameRef.current = null;
            refreshLegacyAddonDomAfterRemount();
        };
        if (typeof window.requestAnimationFrame === 'function') {
            addonEditorDomRefreshFrameRef.current = requestAnimationFrame(refreshAddons);
        } else {
            queueMicrotask(refreshAddons);
        }
    }, []);

    const setActiveEditorContentNode = React.useCallback(node => {
        const previousNode = activeEditorContentRef.current;
        if (previousNode && previousNode !== node) {
            previousNode.removeAttribute('data-sa-active-editor-root');
            if (window.__scratchGuiActiveEditorRoot === previousNode) {
                delete window.__scratchGuiActiveEditorRoot;
            }
        }

        activeEditorContentRef.current = node;

        if (node) {
            node.setAttribute('data-sa-active-editor-root', 'true');
            window.__scratchGuiActiveEditorRoot = node;
            if (previousNode !== node) {
                scheduleAddonEditorDomRefresh();
            }
        }
    }, [scheduleAddonEditorDomRefresh]);

    const syncWorkspaceGrid = React.useCallback(() => {
        const ScratchBlocks = window.ScratchBlocks;
        const workspace = ScratchBlocks && typeof ScratchBlocks.getMainWorkspace === 'function' ?
            ScratchBlocks.getMainWorkspace() :
            null;
        if (!workspace) {
            return;
        }

        const grid = typeof workspace.getGrid === 'function' ? workspace.getGrid() : workspace.grid_;
        if (!grid) {
            return;
        }

        try {
            if (typeof grid.update === 'function') {
                grid.update(workspace.scale || 1);
            }
            const metrics = typeof workspace.getMetrics === 'function' ? workspace.getMetrics() : null;
            const absoluteLeft = metrics && typeof metrics.absoluteLeft === 'number' ? metrics.absoluteLeft : 0;
            const absoluteTop = metrics && typeof metrics.absoluteTop === 'number' ? metrics.absoluteTop : 0;
            if (typeof grid.moveTo === 'function') {
                grid.moveTo((workspace.scrollX || 0) + absoluteLeft, (workspace.scrollY || 0) + absoluteTop);
            }
        } catch (error) {
            // Ignore transient grid sync errors during workspace remounts.
        }
    }, []);

    const scheduleEditorLayoutRefresh = React.useCallback(() => {
        if (editorLayoutRefreshFrameRef.current !== null) {
            cancelAnimationFrame(editorLayoutRefreshFrameRef.current);
        }
        editorLayoutRefreshFrameRef.current = requestAnimationFrame(() => {
            editorLayoutRefreshFrameRef.current = null;
            window.dispatchEvent(new Event('resize'));
            const ScratchBlocks = window.ScratchBlocks;
            if (ScratchBlocks && typeof ScratchBlocks.svgResize === 'function') {
                const workspace = typeof ScratchBlocks.getMainWorkspace === 'function' ?
                    ScratchBlocks.getMainWorkspace() :
                    null;
                if (workspace) {
                    try {
                        ScratchBlocks.svgResize(workspace);
                    } catch (error) {
                        // Ignore transient workspace resize errors during remounts.
                    }
                }
            }
            syncWorkspaceGrid();
        });
    }, [syncWorkspaceGrid]);

    React.useEffect(() => {
        editorWindowSessionsRef.current = editorWindowSessions;
    }, [editorWindowSessions]);

    React.useEffect(() => {
        activeEditorWindowIdRef.current = activeEditorWindowId;
    }, [activeEditorWindowId]);

    React.useEffect(() => () => {
        if (editorLayoutRefreshFrameRef.current !== null) {
            cancelAnimationFrame(editorLayoutRefreshFrameRef.current);
            editorLayoutRefreshFrameRef.current = null;
        }
        if (addonEditorDomRefreshFrameRef.current !== null) {
            cancelAnimationFrame(addonEditorDomRefreshFrameRef.current);
            addonEditorDomRefreshFrameRef.current = null;
        }
    }, []);

    const getTargetById = React.useCallback(targetId => {
        if (!targetId) {
            return null;
        }
        if (stage && stage.id === targetId) {
            return stage;
        }
        return sprites[targetId] || null;
    }, [sprites, stage]);

    const getTargetDisplayName = React.useCallback(targetId => {
        const target = getTargetById(targetId);
        if (!target) {
            return intl.formatMessage(messages.stageTargetName);
        }
        if (target.isStage) {
            return target.name || intl.formatMessage(messages.stageTargetName);
        }
        return target.name;
    }, [getTargetById, intl]);

    const commitEditorWindowState = React.useCallback((nextSessions, nextActiveId = activeEditorWindowIdRef.current) => {
        editorWindowSessionsRef.current = nextSessions;
        activeEditorWindowIdRef.current = nextActiveId;
        setEditorWindowSessions(nextSessions);
        setActiveEditorWindowId(nextActiveId);
    }, []);

    const getEditorFullScreenGeometry = React.useCallback(() => {
        const desktopRect = editorDesktopRef.current ?
            editorDesktopRef.current.getBoundingClientRect() :
            null;
        const width = desktopRect ? desktopRect.width : window.innerWidth;
        const height = desktopRect ? desktopRect.height : window.innerHeight;
        return {
            position: {
                x: 0,
                y: 0
            },
            size: {
                width: Math.max(0, Math.round(width)),
                height: Math.max(0, Math.round(height))
            }
        };
    }, []);

    const getInitialEditorWindowGeometry = React.useCallback(cascadeIndex => {
        const desktopRect = editorDesktopRef.current ?
            editorDesktopRef.current.getBoundingClientRect() :
            null;
        const desktopWidth = desktopRect ? desktopRect.width : window.innerWidth;
        const desktopHeight = desktopRect ? desktopRect.height : window.innerHeight;
        const position = {
            x: Math.max(0, EDITOR_WINDOW_INITIAL_MARGIN_X + (cascadeIndex * EDITOR_WINDOW_INITIAL_CASCADE_X)),
            y: Math.max(0, EDITOR_WINDOW_INITIAL_TOP_OFFSET + (cascadeIndex * EDITOR_WINDOW_INITIAL_CASCADE_Y))
        };
        const size = {
            width: Math.max(
                Math.min(EDITOR_WINDOW_DEFAULT_SIZE.width, Math.round(desktopWidth)),
                Math.round(desktopWidth - position.x - EDITOR_WINDOW_INITIAL_MARGIN_X)
            ),
            height: Math.max(
                Math.min(EDITOR_WINDOW_DEFAULT_SIZE.height, Math.round(desktopHeight)),
                Math.round(desktopHeight - position.y - EDITOR_WINDOW_INITIAL_MARGIN_BOTTOM)
            )
        };
        return {
            position,
            size
        };
    }, []);

    const createEditorWindowSession = React.useCallback((targetId, overrides = {}) => {
        const cascadeIndex = editorWindowSessionsRef.current.length % 6;
        const initialGeometry = getInitialEditorWindowGeometry(cascadeIndex);
        editorWindowIdCounterRef.current += 1;
        const windowDescriptor = createWindowDescriptor(EDITOR_TOOL, {
            instanceId: editorWindowIdCounterRef.current,
            defaultPosition: initialGeometry.position,
            defaultSize: initialGeometry.size
        });
        windowManager.registerWindow(windowDescriptor, {
            visible: true,
            position: initialGeometry.position,
            size: initialGeometry.size
        });
        return {
            id: windowDescriptor.windowId,
            toolId: windowDescriptor.toolId,
            targetId,
            locked: false,
            activeTabIndex: BLOCKS_TAB_INDEX,
            snapshotMarkup: null,
            snapshotSize: null,
            snapshotThemeId: null,
            ...overrides
        };
    }, [getInitialEditorWindowGeometry, windowManager]);

    const createEditorWindowSnapshot = React.useCallback(() => {
        const sourceNode = activeEditorContentRef.current;
        if (!sourceNode) {
            return null;
        }
        const width = sourceNode.clientWidth;
        const height = sourceNode.clientHeight;
        if (!width || !height) {
            return null;
        }

        const snapshotRoot = sourceNode.cloneNode(true);
        snapshotRoot.removeAttribute('data-sa-active-editor-root');
        snapshotRoot.querySelectorAll('[data-sa-active-editor-root]').forEach(element => {
            element.removeAttribute('data-sa-active-editor-root');
        });
        snapshotRoot.style.width = `${width}px`;
        snapshotRoot.style.height = `${height}px`;

        const originalCanvases = sourceNode.querySelectorAll('canvas');
        const clonedCanvases = snapshotRoot.querySelectorAll('canvas');
        clonedCanvases.forEach((clonedCanvas, index) => {
            const originalCanvas = originalCanvases[index];
            if (!originalCanvas || !clonedCanvas.parentNode) {
                return;
            }
            try {
                const image = document.createElement('img');
                image.src = originalCanvas.toDataURL();
                image.width = originalCanvas.width;
                image.height = originalCanvas.height;
                image.className = clonedCanvas.className;
                image.style.cssText = clonedCanvas.getAttribute('style') || '';
                image.setAttribute('draggable', 'false');
                clonedCanvas.parentNode.replaceChild(image, clonedCanvas);
            } catch (error) {
                // Ignore canvases that cannot be serialized.
            }
        });

        computedStyleToInlineStyle(snapshotRoot, {recursive: true});
        snapshotNamespaceCounterRef.current += 1;
        sanitizeSnapshotDom(snapshotRoot, `editor-snapshot-${snapshotNamespaceCounterRef.current}`);

        snapshotRoot.style.width = '100%';
        snapshotRoot.style.height = '100%';
        snapshotRoot.style.pointerEvents = 'none';

        return {
            snapshotMarkup: snapshotRoot.outerHTML,
            snapshotSize: {width, height},
            snapshotThemeId: theme.id
        };
    }, [theme.id]);

    const captureSessionSnapshot = React.useCallback((sessions, sessionId) => {
        if (!sessionId) {
            return sessions;
        }
        const snapshot = createEditorWindowSnapshot();
        if (!snapshot) {
            return sessions;
        }
        return sessions.map(session => {
            if (session.id !== sessionId) {
                return session;
            }
            return {
                ...session,
                snapshotMarkup: snapshot.snapshotMarkup,
                snapshotSize: snapshot.snapshotSize,
                snapshotThemeId: snapshot.snapshotThemeId
            };
        });
    }, [createEditorWindowSnapshot]);

    const syncFullScreenEditorWindowGeometry = React.useCallback(() => {
        const fullScreenGeometry = getEditorFullScreenGeometry();
        let activeEditorIsMaximized = false;
        editorWindowSessionsRef.current.forEach(session => {
            const state = windowManager.getState(session.id);
            if (!state || !state.maximized) return;
            windowManager.syncMaximizedGeometry(session.id, fullScreenGeometry);
            if (session.id === activeEditorWindowIdRef.current) activeEditorIsMaximized = true;
        });
        if (activeEditorIsMaximized) scheduleEditorLayoutRefresh();
    }, [getEditorFullScreenGeometry, scheduleEditorLayoutRefresh, windowManager]);

    React.useEffect(() => {
        if (!customUI || !activeEditorWindowId) {
            return;
        }
        scheduleEditorLayoutRefresh();
    }, [activeEditorWindowId, customUI, scheduleEditorLayoutRefresh, theme.id]);

    React.useLayoutEffect(() => {
        if (!customUI) {
            return;
        }
        menuBarCollapsedRef.current = menuBarCollapsed;
        syncFullScreenEditorWindowGeometry();
    }, [customUI, menuBarCollapsed, syncFullScreenEditorWindowGeometry]);

    React.useEffect(() => {
        if (!customUI) {
            return undefined;
        }

        let resizeFrame = null;
        const scheduleSync = () => {
            if (resizeFrame !== null) {
                cancelAnimationFrame(resizeFrame);
            }
            resizeFrame = requestAnimationFrame(() => {
                resizeFrame = null;
                syncFullScreenEditorWindowGeometry();
            });
        };

        let resizeObserver = null;
        if (typeof ResizeObserver !== 'undefined' && editorDesktopRef.current) {
            resizeObserver = new ResizeObserver(scheduleSync);
            resizeObserver.observe(editorDesktopRef.current);
        }
        window.addEventListener('resize', scheduleSync);
        scheduleSync();

        return () => {
            if (resizeFrame !== null) {
                cancelAnimationFrame(resizeFrame);
            }
            if (resizeObserver) {
                resizeObserver.disconnect();
            }
            window.removeEventListener('resize', scheduleSync);
        };
    }, [customUI, syncFullScreenEditorWindowGeometry]);

    const findEditorWindowFallback = React.useCallback((sessions, excludedId = null) => {
        const candidates = sessions
            .filter(session => session.id !== excludedId)
            .map(session => ({session, state: windowManager.getState(session.id)}))
            .filter(entry => entry.state && entry.state.visible);
        const visibleCandidates = candidates.filter(entry => !entry.state.minimized);
        const orderedCandidates = (visibleCandidates.length ? visibleCandidates : candidates)
            .slice()
            .sort((a, b) => b.state.lastFocusedAt - a.state.lastFocusedAt);
        return orderedCandidates.length ? orderedCandidates[0].session : null;
    }, [windowManager]);

    const syncEditorWindowContext = React.useCallback((session, {syncVm = true, syncTab = true} = {}) => {
        if (!session) {
            return;
        }
        if (syncVm && session.targetId) {
            const currentTargetId = vm.editingTarget ? vm.editingTarget.id : null;
            if (currentTargetId !== session.targetId) {
                lastRequestedEditingTargetIdRef.current = session.targetId;
                vm.setEditingTarget(session.targetId);
            }
        }
        if (syncTab && session.activeTabIndex !== activeTabIndex) {
            onActivateTab(session.activeTabIndex);
        }
    }, [activeTabIndex, onActivateTab, vm]);

    React.useLayoutEffect(() => {
        if (!customUI) {
            pendingEditorWindowSyncRef.current = null;
            return;
        }

        const pendingSync = pendingEditorWindowSyncRef.current;
        if (!pendingSync || pendingSync.windowId !== activeEditorWindowId) {
            return;
        }

        const activeSession = editorWindowSessions.find(session => session.id === pendingSync.windowId);
        if (!activeSession) {
            pendingEditorWindowSyncRef.current = null;
            return;
        }

        pendingEditorWindowSyncRef.current = null;
        syncEditorWindowContext(activeSession, {
            syncVm: pendingSync.syncVm,
            syncTab: pendingSync.syncTab
        });

        requestAnimationFrame(() => {
            if (activeEditorWindowIdRef.current === activeSession.id) {
                scheduleEditorLayoutRefresh();
                scheduleAddonEditorDomRefresh();
            }
        });
    }, [
        activeEditorWindowId,
        customUI,
        editorWindowSessions,
        scheduleAddonEditorDomRefresh,
        scheduleEditorLayoutRefresh,
        syncEditorWindowContext
    ]);

    const updateEditorWindowSession = React.useCallback((windowId, updater) => {
        let updatedSession = null;
        let hasChanges = false;
        const nextSessions = editorWindowSessionsRef.current.map(session => {
            if (session.id !== windowId) {
                return session;
            }
            const partialUpdate = updater(session);
            if (!partialUpdate) {
                updatedSession = session;
                return session;
            }
            const hasSessionChanges = Object.keys(partialUpdate)
                .some(key => session[key] !== partialUpdate[key]);
            if (!hasSessionChanges) {
                updatedSession = session;
                return session;
            }
            updatedSession = {
                ...session,
                ...partialUpdate
            };
            hasChanges = true;
            return updatedSession;
        });
        if (hasChanges) {
            commitEditorWindowState(nextSessions);
        }
        return updatedSession;
    }, [commitEditorWindowState]);

    const activateEditorWindow = React.useCallback((windowId, options = {}) => {
        const currentSessions = editorWindowSessionsRef.current;
        const sessionIndex = currentSessions.findIndex(session => session.id === windowId);
        if (sessionIndex === -1 || !windowManager.hasWindow(windowId)) return;
        const currentActiveId = activeEditorWindowIdRef.current;
        let nextSessions = currentSessions;
        if (currentActiveId && currentActiveId !== windowId) {
            nextSessions = captureSessionSnapshot(nextSessions, currentActiveId);
        }
        nextSessions = nextSessions.map((session, index) => (
            index === sessionIndex && typeof options.activeTabIndex === 'number' ? {
                ...session,
                activeTabIndex: options.activeTabIndex
            } : session
        ));
        windowManager.restore(windowId, {activate: false});
        windowManager.activate(windowId);
        commitEditorWindowState(nextSessions, windowId);
        pendingEditorWindowSyncRef.current = {
            windowId,
            syncVm: options.syncVm !== false,
            syncTab: options.syncTab !== false
        };
    }, [captureSessionSnapshot, commitEditorWindowState, windowManager]);

    const handleEditorTargetSelection = React.useCallback((targetId, options = {}) => {
        if (!targetId || !getTargetById(targetId)) return;

        const currentSessions = editorWindowSessionsRef.current.slice();
        const activeSession = currentSessions.find(session => session.id === activeEditorWindowIdRef.current) || null;
        const inheritedTabIndex = typeof options.activeTabIndex === 'number' ?
            options.activeTabIndex :
            (activeSession ? activeSession.activeTabIndex : BLOCKS_TAB_INDEX);

        let nextSessions = currentSessions;
        let nextActiveId = null;
        const existingSession = currentSessions.find(session => session.targetId === targetId);

        if (existingSession) {
            nextActiveId = existingSession.id;
        } else if (activeSession && !activeSession.locked) {
            nextActiveId = activeSession.id;
            nextSessions = currentSessions.map(session => (
                session.id === activeSession.id ? {
                    ...session,
                    targetId,
                    activeTabIndex: inheritedTabIndex
                } : session
            ));
        } else {
            const newSession = createEditorWindowSession(targetId, {activeTabIndex: inheritedTabIndex});
            nextSessions = currentSessions.concat(newSession);
            nextActiveId = newSession.id;
        }

        if (activeSession && activeSession.id !== nextActiveId) {
            nextSessions = captureSessionSnapshot(nextSessions, activeSession.id);
        }

        windowManager.restore(nextActiveId, {activate: false});
        windowManager.activate(nextActiveId);
        commitEditorWindowState(nextSessions, nextActiveId);
        pendingEditorWindowSyncRef.current = {
            windowId: nextActiveId,
            syncVm: options.syncVm !== false,
            syncTab: options.syncTab !== false
        };
    }, [captureSessionSnapshot, commitEditorWindowState, createEditorWindowSession, getTargetById, windowManager]);

    const handleProjectExplorerTargetSelection = React.useCallback(targetId => {
        if (!targetId || !getTargetById(targetId)) {
            return;
        }

        if (customUI) {
            handleEditorTargetSelection(targetId);
            return;
        }

        const currentTargetId = vm.editingTarget ? vm.editingTarget.id : null;
        if (currentTargetId !== targetId) {
            vm.setEditingTarget(targetId);
        }
    }, [customUI, getTargetById, handleEditorTargetSelection, vm]);

    const handleEditorWindowPositionChange = React.useCallback((windowId, position) => {
        windowManager.move(windowId, position);
    }, [windowManager]);

    const handleEditorWindowSizeChange = React.useCallback((windowId, size) => {
        windowManager.resize(windowId, size);
        if (windowId === activeEditorWindowIdRef.current) scheduleEditorLayoutRefresh();
    }, [scheduleEditorLayoutRefresh, windowManager]);

    const handleEditorWindowFullScreenToggle = React.useCallback((windowId, currentlyFullScreen) => {
        const state = windowManager.requireState(windowId);
        if (currentlyFullScreen || state.maximized) {
            windowManager.restoreMaximized(windowId);
        } else {
            windowManager.maximize(windowId, getEditorFullScreenGeometry());
            windowManager.activate(windowId);
        }
        if (windowId === activeEditorWindowIdRef.current) scheduleEditorLayoutRefresh();
    }, [getEditorFullScreenGeometry, scheduleEditorLayoutRefresh, windowManager]);

    const handleEditorWindowLockToggle = React.useCallback(windowId => {
        updateEditorWindowSession(windowId, session => ({
            locked: !session.locked
        }));
    }, [updateEditorWindowSession]);

    const restoreEditorWindow = React.useCallback(windowId => {
        windowManager.restore(windowId, {activate: false});
        activateEditorWindow(windowId);
    }, [activateEditorWindow, windowManager]);

    const handleEditorWindowMinimizeToggle = React.useCallback((windowId, minimized) => {
        if (minimized) windowManager.minimize(windowId);
        else windowManager.restore(windowId, {activate: false});
        let nextActiveId = activeEditorWindowIdRef.current;
        if (minimized && nextActiveId === windowId) {
            const fallbackSession = findEditorWindowFallback(editorWindowSessionsRef.current, windowId);
            nextActiveId = fallbackSession ? fallbackSession.id : null;
        }
        commitEditorWindowState(editorWindowSessionsRef.current, nextActiveId);
        if (nextActiveId) {
            windowManager.activate(nextActiveId);
            pendingEditorWindowSyncRef.current = {windowId: nextActiveId, syncVm: true, syncTab: true};
        } else {
            pendingEditorWindowSyncRef.current = null;
        }
    }, [commitEditorWindowState, findEditorWindowFallback, windowManager]);

    const handleEditorWindowClose = React.useCallback(windowId => {
        const nextSessions = editorWindowSessionsRef.current.filter(session => session.id !== windowId);
        let nextActiveId = activeEditorWindowIdRef.current;
        if (nextActiveId === windowId) {
            const fallbackSession = findEditorWindowFallback(nextSessions);
            nextActiveId = fallbackSession ? fallbackSession.id : null;
        }
        windowManager.unregisterWindow(windowId);
        commitEditorWindowState(nextSessions, nextActiveId);
        if (nextActiveId) {
            windowManager.activate(nextActiveId);
            pendingEditorWindowSyncRef.current = {windowId: nextActiveId, syncVm: true, syncTab: true};
        } else {
            pendingEditorWindowSyncRef.current = null;
        }
    }, [commitEditorWindowState, findEditorWindowFallback, windowManager]);

    const handleDockLaunchTool = React.useCallback(toolId => {
        switch (toolId) {
        case TOOL_IDS.NODE_EXPLORER:
            handleOpenProjectExplorer();
            return {windowId: NODE_EXPLORER_WINDOW.windowId};
        case TOOL_IDS.INSPECTOR:
            handleOpenProjectInspector();
            return {windowId: INSPECTOR_WINDOW.windowId};
        case TOOL_IDS.ASSETS:
            handleOpenAssetManager();
            return {windowId: ASSETS_WINDOW.windowId};
        case TOOL_IDS.STAGE:
            windowManager.open(STAGE_WINDOW.windowId);
            return {windowId: STAGE_WINDOW.windowId};
        case TOOL_IDS.LEGACY_SPRITES:
            handleOpenLegacySprites();
            return {windowId: LEGACY_SPRITES_WINDOW.windowId};
        case TOOL_IDS.EXTENSION_MANAGER:
            handleOpenExtensionManager();
            return {windowId: EXTENSION_MANAGER_WINDOW.windowId};
        case TOOL_IDS.AGENT:
            handleOpenAgent();
            return {windowId: AGENT_WINDOW.windowId};
        case TOOL_IDS.TODO:
            handleOpenTodo();
            return {windowId: TODO_WINDOW.windowId};
        case TOOL_IDS.PAINT:
            handleOpenPaint();
            return {windowId: PAINT_WINDOW.windowId};
        case TOOL_IDS.EDITOR: {
            const targetId = editingTargetId ||
                (vm && vm.editingTarget ? vm.editingTarget.id : null) ||
                (stage ? stage.id : null);
            if (targetId) handleEditorTargetSelection(targetId);
            return null;
        }
        default:
            throw new Error(`Dock launch is not registered for ToolId: ${toolId}`);
        }
    }, [
        editingTargetId,
        handleEditorTargetSelection,
        handleOpenAssetManager,
        handleOpenLegacySprites,
        handleOpenExtensionManager,
        handleOpenAgent,
        handleOpenTodo,
        handleOpenPaint,
        handleOpenProjectExplorer,
        handleOpenProjectInspector,
        stage,
        vm,
        windowManager
    ]);
    const dockInteractionController = React.useMemo(() => new DockInteractionController({
        toolRegistry: WORKSPACE_TOOL_REGISTRY,
        windowManager,
        dockRuntimeModel,
        launchTool: handleDockLaunchTool
    }), [dockRuntimeModel, handleDockLaunchTool, windowManager]);

    const handleActiveEditorTabSelect = React.useCallback(tabIndex => {
        onActivateTab(tabIndex);
        if (!customUI) {
            return;
        }
        const activeWindowId = activeEditorWindowIdRef.current;
        if (!activeWindowId) {
            return;
        }
        updateEditorWindowSession(activeWindowId, session => (
            session.activeTabIndex === tabIndex ? null : {activeTabIndex: tabIndex}
        ));
        scheduleEditorLayoutRefresh();
    }, [customUI, onActivateTab, scheduleEditorLayoutRefresh, updateEditorWindowSession]);

    const handleEditorWindowContentResize = React.useCallback(windowId => {
        if (windowId === activeEditorWindowIdRef.current) {
            scheduleEditorLayoutRefresh();
        }
    }, [scheduleEditorLayoutRefresh]);

    React.useEffect(() => {
        if (!customUI || !activeEditorWindowId) {
            return;
        }
        const activeSession = editorWindowSessionsRef.current.find(
            session => session.id === activeEditorWindowId
        );
        if (!activeSession || activeSession.activeTabIndex === activeTabIndex) {
            return;
        }
        updateEditorWindowSession(activeEditorWindowId, () => ({
            activeTabIndex
        }));
    }, [activeEditorWindowId, activeTabIndex, customUI, updateEditorWindowSession]);

    React.useEffect(() => {
        const wasCustomUI = previousCustomUIRef.current;
        previousCustomUIRef.current = customUI;
        if (customUI && !wasCustomUI && !editorWindowSessionsRef.current.length && editingTargetId) {
            handleEditorTargetSelection(editingTargetId, {
                activeTabIndex,
                syncVm: false
            });
        }
    }, [activeTabIndex, customUI, editingTargetId, handleEditorTargetSelection]);

    React.useEffect(() => {
        if (!customUI || !editingTargetId) {
            return;
        }
        if (lastRequestedEditingTargetIdRef.current === editingTargetId) {
            lastRequestedEditingTargetIdRef.current = null;
            return;
        }
        const activeSession = editorWindowSessionsRef.current.find(
            session => session.id === activeEditorWindowIdRef.current
        );
        if (activeSession && activeSession.targetId === editingTargetId) {
            return;
        }
        handleEditorTargetSelection(editingTargetId, {
            syncVm: false
        });
    }, [customUI, editingTargetId, handleEditorTargetSelection]);

    React.useEffect(() => {
        if (!customUI || !activeEditorWindowId) {
            return;
        }
        scheduleEditorLayoutRefresh();
    }, [activeEditorWindowId, activeTabIndex, customUI, scheduleEditorLayoutRefresh]);

    React.useEffect(() => {
        if (!customUI) {
            return;
        }
        const validTargetIds = new Set(Object.keys(sprites));
        if (stage && stage.id) {
            validTargetIds.add(stage.id);
        }
        const currentSessions = editorWindowSessionsRef.current;
        let nextSessions = currentSessions.filter(session => validTargetIds.has(session.targetId));
        if (nextSessions.length === currentSessions.length) return;
        currentSessions
            .filter(session => !validTargetIds.has(session.targetId))
            .forEach(session => windowManager.unregisterWindow(session.id));

        let nextActiveId = nextSessions.some(session => session.id === activeEditorWindowIdRef.current) ?
            activeEditorWindowIdRef.current :
            null;

        if (!nextActiveId) {
            const fallbackSession = findEditorWindowFallback(nextSessions);
            nextActiveId = fallbackSession ? fallbackSession.id : null;
        }

        if (!nextSessions.length && editingTargetId && validTargetIds.has(editingTargetId)) {
            const newSession = createEditorWindowSession(editingTargetId, {
                activeTabIndex
            });
            nextSessions = [newSession];
            nextActiveId = newSession.id;
        }

        commitEditorWindowState(nextSessions, nextActiveId);
        if (nextActiveId) {
            const nextActiveSession = nextSessions.find(session => session.id === nextActiveId);
            windowManager.activate(nextActiveId);
            syncEditorWindowContext(nextActiveSession, {
                syncVm: true,
                syncTab: true
            });
        }
    }, [
        activeTabIndex,
        commitEditorWindowState,
        createEditorWindowSession,
        customUI,
        editingTargetId,
        findEditorWindowFallback,
        sprites,
        stage,
        syncEditorWindowContext,
        windowManager
    ]);

    const renderEditorWindowTitle = React.useCallback(session => (
        <span className={styles.editorWindowTitleText}>
            {getTargetDisplayName(session.targetId)}
        </span>
    ), [getTargetDisplayName]);

    const renderEditorWindowHeaderActions = React.useCallback(session => (
        <button
            className={classNames(styles.editorWindowHeaderButton, {
                [styles.editorWindowHeaderButtonActive]: session.locked
            })}
            onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                handleEditorWindowLockToggle(session.id);
            }}
            onMouseDown={event => {
                event.preventDefault();
                event.stopPropagation();
            }}
            onTouchStart={event => {
                event.preventDefault();
                event.stopPropagation();
            }}
            title={intl.formatMessage(
                session.locked ? messages.editorWindowUnlock : messages.editorWindowLock
            )}
            type="button"
        >
            <WindowLockIcon />
        </button>
    ), [handleEditorWindowLockToggle, intl]);

    const activeEditorSession = customUI ?
        (editorWindowSessions.find(session => session.id === activeEditorWindowId) || null) :
        null;
    const activeEditorManagedState = activeEditorSession ? windowManager.getState(activeEditorSession.id) : null;
    const activeEditorSessionReady = !customUI || !activeEditorSession ||
        activeEditorSession.targetId === editingTargetId;
    const blocksLayoutToken = customUI && activeEditorSession ?
        [
            activeEditorSession.id,
            activeEditorSession.targetId || '',
            activeEditorSession.activeTabIndex,
            activeEditorManagedState && activeEditorManagedState.size.width,
            activeEditorManagedState && activeEditorManagedState.size.height,
            editingTargetId || ''
        ].join(':') :
        `legacy:${editingTargetId || ''}:${activeTabIndex}`;

    const renderEditorWrapper = stageSize => (
        <Box
            className={styles.editorWrapper}
            componentRef={setActiveEditorContentNode}
            data-sa-active-editor-root="true"
        >
            <Tabs
                forceRenderTabPanel
                className={tabClassNames.tabs}
                selectedIndex={activeTabIndex}
                selectedTabClassName={tabClassNames.tabSelected}
                selectedTabPanelClassName={tabClassNames.tabPanelSelected}
                onSelect={handleActiveEditorTabSelect}
            >
                <TabList className={tabClassNames.tabList}>
                    <Tab className={tabClassNames.tab}>
                        <img
                            draggable={false}
                            src={codeIcon()}
                        />
                        <FormattedMessage
                            defaultMessage="Code"
                            description="Button to get to the code panel"
                            id="gui.gui.codeTab"
                        />
                    </Tab>
                    <Tab className={tabClassNames.tab}>
                        <img
                            draggable={false}
                            src={costumesIcon()}
                        />
                        {targetIsStage ? (
                            <FormattedMessage
                                defaultMessage="Backdrops"
                                description="Button to get to the backdrops panel"
                                id="gui.gui.backdropsTab"
                            />
                        ) : (
                            <FormattedMessage
                                defaultMessage="Costumes"
                                description="Button to get to the costumes panel"
                                id="gui.gui.costumesTab"
                            />
                        )}
                    </Tab>
                    <Tab className={tabClassNames.tab}>
                        <img
                            draggable={false}
                            src={soundsIcon()}
                        />
                        <FormattedMessage
                            defaultMessage="Sounds"
                            description="Button to get to the sounds panel"
                            id="gui.gui.soundsTab"
                        />
                    </Tab>
                </TabList>
                <TabPanel className={tabClassNames.tabPanel}>
                    <Box className={styles.blocksWrapper}>
                        <Blocks
                            key={`${blocksId}/${theme.id}`}
                            canUseCloud={canUseCloud}
                            grow={1}
                            isVisible={blocksTabVisible}
                            options={{
                                media: `${basePath}static/${theme.getBlocksMediaFolder()}/`
                            }}
                            stageSize={stageSize}
                            onOpenCustomExtensionModal={onOpenCustomExtensionModal}
                            onOpenExtensionImportMethodModal={onOpenExtensionImportMethodModal}
                            onSetSelectedExtension={onSetSelectedExtension}
                            layoutToken={blocksLayoutToken}
                            theme={theme}
                            vm={vm}
                        />
                    </Box>
                    <Box className={styles.extensionButtonContainer}>
                        <button
                            className={styles.extensionButton}
                            title={intl.formatMessage(messages.addExtension)}
                            onClick={onExtensionButtonClick}
                        >
                            <img
                                className={styles.extensionButtonIcon}
                                draggable={false}
                                src={addExtensionIcon}
                            />
                        </button>
                    </Box>
                    <Box className={styles.watermark}>
                        <Watermark />
                    </Box>
                </TabPanel>
                <TabPanel className={tabClassNames.tabPanel}>
                    {costumesTabVisible ? (
                        <CostumeTab
                            assetDatabase={assetDatabase}
                            paintSession={paintSession}
                            vm={vm}
                            onPaintResourceSelectionContextChange={handleWorkspaceResourceSelectionContextChange}
                        />
                    ) : null}
                </TabPanel>
                <TabPanel className={tabClassNames.tabPanel}>
                    {soundsTabVisible ? <SoundTab vm={vm} /> : null}
                </TabPanel>
            </Tabs>
            {backpackVisible ? (
                <Backpack host={backpackHost} />
            ) : null}
        </Box>
    );

    const renderEditorWindowPreview = React.useCallback(session => {
        if (session.snapshotMarkup) {
            return (
                <Box className={styles.editorWindowSnapshot}>
                    <div
                        className={styles.editorWindowSnapshotContent}
                        dangerouslySetInnerHTML={{__html: session.snapshotMarkup}}
                    />
                </Box>
            );
        }

        const target = getTargetById(session.targetId);
        if (!target) {
            return (
                <Box className={styles.editorWindowPreview}>
                    <div className={styles.editorWindowPreviewTitle}>
                        {getTargetDisplayName(session.targetId)}
                    </div>
                    <div className={styles.editorWindowPreviewHint}>
                        {intl.formatMessage(messages.editorWindowNoPreview)}
                    </div>
                </Box>
            );
        }

        const costumes = target.costumes || [];
        const currentCostume = costumes[clampIndex(target.currentCostume, costumes.length)] || null;
        const costumeUrl = currentCostume && currentCostume.asset ? getCostumeUrl(currentCostume.asset) : null;

        return (
            <Box className={styles.editorWindowPreview}>
                <div className={styles.editorWindowPreviewTitle}>
                    {getTargetDisplayName(session.targetId)}
                </div>
                <div className={styles.editorWindowPreviewBody}>
                    <div className={styles.editorWindowPreviewImageFrame}>
                        {costumeUrl ? (
                            <img
                                alt={currentCostume.name}
                                className={styles.editorWindowPreviewImage}
                                draggable={false}
                                src={costumeUrl}
                            />
                        ) : (
                            <div className={styles.editorWindowPreviewEmpty}>
                                {intl.formatMessage(messages.editorWindowNoPreview)}
                            </div>
                        )}
                    </div>
                    <div className={styles.editorWindowPreviewMeta}>
                        <div className={styles.editorWindowPreviewSubtitle}>
                            {currentCostume ? currentCostume.name : intl.formatMessage(messages.editorWindowNoPreview)}
                        </div>
                        <div className={styles.editorWindowPreviewHint}>
                            {intl.formatMessage(messages.editorWindowPreviewHint)}
                        </div>
                    </div>
                </div>
            </Box>
        );
    }, [getTargetById, getTargetDisplayName, intl]);

    const renderEditorWindows = React.useCallback(stageSize => {
        const activeSession = editorWindowSessions.find(session => session.id === activeEditorWindowId) || null;
        const inactiveWindows = editorWindowSessions
            .filter(session => session.id !== activeEditorWindowId)
            .map(session => {
                const windowState = windowManager.requireState(session.id);
                return (
                    <DraggableWindow
                        key={session.id}
                        data-ngvge-tool-id={session.toolId || EDITOR_TOOL.id}
                        data-ngvge-window-model={WORKSPACE_WINDOW_MODEL_ID}
                        data-ngvge-window-active={windowState.active ? 'true' : 'false'}
                        allowMaximize
                        allowMinimize={false}
                        className={styles.editorDraggableWindow}
                        defaultPosition={windowState.position}
                        defaultSize={windowState.size}
                        enableStatePersistence={false}
                        headerActions={renderEditorWindowHeaderActions(session)}
                        isFullScreen={windowState.maximized}
                        isMinimized={windowState.minimized}
                        maxSize={EDITOR_WINDOW_MAX_SIZE}
                        minSize={EDITOR_WINDOW_MIN_SIZE}
                        onActivate={activateEditorWindow}
                        onClose={handleEditorWindowClose}
                        onDragStop={handleEditorWindowPositionChange}
                        onFullScreenToggle={handleEditorWindowFullScreenToggle}
                        onMinimizeToggle={handleEditorWindowMinimizeToggle}
                        onResizeStop={handleEditorWindowSizeChange}
                        position={windowState.position}
                        size={windowState.size}
                        title={renderEditorWindowTitle(session)}
                        windowId={session.id}
                        zIndex={windowState.zIndex}
                    >
                        {renderEditorWindowPreview(session)}
                    </DraggableWindow>
                );
            });

        if (!activeSession) return inactiveWindows;
        const activeWindowState = windowManager.requireState(activeSession.id);
        return inactiveWindows.concat(
            <DraggableWindow
                key={activeSession.id}
                data-ngvge-tool-id={activeSession.toolId || EDITOR_TOOL.id}
                data-ngvge-window-model={WORKSPACE_WINDOW_MODEL_ID}
                data-ngvge-window-active={activeWindowState.active ? 'true' : 'false'}
                allowMaximize
                allowMinimize={false}
                className={styles.editorDraggableWindow}
                defaultPosition={activeWindowState.position}
                defaultSize={activeWindowState.size}
                enableStatePersistence={false}
                headerActions={renderEditorWindowHeaderActions(activeSession)}
                isFullScreen={activeWindowState.maximized}
                isMinimized={activeWindowState.minimized}
                maxSize={EDITOR_WINDOW_MAX_SIZE}
                minSize={EDITOR_WINDOW_MIN_SIZE}
                onActivate={activateEditorWindow}
                onClose={handleEditorWindowClose}
                onContentResize={handleEditorWindowContentResize}
                onDragStop={handleEditorWindowPositionChange}
                onFullScreenToggle={handleEditorWindowFullScreenToggle}
                onMinimizeToggle={handleEditorWindowMinimizeToggle}
                onResizeStop={handleEditorWindowSizeChange}
                position={activeWindowState.position}
                size={activeWindowState.size}
                title={renderEditorWindowTitle(activeSession)}
                windowId={activeSession.id}
                zIndex={activeWindowState.zIndex}
            >
                <Box className={styles.editorWindowBody}>
                    {activeEditorSessionReady ? renderEditorWrapper(stageSize) : renderEditorWindowPreview(activeSession)}
                </Box>
            </DraggableWindow>
        );
    }, [
        activateEditorWindow,
        activeEditorSessionReady,
        activeEditorWindowId,
        editorWindowSessions,
        handleEditorWindowClose,
        handleEditorWindowContentResize,
        handleEditorWindowFullScreenToggle,
        handleEditorWindowMinimizeToggle,
        handleEditorWindowPositionChange,
        handleEditorWindowSizeChange,
        renderEditorWindowHeaderActions,
        renderEditorWindowPreview,
        renderEditorWindowTitle,
        renderEditorWrapper,
        windowManager,
        windowManagerRevision
    ]);

    if (children) {
        return <Box {...componentProps}>{children}</Box>;
    }

    // 全局最小化窗口栏数据
    const minimizedWindows = [];
    if (stageWindowMinimized) {
        minimizedWindows.push({
            windowId: STAGE_WINDOW.windowId,
            title: STAGE_WINDOW.title,
            icon: (
                <svg width="22" height="22" viewBox="0 0 20 20" fill="white">
                    <rect x="2" y="2" width="16" height="16" rx="2" stroke="white" strokeWidth="1" fill="none"/>
                    <rect x="6" y="6" width="8" height="8" fill="white"/>
                </svg>
            ),
            onRestore: () => windowManager.restore(STAGE_WINDOW.windowId)
        });
    }
    if (legacySpritesWindowVisible && targetPaneWindowMinimized) {
        minimizedWindows.push({
            windowId: LEGACY_SPRITES_WINDOW.windowId,
            title: LEGACY_SPRITES_WINDOW.title,
            icon: <LegacySpritesWindowIcon />,
            onRestore: handleRestoreLegacySprites
        });
    }
    if (projectExplorerVisible && projectExplorerWindowMinimized) {
        minimizedWindows.push({
            windowId: NODE_EXPLORER_WINDOW.windowId,
            title: NODE_EXPLORER_WINDOW.title,
            icon: (
                <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
                    <path d="M4 4h5v5H4zM11 4h5v5h-5zM4 11h5v5H4zM11 11h5v5h-5z" fill="white"/>
                </svg>
            ),
            onRestore: () => windowManager.restore(NODE_EXPLORER_WINDOW.windowId)
        });
    }
    if (projectInspectorVisible && projectInspectorWindowMinimized) {
        minimizedWindows.push({
            windowId: INSPECTOR_WINDOW.windowId,
            title: INSPECTOR_WINDOW.title,
            icon: (
                <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
                    <path d="M4 4h12v3H4zM4 9h12v3H4zM4 14h12v2H4z" fill="white"/>
                </svg>
            ),
            onRestore: () => windowManager.restore(INSPECTOR_WINDOW.windowId)
        });
    }
    if (assetManagerVisible && assetManagerWindowMinimized) {
        minimizedWindows.push({
            windowId: ASSETS_WINDOW.windowId,
            title: ASSETS_WINDOW.title,
            icon: (
                <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
                    <path d="M3 4h6l1.5 2H17v10H3z" fill="white"/>
                </svg>
            ),
            onRestore: () => windowManager.restore(ASSETS_WINDOW.windowId)
        });
    }
    editorWindowSessions
        .filter(session => {
            const state = windowManager.getState(session.id);
            return state && state.minimized;
        })
        .forEach(session => {
            const iconSource = session.activeTabIndex === COSTUMES_TAB_INDEX ?
                costumesIcon() :
                (session.activeTabIndex === SOUNDS_TAB_INDEX ? soundsIcon() : codeIcon());
            minimizedWindows.push({
                windowId: session.id,
                title: getTargetDisplayName(session.targetId),
                icon: (
                    <img
                        alt=""
                        draggable={false}
                        src={iconSource}
                        style={{height: 18, width: 18}}
                    />
                ),
                onRestore: () => restoreEditorWindow(session.id)
            });
        });

    const tabClassNames = {
        tabs: styles.tabs,
        tab: classNames(tabStyles.reactTabsTab, styles.tab),
        tabList: classNames(tabStyles.reactTabsTabList, styles.tabList),
        tabPanel: classNames(tabStyles.reactTabsTabPanel, styles.tabPanel),
        tabPanelSelected: classNames(tabStyles.reactTabsTabPanelSelected, styles.isSelected),
        tabSelected: classNames(tabStyles.reactTabsTabSelected, styles.isSelected)
    };
    const hideFloatingWindows = loading || isCreating;
    const windowBackgroundActive = customUI && hasEditorBackgroundTarget(
        editorBackground,
        EDITOR_BACKGROUND_TARGETS.WINDOW
    );
    const effectiveMenuBarCollapsed = customUI && menuBarCollapsed;
    const editorAlertsClassName = classNames(styles.alertsContainer, {
        [styles.alertsContainerHidden]: effectiveMenuBarCollapsed
    });

    const unconstrainedWidth = (
        UNCONSTRAINED_NON_STAGE_WIDTH +
        FIXED_WIDTH +
        Math.max(0, customStageSize.width - FIXED_WIDTH)
    );
    return (<MediaQuery minWidth={unconstrainedWidth}>{isUnconstrained => {
        const stageSize = resolveStageSize(stageSizeMode, isUnconstrained);

        const alwaysEnabledModals = (
            <React.Fragment>
                <TWSecurityManager securityManager={securityManager} />
                <TWRestorePointManager />
                {usernameModalVisible && <TWUsernameModal />}
                {settingsModalVisible && <TWSettingsModal />}
                {engineSettingsModalVisible && <TW02EngineSettingsModal />}
                {toolboxLayoutModalVisible && <TWToolboxLayoutModal media={`${basePath}static/${theme.getBlocksMediaFolder()}/`} />}
                {spriteLayerModalVisible && <SpriteLayerModal />}
                {customExtensionModalVisible && <TWCustomExtensionModal />}
                {ccwExtensionModalVisible && <TWCCWExtensionModal />}
                            {extensionImportMethodModalVisible && <TWExtensionImportModal vm={vm} />}
                            {fontsModalVisible && <TWFontsModal />}                {unknownPlatformModalVisible && <TWUnknownPlatformModal />}
                {invalidProjectModalVisible && <TWInvalidProjectModal />}
                {gitModalVisible && <TWGitModal onClose={onRequestCloseGitModal} />}
                <CollaborationContainer
                    vm={vm}
                    visible={collaborationModalVisible}
                    onRequestClose={onRequestCloseCollaborationModal}
                />
                <DebugWindow
                    visible={debugWindowVisible}
                    onToggleDebugWindow={handleToggleDebugWindow}
                />
            </React.Fragment>
        );

        return isPlayerOnly ? (
            <React.Fragment>
                {/* TW: When the window is fullscreen, use an element to display the background color */}
                {/* The default color for transparency is inconsistent between browsers and there isn't an existing */}
                {/* element for us to style that fills the entire screen. */}
                {isWindowFullScreen ? (
                    <div
                        className={styles.fullscreenBackground}
                        style={{
                            backgroundColor: fullscreenBackgroundColor
                        }}
                    />
                ) : null}
                <StageWrapper
                    isFullScreen={isFullScreen}
                    isEmbedded={isEmbedded}
                    isRendererSupported={isRendererSupported()}
                    isRtl={isRtl}
                    loading={loading}
                    stageSize={STAGE_SIZE_MODES.full}
                    vm={vm}
                >
                    {alertsVisible ? (
                        <Alerts className={styles.alertsContainer} />
                    ) : null}
                </StageWrapper>
                {alwaysEnabledModals}
            </React.Fragment>
        ) : (
            <Box
                className={styles.pageWrapper}
                dir={isRtl ? 'rtl' : 'ltr'}
                style={{
                    minWidth: 1024 + Math.max(0, customStageSize.width - 480) +
                        (!customUI && projectExplorerVisible ? projectExplorerWidth : 0),
                    minHeight: 640 + Math.max(0, customStageSize.height - 360)
                }}
                {...componentProps}
            >
                {alwaysEnabledModals}
                {telemetryModalVisible ? (
                    <TelemetryModal
                        isRtl={isRtl}
                        isTelemetryEnabled={isTelemetryEnabled}
                        onCancel={onTelemetryModalCancel}
                        onOptIn={onTelemetryModalOptIn}
                        onOptOut={onTelemetryModalOptOut}
                        onRequestClose={onRequestCloseTelemetryModal}
                        onShowPrivacyPolicy={onShowPrivacyPolicy}
                    />
                ) : null}
                {loading ? (
                    <Loader isFullScreen />
                ) : null}
                {isCreating ? (
                    <Loader
                        isFullScreen
                        messageId="gui.loader.creating"
                    />
                ) : null}
                {isBrowserSupported() ? null : (
                    <BrowserModal
                        isRtl={isRtl}
                        onClickDesktopSettings={onClickDesktopSettings}
                    />
                )}
                {tipsLibraryVisible ? (
                    <TipsLibrary />
                ) : null}
                {cardsVisible ? (
                    <Cards />
                ) : null}
                {alertsVisible ? (
                    <Alerts className={editorAlertsClassName} />
                ) : null}
                {connectionModalVisible ? (
                    <ConnectionModal
                        vm={vm}
                    />
                ) : null}
                {costumeLibraryVisible ? (
                    <CostumeLibrary
                        vm={vm}
                        onRequestClose={onRequestCloseCostumeLibrary}
                    />
                ) : null}
                {backdropLibraryVisible ? (
                    <BackdropLibrary
                        vm={vm}
                        onRequestClose={onRequestCloseBackdropLibrary}
                    />
                ) : null}
                {!customUI && !projectExplorerVisible && !isFullScreen ? (
                    <button
                        data-ngvge-tool-launcher={NODE_EXPLORER_TOOL.id}
                        className={classNames(styles.projectExplorerLauncher, {
                            [workspaceStyles.workspaceLauncher]: customUI
                        })}
                        title={`Open ${NODE_EXPLORER_TOOL.title}`}
                        type="button"
                        onClick={handleOpenProjectExplorer}
                    >
                        <span aria-hidden="true" className={classNames(styles.projectExplorerLauncherIcon, {
                                [workspaceStyles.workspaceLauncherIcon]: customUI
                            })}><NodeExplorerLauncherIcon /></span>
                        <span>{NODE_EXPLORER_TOOL.title}</span>
                    </button>
                ) : null}
                {!customUI && !projectInspectorVisible && !isFullScreen ? (
                    <button
                        data-ngvge-tool-launcher={INSPECTOR_TOOL.id}
                        className={classNames(styles.projectInspectorLauncher, {
                            [workspaceStyles.workspaceLauncher]: customUI
                        })}
                        title={`Open ${INSPECTOR_TOOL.title}`}
                        type="button"
                        onClick={handleOpenProjectInspector}
                    >
                        <span aria-hidden="true" className={classNames(styles.projectInspectorLauncherIcon, {
                                [workspaceStyles.workspaceLauncherIcon]: customUI
                            })}><InspectorLauncherIcon /></span>
                        <span>{INSPECTOR_TOOL.title}</span>
                    </button>
                ) : null}
                {!customUI && !assetManagerVisible && !projectExplorerVisible && !isFullScreen ? (
                    <button
                        data-ngvge-tool-launcher={ASSETS_TOOL.id}
                        className={classNames(styles.assetManagerLauncher, {
                            [workspaceStyles.workspaceLauncher]: customUI
                        })}
                        title={`Open ${ASSETS_TOOL.title}`}
                        type="button"
                        onClick={handleOpenAssetManager}
                    >
                        <span aria-hidden="true" className={classNames(styles.assetManagerLauncherIcon, {
                                [workspaceStyles.workspaceLauncherIcon]: customUI
                            })}><AssetLauncherIcon /></span>
                        <span>Assets</span>
                    </button>
                ) : null}
                <MenuBar
                    accountNavOpen={accountNavOpen}
                    authorId={authorId}
                    authorThumbnailUrl={authorThumbnailUrl}
                    authorUsername={authorUsername}
                    canChangeLanguage={canChangeLanguage}
                    canChangeTheme={canChangeTheme}
                    canCollapseMenuBar={customUI}
                    canCreateCopy={canCreateCopy}
                    canCreateNew={canCreateNew}
                    canEditTitle={canEditTitle}
                    canManageFiles={canManageFiles}
                    canRemix={canRemix}
                    canSave={canSave}
                    canShare={canShare}
                    className={classNames(styles.menuBarPosition, {
                        [styles.fullscreenMenuBar]: isFullScreen,
                        [styles['menu-bar-position-custom-ui']]: customUI,
                        [workspaceStyles.workspaceMenuBar]: customUI
                    })}
                    enableCommunity={enableCommunity}
                    isShared={isShared}
                    isTotallyNormal={isTotallyNormal}
                    logo={logo}
                    renderLogin={renderLogin}
                    sceneSelector={customUI && !isFullScreen ? (
                        <SceneSelector vm={vm} />
                    ) : null}
                    showComingSoon={showComingSoon}
                    showOpenFilePicker={showOpenFilePicker}
                    showSaveFilePicker={showSaveFilePicker}
                    onClickAbout={onClickAbout}
                    onClickAccountNav={onClickAccountNav}
                    onClickAddonSettings={onClickAddonSettings}
                    onClickDesktopSettings={onClickDesktopSettings}
                    onClickNewWindow={onClickNewWindow}
                    onClickPackager={onClickPackager}
                    onClickLogo={onClickLogo}
                    onCloseAccountNav={onCloseAccountNav}
                    onLogOut={onLogOut}
                    onMenuBarCollapseChange={handleMenuBarCollapseChange}
                    onOpenRegistration={onOpenRegistration}
                    onProjectTelemetryEvent={onProjectTelemetryEvent}
                    onSeeCommunity={onSeeCommunity}
                    onShare={onShare}
                    onStartSelectingFileUpload={onStartSelectingFileUpload}
                    onToggleLoginOpen={onToggleLoginOpen}
                />


                <Box
                    className={classNames(styles.bodyWrapper, {
                        [styles['body-wrapper-custom-ui']]: customUI,
                        [styles.bodyWrapperMenuCollapsed]: effectiveMenuBarCollapsed,
                        [workspaceStyles.workspaceShell]: customUI
                    })}
                    data-ngvge-workspace-shell={customUI ? WORKSPACE_SHELL_VISUAL_FOUNDATION_ID : undefined}
                    data-ngvge-workspace-visual-mode={customUI ? WORKSPACE_SHELL_VISUAL_MODE : undefined}
                    data-ngvge-workspace-accent-policy={customUI ? WORKSPACE_SHELL_ACCENT_POLICY : undefined}
                    data-ngvge-workspace-icon-policy={customUI ? WORKSPACE_SHELL_ICON_POLICY : undefined}
                    data-ngvge-workspace-window-chrome={customUI ? WORKSPACE_SHELL_WINDOW_CHROME : undefined}
                    data-ngvge-tool-registry={customUI ? WORKSPACE_TOOL_REGISTRY_ID : undefined}
                    data-ngvge-tool-ecosystem={customUI ? WORKSPACE_TOOL_ECOSYSTEM_REGISTRY.id : undefined}
                    data-ngvge-todo-ecosystem-lifecycle={customUI ? TODO_ECOSYSTEM_MANIFEST.lifecycle : undefined}
                    data-ngvge-window-model={customUI ? WORKSPACE_WINDOW_MODEL_ID : undefined}
                    data-ngvge-window-manager={customUI ? WORKSPACE_WINDOW_MANAGER_ID : undefined}
                    data-ngvge-window-manager-revision={customUI ? windowManagerRevision : undefined}
                    data-ngvge-workspace-context={customUI ? workspaceContextService.id : undefined}
                    data-ngvge-workspace-context-runtime-binding={customUI ? WORKSPACE_CONTEXT_RUNTIME_BINDING_ID : undefined}
                    data-ngvge-workspace-context-revision={customUI ? workspaceContextRevision : undefined}
                    data-ngvge-dock-runtime-model={customUI ? WORKSPACE_DOCK_RUNTIME_MODEL_ID : undefined}
                    data-ngvge-dock-runtime-revision={customUI ? dockRuntimeRevision : undefined}
                    data-ngvge-dock-interaction={customUI ? WORKSPACE_DOCK_INTERACTION_CONTROLLER_ID : undefined}
                    data-ngvge-dock-organization-model={customUI ? WORKSPACE_DOCK_ORGANIZATION_MODEL_ID : undefined}
                    data-ngvge-dock-organization-revision={customUI ? dockOrganizationRevision : undefined}
                    data-ngvge-dock-placement-model={customUI ? WORKSPACE_DOCK_PLACEMENT_MODEL_ID : undefined}
                    data-ngvge-dock-placement-revision={customUI ? dockPlacementRevision : undefined}
                    data-ngvge-launchpad-model={customUI ? WORKSPACE_LAUNCHPAD_MODEL_ID : undefined}
                    data-ngvge-dock-transition-model={customUI ? WORKSPACE_DOCK_TRANSITION_MODEL_ID : undefined}
                    data-ngvge-workspace-persistence-host={customUI ? WORKSPACE_PERSISTENCE_HOST_ID : undefined}
                    data-ngvge-workspace-persistence-revision={customUI ? workspacePersistenceRevision : undefined}
                    data-ngvge-extension-manager-model={customUI ? WORKSPACE_EXTENSION_MANAGER_MODEL_ID : undefined}
                    data-ngvge-active-window-id={customUI ? (windowManager.getActiveWindowId() || undefined) : undefined}
                >
                    <Box
                        className={styles.flexWrapper}
                        componentRef={workspaceSurfaceRef}
                    >
                        {windowBackgroundActive ? (
                            <div
                                className={styles.windowBackgroundLayer}
                                style={getEditorBackgroundStyle(editorBackground)}
                            />
                        ) : null}
                        {!customUI && projectExplorerVisible ? (
                            <ProjectExplorer
                                nodeCommandClient={nodeExplorerCommandClient}
                                editingTargetId={editingTargetId}
                                expandedNodeIds={projectExplorerExpandedNodeIds}
                                selectedNodeId={projectExplorerSelectedNodeId}
                                sprites={sprites}
                                stage={stage}
                                stageLabel={intl.formatMessage(messages.stageTargetName)}
                                vm={vm}
                                width={projectExplorerWidth}
                                onClose={handleCloseProjectExplorer}
                                onOpenAssetManager={handleOpenAssetManager}
                                onSelectNode={onSetProjectExplorerSelectedNode}
                                onSelectionContextChange={handleWorkspaceNodeSelectionContextChange}
                                onSelectTarget={handleProjectExplorerTargetSelection}
                                onToggleNode={onSetProjectExplorerNodeExpanded}
                            />
                        ) : null}
                        {!customUI ? renderEditorWrapper(stageSize) : null}
                        {!customUI && projectInspectorVisible ? (
                            <ProjectInspector
                                nodeCommandClient={inspectorNodeCommandClient}
                                editingTargetId={editingTargetId}
                                expandedSectionIds={projectInspectorExpandedSectionIds}
                                selectedNodeId={projectExplorerSelectedNodeId}
                                vm={vm}
                                width={projectInspectorWidth}
                                onClose={handleCloseProjectInspector}
                                onSelectNode={onSetProjectExplorerSelectedNode}
                                onSelectTarget={handleProjectExplorerTargetSelection}
                                onToggleSection={onSetProjectInspectorSectionExpanded}
                            />
                        ) : null}
                        {!customUI && !hideFloatingWindows && assetManagerVisible && !assetManagerWindowMinimized ? (
                            <DraggableWindow
                                windowId={ASSETS_WINDOW.windowId}
                                data-ngvge-command-scope={ASSETS_WINDOW.commandScope}
                                data-ngvge-tool-id={ASSETS_WINDOW.toolId}
                                data-ngvge-window-model={WORKSPACE_WINDOW_MODEL_ID}
                                title={ASSETS_WINDOW.title}
                                defaultPosition={{x: 190, y: 48}}
                                defaultSize={{width: 860, height: 560}}
                                minSize={{width: 800, height: 440}}
                                maxSize={{width: 1280, height: 940}}
                                onClose={handleCloseAssetManager}
                                onMinimizeToggle={handleManagedWindowMinimizeToggle}
                                zIndex={467}
                                enableStatePersistence={true}
                            >
                                <ProjectAssetManager
                                    assetDatabase={assetDatabase}
                                    currentTarget={assetManagerTarget}
                                    vm={vm}
                                    onSelectionContextChange={handleWorkspaceResourceSelectionContextChange}
                                    onSelectTarget={handleProjectExplorerTargetSelection}
                                />
                            </DraggableWindow>
                        ) : null}

                        {props.customUI ? (
                        <>
                            <Box
                                className={classNames(styles.editorDesktop, {
                                    [styles['editor-desktop-custom-ui']]: customUI
                                })}
                                componentRef={editorDesktopRef}
                            >
                                {!hideFloatingWindows && (
                                    editorWindowSessions.length ? renderEditorWindows(stageSize) : null
                                )}
                            </Box>
                            {!hideFloatingWindows && projectExplorerWindowState.visible && !projectExplorerWindowMinimized && (
                                <DraggableWindow
                                    windowId={NODE_EXPLORER_WINDOW.windowId}
                                    data-ngvge-command-scope={NODE_EXPLORER_WINDOW.commandScope}
                                    data-ngvge-tool-id={NODE_EXPLORER_WINDOW.toolId}
                                    data-ngvge-window-model={WORKSPACE_WINDOW_MODEL_ID}
                                    data-ngvge-window-active={projectExplorerWindowState.active ? 'true' : 'false'}
                                    title={NODE_EXPLORER_WINDOW.title}
                                    defaultPosition={NODE_EXPLORER_WINDOW.geometry.defaultPosition}
                                    defaultSize={{...NODE_EXPLORER_WINDOW.geometry.defaultSize, width: projectExplorerWidth}}
                                    minSize={NODE_EXPLORER_WINDOW.geometry.minSize}
                                    maxSize={NODE_EXPLORER_WINDOW.geometry.maxSize}
                                    allowMaximize={NODE_EXPLORER_WINDOW.capabilities.maximize}
                                    isFullScreen={projectExplorerWindowState.maximized}
                                    isMinimized={projectExplorerWindowState.minimized}
                                    position={projectExplorerWindowState.position}
                                    size={projectExplorerWindowState.size}
                                    onActivate={handleManagedWindowActivate}
                                    onClose={handleCloseProjectExplorer}
                                    onDragStop={handleManagedWindowDragStop}
                                    onMinimizeToggle={handleManagedWindowMinimizeToggle}
                                    onResizeStop={handleManagedWindowResizeStop}
                                    zIndex={projectExplorerWindowState.zIndex}
                                    enableStatePersistence={false}
                                >
                                    <ProjectExplorer
                                        nodeCommandClient={nodeExplorerCommandClient}
                                        editingTargetId={editingTargetId}
                                        expandedNodeIds={projectExplorerExpandedNodeIds}
                                        selectedNodeId={projectExplorerSelectedNodeId}
                                        showHeader={false}
                                        sprites={sprites}
                                        stage={stage}
                                        stageLabel={intl.formatMessage(messages.stageTargetName)}
                                        vm={vm}
                                        onOpenAssetManager={handleOpenAssetManager}
                                        onOpenLegacySprites={handleOpenLegacySprites}
                                        onSelectNode={onSetProjectExplorerSelectedNode}
                                        onSelectionContextChange={handleWorkspaceNodeSelectionContextChange}
                                        onSelectTarget={handleProjectExplorerTargetSelection}
                                        onToggleNode={onSetProjectExplorerNodeExpanded}
                                    />
                                </DraggableWindow>
                            )}
                            {!hideFloatingWindows && projectInspectorWindowState.visible && !projectInspectorWindowMinimized && (
                                <DraggableWindow
                                    windowId={INSPECTOR_WINDOW.windowId}
                                    data-ngvge-command-scope={INSPECTOR_WINDOW.commandScope}
                                    data-ngvge-tool-id={INSPECTOR_WINDOW.toolId}
                                    data-ngvge-window-model={WORKSPACE_WINDOW_MODEL_ID}
                                    data-ngvge-window-active={projectInspectorWindowState.active ? 'true' : 'false'}
                                    title={INSPECTOR_WINDOW.title}
                                    defaultPosition={INSPECTOR_WINDOW.geometry.defaultPosition}
                                    defaultSize={{...INSPECTOR_WINDOW.geometry.defaultSize, width: projectInspectorWidth}}
                                    minSize={INSPECTOR_WINDOW.geometry.minSize}
                                    maxSize={INSPECTOR_WINDOW.geometry.maxSize}
                                    allowMaximize={INSPECTOR_WINDOW.capabilities.maximize}
                                    isFullScreen={projectInspectorWindowState.maximized}
                                    isMinimized={projectInspectorWindowState.minimized}
                                    position={projectInspectorWindowState.position}
                                    size={projectInspectorWindowState.size}
                                    onActivate={handleManagedWindowActivate}
                                    onClose={handleCloseProjectInspector}
                                    onDragStop={handleManagedWindowDragStop}
                                    onMinimizeToggle={handleManagedWindowMinimizeToggle}
                                    onResizeStop={handleManagedWindowResizeStop}
                                    zIndex={projectInspectorWindowState.zIndex}
                                    enableStatePersistence={false}
                                >
                                    <ProjectInspector
                                        nodeCommandClient={inspectorNodeCommandClient}
                                        editingTargetId={editingTargetId}
                                        expandedSectionIds={projectInspectorExpandedSectionIds}
                                        selectedNodeId={projectExplorerSelectedNodeId}
                                        showHeader={false}
                                        vm={vm}
                                        onSelectNode={onSetProjectExplorerSelectedNode}
                                        onSelectTarget={handleProjectExplorerTargetSelection}
                                        onToggleSection={onSetProjectInspectorSectionExpanded}
                                    />
                                </DraggableWindow>
                            )}
                            {!hideFloatingWindows && assetManagerVisible && !assetManagerWindowMinimized && (
                                <DraggableWindow
                                    windowId={ASSETS_WINDOW.windowId}
                                    data-ngvge-command-scope={ASSETS_WINDOW.commandScope}
                                    data-ngvge-tool-id={ASSETS_WINDOW.toolId}
                                    data-ngvge-window-model={WORKSPACE_WINDOW_MODEL_ID}
                                    data-ngvge-window-active={assetManagerWindowState.active ? 'true' : 'false'}
                                    title={ASSETS_WINDOW.title}
                                    defaultPosition={ASSETS_WINDOW.geometry.defaultPosition}
                                    defaultSize={ASSETS_WINDOW.geometry.defaultSize}
                                    minSize={ASSETS_WINDOW.geometry.minSize}
                                    maxSize={ASSETS_WINDOW.geometry.maxSize}
                                    isFullScreen={assetManagerWindowState.maximized}
                                    isMinimized={assetManagerWindowState.minimized}
                                    position={assetManagerWindowState.position}
                                    size={assetManagerWindowState.size}
                                    onActivate={handleManagedWindowActivate}
                                    onClose={handleCloseAssetManager}
                                    onDragStop={handleManagedWindowDragStop}
                                    onFullScreenToggle={handleManagedWindowFullScreenToggle}
                                    onMinimizeToggle={handleManagedWindowMinimizeToggle}
                                    onResizeStop={handleManagedWindowResizeStop}
                                    zIndex={assetManagerWindowState.zIndex}
                                    enableStatePersistence={false}
                                >
                                    <ProjectAssetManager
                                        assetDatabase={assetDatabase}
                                        currentTarget={assetManagerTarget}
                                        vm={vm}
                                        onSelectionContextChange={handleWorkspaceResourceSelectionContextChange}
                                        onSelectTarget={handleProjectExplorerTargetSelection}
                                    />
                                </DraggableWindow>
                            )}
                            {!hideFloatingWindows && extensionManagerWindowVisible &&
                                !extensionManagerWindowMinimized && (
                                <DraggableWindow
                                    windowId={EXTENSION_MANAGER_WINDOW.windowId}
                                    data-ngvge-command-scope={EXTENSION_MANAGER_WINDOW.commandScope}
                                    data-ngvge-tool-id={EXTENSION_MANAGER_WINDOW.toolId}
                                    data-ngvge-window-model={WORKSPACE_WINDOW_MODEL_ID}
                                    data-ngvge-window-active={extensionManagerWindowState.active ? 'true' : 'false'}
                                    title={EXTENSION_MANAGER_WINDOW.title}
                                    defaultPosition={EXTENSION_MANAGER_WINDOW.geometry.defaultPosition}
                                    defaultSize={EXTENSION_MANAGER_WINDOW.geometry.defaultSize}
                                    minSize={EXTENSION_MANAGER_WINDOW.geometry.minSize}
                                    maxSize={EXTENSION_MANAGER_WINDOW.geometry.maxSize}
                                    isFullScreen={extensionManagerWindowState.maximized}
                                    isMinimized={extensionManagerWindowState.minimized}
                                    position={extensionManagerWindowState.position}
                                    size={extensionManagerWindowState.size}
                                    onActivate={handleManagedWindowActivate}
                                    onClose={handleCloseExtensionManager}
                                    onDragStop={handleManagedWindowDragStop}
                                    onFullScreenToggle={handleManagedWindowFullScreenToggle}
                                    onMinimizeToggle={handleManagedWindowMinimizeToggle}
                                    onResizeStop={handleManagedWindowResizeStop}
                                    zIndex={extensionManagerWindowState.zIndex}
                                    enableStatePersistence={false}
                                >
                                    <WorkspaceExtensionManager
                                        model={extensionManagerModel}
                                        onBrowseCatalog={onExtensionButtonClick}
                                    />
                                </DraggableWindow>
                            )}
                            {!hideFloatingWindows && agentWindowVisible && !agentWindowMinimized && (
                                <DraggableWindow
                                    windowId={AGENT_WINDOW.windowId}
                                    data-ngvge-command-scope={AGENT_WINDOW.commandScope}
                                    data-ngvge-tool-id={AGENT_WINDOW.toolId}
                                    data-ngvge-window-model={WORKSPACE_WINDOW_MODEL_ID}
                                    data-ngvge-window-active={agentWindowState.active ? 'true' : 'false'}
                                    title={AGENT_WINDOW.title}
                                    defaultPosition={AGENT_WINDOW.geometry.defaultPosition}
                                    defaultSize={AGENT_WINDOW.geometry.defaultSize}
                                    minSize={AGENT_WINDOW.geometry.minSize}
                                    maxSize={AGENT_WINDOW.geometry.maxSize}
                                    isFullScreen={agentWindowState.maximized}
                                    isMinimized={agentWindowState.minimized}
                                    position={agentWindowState.position}
                                    size={agentWindowState.size}
                                    onActivate={handleManagedWindowActivate}
                                    onClose={handleCloseAgent}
                                    onDragStop={handleManagedWindowDragStop}
                                    onFullScreenToggle={handleManagedWindowFullScreenToggle}
                                    onMinimizeToggle={handleManagedWindowMinimizeToggle}
                                    onResizeStop={handleManagedWindowResizeStop}
                                    zIndex={agentWindowState.zIndex}
                                    enableStatePersistence={false}
                                >
                                    <WorkspaceAgent model={agentModel} />
                                </DraggableWindow>
                            )}
                            {!hideFloatingWindows && todoWindowVisible && !todoWindowMinimized && (
                                <DraggableWindow
                                    windowId={TODO_WINDOW.windowId}
                                    data-ngvge-command-scope={TODO_WINDOW.commandScope}
                                    data-ngvge-tool-id={TODO_WINDOW.toolId}
                                    data-ngvge-window-model={WORKSPACE_WINDOW_MODEL_ID}
                                    data-ngvge-window-active={todoWindowState.active ? 'true' : 'false'}
                                    title={TODO_WINDOW.title}
                                    defaultPosition={TODO_WINDOW.geometry.defaultPosition}
                                    defaultSize={TODO_WINDOW.geometry.defaultSize}
                                    minSize={TODO_WINDOW.geometry.minSize}
                                    maxSize={TODO_WINDOW.geometry.maxSize}
                                    isFullScreen={todoWindowState.maximized}
                                    isMinimized={todoWindowState.minimized}
                                    position={todoWindowState.position}
                                    size={todoWindowState.size}
                                    onActivate={handleManagedWindowActivate}
                                    onClose={handleCloseTodo}
                                    onDragStop={handleManagedWindowDragStop}
                                    onFullScreenToggle={handleManagedWindowFullScreenToggle}
                                    onMinimizeToggle={handleManagedWindowMinimizeToggle}
                                    onResizeStop={handleManagedWindowResizeStop}
                                    zIndex={todoWindowState.zIndex}
                                    enableStatePersistence={false}
                                >
                                    <WorkspaceTodo model={todoModel} />
                                </DraggableWindow>
                            )}
                            {!hideFloatingWindows && paintWindowVisible && !paintWindowMinimized && (
                                <DraggableWindow
                                    windowId={PAINT_WINDOW.windowId}
                                    data-ngvge-command-scope={PAINT_WINDOW.commandScope}
                                    data-ngvge-tool-id={PAINT_WINDOW.toolId}
                                    data-ngvge-window-model={WORKSPACE_WINDOW_MODEL_ID}
                                    data-ngvge-window-active={paintWindowState.active ? 'true' : 'false'}
                                    title={PAINT_WINDOW.title}
                                    defaultPosition={PAINT_WINDOW.geometry.defaultPosition}
                                    defaultSize={PAINT_WINDOW.geometry.defaultSize}
                                    minSize={PAINT_WINDOW.geometry.minSize}
                                    maxSize={PAINT_WINDOW.geometry.maxSize}
                                    isFullScreen={paintWindowState.maximized}
                                    isMinimized={paintWindowState.minimized}
                                    position={paintWindowState.position}
                                    size={paintWindowState.size}
                                    onActivate={handleManagedWindowActivate}
                                    onClose={handleClosePaint}
                                    onDragStop={handleManagedWindowDragStop}
                                    onFullScreenToggle={handleManagedWindowFullScreenToggle}
                                    onMinimizeToggle={handleManagedWindowMinimizeToggle}
                                    onResizeStop={handleManagedWindowResizeStop}
                                    zIndex={paintWindowState.zIndex}
                                    enableStatePersistence={false}
                                >
                                    <WorkspacePaint
                                        session={paintSession}
                                        onActivateBackend={onActivateWorkspacePaintBackend}
                                    />
                                </DraggableWindow>
                            )}
                            {!hideFloatingWindows && !stageWindowMinimized && (
                                <DraggableWindow
                                    windowId={STAGE_WINDOW.windowId}
                                    data-ngvge-command-scope={STAGE_WINDOW.commandScope}
                                    data-ngvge-tool-id={STAGE_WINDOW.toolId}
                                    data-ngvge-window-model={WORKSPACE_WINDOW_MODEL_ID}
                                    data-ngvge-window-active={stageWindowState.active ? 'true' : 'false'}
                                    title={STAGE_WINDOW.title}
                                    defaultPosition={stageWindowPosition}
                                    defaultSize={stageWindowSize}
                                    minSize={STAGE_WINDOW.geometry.minSize}
                                    maxSize={STAGE_WINDOW.geometry.maxSize}
                                    allowResize={STAGE_WINDOW.capabilities.resize}
                                    allowMaximize={STAGE_WINDOW.capabilities.maximize}
                                    isFullScreen={stageWindowState.maximized}
                                    isMinimized={stageWindowState.minimized}
                                    position={stageWindowState.position}
                                    size={stageWindowState.size}
                                    onActivate={handleManagedWindowActivate}
                                    onContentResize={handleStageWindowContentResize}
                                    onDragStop={handleManagedWindowDragStop}
                                    onResizeStop={handleManagedWindowResizeStop}
                                    onMinimizeToggle={handleManagedWindowMinimizeToggle}
                                    zIndex={isFullScreen ? FULLSCREEN_STAGE_Z_INDEX : stageWindowState.zIndex}
                                    enableStatePersistence={false}
                                >
                                    <StageWrapper
                                        containerSize={stageWindowContentSize}
                                        customStageSize={customStageSize}
                                        fitToContainer={stageWindowAutoFit}
                                        isFullScreen={isFullScreen}
                                        isRendererSupported={isRendererSupported()}
                                        isRtl={isRtl}
                                        onRequestSelectTarget={handleEditorTargetSelection}
                                        onToggleAutoFit={handleToggleStageWindowAutoFit}
                                        showAutoFitButton
                                        stageSize={stageSize}
                                        stageWindowAutoFit={stageWindowAutoFit}
                                        vm={vm}
                                    />
                                </DraggableWindow>
                            )}
                            {!hideFloatingWindows && legacySpritesWindowVisible && (
                                <DraggableWindow
                                    data-ngvge-compatibility-ui={LEGACY_SPRITES_COMPATIBILITY_UI_ID}
                                    data-ngvge-tool-id={LEGACY_SPRITES_WINDOW.toolId}
                                    data-ngvge-window-model={WORKSPACE_WINDOW_MODEL_ID}
                                    data-ngvge-window-active={targetPaneWindowState.active ? 'true' : 'false'}
                                    windowId={LEGACY_SPRITES_WINDOW.windowId}
                                    title={LEGACY_SPRITES_WINDOW.title}
                                    headerActions={(
                                        <span className={styles.legacyCompatibilityBadge}>Compatibility</span>
                                    )}
                                    defaultPosition={targetPaneWindowPosition}
                                    defaultSize={targetPaneWindowSize}
                                    minSize={LEGACY_SPRITES_WINDOW.geometry.minSize}
                                    maxSize={LEGACY_SPRITES_WINDOW.geometry.maxSize}
                                    isFullScreen={targetPaneWindowState.maximized}
                                    isMinimized={targetPaneWindowMinimized}
                                    position={targetPaneWindowState.position}
                                    size={targetPaneWindowState.size}
                                    onActivate={handleManagedWindowActivate}
                                    onClose={handleCloseLegacySprites}
                                    onDragStop={handleManagedWindowDragStop}
                                    onFullScreenToggle={handleManagedWindowFullScreenToggle}
                                    onResizeStop={handleManagedWindowResizeStop}
                                    onMinimizeToggle={handleLegacySpritesMinimizeToggle}
                                    zIndex={targetPaneWindowState.zIndex}
                                    enableStatePersistence={false}
                                >
                                    <TargetPane
                                        compatibilityMode
                                        onRequestSelectTarget={handleEditorTargetSelection}
                                        stageSize={stageSize}
                                        vm={vm}
                                    />
                                </DraggableWindow>
                            )}
                {/* Classic compatibility minimized surface; Workspace mode is owned by the Dock. */}
                {!hideFloatingWindows && !customUI ? <MinimizedBar windows={minimizedWindows} /> : null}
                {!hideFloatingWindows && customUI ? (
                    <WorkspaceWindowTransitionLayer transitionModel={dockTransitionModel} />
                ) : null}
                {!hideFloatingWindows && customUI && !isFullScreen ? (
                    <WorkspaceDock
                        dockRuntimeModel={dockRuntimeModel}
                        interactionController={dockInteractionController}
                        launchpadModel={launchpadModel}
                        organizationModel={dockOrganizationModel}
                        organizationMode={workspacePreferences.workspace.organizationMode}
                        placementModel={dockPlacementModel}
                        presentation={workspacePreferences.workspace.dockPresentation}
                    />
                ) : null}
                        </>
                        ) : (
                        /* 原版内嵌布局（使用原始样式容器） */
                        <Box className={styles.stageAndTargetWrapper}>
                            <StageWrapper
                                isFullScreen={isFullScreen}
                                isRendererSupported={isRendererSupported()}
                                isRtl={isRtl}
                                loading={loading}
                                stageSize={stageSize}
                                vm={vm}
                            >
                                {alertsVisible ? (
                                    <Alerts className={editorAlertsClassName} />
                                ) : null}
                            </StageWrapper>
                            <Box className={styles.targetWrapper}>
                                <TargetPane
                                    stageSize={stageSize}
                                    vm={vm}
                                />
                            </Box>
                        </Box>
                        )}
                    </Box>
                </Box>
                <DragLayer />

            </Box>
        );
    }}</MediaQuery>);
};

GUIComponent.propTypes = {
    accountNavOpen: PropTypes.bool,
    activeTabIndex: PropTypes.number,
    authorId: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]), // can be false
    authorThumbnailUrl: PropTypes.string,
    authorUsername: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]), // can be false
    backdropLibraryVisible: PropTypes.bool,
    backpackHost: PropTypes.string,
    backpackVisible: PropTypes.bool,
    basePath: PropTypes.string,
    blocksTabVisible: PropTypes.bool,
    blocksId: PropTypes.string,
    canChangeLanguage: PropTypes.bool,
    canChangeTheme: PropTypes.bool,
    canCreateCopy: PropTypes.bool,
    canCreateNew: PropTypes.bool,
    canEditTitle: PropTypes.bool,
    canManageFiles: PropTypes.bool,
    canRemix: PropTypes.bool,
    canSave: PropTypes.bool,
    canShare: PropTypes.bool,
    canUseCloud: PropTypes.bool,
    cardsVisible: PropTypes.bool,
    children: PropTypes.node,
    costumeLibraryVisible: PropTypes.bool,
    costumesTabVisible: PropTypes.bool,
    customStageSize: PropTypes.shape({
        width: PropTypes.number,
        height: PropTypes.number
    }),
    customUI: PropTypes.bool,
    editorBackground: PropTypes.shape({
        image: PropTypes.string,
        blur: PropTypes.number,
        target: PropTypes.string
    }),
    editingTargetId: PropTypes.string,
    projectExplorerExpandedNodeIds: PropTypes.arrayOf(PropTypes.string).isRequired,
    projectExplorerSelectedNodeId: PropTypes.string,
    projectExplorerVisible: PropTypes.bool.isRequired,
    projectExplorerWidth: PropTypes.number.isRequired,
    projectInspectorExpandedSectionIds: PropTypes.arrayOf(PropTypes.string).isRequired,
    projectInspectorVisible: PropTypes.bool.isRequired,
    projectInspectorWidth: PropTypes.number.isRequired,
    enableCommunity: PropTypes.bool,
    intl: intlShape.isRequired,
    isCreating: PropTypes.bool,
    isEmbedded: PropTypes.bool,
    isFullScreen: PropTypes.bool,
    isPlayerOnly: PropTypes.bool,
    isRtl: PropTypes.bool,
    isShared: PropTypes.bool,
    isWindowFullScreen: PropTypes.bool,
    isTotallyNormal: PropTypes.bool,
    loading: PropTypes.bool,
    logo: PropTypes.string,
    onActivateCostumesTab: PropTypes.func,
    onActivateSoundsTab: PropTypes.func,
    onActivateTab: PropTypes.func,
    onActivateWorkspacePaintBackend: PropTypes.func,
    onClickAccountNav: PropTypes.func,
    onClickAddonSettings: PropTypes.func,
    onClickDesktopSettings: PropTypes.func,
    onClickNewWindow: PropTypes.func,
    onClickPackager: PropTypes.func,
    onClickLogo: PropTypes.func,
    onCloseAccountNav: PropTypes.func,
    onExtensionButtonClick: PropTypes.func,
    onOpenCustomExtensionModal: PropTypes.func,
    onOpenExtensionImportMethodModal: PropTypes.func,
    onSetSelectedExtension: PropTypes.func,
    onLogOut: PropTypes.func,
    onOpenRegistration: PropTypes.func,
    onSetProjectExplorerNodeExpanded: PropTypes.func.isRequired,
    onSetProjectExplorerSelectedNode: PropTypes.func.isRequired,
    onSetProjectExplorerVisible: PropTypes.func.isRequired,
    onSetProjectExplorerWidth: PropTypes.func.isRequired,
    onSetProjectInspectorSectionExpanded: PropTypes.func.isRequired,
    onSetProjectInspectorVisible: PropTypes.func.isRequired,
    onSetProjectInspectorWidth: PropTypes.func.isRequired,
    onRequestCloseBackdropLibrary: PropTypes.func,
    onRequestCloseCostumeLibrary: PropTypes.func,
    onRequestCloseTelemetryModal: PropTypes.func,
    onSeeCommunity: PropTypes.func,
    onShare: PropTypes.func,
    onShowPrivacyPolicy: PropTypes.func,
    onStartSelectingFileUpload: PropTypes.func,
    onTabSelect: PropTypes.func,
    onTelemetryModalCancel: PropTypes.func,
    onTelemetryModalOptIn: PropTypes.func,
    onTelemetryModalOptOut: PropTypes.func,
    onToggleLoginOpen: PropTypes.func,
    renderLogin: PropTypes.func,
    securityManager: PropTypes.shape({}),
    showComingSoon: PropTypes.bool,
    showOpenFilePicker: PropTypes.func,
    showSaveFilePicker: PropTypes.func,
    soundsTabVisible: PropTypes.bool,
    stageSizeMode: PropTypes.oneOf(Object.keys(STAGE_SIZE_MODES)),
    stage: PropTypes.shape({
        id: PropTypes.string
    }),
    sprites: PropTypes.objectOf(PropTypes.shape({
        id: PropTypes.string
    })),
    targetIsStage: PropTypes.bool,
    telemetryModalVisible: PropTypes.bool,
    theme: PropTypes.instanceOf(Theme),
    tipsLibraryVisible: PropTypes.bool,
    usernameModalVisible: PropTypes.bool,
    settingsModalVisible: PropTypes.bool,
    engineSettingsModalVisible: PropTypes.bool,
    toolboxLayoutModalVisible: PropTypes.bool,
    spriteLayerModalVisible: PropTypes.bool,
    customExtensionModalVisible: PropTypes.bool,
    ccwExtensionModalVisible: PropTypes.bool,
    extensionImportMethodModalVisible: PropTypes.bool,
    fontsModalVisible: PropTypes.bool,
    unknownPlatformModalVisible: PropTypes.bool,
    invalidProjectModalVisible: PropTypes.bool,
    vm: PropTypes.instanceOf(VM).isRequired
};
GUIComponent.defaultProps = {
    backpackHost: null,
    backpackVisible: false,
    basePath: './',
    blocksId: 'original',
    canChangeLanguage: true,
    canChangeTheme: true,
    canCreateNew: false,
    canEditTitle: false,
    canManageFiles: true,
    canRemix: false,
    canSave: false,
    canCreateCopy: false,
    canShare: false,
    canUseCloud: false,
    enableCommunity: false,
    isCreating: false,
    isShared: false,
    isTotallyNormal: false,
    loading: false,
    showComingSoon: false,
    stageSizeMode: STAGE_SIZE_MODES.large
};

const mapStateToProps = state => ({
    customStageSize: state.scratchGui.customStageSize,
    editorBackground: state.scratchGui.tw.editorBackground,
    isWindowFullScreen: state.scratchGui.tw.isWindowFullScreen,
    customUI: !!state.scratchGui.tw.customUI,
    editingTargetId: state.scratchGui.targets.editingTarget,
    projectExplorerExpandedNodeIds: state.scratchGui.projectExplorer.expandedNodeIds,
    projectExplorerSelectedNodeId: state.scratchGui.projectExplorer.selectedNodeId,
    projectExplorerVisible: state.scratchGui.projectExplorer.visible,
    projectExplorerWidth: state.scratchGui.projectExplorer.width,
    projectInspectorExpandedSectionIds: state.scratchGui.projectInspector.expandedSectionIds,
    projectInspectorVisible: state.scratchGui.projectInspector.visible,
    projectInspectorWidth: state.scratchGui.projectInspector.width,
    sprites: state.scratchGui.targets.sprites,
    stage: state.scratchGui.targets.stage,
    // This is the button's mode, as opposed to the actual current state
    blocksId: state.scratchGui.timeTravel.year.toString(),
    stageSizeMode: state.scratchGui.stageSize.stageSize,
    theme: state.scratchGui.theme.theme
});

const mapDispatchToProps = dispatch => ({
    onActivateWorkspacePaintBackend: () => dispatch(activateWorkspacePaintBackend()),
    onSetProjectExplorerNodeExpanded: (nodeId, expanded) => (
        dispatch(setProjectExplorerNodeExpanded(nodeId, expanded))
    ),
    onSetProjectExplorerSelectedNode: nodeId => dispatch(setProjectExplorerSelectedNode(nodeId)),
    onSetProjectExplorerVisible: visible => dispatch(setProjectExplorerVisible(visible)),
    onSetProjectExplorerWidth: width => dispatch(setProjectExplorerWidth(width)),
    onSetProjectInspectorSectionExpanded: (sectionId, expanded) => (
        dispatch(setProjectInspectorSectionExpanded(sectionId, expanded))
    ),
    onSetProjectInspectorVisible: visible => dispatch(setProjectInspectorVisible(visible)),
    onSetProjectInspectorWidth: width => dispatch(setProjectInspectorWidth(width))
});

export default injectIntl(connect(
    mapStateToProps,
    mapDispatchToProps
)(GUIComponent));
