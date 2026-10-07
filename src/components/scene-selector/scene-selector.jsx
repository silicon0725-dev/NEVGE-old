import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import {defineMessages, injectIntl, intlShape} from 'react-intl';

import styles from './scene-selector.css';

const SCENE_SYSTEM_MODULE_ID = 'ngvge.scene-system';
const SCENE_CONTROLLER_CAPABILITY_ID = 'ngvge.scene-controller';

const messages = defineMessages({
    activeScene: {
        id: 'ngvge.sceneSelector.activeScene',
        defaultMessage: 'Active scene',
        description: 'Accessible label for the active scene in the scene selector'
    },
    cancel: {
        id: 'ngvge.sceneSelector.cancel',
        defaultMessage: 'Cancel',
        description: 'Cancel a scene selector action'
    },
    closeError: {
        id: 'ngvge.sceneSelector.closeError',
        defaultMessage: 'Dismiss error',
        description: 'Accessible label for dismissing a scene selector error'
    },
    confirmDelete: {
        id: 'ngvge.sceneSelector.confirmDelete',
        defaultMessage: 'Delete scene',
        description: 'Confirm deletion of a scene'
    },
    createScene: {
        id: 'ngvge.sceneSelector.createScene',
        defaultMessage: 'New scene',
        description: 'Create a new scene'
    },
    deleteScene: {
        id: 'ngvge.sceneSelector.deleteScene',
        defaultMessage: 'Delete',
        description: 'Delete a scene'
    },
    deleteWithFallback: {
        id: 'ngvge.sceneSelector.deleteWithFallback',
        defaultMessage: 'Delete “{scene}”? If it is active, “{fallback}” will be loaded first.',
        description: 'Delete confirmation when another scene can be used as fallback'
    },
    deleteWithReplacement: {
        id: 'ngvge.sceneSelector.deleteWithReplacement',
        defaultMessage: 'Delete “{scene}”? A blank replacement scene will be created first.',
        description: 'Delete confirmation when deleting the only scene'
    },
    dragScene: {
        id: 'ngvge.sceneSelector.dragScene',
        defaultMessage: 'Drag to reorder {scene}',
        description: 'Accessible label for a scene drag handle'
    },
    duplicateScene: {
        id: 'ngvge.sceneSelector.duplicateScene',
        defaultMessage: 'Duplicate',
        description: 'Duplicate a scene'
    },
    loading: {
        id: 'ngvge.sceneSelector.loading',
        defaultMessage: 'Working…',
        description: 'Scene selector busy state'
    },
    openSelector: {
        id: 'ngvge.sceneSelector.openSelector',
        defaultMessage: 'Open scene selector',
        description: 'Accessible label for opening the scene selector'
    },
    renameScene: {
        id: 'ngvge.sceneSelector.renameScene',
        defaultMessage: 'Rename',
        description: 'Rename a scene'
    },
    saveName: {
        id: 'ngvge.sceneSelector.saveName',
        defaultMessage: 'Save name',
        description: 'Save a renamed scene'
    },
    sceneLabel: {
        id: 'ngvge.sceneSelector.sceneLabel',
        defaultMessage: 'Scene',
        description: 'Small label above the active scene name'
    },
    sceneList: {
        id: 'ngvge.sceneSelector.sceneList',
        defaultMessage: 'Scenes',
        description: 'Scene selector panel heading'
    },
    sceneCount: {
        id: 'ngvge.sceneSelector.sceneCount',
        defaultMessage: '{count, plural, one {# scene} other {# scenes}}',
        description: 'Number of scenes in the project'
    },
    setStartupScene: {
        id: 'ngvge.sceneSelector.setStartupScene',
        defaultMessage: 'Set as startup',
        description: 'Set a scene as the startup scene'
    },
    startupScene: {
        id: 'ngvge.sceneSelector.startupScene',
        defaultMessage: 'Startup scene',
        description: 'Label for the project startup scene'
    },
    switchScene: {
        id: 'ngvge.sceneSelector.switchScene',
        defaultMessage: 'Switch to {scene}',
        description: 'Accessible label for switching to a scene'
    }
});

const Icon = ({children, className, viewBox = '0 0 16 16'}) => (
    <svg
        aria-hidden="true"
        className={className}
        focusable="false"
        viewBox={viewBox}
    >
        {children}
    </svg>
);

Icon.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    viewBox: PropTypes.string
};

const SceneGlyph = ({className}) => (
    <Icon className={className}>
        <path d="M3 3.25h8.25A1.75 1.75 0 0 1 13 5v6.25H4.75A1.75 1.75 0 0 1 3 9.5V3.25Z" />
        <path d="M4.75 5.25H13v6A1.75 1.75 0 0 1 11.25 13H4.75A1.75 1.75 0 0 1 3 11.25V7A1.75 1.75 0 0 1 4.75 5.25Z" />
    </Icon>
);

SceneGlyph.propTypes = {
    className: PropTypes.string
};

const PlusGlyph = ({className}) => (
    <Icon className={className}>
        <path d="M8 3v10M3 8h10" />
    </Icon>
);

PlusGlyph.propTypes = {
    className: PropTypes.string
};

const MoreGlyph = ({className}) => (
    <Icon className={className}>
        <circle cx="3.25" cy="8" r="1.1" />
        <circle cx="8" cy="8" r="1.1" />
        <circle cx="12.75" cy="8" r="1.1" />
    </Icon>
);

MoreGlyph.propTypes = {
    className: PropTypes.string
};

const CopyGlyph = ({className}) => (
    <Icon className={className}>
        <rect height="8" rx="1.4" width="8" x="5" y="5" />
        <path d="M4 11H3.75A1.75 1.75 0 0 1 2 9.25v-5.5A1.75 1.75 0 0 1 3.75 2h5.5A1.75 1.75 0 0 1 11 3.75V4" />
    </Icon>
);

CopyGlyph.propTypes = {
    className: PropTypes.string
};

const EditGlyph = ({className}) => (
    <Icon className={className}>
        <path d="m3 11.5.55-2.55 6.9-6.9a1.2 1.2 0 0 1 1.7 0l1.8 1.8a1.2 1.2 0 0 1 0 1.7l-6.9 6.9L4.5 13 3 11.5Z" />
        <path d="m9.25 3.25 3.5 3.5" />
    </Icon>
);

EditGlyph.propTypes = {
    className: PropTypes.string
};

const TrashGlyph = ({className}) => (
    <Icon className={className}>
        <path d="M3.5 4.5h9M6 4.5V3.2h4v1.3M5 6.2l.45 6.1h5.1L11 6.2M7 7.2v3.5M9 7.2v3.5" />
    </Icon>
);

TrashGlyph.propTypes = {
    className: PropTypes.string
};

const StarGlyph = ({className}) => (
    <Icon className={className}>
        <path d="m8 2.1 1.7 3.45 3.8.55-2.75 2.68.65 3.78L8 10.78l-3.4 1.78.65-3.78L2.5 6.1l3.8-.55L8 2.1Z" />
    </Icon>
);

StarGlyph.propTypes = {
    className: PropTypes.string
};

const CheckGlyph = ({className}) => (
    <Icon className={className}>
        <path d="m3.25 8.2 3 3.05 6.5-6.5" />
    </Icon>
);

CheckGlyph.propTypes = {
    className: PropTypes.string
};

const CloseGlyph = ({className}) => (
    <Icon className={className}>
        <path d="m4 4 8 8M12 4l-8 8" />
    </Icon>
);

CloseGlyph.propTypes = {
    className: PropTypes.string
};

const getFallbackScene = (scenes, sceneId) => {
    if (scenes.length <= 1) return null;
    const index = scenes.findIndex(scene => scene.id === sceneId);
    const remaining = scenes.filter(scene => scene.id !== sceneId);
    return remaining[Math.max(0, index - 1)] || remaining[0] || null;
};

const getErrorMessage = error => {
    if (!error) return null;
    return error && error.message ? error.message : String(error);
};

const snapshotModuleState = value => value ? {
    enabled: Boolean(value.enabled),
    error: value.error || null,
    state: value.state || null
} : null;

const snapshotScene = scene => ({
    hasSnapshot: scene.hasSnapshot !== false,
    id: scene.id,
    index: Number.isFinite(scene.index) ? scene.index : 0,
    isActive: Boolean(scene.isActive),
    isStartup: Boolean(scene.isStartup),
    name: scene.name || 'Scene'
});

const snapshotSceneList = value => {
    if (!value || typeof value.map !== 'function') return [];
    return value.map(snapshotScene);
};

const createManagerStatusFromView = value => value ? {
    busy: Boolean(value.busy),
    error: value.error || null,
    operation: value.operation || null,
    sceneCount: Array.isArray(value.scenes) ? value.scenes.length : 0
} : null;

const createRuntimeStatusFromView = value => value ? {
    activeSceneId: value.activeSceneId || null,
    busy: Boolean(value.busy),
    error: value.error || null,
    loadedSceneId: value.loadedSceneId || null,
    operation: value.operation || null,
    singleSceneMode: true
} : null;

const SceneSelector = ({className, intl, vm}) => {
    const rootRef = React.useRef(null);
    const renameInputRef = React.useRef(null);
    const moduleManagerRef = React.useRef(null);
    const externalBusyRefreshTimerRef = React.useRef(null);
    const [servicesReady, setServicesReady] = React.useState(false);
    const [moduleState, setModuleState] = React.useState(null);
    const [scenes, setScenes] = React.useState([]);
    const [managerStatus, setManagerStatus] = React.useState(null);
    const [runtimeStatus, setRuntimeStatus] = React.useState(null);
    const [isOpen, setIsOpen] = React.useState(false);
    const [localOperation, setLocalOperation] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [renamingSceneId, setRenamingSceneId] = React.useState(null);
    const [renameValue, setRenameValue] = React.useState('');
    const [deleteSceneId, setDeleteSceneId] = React.useState(null);
    const [dragSceneId, setDragSceneId] = React.useState(null);
    const [dragOverSceneId, setDragOverSceneId] = React.useState(null);

    const readControllerView = React.useCallback(moduleManager => {
        if (!moduleManager) return null;
        const nextModuleState = snapshotModuleState(moduleManager.getModuleState(SCENE_SYSTEM_MODULE_ID));
        setModuleState(nextModuleState);
        if (!nextModuleState || !nextModuleState.enabled) return null;
        const controller = moduleManager.getCapability(SCENE_CONTROLLER_CAPABILITY_ID);
        if (!controller || typeof controller.getViewStateJSON !== 'function') return null;
        const json = controller.getViewStateJSON();
        if (typeof json !== 'string') throw new TypeError('Scene Controller returned a non-portable view payload.');
        return JSON.parse(json);
    }, []);

    const applyControllerView = React.useCallback(view => {
        if (!view) {
            setServicesReady(false);
            setScenes([]);
            setManagerStatus(null);
            setRuntimeStatus(null);
            setIsOpen(false);
            return;
        }
        setServicesReady(true);
        setScenes(snapshotSceneList(view.scenes));
        setManagerStatus(createManagerStatusFromView(view));
        setRuntimeStatus(createRuntimeStatusFromView(view));
    }, []);

    const refreshView = React.useCallback(() => {
        const moduleManager = moduleManagerRef.current;
        if (!moduleManager) return;
        try {
            applyControllerView(readControllerView(moduleManager));
        } catch (nextError) {
            // Controller capability is resolved per operation/read and is never retained.
            // If authority vanished between getCapability and call, the next manager event
            // will settle the selector to unavailable without retaining a stale facade.
            setServicesReady(false);
            setError(getErrorMessage(nextError));
        }
    }, [applyControllerView, readControllerView]);

    React.useEffect(() => {
        const moduleManager = vm && vm.runtime ? vm.runtime.ngvgeFirstPartyModules : null;
        moduleManagerRef.current = moduleManager;
        if (!moduleManager) {
            setModuleState(null);
            applyControllerView(null);
            return undefined;
        }

        let disposed = false;
        const sync = () => {
            if (disposed) return;
            try {
                applyControllerView(readControllerView(moduleManager));
                setError(null);
            } catch (nextError) {
                setServicesReady(false);
                setError(getErrorMessage(nextError));
            }
        };
        const unsubscribeManager = moduleManager.subscribe(sync);
        const unsubscribeData = typeof moduleManager.subscribeModuleData === 'function' ?
            moduleManager.subscribeModuleData(change => {
                if (!change || change.moduleId === SCENE_SYSTEM_MODULE_ID || change.type === 'deserialize') sync();
            }) : () => {};
        sync();
        return () => {
            disposed = true;
            moduleManagerRef.current = null;
            // These are Host-owned subscriptions, not capability facades. They remain
            // valid regardless of Scene module authority and are safe to dispose here.
            unsubscribeData();
            unsubscribeManager();
        };
    }, [vm, applyControllerView, readControllerView]);

    React.useEffect(() => {
        if (!isOpen) return undefined;
        const handlePointerDown = event => {
            if (rootRef.current && !rootRef.current.contains(event.target)) setIsOpen(false);
        };
        const handleKeyDown = event => {
            if (event.key === 'Escape') {
                setIsOpen(false);
                setRenamingSceneId(null);
                setDeleteSceneId(null);
            }
        };
        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    React.useEffect(() => {
        if (!renamingSceneId || !renameInputRef.current) return;
        renameInputRef.current.focus();
        renameInputRef.current.select();
    }, [renamingSceneId]);

    React.useEffect(() => {
        if (externalBusyRefreshTimerRef.current) {
            clearTimeout(externalBusyRefreshTimerRef.current);
            externalBusyRefreshTimerRef.current = null;
        }
        if (localOperation || !managerStatus || !managerStatus.busy) return undefined;
        // External scene navigation (for example Project Explorer -> Enter Scene) does
        // not publish an extra Module Data mutation when the controller settles. Poll
        // only while that external operation is busy so this selector cannot remain
        // stuck on a stale busy snapshot.
        externalBusyRefreshTimerRef.current = setTimeout(() => {
            externalBusyRefreshTimerRef.current = null;
            refreshView();
        }, 32);
        return () => {
            if (externalBusyRefreshTimerRef.current) {
                clearTimeout(externalBusyRefreshTimerRef.current);
                externalBusyRefreshTimerRef.current = null;
            }
        };
    }, [localOperation, managerStatus, refreshView]);

    const busy = Boolean(localOperation || (managerStatus && managerStatus.busy));

    const runOperation = React.useCallback(async (operationName, command, options = {}) => {
        if (busy) return null;
        const moduleManager = moduleManagerRef.current;
        if (!moduleManager) return null;
        setLocalOperation(operationName);
        setError(null);
        try {
            const state = moduleManager.getModuleState(SCENE_SYSTEM_MODULE_ID);
            if (!state || !state.enabled) return null;
            const controller = moduleManager.getCapability(SCENE_CONTROLLER_CAPABILITY_ID);
            if (!controller || typeof controller.execute !== 'function') return null;
            const resultJSON = await controller.execute(command, JSON.stringify(options));
            return typeof resultJSON === 'string' ? JSON.parse(resultJSON) : null;
        } catch (nextError) {
            setError(getErrorMessage(nextError));
            return null;
        } finally {
            setLocalOperation(null);
            refreshView();
        }
    }, [busy, refreshView]);

    if (!servicesReady) {
        if (!moduleState || (!moduleState.enabled && moduleState.state !== 'error')) return null;
        return (
            <div className={classNames(styles.root, className)} data-ngvge-command-scope="scene">
                <button
                    aria-label={intl.formatMessage(messages.openSelector)}
                    className={styles.selectorButton}
                    disabled
                    title={moduleState.error || 'Scene System is still initializing.'}
                    type="button"
                >
                    <span className={styles.selectorIconFrame}>
                        <SceneGlyph className={styles.selectorIcon} />
                    </span>
                    <span className={styles.selectorText}>
                        <span className={styles.selectorEyebrow}>{intl.formatMessage(messages.sceneLabel)}</span>
                        <span className={styles.selectorName}>Unavailable</span>
                    </span>
                </button>
            </div>
        );
    }

    const activeSceneId = runtimeStatus && runtimeStatus.activeSceneId ?
        runtimeStatus.activeSceneId : (scenes.find(scene => scene.isActive) || {}).id;
    const activeScene = scenes.find(scene => scene.id === activeSceneId) || scenes[0] || null;
    const deleteScene = scenes.find(scene => scene.id === deleteSceneId) || null;
    const deleteFallback = deleteScene ? getFallbackScene(scenes, deleteScene.id) : null;

    const handleCreate = () => runOperation('create', 'create-and-load').then(created => {
        if (!created) return;
        setRenamingSceneId(null);
        setDeleteSceneId(null);
    });

    const handleSwitch = sceneId => {
        if (sceneId === activeSceneId && runtimeStatus && runtimeStatus.loadedSceneId === sceneId) {
            setIsOpen(false);
            return;
        }
        runOperation('switch', 'enter', {sceneId}).then(result => {
            if (result) setIsOpen(false);
        });
    };

    const handleDuplicate = sceneId => runOperation('duplicate', 'duplicate-and-load', {sceneId}).then(result => {
        if (result) setDeleteSceneId(null);
    });

    const beginRename = scene => {
        if (busy) return;
        setDeleteSceneId(null);
        setRenamingSceneId(scene.id);
        setRenameValue(scene.name);
    };

    const cancelRename = () => {
        setRenamingSceneId(null);
        setRenameValue('');
    };

    const commitRename = sceneId => {
        const nextName = renameValue.trim();
        if (!nextName) return;
        runOperation('rename', 'rename', {name: nextName, sceneId}).then(result => {
            if (result) cancelRename();
        });
    };

    const handleRenameKeyDown = (event, sceneId) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            commitRename(sceneId);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            cancelRename();
        }
    };

    const handleSetStartup = sceneId => runOperation('startup', 'set-startup', {sceneId});

    const requestDelete = sceneId => {
        if (busy) return;
        setRenamingSceneId(null);
        setDeleteSceneId(sceneId);
    };

    const confirmDelete = () => {
        if (!deleteScene) return;
        runOperation('delete', 'delete', {sceneId: deleteScene.id}).then(result => {
            if (result) setDeleteSceneId(null);
        });
    };

    const handleDragStart = (event, sceneId) => {
        if (busy || renamingSceneId) {
            event.preventDefault();
            return;
        }
        setDragSceneId(sceneId);
        setDragOverSceneId(null);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', sceneId);
    };

    const handleDragOver = (event, sceneId) => {
        if (!dragSceneId || dragSceneId === sceneId || busy) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDragOverSceneId(sceneId);
    };

    const handleDrop = (event, targetScene) => {
        event.preventDefault();
        if (!dragSceneId || dragSceneId === targetScene.id || busy) return;
        const sourceSceneId = dragSceneId;
        setDragSceneId(null);
        setDragOverSceneId(null);
        runOperation('move', 'move', {index: targetScene.index, sceneId: sourceSceneId});
    };

    const handleDragEnd = () => {
        setDragSceneId(null);
        setDragOverSceneId(null);
    };

    return (
        <div
            className={classNames(styles.root, className)}
            data-ngvge-command-scope="scene"
            ref={rootRef}
        >
            <button
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                aria-label={intl.formatMessage(messages.openSelector)}
                className={classNames(styles.selectorButton, {
                    [styles.selectorButtonBusy]: busy,
                    [styles.selectorButtonOpen]: isOpen
                })}
                disabled={!activeScene}
                title={activeScene ? activeScene.name : ''}
                type="button"
                onClick={() => setIsOpen(value => !value)}
            >
                <span className={styles.selectorIconFrame}>
                    <SceneGlyph className={styles.selectorIcon} />
                </span>
                <span className={styles.selectorText}>
                    <span className={styles.selectorEyebrow}>
                        {intl.formatMessage(messages.sceneLabel)}
                    </span>
                    <span className={styles.selectorName}>
                        {activeScene ? activeScene.name : '—'}
                    </span>
                </span>
                {busy ? (
                    <span aria-hidden="true" className={styles.spinner} />
                ) : (
                    <span aria-hidden="true" className={styles.caret} />
                )}
            </button>

            {isOpen ? (
                <div
                    aria-label={intl.formatMessage(messages.sceneList)}
                    className={styles.panel}
                    role="dialog"
                >
                    <div className={styles.panelHeader}>
                        <div>
                            <div className={styles.panelTitle}>
                                {intl.formatMessage(messages.sceneList)}
                            </div>
                            <div className={styles.panelSubtitle}>
                                {intl.formatMessage(messages.sceneCount, {count: scenes.length})}
                            </div>
                        </div>
                        <button
                            aria-label={intl.formatMessage(messages.createScene)}
                            className={styles.createButton}
                            disabled={busy}
                            title={intl.formatMessage(messages.createScene)}
                            type="button"
                            onClick={handleCreate}
                        >
                            <PlusGlyph className={styles.buttonIcon} />
                            <span>{intl.formatMessage(messages.createScene)}</span>
                        </button>
                    </div>

                    {error ? (
                        <div className={styles.errorBanner} role="alert">
                            <span className={styles.errorText}>{error}</span>
                            <button
                                aria-label={intl.formatMessage(messages.closeError)}
                                className={styles.errorCloseButton}
                                type="button"
                                onClick={() => setError(null)}
                            >
                                <CloseGlyph className={styles.smallIcon} />
                            </button>
                        </div>
                    ) : null}

                    {busy ? (
                        <div className={styles.busyBanner} role="status">
                            <span aria-hidden="true" className={styles.spinnerDark} />
                            <span>{intl.formatMessage(messages.loading)}</span>
                        </div>
                    ) : null}

                    <div className={styles.sceneList} role="list">
                        {scenes.map(scene => {
                            const active = scene.id === activeSceneId;
                            const renaming = scene.id === renamingSceneId;
                            const dragging = scene.id === dragSceneId;
                            const dragOver = scene.id === dragOverSceneId;
                            return (
                                <div
                                    className={classNames(styles.sceneItem, {
                                        [styles.sceneItemActive]: active,
                                        [styles.sceneItemDragging]: dragging,
                                        [styles.sceneItemDragOver]: dragOver
                                    })}
                                    draggable={!busy && !renaming}
                                    key={scene.id}
                                    role="listitem"
                                    onDragEnd={handleDragEnd}
                                    onDragOver={event => handleDragOver(event, scene.id)}
                                    onDragStart={event => handleDragStart(event, scene.id)}
                                    onDrop={event => handleDrop(event, scene)}
                                >
                                    <span
                                        aria-label={intl.formatMessage(messages.dragScene, {scene: scene.name})}
                                        className={styles.dragHandle}
                                        role="img"
                                    >
                                        <MoreGlyph className={styles.dragIcon} />
                                    </span>

                                    {renaming ? (
                                        <div className={styles.renameEditor}>
                                            <input
                                                className={styles.renameInput}
                                                maxLength={120}
                                                ref={renameInputRef}
                                                type="text"
                                                value={renameValue}
                                                onChange={event => setRenameValue(event.target.value)}
                                                onKeyDown={event => handleRenameKeyDown(event, scene.id)}
                                            />
                                            <button
                                                aria-label={intl.formatMessage(messages.saveName)}
                                                className={styles.inlineActionButton}
                                                disabled={!renameValue.trim() || busy}
                                                type="button"
                                                onClick={() => commitRename(scene.id)}
                                            >
                                                <CheckGlyph className={styles.smallIcon} />
                                            </button>
                                            <button
                                                aria-label={intl.formatMessage(messages.cancel)}
                                                className={styles.inlineActionButton}
                                                disabled={busy}
                                                type="button"
                                                onClick={cancelRename}
                                            >
                                                <CloseGlyph className={styles.smallIcon} />
                                            </button>
                                        </div>
                                    ) : (
                                        <React.Fragment>
                                            <button
                                                aria-current={active ? 'true' : undefined}
                                                aria-label={active ?
                                                    intl.formatMessage(messages.activeScene) :
                                                    intl.formatMessage(messages.switchScene, {scene: scene.name})
                                                }
                                                className={styles.sceneMainButton}
                                                disabled={busy}
                                                type="button"
                                                onClick={() => handleSwitch(scene.id)}
                                            >
                                                <span className={styles.sceneThumbnail}>
                                                    <SceneGlyph className={styles.sceneThumbnailIcon} />
                                                </span>
                                                <span className={styles.sceneDetails}>
                                                    <span className={styles.sceneName}>{scene.name}</span>
                                                    <span className={styles.sceneMeta}>
                                                        {active ? (
                                                            <span className={styles.activeBadge}>
                                                                {intl.formatMessage(messages.activeScene)}
                                                            </span>
                                                        ) : null}
                                                        {scene.isStartup ? (
                                                            <span className={styles.startupBadge}>
                                                                <StarGlyph className={styles.badgeIcon} />
                                                                {intl.formatMessage(messages.startupScene)}
                                                            </span>
                                                        ) : null}
                                                    </span>
                                                </span>
                                            </button>

                                            <div className={styles.sceneActions}>
                                                <button
                                                    aria-label={intl.formatMessage(messages.setStartupScene)}
                                                    className={classNames(styles.sceneActionButton, {
                                                        [styles.sceneActionButtonActive]: scene.isStartup
                                                    })}
                                                    disabled={busy || scene.isStartup}
                                                    title={intl.formatMessage(messages.setStartupScene)}
                                                    type="button"
                                                    onClick={() => handleSetStartup(scene.id)}
                                                >
                                                    <StarGlyph className={styles.smallIcon} />
                                                </button>
                                                <button
                                                    aria-label={intl.formatMessage(messages.renameScene)}
                                                    className={styles.sceneActionButton}
                                                    disabled={busy}
                                                    title={intl.formatMessage(messages.renameScene)}
                                                    type="button"
                                                    onClick={() => beginRename(scene)}
                                                >
                                                    <EditGlyph className={styles.smallIcon} />
                                                </button>
                                                <button
                                                    aria-label={intl.formatMessage(messages.duplicateScene)}
                                                    className={styles.sceneActionButton}
                                                    disabled={busy}
                                                    title={intl.formatMessage(messages.duplicateScene)}
                                                    type="button"
                                                    onClick={() => handleDuplicate(scene.id)}
                                                >
                                                    <CopyGlyph className={styles.smallIcon} />
                                                </button>
                                                <button
                                                    aria-label={intl.formatMessage(messages.deleteScene)}
                                                    className={classNames(
                                                        styles.sceneActionButton,
                                                        styles.sceneActionButtonDanger
                                                    )}
                                                    disabled={busy}
                                                    title={intl.formatMessage(messages.deleteScene)}
                                                    type="button"
                                                    onClick={() => requestDelete(scene.id)}
                                                >
                                                    <TrashGlyph className={styles.smallIcon} />
                                                </button>
                                            </div>
                                        </React.Fragment>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {deleteScene ? (
                        <div className={styles.deleteConfirmation} role="alertdialog">
                            <div className={styles.deleteConfirmationIcon}>
                                <TrashGlyph className={styles.deleteIcon} />
                            </div>
                            <div className={styles.deleteConfirmationBody}>
                                <div className={styles.deleteConfirmationText}>
                                    {deleteFallback ? intl.formatMessage(messages.deleteWithFallback, {
                                        fallback: deleteFallback.name,
                                        scene: deleteScene.name
                                    }) : intl.formatMessage(messages.deleteWithReplacement, {
                                        scene: deleteScene.name
                                    })}
                                </div>
                                <div className={styles.deleteConfirmationActions}>
                                    <button
                                        className={styles.secondaryButton}
                                        disabled={busy}
                                        type="button"
                                        onClick={() => setDeleteSceneId(null)}
                                    >
                                        {intl.formatMessage(messages.cancel)}
                                    </button>
                                    <button
                                        className={styles.dangerButton}
                                        disabled={busy}
                                        type="button"
                                        onClick={confirmDelete}
                                    >
                                        {intl.formatMessage(messages.confirmDelete)}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
};

SceneSelector.propTypes = {
    className: PropTypes.string,
    intl: intlShape.isRequired,
    vm: PropTypes.shape({
        runtime: PropTypes.object
    }).isRequired
};

export {SceneSelector};
export default injectIntl(SceneSelector);
