import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

import {CAMERA2D_TYPE_ID} from '../../core/camera2d';
import {CHARACTER_CONTROLLER2D_TYPE_ID} from '../../core/character-controller2d';
import {
    COLLIDER2D_SHAPE_TYPES,
    COLLIDER2D_TRANSFORM_INHERITANCE,
    COLLIDER2D_TYPE_ID,
    isConvexPolygon
} from '../../core/collider2d';
import {PROTOCOL_DTO_KINDS} from '../../core/protocol';
import {FUNCTIONAL_NODE_ARCHETYPE_IDS} from '../../core/functional-node';
import {TRANSFORM2D_TYPE_ID} from '../../core/transform2d';
import {RIGIDBODY2D_TYPE_ID} from '../../core/rigidbody2d';
import {TILEMAP_LAYER2D_TYPE_ID} from '../../core/tilemap-layer2d';
import {ensureTileDefinition} from '../../core/tileset';
import {getInspectorRegistry} from '../../lib/project-inspector/inspector-registry';
import {getPropertyHistory} from '../../lib/project-inspector/property-history';
import {
    PASSIVE_SCRATCH_TARGET_UI_REFRESH_MS,
    hasActiveScratchThreads
} from '../../lib/scratch-sprite-adapter/scratch-runtime-update-policy';
import {getEditorCommandManager} from '../../lib/editor-commands/editor-command-manager';
import {
    CHARACTER_TEST_DRIVE_MODES,
    COLLIDER_GIZMO_GLOBAL_MODE,
    COLLIDER_GIZMO_VISIBILITY,
    convertColliderShapePreservingBounds,
    createDefaultColliderShape,
    getCharacterTestDrive,
    getColliderGizmoPreferences,
    getEditorTransformPreview,
    getShapeBounds,
    insertConvexPolygonPoint,
    removeConvexPolygonPoint
} from '../../lib/editor-visualization';
import {getNodeDatabase, installNodeDatabase} from '../../lib/project-nodes/node-database';
import {
    WORKSPACE_NODE_DOMAINS,
    createWorkspaceNodeCommandClientForVM
} from '../../lib/editor-shell/node-workspace-command';
import {TOOL_IDS} from '../../lib/editor-shell/tool-registry';
import {FUNCTIONAL_NODE_CREATION_CAPABILITY_ID} from '../../lib/functional-node';
import {materializePortableCapabilityValue} from '../../lib/first-party-modules/materialize-portable-capability-value';
import {
    TRANSFORM2D_COMMAND_CAPABILITY_ID,
    TRANSFORM2D_RUNTIME_CAPABILITY_ID,
    createTransform2DEditorClient
} from '../../lib/transform-system';
import {
    CAMERA2D_COMMAND_CAPABILITY_ID,
    CAMERA2D_RUNTIME_CAPABILITY_ID,
    createCamera2DEditorClient
} from '../../lib/camera-system';
import {
    COLLIDER2D_COMMAND_CAPABILITY_ID,
    COLLIDER2D_RUNTIME_CAPABILITY_ID,
    createCollider2DEditorClient
} from '../../lib/collision-system';
import {
    TILEMAP_LAYER2D_COMMAND_CAPABILITY_ID,
    TILEMAP_LAYER2D_RUNTIME_CAPABILITY_ID,
    TILESET_RESOURCE_CAPABILITY_ID,
    createTileMapLayer2DEditorClient,
    getTileMapEditorState
} from '../../lib/tilemap-system';
import {
    CHARACTER_CONTROLLER2D_COMMAND_CAPABILITY_ID,
    CHARACTER_CONTROLLER2D_RUNTIME_CAPABILITY_ID,
    createCharacterController2DEditorClient
} from '../../lib/character-controller-system';
import {
    PHYSICS2D_RUNTIME_CAPABILITY_ID,
    PHYSICS_MATERIAL2D_RESOURCE_CAPABILITY_ID,
    RIGIDBODY2D_COMMAND_CAPABILITY_ID,
    createRigidBody2DEditorClient
} from '../../lib/physics-system';

import styles from './project-inspector.css';

const SCENE_SYSTEM_MODULE_ID = 'ngvge.scene-system';
const RUNTIME_NODE_MODEL_CAPABILITY_ID = 'ngvge.runtime-node-model';
const SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID = 'ngvge.scratch-sprite-node-adapter';
const PASSIVE_RUNTIME_INSPECTOR_REFRESH_MS = 83;

const normalizeDraftValue = value => (
    value === null || typeof value === 'undefined' ? '' : String(value)
);

const DraftInput = props => {
    const {
        disabled,
        max,
        min,
        onCommit,
        step,
        type,
        value
    } = props;
    const [draft, setDraft] = React.useState(normalizeDraftValue(value));

    React.useEffect(() => {
        setDraft(normalizeDraftValue(value));
    }, [value]);

    const commit = () => {
        if (disabled) return;
        if (type === 'number') {
            const numberValue = Number(draft);
            if (!Number.isFinite(numberValue)) {
                setDraft(normalizeDraftValue(value));
                return;
            }
            onCommit(numberValue);
        } else {
            onCommit(draft);
        }
    };

    return (
        <input
            className={styles.input}
            disabled={disabled}
            max={max}
            min={min}
            step={step}
            type={type}
            value={draft}
            onBlur={commit}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    event.currentTarget.blur();
                } else if (event.key === 'Escape') {
                    setDraft(normalizeDraftValue(value));
                    event.currentTarget.blur();
                }
            }}
        />
    );
};

DraftInput.propTypes = {
    disabled: PropTypes.bool,
    max: PropTypes.number,
    min: PropTypes.number,
    onCommit: PropTypes.func.isRequired,
    step: PropTypes.number,
    type: PropTypes.oneOf(['number', 'text']),
    value: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
};

DraftInput.defaultProps = {
    disabled: false,
    max: undefined,
    min: undefined,
    step: undefined,
    type: 'text',
    value: ''
};

const InspectorRow = ({children, label}) => (
    <label className={styles.row}>
        <span className={styles.rowLabel}>{label}</span>
        <span className={styles.rowControl}>{children}</span>
    </label>
);

InspectorRow.propTypes = {
    children: PropTypes.node.isRequired,
    label: PropTypes.node.isRequired
};

const InspectorSection = props => {
    const {
        children,
        expanded,
        id,
        label,
        onToggle,
        secondaryLabel
    } = props;

    return (
        <section className={styles.section} data-inspector-section={id}>
            <button
                aria-expanded={expanded}
                className={styles.sectionHeader}
                type="button"
                onClick={() => onToggle(id, !expanded)}
            >
                <span
                    aria-hidden="true"
                    className={classNames(styles.sectionDisclosure, {
                        [styles.sectionDisclosureExpanded]: expanded
                    })}
                >
                    ▸
                </span>
                <span className={styles.sectionTitle}>{label}</span>
                {secondaryLabel ? (
                    <span className={styles.sectionSecondary}>{secondaryLabel}</span>
                ) : null}
            </button>
            {expanded ? <div className={styles.sectionBody}>{children}</div> : null}
        </section>
    );
};

InspectorSection.propTypes = {
    children: PropTypes.node.isRequired,
    expanded: PropTypes.bool.isRequired,
    id: PropTypes.string.isRequired,
    label: PropTypes.node.isRequired,
    onToggle: PropTypes.func.isRequired,
    secondaryLabel: PropTypes.node
};

InspectorSection.defaultProps = {
    secondaryLabel: null
};

const ExtensionField = ({field, onCommit}) => {
    if (field.type === 'boolean') {
        return (
            <input
                checked={Boolean(field.value)}
                className={styles.checkbox}
                disabled={field.disabled}
                type="checkbox"
                onChange={event => onCommit(event.target.checked)}
            />
        );
    }

    if (field.type === 'select') {
        return (
            <select
                className={styles.select}
                disabled={field.disabled}
                value={normalizeDraftValue(field.value)}
                onChange={event => onCommit(event.target.value)}
            >
                {(field.options || []).map(option => (
                    <option key={String(option.value)} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        );
    }

    return (
        <DraftInput
            disabled={field.disabled}
            max={field.max}
            min={field.min}
            step={field.step}
            type={field.type === 'number' ? 'number' : 'text'}
            value={field.value}
            onCommit={onCommit}
        />
    );
};

ExtensionField.propTypes = {
    field: PropTypes.shape({
        disabled: PropTypes.bool,
        id: PropTypes.string.isRequired,
        label: PropTypes.string.isRequired,
        max: PropTypes.number,
        min: PropTypes.number,
        options: PropTypes.arrayOf(PropTypes.shape({
            label: PropTypes.string.isRequired,
            value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired
        })),
        step: PropTypes.number,
        type: PropTypes.string,
        value: PropTypes.oneOfType([PropTypes.bool, PropTypes.number, PropTypes.string])
    }).isRequired,
    onCommit: PropTypes.func.isRequired
};

const legacyColliderPropertiesToPatch = (properties, sensor) => {
    const source = properties && typeof properties === 'object' ? properties : {};
    const positive = (value, fallback) => {
        const number = Math.abs(Number(value));
        return Number.isFinite(number) && number > 0 ? number : fallback;
    };
    const finite = (value, fallback = 0) => {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    };
    const width = positive(source.width, 100);
    const height = positive(source.height, 100);
    const radius = positive(source.radius, Math.max(width, height) / 2);
    let shape;
    if (source.shape === 'circle') {
        shape = {radius, type: COLLIDER2D_SHAPE_TYPES.CIRCLE};
    } else if (source.shape === 'polygon') {
        shape = {
            points: [
                [-width / 2, -height / 2],
                [width / 2, -height / 2],
                [width / 2, height / 2],
                [-width / 2, height / 2]
            ],
            type: COLLIDER2D_SHAPE_TYPES.CONVEX_POLYGON
        };
    } else {
        shape = {size: [width, height], type: COLLIDER2D_SHAPE_TYPES.RECTANGLE};
    }
    return {
        collisionLayer: Math.max(0, Math.trunc(finite(source.collisionLayer, 1))) >>> 0,
        collisionMask: Math.max(0, Math.trunc(finite(source.collisionMask, 1))) >>> 0,
        offset: [finite(source.offsetX), finite(source.offsetY)],
        rotation: 0,
        sensor: Boolean(sensor),
        shape
    };
};

const isTransientColliderAuthoringEvent = change => Boolean(change && (
    change.type === 'authoring-preview-begin' ||
    change.type === 'authoring-preview-patch' ||
    change.type === 'authoring-preview-cancel'
));

const isPassiveColliderGeometryRefreshEvent = change => Boolean(change && change.type === 'collision:refresh');

const ProjectInspector = props => {
    const {
        editingTargetId,
        expandedSectionIds,
        nodeCommandClient,
        onClose,
        onSelectNode,
        onSelectTarget,
        onToggleSection,
        selectedNodeId,
        showHeader,
        vm,
        width
    } = props;
    const [revision, setRevision] = React.useState(0);
    const [historyRevision, setHistoryRevision] = React.useState(0);
    const [runtimeNodeCommandError, setRuntimeNodeCommandError] = React.useState(null);
    const [runtimeTransformError, setRuntimeTransformError] = React.useState(null);
    const [runtimeCameraError, setRuntimeCameraError] = React.useState(null);
    const [runtimeColliderError, setRuntimeColliderError] = React.useState(null);
    const [runtimeCharacterError, setRuntimeCharacterError] = React.useState(null);
    const [runtimeTileMapError, setRuntimeTileMapError] = React.useState(null);
    const [runtimeRigidBodyError, setRuntimeRigidBodyError] = React.useState(null);
    const refresh = React.useCallback(() => setRevision(value => value + 1), []);
    const refreshHistory = React.useCallback(() => setHistoryRevision(value => value + 1), []);
    const runtime = vm && vm.runtime;
    const colliderGizmoPreferences = React.useMemo(() => (
        runtime ? getColliderGizmoPreferences(runtime) : null
    ), [runtime]);
    const characterTestDrive = React.useMemo(() => (
        runtime ? getCharacterTestDrive(runtime) : null
    ), [runtime]);
    const transformPreview = React.useMemo(() => (
        runtime ? getEditorTransformPreview(runtime) : null
    ), [runtime]);
    const tileMapEditorState = React.useMemo(() => (
        runtime ? getTileMapEditorState(runtime) : null
    ), [runtime]);
    const registry = React.useMemo(() => getInspectorRegistry(runtime), [runtime]);
    const history = React.useMemo(() => getPropertyHistory(runtime), [runtime]);
    const nodeDatabase = React.useMemo(() => (
        runtime ? (getNodeDatabase(runtime) || installNodeDatabase(vm)) : null
    ), [runtime, vm]);
    const moduleManager = runtime ? runtime.ngvgeFirstPartyModules : null;
    const sceneModuleState = moduleManager ? moduleManager.getModuleState(SCENE_SYSTEM_MODULE_ID) : null;
    const runtimeNodeModel = sceneModuleState && sceneModuleState.enabled ?
        moduleManager.getCapability(RUNTIME_NODE_MODEL_CAPABILITY_ID) : null;
    const scratchSpriteAdapter = sceneModuleState && sceneModuleState.enabled ?
        moduleManager.getCapability(SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID) : null;
    const functionalNodeCreation = sceneModuleState && sceneModuleState.enabled ?
        moduleManager.getCapability(FUNCTIONAL_NODE_CREATION_CAPABILITY_ID) : null;
    const workspaceNodeCommandClient = React.useMemo(() => (
        nodeCommandClient || createWorkspaceNodeCommandClientForVM({
            selectionWriter: onSelectNode,
            toolId: TOOL_IDS.INSPECTOR,
            vm
        })
    ), [nodeCommandClient, onSelectNode, vm]);
    const transformRuntimeCapability = sceneModuleState && sceneModuleState.enabled ?
        moduleManager.getCapability(TRANSFORM2D_RUNTIME_CAPABILITY_ID) : null;
    const transformCommandCapability = sceneModuleState && sceneModuleState.enabled ?
        moduleManager.getCapability(TRANSFORM2D_COMMAND_CAPABILITY_ID) : null;
    const transformEditorClient = React.useMemo(() => {
        if (!transformCommandCapability) return null;
        try {
            return createTransform2DEditorClient(transformCommandCapability);
        } catch {
            return null;
        }
    }, [transformCommandCapability]);
    const cameraRuntimeCapability = sceneModuleState && sceneModuleState.enabled ?
        moduleManager.getCapability(CAMERA2D_RUNTIME_CAPABILITY_ID) : null;
    const cameraCommandCapability = sceneModuleState && sceneModuleState.enabled ?
        moduleManager.getCapability(CAMERA2D_COMMAND_CAPABILITY_ID) : null;
    const cameraEditorClient = React.useMemo(() => {
        if (!cameraCommandCapability) return null;
        try {
            return createCamera2DEditorClient(cameraCommandCapability);
        } catch {
            return null;
        }
    }, [cameraCommandCapability]);
    const colliderRuntimeCapability = sceneModuleState && sceneModuleState.enabled ?
        moduleManager.getCapability(COLLIDER2D_RUNTIME_CAPABILITY_ID) : null;
    const colliderCommandCapability = sceneModuleState && sceneModuleState.enabled ?
        moduleManager.getCapability(COLLIDER2D_COMMAND_CAPABILITY_ID) : null;
    const colliderEditorClient = React.useMemo(() => {
        if (!colliderCommandCapability) return null;
        try {
            return createCollider2DEditorClient(colliderCommandCapability);
        } catch {
            return null;
        }
    }, [colliderCommandCapability]);
    const characterRuntimeCapability = sceneModuleState && sceneModuleState.enabled ?
        moduleManager.getCapability(CHARACTER_CONTROLLER2D_RUNTIME_CAPABILITY_ID) : null;
    const characterCommandCapability = sceneModuleState && sceneModuleState.enabled ?
        moduleManager.getCapability(CHARACTER_CONTROLLER2D_COMMAND_CAPABILITY_ID) : null;
    const characterEditorClient = React.useMemo(() => {
        if (!characterCommandCapability) return null;
        try {
            return createCharacterController2DEditorClient(characterCommandCapability);
        } catch {
            return null;
        }
    }, [characterCommandCapability]);
    const physicsRuntimeCapability = sceneModuleState && sceneModuleState.enabled ?
        moduleManager.getCapability(PHYSICS2D_RUNTIME_CAPABILITY_ID) : null;
    const rigidBodyCommandCapability = sceneModuleState && sceneModuleState.enabled ?
        moduleManager.getCapability(RIGIDBODY2D_COMMAND_CAPABILITY_ID) : null;
    const physicsMaterialResourceCapability = sceneModuleState && sceneModuleState.enabled ?
        moduleManager.getCapability(PHYSICS_MATERIAL2D_RESOURCE_CAPABILITY_ID) : null;
    const rigidBodyEditorClient = React.useMemo(() => {
        if (!rigidBodyCommandCapability) return null;
        try { return createRigidBody2DEditorClient(rigidBodyCommandCapability); } catch { return null; }
    }, [rigidBodyCommandCapability]);
    const tileMapRuntimeCapability = sceneModuleState && sceneModuleState.enabled ?
        moduleManager.getCapability(TILEMAP_LAYER2D_RUNTIME_CAPABILITY_ID) : null;
    const tileMapCommandCapability = sceneModuleState && sceneModuleState.enabled ?
        moduleManager.getCapability(TILEMAP_LAYER2D_COMMAND_CAPABILITY_ID) : null;
    const tileSetResourceCapability = sceneModuleState && sceneModuleState.enabled ?
        moduleManager.getCapability(TILESET_RESOURCE_CAPABILITY_ID) : null;
    const tileMapEditorClient = React.useMemo(() => {
        if (!tileMapCommandCapability) return null;
        try { return createTileMapLayer2DEditorClient(tileMapCommandCapability); } catch { return null; }
    }, [tileMapCommandCapability]);

    React.useEffect(() => {
        if (!registry) return () => {};
        return registry.subscribe(refresh);
    }, [registry, refresh]);

    React.useEffect(() => {
        if (!vm || typeof vm.on !== 'function') return () => {};
        let timerHandle = null;
        let frameHandle = null;
        let scheduled = false;
        const flush = () => {
            timerHandle = null;
            frameHandle = null;
            scheduled = false;
            refresh();
        };
        const onTargetsUpdate = () => {
            if (!hasActiveScratchThreads(vm)) {
                if (!scheduled) flush();
                return;
            }
            if (scheduled) return;
            scheduled = true;
            timerHandle = setTimeout(() => {
                timerHandle = null;
                if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
                    frameHandle = window.requestAnimationFrame(flush);
                } else {
                    flush();
                }
            }, PASSIVE_SCRATCH_TARGET_UI_REFRESH_MS);
        };
        vm.on('targetsUpdate', onTargetsUpdate);
        return () => {
            vm.off('targetsUpdate', onTargetsUpdate);
            if (timerHandle !== null) clearTimeout(timerHandle);
            if (frameHandle !== null && typeof window !== 'undefined' &&
                typeof window.cancelAnimationFrame === 'function') {
                window.cancelAnimationFrame(frameHandle);
            }
        };
    }, [refresh, vm]);

    React.useEffect(() => {
        if (!history) return () => {};
        return history.subscribe(refreshHistory);
    }, [history, refreshHistory]);

    React.useEffect(() => {
        if (!colliderGizmoPreferences || typeof colliderGizmoPreferences.subscribe !== 'function') return () => {};
        return colliderGizmoPreferences.subscribe(refresh);
    }, [colliderGizmoPreferences, refresh]);

    React.useEffect(() => {
        if (!characterTestDrive || typeof characterTestDrive.subscribe !== 'function') return () => {};
        return characterTestDrive.subscribe(refresh);
    }, [characterTestDrive, refresh]);

    React.useEffect(() => {
        if (!physicsRuntimeCapability || typeof physicsRuntimeCapability.subscribe !== 'function') return () => {};
        return physicsRuntimeCapability.subscribe(change => {
            // Per-fixed-step motion is already represented by Transform2D Runtime updates below.
            // Re-rendering the whole Inspector once for physics:step and again for runtime:patch
            // doubles the passive selected-node presentation cost without exposing new information.
            if (change && change.type === 'physics:step') return;
            refresh();
        });
    }, [physicsRuntimeCapability, refresh]);

    React.useEffect(() => {
        if (!transformPreview || typeof transformPreview.subscribe !== 'function') return () => {};
        return transformPreview.subscribe(refresh);
    }, [refresh, transformPreview]);

    React.useEffect(() => {
        if (!nodeDatabase) return () => {};
        return nodeDatabase.subscribe(refresh);
    }, [nodeDatabase, refresh]);

    React.useEffect(() => {
        if (!runtimeNodeModel || typeof runtimeNodeModel.subscribe !== 'function') return () => {};
        return runtimeNodeModel.subscribe(refresh);
    }, [refresh, runtimeNodeModel]);

    React.useEffect(() => {
        if (!transformRuntimeCapability || typeof transformRuntimeCapability.subscribe !== 'function') return () => {};
        let frameHandle = null;
        let timerHandle = null;
        let scheduled = false;
        let lastPassiveRefreshAt = 0;
        const now = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ?
            performance.now() : Date.now());
        const flush = () => {
            frameHandle = null;
            timerHandle = null;
            scheduled = false;
            lastPassiveRefreshAt = now();
            refresh();
        };
        const scheduleFrame = delayMs => {
            if (delayMs > 0) {
                timerHandle = setTimeout(flush, delayMs);
                return;
            }
            if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
                frameHandle = window.requestAnimationFrame(flush);
            } else {
                timerHandle = setTimeout(flush, 16);
            }
        };
        const scheduleRefresh = change => {
            if (change && change.nodeId && selectedNodeId && change.nodeId !== selectedNodeId) return;
            if (scheduled) return;
            scheduled = true;
            // Runtime patches are high-frequency execution telemetry (not editor authority mutations).
            // Sample Inspector numbers at ~12 Hz while the Stage gizmo stays frame-accurate via its
            // passive DOM fast path. Commit/attach/detach/rehydrate events remain immediate.
            if (change && change.type === 'runtime:patch') {
                const elapsed = now() - lastPassiveRefreshAt;
                scheduleFrame(Math.max(0, PASSIVE_RUNTIME_INSPECTOR_REFRESH_MS - elapsed));
                return;
            }
            scheduleFrame(0);
        };
        const unsubscribe = transformRuntimeCapability.subscribe(scheduleRefresh);
        return () => {
            if (typeof unsubscribe === 'function') unsubscribe();
            if (frameHandle !== null && typeof window !== 'undefined' &&
                typeof window.cancelAnimationFrame === 'function') {
                window.cancelAnimationFrame(frameHandle);
            }
            if (timerHandle !== null) clearTimeout(timerHandle);
        };
    }, [refresh, selectedNodeId, transformRuntimeCapability]);

    React.useEffect(() => {
        if (!cameraRuntimeCapability || typeof cameraRuntimeCapability.subscribe !== 'function') return () => {};
        return cameraRuntimeCapability.subscribe(change => {
            if (change && change.nodeId && selectedNodeId && change.nodeId !== selectedNodeId) return;
            refresh();
        });
    }, [cameraRuntimeCapability, refresh, selectedNodeId]);

    React.useEffect(() => {
        if (!colliderRuntimeCapability || typeof colliderRuntimeCapability.subscribe !== 'function') return () => {};
        return colliderRuntimeCapability.subscribe(change => {
            // Transient Collider2D authoring is presented by the stage gizmo fast path.
            // It must not force the full Project Inspector to synchronously rerender on every drag frame.
            if (isTransientColliderAuthoringEvent(change)) return;
            if (isPassiveColliderGeometryRefreshEvent(change)) return;
            if (change && change.nodeId && selectedNodeId && change.nodeId !== selectedNodeId &&
                change.otherNodeId !== selectedNodeId && change.areaNodeId !== selectedNodeId) return;
            refresh();
        });
    }, [colliderRuntimeCapability, refresh, selectedNodeId]);

    React.useEffect(() => {
        if (!characterRuntimeCapability || typeof characterRuntimeCapability.subscribe !== 'function') return () => {};
        return characterRuntimeCapability.subscribe(change => {
            if (change && change.nodeId && selectedNodeId && change.nodeId !== selectedNodeId) return;
            refresh();
        });
    }, [characterRuntimeCapability, refresh, selectedNodeId]);

    React.useEffect(() => {
        if (!tileMapRuntimeCapability || typeof tileMapRuntimeCapability.subscribe !== 'function') return () => {};
        return tileMapRuntimeCapability.subscribe(change => {
            if (change && change.nodeId && selectedNodeId && change.nodeId !== selectedNodeId) return;
            refresh();
        });
    }, [refresh, selectedNodeId, tileMapRuntimeCapability]);

    React.useEffect(() => {
        if (!tileSetResourceCapability || typeof tileSetResourceCapability.subscribe !== 'function') return () => {};
        return tileSetResourceCapability.subscribe(refresh);
    }, [refresh, tileSetResourceCapability]);

    React.useEffect(() => {
        if (!tileMapEditorState || typeof tileMapEditorState.subscribe !== 'function') return () => {};
        return tileMapEditorState.subscribe(refresh);
    }, [refresh, tileMapEditorState]);

    const target = runtime && editingTargetId ? runtime.getTargetById(editingTargetId) : null;
    const selectedRuntimeNode = runtimeNodeModel && selectedNodeId ?
        materializePortableCapabilityValue(runtimeNodeModel.getNodeSnapshot(selectedNodeId)) : null;
    const selectedRuntimeScratchBinding = selectedRuntimeNode && scratchSpriteAdapter &&
        typeof scratchSpriteAdapter.getBindingByNodeId === 'function' ?
        materializePortableCapabilityValue(
            scratchSpriteAdapter.getBindingByNodeId(selectedRuntimeNode.id, selectedRuntimeNode.sceneId)
        ) : null;
    const selectedRuntimeScratchTarget = selectedRuntimeScratchBinding && runtime &&
        typeof runtime.getTargetById === 'function' && selectedRuntimeScratchBinding.targetRuntimeId ?
        runtime.getTargetById(selectedRuntimeScratchBinding.targetRuntimeId) : null;
    const selectedRuntimeNodeType = selectedRuntimeNode && typeof runtimeNodeModel.getNodeType === 'function' ?
        materializePortableCapabilityValue(runtimeNodeModel.getNodeType(selectedRuntimeNode.typeId)) : null;
    const selectedRuntimeNodeParent = selectedRuntimeNode ?
        materializePortableCapabilityValue(runtimeNodeModel.getParent(selectedRuntimeNode.id)) : null;
    const selectedRuntimeNodeChildren = selectedRuntimeNode ?
        materializePortableCapabilityValue(runtimeNodeModel.getChildren(selectedRuntimeNode.id)) : [];
    const selectedRuntimeComponents = selectedRuntimeNode && Array.isArray(selectedRuntimeNode.components) ?
        selectedRuntimeNode.components : [];
    const selectedRuntimeTransformComponent = selectedRuntimeComponents.find(
        component => component && component.typeId === TRANSFORM2D_TYPE_ID
    ) || null;
    const selectedRuntimeCameraComponent = selectedRuntimeComponents.find(
        component => component && component.typeId === CAMERA2D_TYPE_ID
    ) || null;
    const selectedRuntimeColliderComponent = selectedRuntimeComponents.find(
        component => component && component.typeId === COLLIDER2D_TYPE_ID
    ) || null;
    const selectedRuntimeCharacterComponent = selectedRuntimeComponents.find(
        component => component && component.typeId === CHARACTER_CONTROLLER2D_TYPE_ID
    ) || null;
    const selectedRuntimeTileMapComponent = selectedRuntimeComponents.find(
        component => component && component.typeId === TILEMAP_LAYER2D_TYPE_ID
    ) || null;
    const selectedRuntimeRigidBodyComponent = selectedRuntimeComponents.find(
        component => component && component.typeId === RIGIDBODY2D_TYPE_ID
    ) || null;
    const selectedRuntimeTransform = (() => {
        if (!transformRuntimeCapability || !selectedRuntimeNode || !selectedRuntimeTransformComponent ||
            typeof transformRuntimeCapability.getRuntimeTransform !== 'function') return null;
        try {
            return materializePortableCapabilityValue(
                transformRuntimeCapability.getRuntimeTransform(selectedRuntimeNode.id)
            );
        } catch {
            return null;
        }
    })();
    const selectedRuntimeTransformPreview = (() => {
        if (!selectedRuntimeTransform || !selectedRuntimeNode || !transformPreview) return selectedRuntimeTransform;
        const preview = transformPreview.getSnapshot();
        if (!preview || !preview.active || preview.nodeId !== selectedRuntimeNode.id ||
            !Array.isArray(preview.previewPosition)) return selectedRuntimeTransform;
        return Object.assign({}, selectedRuntimeTransform, {position: preview.previewPosition.slice()});
    })();
    const selectedRuntimeTransformIsPreview = selectedRuntimeTransformPreview !== selectedRuntimeTransform;
    const runtimeTransformDiverged = (() => {
        if (!transformRuntimeCapability || !selectedRuntimeNode || !selectedRuntimeTransformComponent ||
            typeof transformRuntimeCapability.isRuntimeDivergedFromPersistent !== 'function') return false;
        try {
            return Boolean(transformRuntimeCapability.isRuntimeDivergedFromPersistent(selectedRuntimeNode.id));
        } catch {
            return false;
        }
    })();
    const selectedRuntimeCamera = (() => {
        if (!cameraRuntimeCapability || !selectedRuntimeNode || !selectedRuntimeCameraComponent ||
            typeof cameraRuntimeCapability.getCamera !== 'function') return null;
        try {
            return materializePortableCapabilityValue(cameraRuntimeCapability.getCamera(selectedRuntimeNode.id));
        } catch {
            return null;
        }
    })();
    const activeRuntimeCameraNodeId = (() => {
        if (!cameraRuntimeCapability || typeof cameraRuntimeCapability.getViewportState !== 'function') return null;
        try {
            const state = materializePortableCapabilityValue(cameraRuntimeCapability.getViewportState());
            return state ? state.activeCameraNodeId : null;
        } catch {
            return null;
        }
    })();
    const selectedRuntimeCollider = (() => {
        if (!colliderRuntimeCapability || !selectedRuntimeNode || !selectedRuntimeColliderComponent ||
            typeof colliderRuntimeCapability.getCollider !== 'function') return null;
        try {
            return materializePortableCapabilityValue(colliderRuntimeCapability.getCollider(selectedRuntimeNode.id));
        } catch {
            return null;
        }
    })();
    const selectedRuntimeColliderShapeBounds = selectedRuntimeCollider && selectedRuntimeCollider.config ?
        getShapeBounds(selectedRuntimeCollider.config.shape) : null;
    const selectedRuntimeColliderGizmoVisibility = selectedRuntimeNode && colliderGizmoPreferences ?
        colliderGizmoPreferences.getNodeVisibility(selectedRuntimeNode.id) : COLLIDER_GIZMO_VISIBILITY.INHERIT;
    const selectedRuntimeCharacter = (() => {
        if (!characterRuntimeCapability || !selectedRuntimeNode || !selectedRuntimeCharacterComponent ||
            typeof characterRuntimeCapability.getController !== 'function') return null;
        try {
            return materializePortableCapabilityValue(characterRuntimeCapability.getController(selectedRuntimeNode.id));
        } catch {
            return null;
        }
    })();
    const selectedRuntimeRigidBody = (() => {
        if (!physicsRuntimeCapability || !selectedRuntimeNode || !selectedRuntimeRigidBodyComponent ||
            typeof physicsRuntimeCapability.getRigidBody !== 'function') return null;
        try { return materializePortableCapabilityValue(physicsRuntimeCapability.getRigidBody(selectedRuntimeNode.id)); }
        catch { return null; }
    })();
    const physicsRuntimeStatus = (() => {
        if (!physicsRuntimeCapability || typeof physicsRuntimeCapability.getStatus !== 'function') return null;
        try { return materializePortableCapabilityValue(physicsRuntimeCapability.getStatus()); } catch { return null; }
    })();
    const availablePhysicsMaterials = (() => {
        if (!physicsMaterialResourceCapability || typeof physicsMaterialResourceCapability.listMaterials !== 'function') return [];
        try {
            const values = materializePortableCapabilityValue(physicsMaterialResourceCapability.listMaterials());
            return Array.isArray(values) ? values : [];
        } catch { return []; }
    })();
    const selectedRuntimeTileMap = (() => {
        if (!tileMapRuntimeCapability || !selectedRuntimeNode || !selectedRuntimeTileMapComponent ||
            typeof tileMapRuntimeCapability.getLayer !== 'function') return null;
        try { return materializePortableCapabilityValue(tileMapRuntimeCapability.getLayer(selectedRuntimeNode.id)); }
        catch { return null; }
    })();
    const tileMapEditorSnapshot = tileMapEditorState ? tileMapEditorState.getState() : null;
    const availableTileSets = (() => {
        if (!tileSetResourceCapability || typeof tileSetResourceCapability.listTileSets !== 'function') return [];
        try {
            const values = materializePortableCapabilityValue(tileSetResourceCapability.listTileSets());
            return Array.isArray(values) ? values : [];
        } catch { return []; }
    })();
    const selectedTileSet = selectedRuntimeTileMap && selectedRuntimeTileMap.config.tileSetResourceId &&
        tileSetResourceCapability && typeof tileSetResourceCapability.getTileSet === 'function' ? (() => {
            try { return materializePortableCapabilityValue(
                tileSetResourceCapability.getTileSet(selectedRuntimeTileMap.config.tileSetResourceId)
            ); } catch { return null; }
        })() : null;
    const selectedTileSetTile = selectedTileSet && selectedTileSet.data && tileMapEditorSnapshot ?
        ensureTileDefinition(selectedTileSet.data, tileMapEditorSnapshot.activeTileId) : null;
    const availableImageResources = runtime && runtime.ngvgeGlobalAssetDatabase &&
        typeof runtime.ngvgeGlobalAssetDatabase.listResources === 'function' ?
        runtime.ngvgeGlobalAssetDatabase.listResources().filter(resource => resource.kind === 'costume') : [];
    const characterTestDriveState = characterTestDrive ? characterTestDrive.getState() : null;
    const selectedRuntimeCharacterTestDriveActive = Boolean(
        selectedRuntimeNode && characterTestDriveState && characterTestDriveState.running &&
        characterTestDriveState.activeNodeId === selectedRuntimeNode.id
    );
    const selectedNode = nodeDatabase && selectedNodeId ? nodeDatabase.getNode(selectedNodeId) : null;
    const isCustomNode = Boolean(selectedNode && !selectedNode.targetId);
    const selectedNodeType = isCustomNode ? nodeDatabase.getNodeType(selectedNode.typeId) : null;
    const selectedNodeParent = isCustomNode ? nodeDatabase.getParent(selectedNode.id) : null;
    const selectedNodeChildren = isCustomNode ? nodeDatabase.getChildren(selectedNode.id) : [];
    const isLegacyCompatibilityCollider = Boolean(
        isCustomNode && selectedNode && selectedNode.typeId === COLLIDER2D_TYPE_ID
    );

    const originalSprites = React.useMemo(() => {
        if (!runtime) return [];
        return runtime.targets
            .filter(candidate => candidate && candidate.isOriginal && !candidate.isStage)
            .slice()
            .sort((targetA, targetB) => {
                const orderA = typeof targetA.getLayerOrder === 'function' ? targetA.getLayerOrder() : 0;
                const orderB = typeof targetB.getLayerOrder === 'function' ? targetB.getLayerOrder() : 0;
                return orderB - orderA;
            });
    }, [runtime, revision]);

    const isExpanded = sectionId => expandedSectionIds.indexOf(sectionId) !== -1;

    const emitTargetRefresh = React.useCallback(() => {
        if (typeof vm.emitTargetsUpdate === 'function') vm.emitTargetsUpdate(false);
        refresh();
    }, [refresh, vm]);

    const applySpriteInfo = React.useCallback((targetId, data) => {
        const currentTarget = runtime && runtime.getTargetById(targetId);
        if (!currentTarget || currentTarget.isStage) return;
        if (vm.editingTarget && vm.editingTarget.id === targetId) {
            vm.postSpriteInfo(data);
        } else {
            currentTarget.postSpriteInfo(data);
            runtime.emitProjectChanged();
        }
        emitTargetRefresh();
    }, [emitTargetRefresh, runtime, vm]);

    const commitSpriteProperty = React.useCallback((property, value, label) => {
        if (!target || target.isStage || !history) return;
        const targetId = target.id;
        const before = target[property];
        applySpriteInfo(targetId, {[property]: value});
        const updatedTarget = runtime.getTargetById(targetId);
        const after = updatedTarget ? updatedTarget[property] : value;
        history.recordValue({
            after,
            apply: nextValue => applySpriteInfo(targetId, {[property]: nextValue}),
            before,
            label,
            metadata: {property, targetId, type: 'sprite-property'}
        });
    }, [applySpriteInfo, history, runtime, target]);

    const commitSelectedRuntimeScratchProperty = React.useCallback((property, value, label) => {
        if (!selectedRuntimeScratchTarget || selectedRuntimeScratchTarget.isStage) return;
        const targetId = selectedRuntimeScratchTarget.id;
        const before = selectedRuntimeScratchTarget[property];
        applySpriteInfo(targetId, {[property]: value});
        if (!history) return;
        const updatedTarget = runtime.getTargetById(targetId);
        const after = updatedTarget ? updatedTarget[property] : value;
        history.recordValue({
            after,
            apply: nextValue => applySpriteInfo(targetId, {[property]: nextValue}),
            before,
            label,
            metadata: {nodeId: selectedRuntimeNode ? selectedRuntimeNode.id : null, property, targetId, type: 'scratch-compat-property'}
        });
    }, [applySpriteInfo, history, runtime, selectedRuntimeNode, selectedRuntimeScratchTarget]);

    const applyTargetName = React.useCallback((targetId, name) => {
        const currentTarget = runtime && runtime.getTargetById(targetId);
        if (!currentTarget || currentTarget.isStage) return;
        vm.renameSprite(targetId, name);
        emitTargetRefresh();
        return currentTarget.getName();
    }, [emitTargetRefresh, runtime, vm]);

    const renameTarget = React.useCallback(name => {
        if (!target || target.isStage || !history) return;
        const normalizedName = String(name).trim();
        const before = target.getName();
        if (!normalizedName || normalizedName === before) return;
        const targetId = target.id;
        const after = applyTargetName(targetId, normalizedName) || normalizedName;
        history.recordValue({
            after,
            apply: nextName => applyTargetName(targetId, nextName),
            before,
            label: `Rename ${before}`,
            metadata: {targetId, type: 'rename'}
        });
    }, [applyTargetName, history, target]);

    const getLayerSnapshot = React.useCallback(() => {
        if (!runtime) return [];
        return runtime.targets
            .filter(candidate => candidate && candidate.isOriginal && !candidate.isStage)
            .slice()
            .sort((targetA, targetB) => targetB.getLayerOrder() - targetA.getLayerOrder())
            .map(candidate => candidate.id);
    }, [runtime]);

    const applyLayerSnapshot = React.useCallback(targetIds => {
        if (!runtime) return;
        targetIds.forEach(targetId => {
            const layerTarget = runtime.getTargetById(targetId);
            if (layerTarget && !layerTarget.isStage) layerTarget.goToBack();
        });
        runtime.emitProjectChanged();
        emitTargetRefresh();
    }, [emitTargetRefresh, runtime]);

    const moveLayer = React.useCallback(action => {
        if (!target || target.isStage || !history) return;
        const before = getLayerSnapshot();
        if (action === 'front') target.goToFront();
        if (action === 'forward') target.goForwardLayers(1);
        if (action === 'backward') target.goBackwardLayers(1);
        if (action === 'back') target.goToBack();
        runtime.emitProjectChanged();
        emitTargetRefresh();
        const after = getLayerSnapshot();
        history.recordValue({
            after,
            apply: applyLayerSnapshot,
            before,
            label: `Layer: ${target.getName()} ${action}`,
            metadata: {targetId: target.id, type: 'layer'}
        });
    }, [applyLayerSnapshot, emitTargetRefresh, getLayerSnapshot, history, runtime, target]);

    const applyExtensionValue = React.useCallback((sectionId, targetId, fieldId, value) => {
        if (!registry || !runtime) return;
        const currentSection = registry.getSection(sectionId);
        const currentTarget = runtime.getTargetById(targetId);
        if (!currentSection || !currentTarget) return;
        currentSection.setValue(currentTarget, fieldId, value, {
            registry,
            runtime,
            vm
        });
        registry.notify({sectionId, targetId});
        emitTargetRefresh();
    }, [emitTargetRefresh, registry, runtime, vm]);

    const commandManager = React.useMemo(() => getEditorCommandManager(runtime), [runtime]);
    const handleHistoryUndo = React.useCallback(() => {
        if (commandManager) commandManager.execute('editor.undo', {scopeId: 'project'});
        else if (history) history.undo();
    }, [commandManager, history]);
    const handleHistoryRedo = React.useCallback(() => {
        if (commandManager) commandManager.execute('editor.redo', {scopeId: 'project'});
        else if (history) history.redo();
    }, [commandManager, history]);

    const extensionSections = React.useMemo(() => {
        if (!registry || !target || isCustomNode) return [];
        const context = {registry, runtime, vm};
        return registry.getSections(target, context)
            .filter(section => !section.hidden)
            .map(section => {
                try {
                    return {
                        section,
                        fields: section.getFields(target, context) || [],
                        error: null
                    };
                } catch (error) {
                    return {
                        section,
                        fields: [],
                        error: error && error.message ? error.message : String(error)
                    };
                }
            });
    }, [isCustomNode, registry, revision, runtime, target, vm]);

    const renameSelectedNode = React.useCallback(name => {
        if (!selectedNode) return;
        workspaceNodeCommandClient.patchNode({nodeId: selectedNode.id, patch: {name}});
    }, [selectedNode, workspaceNodeCommandClient]);

    const setSelectedNodeEnabled = React.useCallback(enabled => {
        if (!selectedNode) return;
        workspaceNodeCommandClient.patchNode({nodeId: selectedNode.id, patch: {enabled}});
    }, [selectedNode, workspaceNodeCommandClient]);

    const setSelectedNodeProperty = React.useCallback((fieldId, value) => {
        if (!selectedNode) return;
        workspaceNodeCommandClient.patchNode({
            nodeId: selectedNode.id,
            patch: {properties: {[fieldId]: value}}
        });
    }, [selectedNode, workspaceNodeCommandClient]);

    const upgradeLegacyCollider = React.useCallback(async sensor => {
        if (!isLegacyCompatibilityCollider || !selectedNode || !nodeDatabase || !runtimeNodeModel ||
            !functionalNodeCreation || !colliderEditorClient || !moduleManager) return null;
        let createdNodeId = null;
        try {
            const sceneProject = moduleManager.getModuleData(SCENE_SYSTEM_MODULE_ID, null);
            const scenes = sceneProject && Array.isArray(sceneProject.scenes) ? sceneProject.scenes : [];
            const scene = scenes.find(candidate => candidate.id === sceneProject.activeSceneId) || scenes[0] || null;
            if (!scene) throw new Error('No active scene is available for Collider2D upgrade.');
            const sceneRoot = runtimeNodeModel.getSceneRoot(scene.id);
            if (!sceneRoot) throw new Error('The active scene runtime root is unavailable.');

            const nearestTargetNode = nodeDatabase.getNearestTargetNode(selectedNode.id);
            let parentId = sceneRoot.id;
            if (nearestTargetNode && nearestTargetNode.targetId) {
                const targetNode = runtime && typeof runtime.getTargetById === 'function' ?
                    runtime.getTargetById(nearestTargetNode.targetId) : null;
                if (targetNode && !targetNode.isStage) {
                    const binding = scratchSpriteAdapter && typeof scratchSpriteAdapter.getBindingByTargetRuntimeId === 'function' ?
                        scratchSpriteAdapter.getBindingByTargetRuntimeId(nearestTargetNode.targetId, scene.id) : null;
                    if (!binding || !binding.nodeId) {
                        throw new Error('The parent Scratch Sprite is not bound to a Functional Sprite2D node.');
                    }
                    parentId = binding.nodeId;
                }
            }

            const archetypeId = sensor ?
                FUNCTIONAL_NODE_ARCHETYPE_IDS.AREA_2D : FUNCTIONAL_NODE_ARCHETYPE_IDS.STATIC_BODY_2D;
            const plan = materializePortableCapabilityValue(functionalNodeCreation.createPlan(archetypeId, {
                name: selectedNode.name,
                sceneId: scene.id,
                scope: 'scene'
            }));
            const createdPayloadRaw = await Promise.resolve(workspaceNodeCommandClient.createNode({
                domain: WORKSPACE_NODE_DOMAINS.RUNTIME,
                options: plan.options,
                parentId,
                typeId: plan.runtimeTypeId
            }));
            const createdPayload = materializePortableCapabilityValue(createdPayloadRaw);
            const createdNode = createdPayload && createdPayload.node;
            if (!createdNode || !createdNode.id) throw new Error('Functional Collider upgrade did not create a Runtime Node.');
            createdNodeId = createdNode.id;
            const colliderComponent = Array.isArray(createdNode.components) ?
                createdNode.components.find(component => component && component.typeId === COLLIDER2D_TYPE_ID) : null;
            if (!colliderComponent) throw new Error('Upgraded Runtime Node did not provision Collider2D.');

            const patchResult = colliderEditorClient.patchComponent({
                componentId: colliderComponent.id,
                nodeId: createdNode.id,
                patch: legacyColliderPropertiesToPatch(selectedNode.properties, sensor)
            });
            if (patchResult && patchResult.kind === PROTOCOL_DTO_KINDS.ERROR) {
                throw new Error(patchResult.message || patchResult.code || 'Collider2D upgrade patch was rejected.');
            }

            await Promise.resolve(workspaceNodeCommandClient.destroyNode({nodeId: selectedNode.id}));
            workspaceNodeCommandClient.selectNode({nodeId: createdNode.id});
            setRuntimeNodeCommandError(null);
            refresh();
            return createdNode;
        } catch (error) {
            if (createdNodeId) {
                try { await Promise.resolve(workspaceNodeCommandClient.destroyNode({nodeId: createdNodeId})); } catch { /* rollback best effort */ }
            }
            setRuntimeNodeCommandError(error && error.message ? error.message : String(error));
            refresh();
            return null;
        }
    }, [
        colliderEditorClient,
        functionalNodeCreation,
        isLegacyCompatibilityCollider,
        moduleManager,
        nodeDatabase,
        refresh,
        runtime,
        runtimeNodeModel,
        scratchSpriteAdapter,
        selectedNode,
        workspaceNodeCommandClient
    ]);

    const deleteSelectedNode = React.useCallback(() => {
        if (!nodeDatabase || !selectedNode) return;
        const nearestTarget = nodeDatabase.getNearestTargetNode(selectedNode.id);
        const nextSelection = selectedNodeParent || nearestTarget || null;
        if (!window.confirm(`Delete ${selectedNode.name} and all of its child nodes?`)) return;
        const settle = payload => {
            workspaceNodeCommandClient.selectNode({nodeId: nextSelection ? nextSelection.id : null});
            if (nextSelection && nextSelection.targetId) onSelectTarget(nextSelection.targetId);
            return payload;
        };
        const result = workspaceNodeCommandClient.destroyNode({nodeId: selectedNode.id});
        return result && typeof result.then === 'function' ? result.then(settle) : settle(result);
    }, [nodeDatabase, onSelectTarget, selectedNode, selectedNodeParent, workspaceNodeCommandClient]);

    const executeWorkspaceNodeCommand = React.useCallback(execute => {
        try {
            const result = execute(workspaceNodeCommandClient);
            if (result && typeof result.then === 'function') {
                return result.then(payload => {
                    setRuntimeNodeCommandError(null);
                    refresh();
                    return payload;
                }).catch(error => {
                    setRuntimeNodeCommandError(error && error.message ? error.message : String(error));
                    refresh();
                    return null;
                });
            }
            setRuntimeNodeCommandError(null);
            refresh();
            return result;
        } catch (error) {
            setRuntimeNodeCommandError(error && error.message ? error.message : String(error));
            refresh();
            return null;
        }
    }, [refresh, workspaceNodeCommandClient]);

    const renameSelectedRuntimeNode = React.useCallback(name => {
        if (!selectedRuntimeNode) return;
        executeWorkspaceNodeCommand(client => client.patchNode({
            nodeId: selectedRuntimeNode.id,
            patch: {name}
        }));
    }, [executeWorkspaceNodeCommand, selectedRuntimeNode]);

    const setSelectedRuntimeNodeEnabled = React.useCallback(enabled => {
        if (!selectedRuntimeNode) return;
        executeWorkspaceNodeCommand(client => client.patchNode({
            nodeId: selectedRuntimeNode.id,
            patch: {enabled}
        }));
    }, [executeWorkspaceNodeCommand, selectedRuntimeNode]);

    const deleteSelectedRuntimeNode = React.useCallback(async () => {
        if (!runtimeNodeModel || !selectedRuntimeNode || selectedRuntimeNode.protected) return;
        if (!window.confirm(`Delete ${selectedRuntimeNode.name} and all of its child nodes?`)) return;
        const parent = runtimeNodeModel.getParent(selectedRuntimeNode.id);
        const result = await executeWorkspaceNodeCommand(
            client => client.destroyNode({nodeId: selectedRuntimeNode.id})
        );
        if (result) {
            workspaceNodeCommandClient.selectNode({nodeId: parent && !parent.protected ? parent.id : null});
        }
    }, [executeWorkspaceNodeCommand, runtimeNodeModel, selectedRuntimeNode, workspaceNodeCommandClient]);

    const commitSelectedRuntimeTransformPatch = React.useCallback(patch => {
        if (!transformEditorClient || !selectedRuntimeNode || !selectedRuntimeTransformComponent) return false;
        try {
            const result = transformEditorClient.patchComponent({
                componentId: selectedRuntimeTransformComponent.id,
                nodeId: selectedRuntimeNode.id,
                patch
            });
            if (result && result.kind === PROTOCOL_DTO_KINDS.ERROR) {
                setRuntimeTransformError(result.message || result.code || 'Transform command was rejected.');
                refresh();
                return false;
            }
            setRuntimeTransformError(null);
            refresh();
            return true;
        } catch (error) {
            setRuntimeTransformError(error && error.message ? error.message : String(error));
            refresh();
            return false;
        }
    }, [refresh, selectedRuntimeNode, selectedRuntimeTransformComponent, transformEditorClient]);

    const commitSelectedRuntimePositionAxis = React.useCallback((axis, value) => {
        if (!selectedRuntimeTransform || !Array.isArray(selectedRuntimeTransform.position)) return;
        const position = [selectedRuntimeTransform.position[0], selectedRuntimeTransform.position[1]];
        position[axis] = value;
        commitSelectedRuntimeTransformPatch({position});
    }, [commitSelectedRuntimeTransformPatch, selectedRuntimeTransform]);

    const commitSelectedRuntimeScale = React.useCallback(value => {
        commitSelectedRuntimeTransformPatch({scale: [value, value]});
    }, [commitSelectedRuntimeTransformPatch]);

    const commitSelectedRuntimeScaleAxis = React.useCallback((axis, value) => {
        if (!selectedRuntimeTransform || !Array.isArray(selectedRuntimeTransform.scale)) return;
        const scale = [selectedRuntimeTransform.scale[0], selectedRuntimeTransform.scale[1]];
        scale[axis] = value;
        commitSelectedRuntimeTransformPatch({scale});
    }, [commitSelectedRuntimeTransformPatch, selectedRuntimeTransform]);

    const commitSelectedRuntimeCameraPatch = React.useCallback(patch => {
        if (!cameraEditorClient || !selectedRuntimeNode || !selectedRuntimeCameraComponent) return false;
        try {
            const result = cameraEditorClient.patchComponent({
                componentId: selectedRuntimeCameraComponent.id,
                nodeId: selectedRuntimeNode.id,
                patch
            });
            if (result && result.kind === PROTOCOL_DTO_KINDS.ERROR) {
                setRuntimeCameraError(result.message || result.code || 'Camera2D command was rejected.');
                refresh();
                return false;
            }
            setRuntimeCameraError(null);
            refresh();
            return true;
        } catch (error) {
            setRuntimeCameraError(error && error.message ? error.message : String(error));
            refresh();
            return false;
        }
    }, [cameraEditorClient, refresh, selectedRuntimeCameraComponent, selectedRuntimeNode]);

    const commitSelectedRuntimeCameraVecAxis = React.useCallback((field, axis, value) => {
        if (!selectedRuntimeCamera || !selectedRuntimeCamera.config || !Array.isArray(selectedRuntimeCamera.config[field])) return;
        const next = [selectedRuntimeCamera.config[field][0], selectedRuntimeCamera.config[field][1]];
        next[axis] = value;
        commitSelectedRuntimeCameraPatch({[field]: next});
    }, [commitSelectedRuntimeCameraPatch, selectedRuntimeCamera]);

    const commitSelectedRuntimeCharacterPatch = React.useCallback(patch => {
        if (!characterEditorClient || !selectedRuntimeNode || !selectedRuntimeCharacterComponent) return false;
        try {
            const result = characterEditorClient.patchComponent({
                componentId: selectedRuntimeCharacterComponent.id,
                nodeId: selectedRuntimeNode.id,
                patch
            });
            if (result && result.kind === PROTOCOL_DTO_KINDS.ERROR) {
                setRuntimeCharacterError(result.message || result.code || 'CharacterController2D command was rejected.');
                refresh();
                return false;
            }
            setRuntimeCharacterError(null);
            refresh();
            return true;
        } catch (error) {
            setRuntimeCharacterError(error && error.message ? error.message : String(error));
            refresh();
            return false;
        }
    }, [characterEditorClient, refresh, selectedRuntimeCharacterComponent, selectedRuntimeNode]);

    const commitSelectedRuntimeCharacterUpAxis = React.useCallback((axis, value) => {
        if (!selectedRuntimeCharacter || !selectedRuntimeCharacter.config ||
            !Array.isArray(selectedRuntimeCharacter.config.upDirection)) return;
        const next = selectedRuntimeCharacter.config.upDirection.slice();
        next[axis] = value;
        commitSelectedRuntimeCharacterPatch({upDirection: next});
    }, [commitSelectedRuntimeCharacterPatch, selectedRuntimeCharacter]);

    const commitSelectedRuntimeRigidBodyPatch = React.useCallback(patch => {
        if (!rigidBodyEditorClient || !selectedRuntimeNode || !selectedRuntimeRigidBodyComponent) return false;
        try {
            const result = rigidBodyEditorClient.patchComponent({
                componentId: selectedRuntimeRigidBodyComponent.id,
                nodeId: selectedRuntimeNode.id,
                patch
            });
            if (result && result.kind === PROTOCOL_DTO_KINDS.ERROR) {
                setRuntimeRigidBodyError(result.message || result.code || 'RigidBody2D command was rejected.');
                refresh();
                return false;
            }
            setRuntimeRigidBodyError(null);
            refresh();
            return true;
        } catch (error) {
            setRuntimeRigidBodyError(error && error.message ? error.message : String(error));
            refresh();
            return false;
        }
    }, [refresh, rigidBodyEditorClient, selectedRuntimeNode, selectedRuntimeRigidBodyComponent]);

    const commitSelectedRuntimeRigidBodyVelocityAxis = React.useCallback((axis, value) => {
        if (!selectedRuntimeRigidBody || !selectedRuntimeRigidBody.config || !Array.isArray(selectedRuntimeRigidBody.config.velocity)) return;
        const next = selectedRuntimeRigidBody.config.velocity.slice();
        next[axis] = value;
        commitSelectedRuntimeRigidBodyPatch({velocity: next});
    }, [commitSelectedRuntimeRigidBodyPatch, selectedRuntimeRigidBody]);

    const commitSelectedRuntimeTileMapPatch = React.useCallback(patch => {
        if (!tileMapEditorClient || !selectedRuntimeNode || !selectedRuntimeTileMapComponent) return false;
        try {
            const result = tileMapEditorClient.patchComponent({
                componentId: selectedRuntimeTileMapComponent.id,
                nodeId: selectedRuntimeNode.id,
                patch
            });
            if (result && result.kind === PROTOCOL_DTO_KINDS.ERROR) {
                setRuntimeTileMapError(result.message || result.code || 'TileMapLayer2D command was rejected.');
                refresh();
                return false;
            }
            setRuntimeTileMapError(null);
            refresh();
            return true;
        } catch (error) {
            setRuntimeTileMapError(error && error.message ? error.message : String(error));
            refresh();
            return false;
        }
    }, [refresh, selectedRuntimeNode, selectedRuntimeTileMapComponent, tileMapEditorClient]);

    const commitSelectedTileSetPatch = React.useCallback(patch => {
        if (!tileSetResourceCapability || !selectedTileSet || typeof tileSetResourceCapability.patchTileSet !== 'function') {
            return false;
        }
        try {
            tileSetResourceCapability.patchTileSet(selectedTileSet.resourceId, patch);
            setRuntimeTileMapError(null);
            refresh();
            return true;
        } catch (error) {
            setRuntimeTileMapError(error && error.message ? error.message : String(error));
            refresh();
            return false;
        }
    }, [refresh, selectedTileSet, tileSetResourceCapability]);

    const createAndBindTileSet = React.useCallback(() => {
        if (!tileSetResourceCapability || typeof tileSetResourceCapability.createTileSet !== 'function') return;
        try {
            const created = materializePortableCapabilityValue(tileSetResourceCapability.createTileSet({name: 'TileSet'}));
            if (created && created.resourceId) commitSelectedRuntimeTileMapPatch({tileSetResourceId: created.resourceId});
        } catch (error) {
            setRuntimeTileMapError(error && error.message ? error.message : String(error));
        }
    }, [commitSelectedRuntimeTileMapPatch, tileSetResourceCapability]);

    const commitSelectedTileSetTile = React.useCallback(patch => {
        if (!tileSetResourceCapability || !selectedTileSet || !tileMapEditorSnapshot ||
            typeof tileSetResourceCapability.setTileDefinition !== 'function') return false;
        try {
            tileSetResourceCapability.setTileDefinition(selectedTileSet.resourceId, tileMapEditorSnapshot.activeTileId, patch);
            setRuntimeTileMapError(null);
            refresh();
            return true;
        } catch (error) {
            setRuntimeTileMapError(error && error.message ? error.message : String(error));
            refresh();
            return false;
        }
    }, [refresh, selectedTileSet, tileMapEditorSnapshot, tileSetResourceCapability]);

    const commitSelectedTileCollisionShape = React.useCallback(type => {
        if (!selectedTileSetTile || !selectedTileSet || !tileMapEditorSnapshot) return;
        if (type === 'none') {
            commitSelectedTileSetTile({collision: []});
            return;
        }
        const tileSize = selectedTileSet.data.tileSize || [32, 32];
        let shape;
        if (type === COLLIDER2D_SHAPE_TYPES.CIRCLE) {
            shape = {type, radius: Math.min(tileSize[0], tileSize[1]) / 2};
        } else if (type === COLLIDER2D_SHAPE_TYPES.CAPSULE) {
            const radius = Math.min(tileSize[0], tileSize[1]) / 2;
            shape = {type, radius, height: Math.max(tileSize[1], radius * 2)};
        } else if (type === COLLIDER2D_SHAPE_TYPES.CONVEX_POLYGON) {
            const hx = tileSize[0] / 2;
            const hy = tileSize[1] / 2;
            shape = {type, points: [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]]};
        } else {
            shape = {type: COLLIDER2D_SHAPE_TYPES.RECTANGLE, size: tileSize.slice()};
        }
        commitSelectedTileSetTile({collision: [{id: 'primary', offset: [0, 0], rotation: 0, shape}]});
    }, [commitSelectedTileSetTile, selectedTileSet, selectedTileSetTile, tileMapEditorSnapshot]);

    const commitSelectedTileAtlasAxis = React.useCallback((axis, value) => {
        if (!selectedTileSetTile) return;
        const atlas = selectedTileSetTile.atlas.slice();
        atlas[axis] = Math.max(0, Math.trunc(Number(value) || 0));
        commitSelectedTileSetTile({atlas});
    }, [commitSelectedTileSetTile, selectedTileSetTile]);

    const commitSelectedTileCollisionShapeField = React.useCallback((field, value, axis = null) => {
        if (!selectedTileSetTile || !Array.isArray(selectedTileSetTile.collision) || !selectedTileSetTile.collision.length) return;
        const entry = selectedTileSetTile.collision[0];
        const shape = Object.assign({}, entry.shape);
        if (axis === null) shape[field] = Math.max(0.001, Math.abs(Number(value) || 0.001));
        else {
            const vector = Array.isArray(shape[field]) ? shape[field].slice() : [1, 1];
            vector[axis] = Math.max(0.001, Math.abs(Number(value) || 0.001));
            shape[field] = vector;
        }
        if (shape.type === COLLIDER2D_SHAPE_TYPES.CAPSULE && field === 'radius') {
            shape.height = Math.max(shape.height || 0, shape.radius * 2);
        }
        if (shape.type === COLLIDER2D_SHAPE_TYPES.CAPSULE && field === 'height') {
            shape.height = Math.max(shape.height, (shape.radius || 0.001) * 2);
        }
        commitSelectedTileSetTile({collision: [Object.assign({}, entry, {shape})]});
    }, [commitSelectedTileSetTile, selectedTileSetTile]);

    const commitSelectedTileCollisionEntryField = React.useCallback((field, value, axis = null) => {
        if (!selectedTileSetTile || !Array.isArray(selectedTileSetTile.collision) || !selectedTileSetTile.collision.length) return;
        const entry = Object.assign({}, selectedTileSetTile.collision[0]);
        if (axis === null) entry[field] = Number(value) || 0;
        else {
            const vector = Array.isArray(entry[field]) ? entry[field].slice() : [0, 0];
            vector[axis] = Number(value) || 0;
            entry[field] = vector;
        }
        commitSelectedTileSetTile({collision: [entry]});
    }, [commitSelectedTileSetTile, selectedTileSetTile]);

    const commitSelectedTilePolygonPoints = React.useCallback(value => {
        if (!selectedTileSetTile || !selectedTileSetTile.collision.length) return;
        try {
            const parsed = JSON.parse(String(value));
            if (!Array.isArray(parsed)) throw new TypeError('Polygon points must be a JSON array.');
            const entry = selectedTileSetTile.collision[0];
            commitSelectedTileSetTile({collision: [Object.assign({}, entry, {shape: Object.assign({}, entry.shape, {points: parsed})})]});
        } catch (error) {
            setRuntimeTileMapError(error && error.message ? error.message : String(error));
        }
    }, [commitSelectedTileSetTile, selectedTileSetTile]);

    const commitSelectedTileCustomData = React.useCallback(value => {
        try {
            const parsed = String(value).trim() ? JSON.parse(String(value)) : {};
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new TypeError('Custom Data must be a JSON object.');
            commitSelectedTileSetTile({customData: parsed});
        } catch (error) {
            setRuntimeTileMapError(error && error.message ? error.message : String(error));
        }
    }, [commitSelectedTileSetTile]);

    const commitSelectedRuntimeColliderPatch = React.useCallback(patch => {
        if (!colliderEditorClient || !selectedRuntimeNode || !selectedRuntimeColliderComponent) return false;
        try {
            const result = colliderEditorClient.patchComponent({
                componentId: selectedRuntimeColliderComponent.id,
                nodeId: selectedRuntimeNode.id,
                patch
            });
            if (result && result.kind === PROTOCOL_DTO_KINDS.ERROR) {
                setRuntimeColliderError(result.message || result.code || 'Collider2D command was rejected.');
                refresh();
                return false;
            }
            setRuntimeColliderError(null);
            refresh();
            return true;
        } catch (error) {
            setRuntimeColliderError(error && error.message ? error.message : String(error));
            refresh();
            return false;
        }
    }, [colliderEditorClient, refresh, selectedRuntimeColliderComponent, selectedRuntimeNode]);

    const commitSelectedRuntimeColliderVecAxis = React.useCallback((field, axis, value) => {
        if (!selectedRuntimeCollider || !selectedRuntimeCollider.config ||
            !Array.isArray(selectedRuntimeCollider.config[field])) return;
        const next = selectedRuntimeCollider.config[field].slice();
        next[axis] = value;
        commitSelectedRuntimeColliderPatch({[field]: next});
    }, [commitSelectedRuntimeColliderPatch, selectedRuntimeCollider]);

    const commitSelectedRuntimeColliderShape = React.useCallback(shape => {
        commitSelectedRuntimeColliderPatch({shape});
    }, [commitSelectedRuntimeColliderPatch]);

    const commitSelectedRuntimeColliderShapeField = React.useCallback((field, value) => {
        if (!selectedRuntimeCollider || !selectedRuntimeCollider.config) return;
        commitSelectedRuntimeColliderShape(Object.assign({}, selectedRuntimeCollider.config.shape, {[field]: value}));
    }, [commitSelectedRuntimeColliderShape, selectedRuntimeCollider]);

    const commitSelectedRuntimeColliderShapeType = React.useCallback(type => {
        if (!selectedRuntimeCollider || !selectedRuntimeCollider.config) return;
        commitSelectedRuntimeColliderShape(convertColliderShapePreservingBounds(
            selectedRuntimeCollider.config.shape,
            type
        ));
    }, [commitSelectedRuntimeColliderShape, selectedRuntimeCollider]);

    const resetSelectedRuntimeColliderShape = React.useCallback(() => {
        if (!selectedRuntimeCollider || !selectedRuntimeCollider.config) return;
        commitSelectedRuntimeColliderShape(createDefaultColliderShape(selectedRuntimeCollider.config.shape.type));
    }, [commitSelectedRuntimeColliderShape, selectedRuntimeCollider]);

    const commitSelectedRuntimeRectangleAxis = React.useCallback((axis, value) => {
        if (!selectedRuntimeCollider || selectedRuntimeCollider.config.shape.type !== COLLIDER2D_SHAPE_TYPES.RECTANGLE) return;
        const size = selectedRuntimeCollider.config.shape.size.slice();
        size[axis] = Math.max(0.001, Math.abs(Number(value) || 0.001));
        commitSelectedRuntimeColliderShape({type: COLLIDER2D_SHAPE_TYPES.RECTANGLE, size});
    }, [commitSelectedRuntimeColliderShape, selectedRuntimeCollider]);

    const commitSelectedRuntimeCircleRadius = React.useCallback(value => {
        const radius = Math.max(0.001, Math.abs(Number(value) || 0.001));
        commitSelectedRuntimeColliderShape({type: COLLIDER2D_SHAPE_TYPES.CIRCLE, radius});
    }, [commitSelectedRuntimeColliderShape]);

    const commitSelectedRuntimeCapsuleRadius = React.useCallback(value => {
        if (!selectedRuntimeCollider || selectedRuntimeCollider.config.shape.type !== COLLIDER2D_SHAPE_TYPES.CAPSULE) return;
        const radius = Math.max(0.001, Math.abs(Number(value) || 0.001));
        const height = Math.max(selectedRuntimeCollider.config.shape.height, radius * 2);
        commitSelectedRuntimeColliderShape({type: COLLIDER2D_SHAPE_TYPES.CAPSULE, radius, height});
    }, [commitSelectedRuntimeColliderShape, selectedRuntimeCollider]);

    const commitSelectedRuntimeCapsuleHeight = React.useCallback(value => {
        if (!selectedRuntimeCollider || selectedRuntimeCollider.config.shape.type !== COLLIDER2D_SHAPE_TYPES.CAPSULE) return;
        const radius = selectedRuntimeCollider.config.shape.radius;
        const height = Math.max(radius * 2, Math.abs(Number(value) || radius * 2));
        commitSelectedRuntimeColliderShape({type: COLLIDER2D_SHAPE_TYPES.CAPSULE, radius, height});
    }, [commitSelectedRuntimeColliderShape, selectedRuntimeCollider]);

    const commitSelectedRuntimePolygonPoint = React.useCallback((index, axis, value) => {
        if (!selectedRuntimeCollider || selectedRuntimeCollider.config.shape.type !== COLLIDER2D_SHAPE_TYPES.CONVEX_POLYGON) return;
        const points = selectedRuntimeCollider.config.shape.points.map(point => point.slice());
        if (!points[index]) return;
        points[index][axis] = Number(value);
        if (!Number.isFinite(points[index][axis]) || !isConvexPolygon(points)) {
            setRuntimeColliderError('Convex Polygon vertices must remain finite, convex and non-degenerate.');
            refresh();
            return;
        }
        commitSelectedRuntimeColliderShape({type: COLLIDER2D_SHAPE_TYPES.CONVEX_POLYGON, points});
    }, [commitSelectedRuntimeColliderShape, refresh, selectedRuntimeCollider]);

    const addSelectedRuntimePolygonPoint = React.useCallback(() => {
        if (!selectedRuntimeCollider || selectedRuntimeCollider.config.shape.type !== COLLIDER2D_SHAPE_TYPES.CONVEX_POLYGON) return;
        const points = insertConvexPolygonPoint(selectedRuntimeCollider.config.shape.points);
        commitSelectedRuntimeColliderShape({type: COLLIDER2D_SHAPE_TYPES.CONVEX_POLYGON, points});
    }, [commitSelectedRuntimeColliderShape, selectedRuntimeCollider]);

    const removeSelectedRuntimePolygonPoint = React.useCallback(index => {
        if (!selectedRuntimeCollider || selectedRuntimeCollider.config.shape.type !== COLLIDER2D_SHAPE_TYPES.CONVEX_POLYGON) return;
        const points = removeConvexPolygonPoint(selectedRuntimeCollider.config.shape.points, index);
        if (!isConvexPolygon(points)) return;
        commitSelectedRuntimeColliderShape({type: COLLIDER2D_SHAPE_TYPES.CONVEX_POLYGON, points});
    }, [commitSelectedRuntimeColliderShape, selectedRuntimeCollider]);

    const commitSelectedRuntimePolygonPoints = React.useCallback(value => {
        const points = String(value).split(';').map(entry => entry.trim()).filter(Boolean).map(entry => (
            entry.split(',').map(numberValue => Number(numberValue.trim()))
        ));
        if (points.length < 3 || points.some(point => point.length !== 2 || point.some(numberValue => !Number.isFinite(numberValue)))) {
            setRuntimeColliderError('Convex polygon points must use x,y; x,y; x,y format with at least three points.');
            refresh();
            return;
        }
        commitSelectedRuntimeColliderShape({type: COLLIDER2D_SHAPE_TYPES.CONVEX_POLYGON, points});
    }, [commitSelectedRuntimeColliderShape, refresh]);

    const commitSelectedRuntimeColliderGizmoVisibility = React.useCallback(visibility => {
        if (!colliderGizmoPreferences || !selectedRuntimeNode) return;
        colliderGizmoPreferences.setNodeVisibility(selectedRuntimeNode.id, visibility);
        refresh();
    }, [colliderGizmoPreferences, refresh, selectedRuntimeNode]);

    const commitGlobalColliderGizmoMode = React.useCallback(mode => {
        if (!colliderGizmoPreferences) return;
        colliderGizmoPreferences.setGlobalMode(mode);
        refresh();
    }, [colliderGizmoPreferences, refresh]);

    const patchCharacterTestDriveSettings = React.useCallback(patch => {
        if (!characterTestDrive) return;
        characterTestDrive.patchSettings(patch);
        refresh();
    }, [characterTestDrive, refresh]);

    const startSelectedRuntimeCharacterTestDrive = React.useCallback(() => {
        if (!characterTestDrive || !characterRuntimeCapability || !selectedRuntimeNode || !selectedRuntimeCharacter) return;
        try {
            characterRuntimeCapability.resetRuntimeState(selectedRuntimeNode.id);
            characterTestDrive.start(selectedRuntimeNode.id);
            setRuntimeCharacterError(null);
            refresh();
        } catch (error) {
            setRuntimeCharacterError(error && error.message ? error.message : String(error));
            refresh();
        }
    }, [characterRuntimeCapability, characterTestDrive, refresh, selectedRuntimeCharacter, selectedRuntimeNode]);

    const pauseSelectedRuntimeCharacterTestDrive = React.useCallback(() => {
        if (!characterTestDrive) return;
        characterTestDrive.pause();
        refresh();
    }, [characterTestDrive, refresh]);

    const resetSelectedRuntimeCharacterTestDrive = React.useCallback(() => {
        if (!characterTestDrive || !characterRuntimeCapability || !selectedRuntimeNode) return;
        try {
            if (characterTestDrive.getState().activeNodeId === selectedRuntimeNode.id) characterTestDrive.stop();
            characterRuntimeCapability.resetRuntimeState(selectedRuntimeNode.id);
            setRuntimeCharacterError(null);
            refresh();
        } catch (error) {
            setRuntimeCharacterError(error && error.message ? error.message : String(error));
            refresh();
        }
    }, [characterRuntimeCapability, characterTestDrive, refresh, selectedRuntimeNode]);

    const selectedLayerIndex = target && !target.isStage ?
        originalSprites.findIndex(candidate => candidate.id === target.id) : -1;
    const historyState = React.useMemo(() => (history ? history.getState() : {
        canRedo: false,
        canUndo: false,
        redoDepth: 0,
        undoDepth: 0
    }), [history, historyRevision]);

    return (
        <aside
            aria-label="Inspector"
            data-ngvge-command-scope="project"
            data-ngvge-inspector="true"
            tabIndex={-1}
            className={classNames(styles.inspector, {
                [styles.inspectorEmbedded]: showHeader
            })}
            style={showHeader ? {width} : undefined}
        >
            {showHeader ? (
                <header className={styles.header}>
                    <div className={styles.headerText}>
                        <span className={styles.eyebrow}>NGVGE</span>
                        <h2 className={styles.title}>Inspector</h2>
                    </div>
                    <button
                        aria-label="Close Inspector"
                        className={styles.closeButton}
                        type="button"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </header>
            ) : null}

            <div className={styles.content}>
                {selectedRuntimeNode ? (
                    <React.Fragment>
                        <div className={styles.targetSummary}>
                            <span className={styles.targetIcon}>
                                {selectedRuntimeNode.originalTypeId ? '⚠' : (
                                    selectedRuntimeNodeType && selectedRuntimeNodeType.family === 'service' ? '◆' : '◇'
                                )}
                            </span>
                            <span className={styles.targetSummaryText}>
                                <strong>{selectedRuntimeNode.name}</strong>
                                <small>{selectedRuntimeNode.originalTypeId ?
                                    `Missing provider · ${selectedRuntimeNode.originalTypeId}` :
                                    `${selectedRuntimeNodeType ? selectedRuntimeNodeType.label : selectedRuntimeNode.typeId} · ${
                                        selectedRuntimeScratchBinding ? 'Scratch Bound' : 'Native'
                                    }`
                                }</small>
                            </span>
                        </div>

                        <InspectorSection
                            expanded={isExpanded('runtime-node:identity')}
                            id="runtime-node:identity"
                            label="Runtime Node"
                            onToggle={onToggleSection}
                        >
                            <InspectorRow label="Name">
                                <DraftInput
                                    value={selectedRuntimeNode.name}
                                    onCommit={renameSelectedRuntimeNode}
                                />
                            </InspectorRow>
                            <InspectorRow label="Enabled">
                                <input
                                    checked={Boolean(selectedRuntimeNode.enabledSelf)}
                                    className={styles.checkbox}
                                    type="checkbox"
                                    onChange={event => setSelectedRuntimeNodeEnabled(event.target.checked)}
                                />
                            </InspectorRow>
                            <InspectorRow label="Type">
                                <input
                                    readOnly
                                    className={classNames(styles.input, styles.inputReadOnly)}
                                    value={selectedRuntimeNode.originalTypeId || selectedRuntimeNode.typeId}
                                />
                            </InspectorRow>
                            <InspectorRow label="Scope">
                                <input
                                    readOnly
                                    className={classNames(styles.input, styles.inputReadOnly)}
                                    value={selectedRuntimeNode.scope}
                                />
                            </InspectorRow>
                            <InspectorRow label="Scene">
                                <input
                                    readOnly
                                    className={classNames(styles.input, styles.inputReadOnly)}
                                    value={selectedRuntimeNode.sceneId || 'Project global'}
                                />
                            </InspectorRow>
                            {runtimeNodeCommandError ? (
                                <div className={styles.extensionError}>{runtimeNodeCommandError}</div>
                            ) : null}
                        </InspectorSection>

                        {selectedRuntimeTransformComponent ? (
                            <InspectorSection
                                expanded={isExpanded('runtime-node:transform')}
                                id="runtime-node:transform"
                                label="Transform2D"
                                secondaryLabel={selectedRuntimeTransformIsPreview ? 'Editor Drag Preview' : (
                                    runtimeTransformDiverged ? 'Runtime differs from saved state' : (
                                        selectedRuntimeScratchBinding ? 'Scratch Compatibility' : 'NGVGE Native'
                                    )
                                )}
                                onToggle={onToggleSection}
                            >
                                {selectedRuntimeTransformPreview ? (
                                    <React.Fragment>
                                        <div className={styles.twoColumnGrid}>
                                            <InspectorRow label="X">
                                                <DraftInput
                                                    step={1}
                                                    type="number"
                                                    value={selectedRuntimeTransformPreview.position[0]}
                                                    onCommit={value => commitSelectedRuntimePositionAxis(0, value)}
                                                />
                                            </InspectorRow>
                                            <InspectorRow label="Y">
                                                <DraftInput
                                                    step={1}
                                                    type="number"
                                                    value={selectedRuntimeTransformPreview.position[1]}
                                                    onCommit={value => commitSelectedRuntimePositionAxis(1, value)}
                                                />
                                            </InspectorRow>
                                        </div>
                                        <InspectorRow label="Rotation">
                                            <DraftInput
                                                step={1}
                                                type="number"
                                                value={selectedRuntimeTransformPreview.rotation}
                                                onCommit={value => commitSelectedRuntimeTransformPatch({rotation: value})}
                                            />
                                        </InspectorRow>
                                        {selectedRuntimeScratchBinding ? (
                                            <InspectorRow label="Scale">
                                                <DraftInput
                                                    min={0}
                                                    step={0.01}
                                                    type="number"
                                                    value={selectedRuntimeTransformPreview.scale[0]}
                                                    onCommit={commitSelectedRuntimeScale}
                                                />
                                            </InspectorRow>
                                        ) : (
                                            <div className={styles.twoColumnGrid}>
                                                <InspectorRow label="Scale X">
                                                    <DraftInput
                                                        step={0.01}
                                                        type="number"
                                                        value={selectedRuntimeTransformPreview.scale[0]}
                                                        onCommit={value => commitSelectedRuntimeScaleAxis(0, value)}
                                                    />
                                                </InspectorRow>
                                                <InspectorRow label="Scale Y">
                                                    <DraftInput
                                                        step={0.01}
                                                        type="number"
                                                        value={selectedRuntimeTransformPreview.scale[1]}
                                                        onCommit={value => commitSelectedRuntimeScaleAxis(1, value)}
                                                    />
                                                </InspectorRow>
                                            </div>
                                        )}
                                        {selectedRuntimeTransformIsPreview ? (
                                            <InspectorRow label="Editor Preview">
                                                <input
                                                    readOnly
                                                    className={classNames(styles.input, styles.inputReadOnly)}
                                                    value="Transient · commit on release"
                                                />
                                            </InspectorRow>
                                        ) : null}
                                        <InspectorRow label="Authority">
                                            <input
                                                readOnly
                                                className={classNames(styles.input, styles.inputReadOnly)}
                                                value={selectedRuntimeScratchBinding ? 'Scratch Compatibility' : 'NGVGE Native'}
                                            />
                                        </InspectorRow>
                                        <InspectorRow label="Component ID">
                                            <input
                                                readOnly
                                                className={classNames(styles.input, styles.inputReadOnly)}
                                                value={selectedRuntimeTransformComponent.id}
                                            />
                                        </InspectorRow>
                                    </React.Fragment>
                                ) : (
                                    <div className={styles.nodeEmptyProperties}>Runtime Transform is not available.</div>
                                )}
                                {runtimeTransformError ? (
                                    <div className={styles.extensionError}>{runtimeTransformError}</div>
                                ) : null}
                            </InspectorSection>
                        ) : null}

                        {selectedRuntimeScratchBinding && selectedRuntimeScratchTarget ? (
                            <InspectorSection
                                expanded={isExpanded('runtime-node:scratch-appearance')}
                                id="runtime-node:scratch-appearance"
                                label="Sprite Appearance"
                                secondaryLabel="Scratch Compatibility"
                                onToggle={onToggleSection}
                            >
                                <InspectorRow label="Visible">
                                    <input
                                        checked={Boolean(selectedRuntimeScratchTarget.visible)}
                                        className={styles.checkbox}
                                        type="checkbox"
                                        onChange={event => commitSelectedRuntimeScratchProperty(
                                            'visible',
                                            event.target.checked,
                                            'Set visibility'
                                        )}
                                    />
                                </InspectorRow>
                                <InspectorRow label="Rotation Style">
                                    <select
                                        className={styles.select}
                                        value={selectedRuntimeScratchTarget.rotationStyle || 'all around'}
                                        onChange={event => commitSelectedRuntimeScratchProperty(
                                            'rotationStyle',
                                            event.target.value,
                                            'Set rotation style'
                                        )}
                                    >
                                        <option value="all around">All around</option>
                                        <option value="left-right">Left / right</option>
                                        <option value="don't rotate">Do not rotate</option>
                                    </select>
                                </InspectorRow>
                                <InspectorRow label="Draggable">
                                    <input
                                        checked={Boolean(selectedRuntimeScratchTarget.draggable)}
                                        className={styles.checkbox}
                                        type="checkbox"
                                        onChange={event => commitSelectedRuntimeScratchProperty(
                                            'draggable',
                                            event.target.checked,
                                            'Set draggable'
                                        )}
                                    />
                                </InspectorRow>
                                <InspectorRow label="Target">
                                    <input
                                        readOnly
                                        className={classNames(styles.input, styles.inputReadOnly)}
                                        value={selectedRuntimeScratchTarget.getName()}
                                    />
                                </InspectorRow>
                            </InspectorSection>
                        ) : null}

                        {selectedRuntimeTileMapComponent ? (
                            <React.Fragment>
                                <InspectorSection
                                    expanded={isExpanded('runtime-node:tilemap-layer2d')}
                                    id="runtime-node:tilemap-layer2d"
                                    label="TileMapLayer2D"
                                    secondaryLabel={selectedRuntimeTileMap ? `${selectedRuntimeTileMap.cells.length} cells · ${selectedRuntimeTileMap.config.chunks.length} chunks` : 'Runtime unavailable'}
                                    onToggle={onToggleSection}
                                >
                                    {selectedRuntimeTileMap ? (
                                        <React.Fragment>
                                            <InspectorRow label="TileSet">
                                                <select
                                                    className={styles.select}
                                                    value={selectedRuntimeTileMap.config.tileSetResourceId || ''}
                                                    onChange={event => commitSelectedRuntimeTileMapPatch({tileSetResourceId: event.target.value || null})}
                                                >
                                                    <option value="">No TileSet</option>
                                                    {availableTileSets.map(resource => (
                                                        <option key={resource.resourceId} value={resource.resourceId}>{resource.name}</option>
                                                    ))}
                                                </select>
                                            </InspectorRow>
                                            <div className={styles.testDriveActions}>
                                                <button type="button" onClick={createAndBindTileSet}>New TileSet</button>
                                            </div>
                                            <div className={styles.twoColumnGrid}>
                                                <InspectorRow label="Visible">
                                                    <input
                                                        checked={Boolean(selectedRuntimeTileMap.config.visible)}
                                                        className={styles.checkbox}
                                                        type="checkbox"
                                                        onChange={event => commitSelectedRuntimeTileMapPatch({visible: event.target.checked})}
                                                    />
                                                </InspectorRow>
                                                <InspectorRow label="Y Sort">
                                                    <input
                                                        checked={Boolean(selectedRuntimeTileMap.config.ySortEnabled)}
                                                        className={styles.checkbox}
                                                        type="checkbox"
                                                        onChange={event => commitSelectedRuntimeTileMapPatch({ySortEnabled: event.target.checked})}
                                                    />
                                                </InspectorRow>
                                            </div>
                                            <InspectorRow label="Z Index">
                                                <DraftInput type="number" step={1} value={selectedRuntimeTileMap.config.zIndex}
                                                    onCommit={value => commitSelectedRuntimeTileMapPatch({zIndex: value})} />
                                            </InspectorRow>
                                            <div className={styles.groupLabel}>Collision Projection</div>
                                            <div className={styles.twoColumnGrid}>
                                                <InspectorRow label="Enabled">
                                                    <input checked={Boolean(selectedRuntimeTileMap.config.collisionEnabled)} className={styles.checkbox}
                                                        type="checkbox" onChange={event => commitSelectedRuntimeTileMapPatch({collisionEnabled: event.target.checked})} />
                                                </InspectorRow>
                                                <InspectorRow label="Navigation">
                                                    <input checked={Boolean(selectedRuntimeTileMap.config.navigationEnabled)} className={styles.checkbox}
                                                        type="checkbox" onChange={event => commitSelectedRuntimeTileMapPatch({navigationEnabled: event.target.checked})} />
                                                </InspectorRow>
                                            </div>
                                            <div className={styles.twoColumnGrid}>
                                                <InspectorRow label="Layer">
                                                    <DraftInput min={0} step={1} type="number" value={selectedRuntimeTileMap.config.collisionLayer}
                                                        onCommit={value => commitSelectedRuntimeTileMapPatch({collisionLayer: value})} />
                                                </InspectorRow>
                                                <InspectorRow label="Mask">
                                                    <DraftInput min={0} step={1} type="number" value={selectedRuntimeTileMap.config.collisionMask}
                                                        onCommit={value => commitSelectedRuntimeTileMapPatch({collisionMask: value})} />
                                                </InspectorRow>
                                            </div>
                                            <InspectorRow label="Storage">
                                                <input readOnly className={classNames(styles.input, styles.inputReadOnly)}
                                                    value={`Sparse chunks · ${selectedRuntimeTileMap.config.chunkSize}×${selectedRuntimeTileMap.config.chunkSize}`} />
                                            </InspectorRow>
                                            <InspectorRow label="Scratch export">
                                                <input readOnly className={classNames(styles.input, styles.inputReadOnly)} value="Bake / compatibility projection" />
                                            </InspectorRow>
                                        </React.Fragment>
                                    ) : <div className={styles.nodeEmptyProperties}>TileMapLayer2D runtime is not available.</div>}
                                    {runtimeTileMapError ? <div className={styles.extensionError}>{runtimeTileMapError}</div> : null}
                                </InspectorSection>

                                <InspectorSection
                                    expanded={isExpanded('runtime-node:tilemap-authoring')}
                                    id="runtime-node:tilemap-authoring"
                                    label="TileMap Authoring"
                                    secondaryLabel={tileMapEditorSnapshot ? tileMapEditorSnapshot.tool : 'Editor'}
                                    onToggle={onToggleSection}
                                >
                                    {tileMapEditorSnapshot ? (
                                        <React.Fragment>
                                            <InspectorRow label="Active Tile">
                                                <DraftInput min={0} step={1} type="number" value={tileMapEditorSnapshot.activeTileId}
                                                    onCommit={value => tileMapEditorState.patch({activeTileId: value})} />
                                            </InspectorRow>
                                            <div className={styles.twoColumnGrid}>
                                                <InspectorRow label="Grid">
                                                    <input checked={Boolean(tileMapEditorSnapshot.gridVisible)} className={styles.checkbox} type="checkbox"
                                                        onChange={event => tileMapEditorState.patch({gridVisible: event.target.checked})} />
                                                </InspectorRow>
                                                <InspectorRow label="Collision Debug">
                                                    <input checked={Boolean(tileMapEditorSnapshot.collisionDebug)} className={styles.checkbox} type="checkbox"
                                                        onChange={event => tileMapEditorState.patch({collisionDebug: event.target.checked})} />
                                                </InspectorRow>
                                            </div>
                                            <InspectorRow label="Navigation Debug">
                                                <input checked={Boolean(tileMapEditorSnapshot.navigationDebug)} className={styles.checkbox} type="checkbox"
                                                    onChange={event => tileMapEditorState.patch({navigationDebug: event.target.checked})} />
                                            </InspectorRow>
                                            <div className={styles.twoColumnGrid}>
                                                <InspectorRow label="Flip X">
                                                    <input checked={Boolean(tileMapEditorSnapshot.flipX)} className={styles.checkbox} type="checkbox"
                                                        onChange={event => tileMapEditorState.patch({flipX: event.target.checked})} />
                                                </InspectorRow>
                                                <InspectorRow label="Flip Y">
                                                    <input checked={Boolean(tileMapEditorSnapshot.flipY)} className={styles.checkbox} type="checkbox"
                                                        onChange={event => tileMapEditorState.patch({flipY: event.target.checked})} />
                                                </InspectorRow>
                                            </div>
                                            <InspectorRow label="Rotation">
                                                <select className={styles.select} value={tileMapEditorSnapshot.rotation}
                                                    onChange={event => tileMapEditorState.patch({rotation: Number(event.target.value)})}>
                                                    <option value={0}>0°</option><option value={1}>90°</option>
                                                    <option value={2}>180°</option><option value={3}>270°</option>
                                                </select>
                                            </InspectorRow>
                                            <InspectorRow label="Selection">
                                                <input readOnly className={classNames(styles.input, styles.inputReadOnly)}
                                                    value={tileMapEditorSnapshot.selection ? `${tileMapEditorSnapshot.selection.from.join(',')} → ${tileMapEditorSnapshot.selection.to.join(',')}` : 'None'} />
                                            </InspectorRow>
                                        </React.Fragment>
                                    ) : null}
                                </InspectorSection>

                                <InspectorSection
                                    expanded={isExpanded('runtime-node:tileset-resource')}
                                    id="runtime-node:tileset-resource"
                                    label="TileSet Resource"
                                    secondaryLabel={selectedTileSet ? selectedTileSet.name : 'Unbound'}
                                    onToggle={onToggleSection}
                                >
                                    {selectedTileSet ? (
                                        <React.Fragment>
                                            <InspectorRow label="Name">
                                                <DraftInput value={selectedTileSet.name}
                                                    onCommit={value => tileSetResourceCapability.renameTileSet(selectedTileSet.resourceId, value)} />
                                            </InspectorRow>
                                            <InspectorRow label="Texture">
                                                <select className={styles.select} value={selectedTileSet.data.textureResourceId || ''}
                                                    onChange={event => commitSelectedTileSetPatch({textureResourceId: event.target.value || null})}>
                                                    <option value="">No texture</option>
                                                    {availableImageResources.map(resource => (
                                                        <option key={resource.resourceId} value={resource.resourceId}>{resource.name}</option>
                                                    ))}
                                                </select>
                                            </InspectorRow>
                                            <div className={styles.groupLabel}>Tile Size</div>
                                            <div className={styles.twoColumnGrid}>
                                                <InspectorRow label="Width"><DraftInput min={1} step={1} type="number" value={selectedTileSet.data.tileSize[0]}
                                                    onCommit={value => commitSelectedTileSetPatch({tileSize: [value, selectedTileSet.data.tileSize[1]]})} /></InspectorRow>
                                                <InspectorRow label="Height"><DraftInput min={1} step={1} type="number" value={selectedTileSet.data.tileSize[1]}
                                                    onCommit={value => commitSelectedTileSetPatch({tileSize: [selectedTileSet.data.tileSize[0], value]})} /></InspectorRow>
                                            </div>
                                            <div className={styles.groupLabel}>Atlas Grid</div>
                                            <div className={styles.twoColumnGrid}>
                                                <InspectorRow label="Columns"><DraftInput min={1} step={1} type="number" value={selectedTileSet.data.atlas.columns}
                                                    onCommit={value => commitSelectedTileSetPatch({atlas: Object.assign({}, selectedTileSet.data.atlas, {columns: value})})} /></InspectorRow>
                                                <InspectorRow label="Rows"><DraftInput min={1} step={1} type="number" value={selectedTileSet.data.atlas.rows}
                                                    onCommit={value => commitSelectedTileSetPatch({atlas: Object.assign({}, selectedTileSet.data.atlas, {rows: value})})} /></InspectorRow>
                                            </div>
                                            <div className={styles.twoColumnGrid}>
                                                <InspectorRow label="Margin X"><DraftInput min={0} step={1} type="number" value={selectedTileSet.data.atlas.margin[0]}
                                                    onCommit={value => commitSelectedTileSetPatch({atlas: Object.assign({}, selectedTileSet.data.atlas, {margin: [value, selectedTileSet.data.atlas.margin[1]]})})} /></InspectorRow>
                                                <InspectorRow label="Margin Y"><DraftInput min={0} step={1} type="number" value={selectedTileSet.data.atlas.margin[1]}
                                                    onCommit={value => commitSelectedTileSetPatch({atlas: Object.assign({}, selectedTileSet.data.atlas, {margin: [selectedTileSet.data.atlas.margin[0], value]})})} /></InspectorRow>
                                            </div>
                                            <div className={styles.twoColumnGrid}>
                                                <InspectorRow label="Sep X"><DraftInput min={0} step={1} type="number" value={selectedTileSet.data.atlas.separation[0]}
                                                    onCommit={value => commitSelectedTileSetPatch({atlas: Object.assign({}, selectedTileSet.data.atlas, {separation: [value, selectedTileSet.data.atlas.separation[1]]})})} /></InspectorRow>
                                                <InspectorRow label="Sep Y"><DraftInput min={0} step={1} type="number" value={selectedTileSet.data.atlas.separation[1]}
                                                    onCommit={value => commitSelectedTileSetPatch({atlas: Object.assign({}, selectedTileSet.data.atlas, {separation: [selectedTileSet.data.atlas.separation[0], value]})})} /></InspectorRow>
                                            </div>
                                            {selectedTileSetTile ? (
                                                <React.Fragment>
                                                    <div className={styles.groupLabel}>Active Tile #{tileMapEditorSnapshot ? tileMapEditorSnapshot.activeTileId : 0}</div>
                                                    <div className={styles.twoColumnGrid}>
                                                        <InspectorRow label="Atlas X"><DraftInput min={0} step={1} type="number" value={selectedTileSetTile.atlas[0]}
                                                            onCommit={value => commitSelectedTileAtlasAxis(0, value)} /></InspectorRow>
                                                        <InspectorRow label="Atlas Y"><DraftInput min={0} step={1} type="number" value={selectedTileSetTile.atlas[1]}
                                                            onCommit={value => commitSelectedTileAtlasAxis(1, value)} /></InspectorRow>
                                                    </div>
                                                    <InspectorRow label="Collision">
                                                        <select className={styles.select}
                                                            value={selectedTileSetTile.collision.length ? selectedTileSetTile.collision[0].shape.type : 'none'}
                                                            onChange={event => commitSelectedTileCollisionShape(event.target.value)}>
                                                            <option value="none">None</option>
                                                            <option value={COLLIDER2D_SHAPE_TYPES.RECTANGLE}>Rectangle</option>
                                                            <option value={COLLIDER2D_SHAPE_TYPES.CIRCLE}>Circle</option>
                                                            <option value={COLLIDER2D_SHAPE_TYPES.CAPSULE}>Capsule</option>
                                                            <option value={COLLIDER2D_SHAPE_TYPES.CONVEX_POLYGON}>Convex Polygon</option>
                                                        </select>
                                                    </InspectorRow>
                                                    {selectedTileSetTile.collision.length && selectedTileSetTile.collision[0].shape.type === COLLIDER2D_SHAPE_TYPES.RECTANGLE ? (
                                                        <div className={styles.twoColumnGrid}>
                                                            <InspectorRow label="Col Width"><DraftInput min={0.001} step={1} type="number" value={selectedTileSetTile.collision[0].shape.size[0]}
                                                                onCommit={value => commitSelectedTileCollisionShapeField('size', value, 0)} /></InspectorRow>
                                                            <InspectorRow label="Col Height"><DraftInput min={0.001} step={1} type="number" value={selectedTileSetTile.collision[0].shape.size[1]}
                                                                onCommit={value => commitSelectedTileCollisionShapeField('size', value, 1)} /></InspectorRow>
                                                        </div>
                                                    ) : null}
                                                    {selectedTileSetTile.collision.length && selectedTileSetTile.collision[0].shape.type === COLLIDER2D_SHAPE_TYPES.CIRCLE ? (
                                                        <InspectorRow label="Radius"><DraftInput min={0.001} step={1} type="number" value={selectedTileSetTile.collision[0].shape.radius}
                                                            onCommit={value => commitSelectedTileCollisionShapeField('radius', value)} /></InspectorRow>
                                                    ) : null}
                                                    {selectedTileSetTile.collision.length && selectedTileSetTile.collision[0].shape.type === COLLIDER2D_SHAPE_TYPES.CAPSULE ? (
                                                        <div className={styles.twoColumnGrid}>
                                                            <InspectorRow label="Radius"><DraftInput min={0.001} step={1} type="number" value={selectedTileSetTile.collision[0].shape.radius}
                                                                onCommit={value => commitSelectedTileCollisionShapeField('radius', value)} /></InspectorRow>
                                                            <InspectorRow label="Height"><DraftInput min={0.001} step={1} type="number" value={selectedTileSetTile.collision[0].shape.height}
                                                                onCommit={value => commitSelectedTileCollisionShapeField('height', value)} /></InspectorRow>
                                                        </div>
                                                    ) : null}
                                                    {selectedTileSetTile.collision.length && selectedTileSetTile.collision[0].shape.type === COLLIDER2D_SHAPE_TYPES.CONVEX_POLYGON ? (
                                                        <InspectorRow label="Points JSON"><DraftInput
                                                            value={JSON.stringify(selectedTileSetTile.collision[0].shape.points || [])}
                                                            onCommit={commitSelectedTilePolygonPoints} /></InspectorRow>
                                                    ) : null}
                                                    {selectedTileSetTile.collision.length ? (
                                                        <React.Fragment>
                                                            <div className={styles.twoColumnGrid}>
                                                                <InspectorRow label="Col Offset X"><DraftInput step={1} type="number" value={selectedTileSetTile.collision[0].offset[0]}
                                                                    onCommit={value => commitSelectedTileCollisionEntryField('offset', value, 0)} /></InspectorRow>
                                                                <InspectorRow label="Col Offset Y"><DraftInput step={1} type="number" value={selectedTileSetTile.collision[0].offset[1]}
                                                                    onCommit={value => commitSelectedTileCollisionEntryField('offset', value, 1)} /></InspectorRow>
                                                            </div>
                                                            <InspectorRow label="Col Rotation"><DraftInput step={1} type="number" value={selectedTileSetTile.collision[0].rotation}
                                                                onCommit={value => commitSelectedTileCollisionEntryField('rotation', value)} /></InspectorRow>
                                                        </React.Fragment>
                                                    ) : null}
                                                    <div className={styles.groupLabel}>Terrain / Variant / Navigation</div>
                                                    <InspectorRow label="Variant Group"><DraftInput value={selectedTileSetTile.variantGroup || ''}
                                                        onCommit={value => commitSelectedTileSetTile({variantGroup: String(value).trim() || null})} /></InspectorRow>
                                                    <div className={styles.twoColumnGrid}>
                                                        <InspectorRow label="Terrain ID"><DraftInput value={(selectedTileSetTile.terrain && selectedTileSetTile.terrain.terrainId) || ''}
                                                            onCommit={value => commitSelectedTileSetTile({terrain: Object.assign({}, selectedTileSetTile.terrain || {}, {terrainId: String(value).trim()})})} /></InspectorRow>
                                                        <InspectorRow label="Terrain Mask"><DraftInput min={0} max={15} step={1} type="number" value={(selectedTileSetTile.terrain && selectedTileSetTile.terrain.mask) || 0}
                                                            onCommit={value => commitSelectedTileSetTile({terrain: Object.assign({}, selectedTileSetTile.terrain || {}, {mask: Math.max(0, Math.min(15, Math.trunc(Number(value) || 0)))})})} /></InspectorRow>
                                                    </div>
                                                    <InspectorRow label="Navigation">
                                                        <input checked={Boolean(selectedTileSetTile.navigation && selectedTileSetTile.navigation.enabled)} className={styles.checkbox} type="checkbox"
                                                            onChange={event => commitSelectedTileSetTile({navigation: Object.assign({}, selectedTileSetTile.navigation || {}, {enabled: event.target.checked})})} />
                                                    </InspectorRow>
                                                    <InspectorRow label="Custom Data JSON"><DraftInput value={JSON.stringify(selectedTileSetTile.customData || {})}
                                                        onCommit={commitSelectedTileCustomData} /></InspectorRow>
                                                </React.Fragment>
                                            ) : null}
                                            <InspectorRow label="Resource ID">
                                                <input readOnly className={classNames(styles.input, styles.inputReadOnly)} value={selectedTileSet.resourceId} />
                                            </InspectorRow>
                                        </React.Fragment>
                                    ) : <div className={styles.nodeEmptyProperties}>Bind or create a TileSet Resource to paint this layer.</div>}
                                </InspectorSection>
                            </React.Fragment>
                        ) : null}

                        {selectedRuntimeCameraComponent ? (
                            <InspectorSection
                                expanded={isExpanded('runtime-node:camera2d')}
                                id="runtime-node:camera2d"
                                label="Camera2D"
                                secondaryLabel={activeRuntimeCameraNodeId === selectedRuntimeNode.id ? 'Active' : 'Native'}
                                onToggle={onToggleSection}
                            >
                                {selectedRuntimeCamera ? (
                                    <React.Fragment>
                                        <InspectorRow label="Enabled">
                                            <input
                                                checked={Boolean(selectedRuntimeCamera.config.enabled)}
                                                className={styles.checkbox}
                                                type="checkbox"
                                                onChange={event => commitSelectedRuntimeCameraPatch({enabled: event.target.checked})}
                                            />
                                        </InspectorRow>
                                        <div className={styles.twoColumnGrid}>
                                            <InspectorRow label="Zoom X">
                                                <DraftInput min={0.01} step={0.05} type="number"
                                                    value={selectedRuntimeCamera.config.zoom[0]}
                                                    onCommit={value => commitSelectedRuntimeCameraVecAxis('zoom', 0, value)} />
                                            </InspectorRow>
                                            <InspectorRow label="Zoom Y">
                                                <DraftInput min={0.01} step={0.05} type="number"
                                                    value={selectedRuntimeCamera.config.zoom[1]}
                                                    onCommit={value => commitSelectedRuntimeCameraVecAxis('zoom', 1, value)} />
                                            </InspectorRow>
                                        </div>
                                        <div className={styles.twoColumnGrid}>
                                            <InspectorRow label="Offset X">
                                                <DraftInput step={1} type="number"
                                                    value={selectedRuntimeCamera.config.offset[0]}
                                                    onCommit={value => commitSelectedRuntimeCameraVecAxis('offset', 0, value)} />
                                            </InspectorRow>
                                            <InspectorRow label="Offset Y">
                                                <DraftInput step={1} type="number"
                                                    value={selectedRuntimeCamera.config.offset[1]}
                                                    onCommit={value => commitSelectedRuntimeCameraVecAxis('offset', 1, value)} />
                                            </InspectorRow>
                                        </div>
                                        <InspectorRow label="Priority">
                                            <DraftInput step={1} type="number"
                                                value={selectedRuntimeCamera.config.priority}
                                                onCommit={value => commitSelectedRuntimeCameraPatch({priority: value})} />
                                        </InspectorRow>
                                        <InspectorRow label="Scratch export">
                                            <input readOnly className={classNames(styles.input, styles.inputReadOnly)}
                                                value="NGVGE native only" />
                                        </InspectorRow>
                                    </React.Fragment>
                                ) : (
                                    <div className={styles.nodeEmptyProperties}>Camera2D runtime is not available.</div>
                                )}
                                {runtimeCameraError ? <div className={styles.extensionError}>{runtimeCameraError}</div> : null}
                            </InspectorSection>
                        ) : null}

                        {selectedRuntimeColliderComponent ? (
                            <InspectorSection
                                expanded={isExpanded('runtime-node:collider2d')}
                                id="runtime-node:collider2d"
                                label="Collider2D"
                                secondaryLabel={selectedRuntimeCollider && selectedRuntimeCollider.config.sensor ? 'Sensor' : 'Solid'}
                                onToggle={onToggleSection}
                            >
                                {selectedRuntimeCollider ? (
                                    <React.Fragment>
                                        <div className={styles.groupLabel}>Geometry</div>
                                        <InspectorRow label="Shape">
                                            <select
                                                className={styles.input}
                                                data-ngvge-collider-shape-select="true"
                                                value={selectedRuntimeCollider.config.shape.type}
                                                onChange={event => commitSelectedRuntimeColliderShapeType(event.target.value)}
                                            >
                                                <option value={COLLIDER2D_SHAPE_TYPES.RECTANGLE}>Rectangle</option>
                                                <option value={COLLIDER2D_SHAPE_TYPES.CIRCLE}>Circle</option>
                                                <option value={COLLIDER2D_SHAPE_TYPES.CAPSULE}>Capsule</option>
                                                <option value={COLLIDER2D_SHAPE_TYPES.CONVEX_POLYGON}>Convex Polygon</option>
                                            </select>
                                        </InspectorRow>
                                        <div className={styles.colliderShapeToolbar}>
                                            <button
                                                className={styles.secondaryButton}
                                                data-ngvge-collider-reset-shape="true"
                                                type="button"
                                                onClick={resetSelectedRuntimeColliderShape}
                                            >
                                                Reset Shape
                                            </button>
                                            <span className={styles.colliderShapeHint}>Drag yellow Stage handles to resize / move / rotate.</span>
                                        </div>
                                        {selectedRuntimeCollider.config.shape.type === COLLIDER2D_SHAPE_TYPES.RECTANGLE ? (
                                            <React.Fragment>
                                                <div className={styles.groupLabel}>Rectangle Size</div>
                                                <div className={styles.twoColumnGrid}>
                                                    <InspectorRow label="Width">
                                                        <DraftInput min={0.001} step={1} type="number"
                                                            value={selectedRuntimeCollider.config.shape.size[0]}
                                                            onCommit={value => commitSelectedRuntimeRectangleAxis(0, value)} />
                                                    </InspectorRow>
                                                    <InspectorRow label="Height">
                                                        <DraftInput min={0.001} step={1} type="number"
                                                            value={selectedRuntimeCollider.config.shape.size[1]}
                                                            onCommit={value => commitSelectedRuntimeRectangleAxis(1, value)} />
                                                    </InspectorRow>
                                                </div>
                                            </React.Fragment>
                                        ) : null}
                                        {selectedRuntimeCollider.config.shape.type === COLLIDER2D_SHAPE_TYPES.CIRCLE ? (
                                            <React.Fragment>
                                                <div className={styles.groupLabel}>Circle Size</div>
                                                <div className={styles.twoColumnGrid}>
                                                    <InspectorRow label="Radius">
                                                        <DraftInput min={0.001} step={1} type="number"
                                                            value={selectedRuntimeCollider.config.shape.radius}
                                                            onCommit={commitSelectedRuntimeCircleRadius} />
                                                    </InspectorRow>
                                                    <InspectorRow label="Diameter">
                                                        <input readOnly className={classNames(styles.input, styles.inputReadOnly)}
                                                            value={selectedRuntimeCollider.config.shape.radius * 2} />
                                                    </InspectorRow>
                                                </div>
                                            </React.Fragment>
                                        ) : null}
                                        {selectedRuntimeCollider.config.shape.type === COLLIDER2D_SHAPE_TYPES.CAPSULE ? (
                                            <React.Fragment>
                                                <div className={styles.groupLabel}>Capsule Size</div>
                                                <div className={styles.twoColumnGrid}>
                                                    <InspectorRow label="Radius">
                                                        <DraftInput min={0.001} step={1} type="number"
                                                            value={selectedRuntimeCollider.config.shape.radius}
                                                            onCommit={commitSelectedRuntimeCapsuleRadius} />
                                                    </InspectorRow>
                                                    <InspectorRow label="Height">
                                                        <DraftInput min={selectedRuntimeCollider.config.shape.radius * 2} step={1} type="number"
                                                            value={selectedRuntimeCollider.config.shape.height}
                                                            onCommit={commitSelectedRuntimeCapsuleHeight} />
                                                    </InspectorRow>
                                                    <InspectorRow label="Width">
                                                        <input readOnly className={classNames(styles.input, styles.inputReadOnly)}
                                                            value={selectedRuntimeCollider.config.shape.radius * 2} />
                                                    </InspectorRow>
                                                    <InspectorRow label="Min Height">
                                                        <input readOnly className={classNames(styles.input, styles.inputReadOnly)}
                                                            value={selectedRuntimeCollider.config.shape.radius * 2} />
                                                    </InspectorRow>
                                                </div>
                                            </React.Fragment>
                                        ) : null}
                                        {selectedRuntimeCollider.config.shape.type === COLLIDER2D_SHAPE_TYPES.CONVEX_POLYGON ? (
                                            <React.Fragment>
                                                <div className={styles.groupLabel}>Polygon Vertices</div>
                                                <div className={styles.colliderPolygonVertexList}>
                                                    {selectedRuntimeCollider.config.shape.points.map((point, index) => (
                                                        <div className={styles.colliderPolygonVertex} key={`collider-point-${index}`}>
                                                            <span className={styles.colliderPolygonVertexLabel}>#{index + 1}</span>
                                                            <DraftInput step={1} type="number" value={point[0]}
                                                                onCommit={value => commitSelectedRuntimePolygonPoint(index, 0, value)} />
                                                            <DraftInput step={1} type="number" value={point[1]}
                                                                onCommit={value => commitSelectedRuntimePolygonPoint(index, 1, value)} />
                                                            <button
                                                                className={styles.colliderPolygonRemove}
                                                                disabled={selectedRuntimeCollider.config.shape.points.length <= 3}
                                                                title="Remove vertex"
                                                                type="button"
                                                                onClick={() => removeSelectedRuntimePolygonPoint(index)}
                                                            >
                                                                −
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <button
                                                        className={styles.secondaryButton}
                                                        data-ngvge-collider-add-vertex="true"
                                                        disabled={selectedRuntimeCollider.config.shape.points.length >= 32}
                                                        type="button"
                                                        onClick={addSelectedRuntimePolygonPoint}
                                                    >
                                                        + Add Vertex
                                                    </button>
                                                </div>
                                                <InspectorRow label="Raw Points">
                                                    <DraftInput
                                                        type="text"
                                                        value={selectedRuntimeCollider.config.shape.points.map(point => point.join(',')).join('; ')}
                                                        onCommit={commitSelectedRuntimePolygonPoints}
                                                    />
                                                </InspectorRow>
                                            </React.Fragment>
                                        ) : null}
                                        {selectedRuntimeColliderShapeBounds ? (
                                            <div className={styles.colliderShapeSummary}>
                                                Effective local bounds: {Number(selectedRuntimeColliderShapeBounds.width.toFixed(2))} × {Number(selectedRuntimeColliderShapeBounds.height.toFixed(2))}
                                            </div>
                                        ) : null}
                                        <div className={styles.groupLabel}>Local Shape Transform</div>
                                        <div className={styles.twoColumnGrid}>
                                            <InspectorRow label="Offset X">
                                                <DraftInput step={1} type="number"
                                                    value={selectedRuntimeCollider.config.offset[0]}
                                                    onCommit={value => commitSelectedRuntimeColliderVecAxis('offset', 0, value)} />
                                            </InspectorRow>
                                            <InspectorRow label="Offset Y">
                                                <DraftInput step={1} type="number"
                                                    value={selectedRuntimeCollider.config.offset[1]}
                                                    onCommit={value => commitSelectedRuntimeColliderVecAxis('offset', 1, value)} />
                                            </InspectorRow>
                                        </div>
                                        <InspectorRow label="Local Rotation">
                                            <DraftInput step={1} type="number"
                                                value={selectedRuntimeCollider.config.rotation}
                                                onCommit={value => commitSelectedRuntimeColliderPatch({rotation: value})} />
                                        </InspectorRow>
                                        <div className={styles.groupLabel}>Collision</div>
                                        <div className={styles.twoColumnGrid}>
                                            <InspectorRow label="Layer">
                                                <DraftInput min={0} step={1} type="number"
                                                    value={selectedRuntimeCollider.config.collisionLayer}
                                                    onCommit={value => commitSelectedRuntimeColliderPatch({collisionLayer: value})} />
                                            </InspectorRow>
                                            <InspectorRow label="Mask">
                                                <DraftInput min={0} step={1} type="number"
                                                    value={selectedRuntimeCollider.config.collisionMask}
                                                    onCommit={value => commitSelectedRuntimeColliderPatch({collisionMask: value})} />
                                            </InspectorRow>
                                        </div>
                                        <InspectorRow label="Sensor">
                                            <input
                                                checked={Boolean(selectedRuntimeCollider.config.sensor)}
                                                className={styles.checkbox}
                                                type="checkbox"
                                                onChange={event => commitSelectedRuntimeColliderPatch({sensor: event.target.checked})}
                                            />
                                        </InspectorRow>
                                        <div className={styles.groupLabel}>Editor Visualization</div>
                                        <InspectorRow label="Debug Shapes">
                                            <select
                                                className={styles.select}
                                                value={colliderGizmoPreferences ? colliderGizmoPreferences.getGlobalMode() :
                                                    COLLIDER_GIZMO_GLOBAL_MODE.ALL}
                                                onChange={event => commitGlobalColliderGizmoMode(event.target.value)}
                                            >
                                                <option value={COLLIDER_GIZMO_GLOBAL_MODE.ALL}>All Colliders</option>
                                                <option value={COLLIDER_GIZMO_GLOBAL_MODE.SELECTED}>Selected Only</option>
                                                <option value={COLLIDER_GIZMO_GLOBAL_MODE.HIDDEN}>Off (selected stays visible)</option>
                                            </select>
                                        </InspectorRow>
                                        <InspectorRow label="Gizmo">
                                            <select
                                                className={styles.select}
                                                value={selectedRuntimeColliderGizmoVisibility}
                                                onChange={event => commitSelectedRuntimeColliderGizmoVisibility(event.target.value)}
                                            >
                                                <option value={COLLIDER_GIZMO_VISIBILITY.INHERIT}>Inherit Editor</option>
                                                <option value={COLLIDER_GIZMO_VISIBILITY.ALWAYS}>Always</option>
                                                <option value={COLLIDER_GIZMO_VISIBILITY.SELECTED}>Selected Only</option>
                                                <option value={COLLIDER_GIZMO_VISIBILITY.HIDDEN}>Hidden</option>
                                            </select>
                                        </InspectorRow>
                                        <InspectorRow label="Scale Policy">
                                            <select
                                                className={styles.input}
                                                value={selectedRuntimeCollider.config.transformInheritance}
                                                onChange={event => commitSelectedRuntimeColliderPatch({
                                                    transformInheritance: event.target.value
                                                })}
                                            >
                                                <option value={COLLIDER2D_TRANSFORM_INHERITANCE.INHERIT_NODE}>Inherit Node Transform</option>
                                                <option value={COLLIDER2D_TRANSFORM_INHERITANCE.IGNORE_NODE_SCALE}>Ignore Node Scale</option>
                                            </select>
                                        </InspectorRow>
                                        <InspectorRow label="Overlaps">
                                            <input readOnly className={classNames(styles.input, styles.inputReadOnly)}
                                                value={colliderRuntimeCapability && typeof colliderRuntimeCapability.getOverlaps === 'function' ?
                                                    colliderRuntimeCapability.getOverlaps(selectedRuntimeNode.id).length : 0} />
                                        </InspectorRow>
                                        <InspectorRow label="Scratch export">
                                            <input readOnly className={classNames(styles.input, styles.inputReadOnly)}
                                                value="NGVGE native only" />
                                        </InspectorRow>
                                    </React.Fragment>
                                ) : (
                                    <div className={styles.nodeEmptyProperties}>Collider2D runtime is not available.</div>
                                )}
                                {runtimeColliderError ? <div className={styles.extensionError}>{runtimeColliderError}</div> : null}
                            </InspectorSection>
                        ) : null}

                        {selectedRuntimeCharacterComponent ? (
                            <InspectorSection
                                expanded={isExpanded('runtime-node:character-controller2d')}
                                id="runtime-node:character-controller2d"
                                label="CharacterController2D"
                                secondaryLabel={selectedRuntimeCharacter && selectedRuntimeCharacter.state.onFloor ? 'On Floor' :
                                    (selectedRuntimeCharacter && selectedRuntimeCharacter.state.onWall ? 'On Wall' : 'Kinematic')}
                                onToggle={onToggleSection}
                            >
                                {selectedRuntimeCharacter ? (
                                    <React.Fragment>
                                        <div className={styles.groupLabel}>Editor Test Drive</div>
                                        <InspectorRow label="Mode">
                                            <select
                                                className={styles.select}
                                                value={characterTestDriveState ? characterTestDriveState.mode :
                                                    CHARACTER_TEST_DRIVE_MODES.PLATFORMER}
                                                onChange={event => patchCharacterTestDriveSettings({mode: event.target.value})}
                                            >
                                                <option value={CHARACTER_TEST_DRIVE_MODES.PLATFORMER}>Platformer</option>
                                                <option value={CHARACTER_TEST_DRIVE_MODES.TOP_DOWN}>Top-down</option>
                                            </select>
                                        </InspectorRow>
                                        <div className={styles.twoColumnGrid}>
                                            <InspectorRow label="Speed">
                                                <DraftInput min={0} step={10} type="number"
                                                    value={characterTestDriveState ? characterTestDriveState.speed : 180}
                                                    onCommit={value => patchCharacterTestDriveSettings({speed: value})} />
                                            </InspectorRow>
                                            <InspectorRow label="Gravity">
                                                <DraftInput min={0} step={50} type="number"
                                                    value={characterTestDriveState ? characterTestDriveState.gravity : 1200}
                                                    onCommit={value => patchCharacterTestDriveSettings({gravity: value})} />
                                            </InspectorRow>
                                        </div>
                                        <InspectorRow label="Jump Speed">
                                            <DraftInput min={0} step={10} type="number"
                                                value={characterTestDriveState ? characterTestDriveState.jumpSpeed : 420}
                                                onCommit={value => patchCharacterTestDriveSettings({jumpSpeed: value})} />
                                        </InspectorRow>
                                        <div className={styles.testDriveActions}>
                                            <button
                                                className={styles.primaryButton}
                                                disabled={selectedRuntimeCharacterTestDriveActive}
                                                type="button"
                                                onClick={startSelectedRuntimeCharacterTestDrive}
                                            >
                                                Start Test
                                            </button>
                                            <button
                                                disabled={!selectedRuntimeCharacterTestDriveActive}
                                                type="button"
                                                onClick={pauseSelectedRuntimeCharacterTestDrive}
                                            >
                                                Pause
                                            </button>
                                            <button
                                                type="button"
                                                onClick={resetSelectedRuntimeCharacterTestDrive}
                                            >
                                                Reset
                                            </button>
                                        </div>
                                        <div className={styles.testDriveHint}>
                                            {characterTestDriveState && characterTestDriveState.mode ===
                                                CHARACTER_TEST_DRIVE_MODES.TOP_DOWN ?
                                                'WASD / Arrow keys move. This is editor-only and never persists.' :
                                                'A/D or ←/→ move, Space jumps. Gravity is editor-only and never persists.'}
                                        </div>
                                        {characterTestDriveState && characterTestDriveState.lastError ? (
                                            <div className={styles.extensionError}>{characterTestDriveState.lastError}</div>
                                        ) : null}
                                        <div className={styles.groupLabel}>Runtime Debug</div>
                                        <div className={styles.twoColumnGrid}>
                                            <InspectorRow label="Velocity X">
                                                <input readOnly className={classNames(styles.input, styles.inputReadOnly)}
                                                    value={selectedRuntimeCharacter.state.velocity[0]} />
                                            </InspectorRow>
                                            <InspectorRow label="Velocity Y">
                                                <input readOnly className={classNames(styles.input, styles.inputReadOnly)}
                                                    value={selectedRuntimeCharacter.state.velocity[1]} />
                                            </InspectorRow>
                                        </div>
                                        <div className={styles.twoColumnGrid}>
                                            <InspectorRow label="On Floor">
                                                <input readOnly className={classNames(styles.input, styles.inputReadOnly)}
                                                    value={selectedRuntimeCharacter.state.onFloor ? 'Yes' : 'No'} />
                                            </InspectorRow>
                                            <InspectorRow label="On Wall">
                                                <input readOnly className={classNames(styles.input, styles.inputReadOnly)}
                                                    value={selectedRuntimeCharacter.state.onWall ? 'Yes' : 'No'} />
                                            </InspectorRow>
                                        </div>
                                        <div className={styles.twoColumnGrid}>
                                            <InspectorRow label="Floor Normal X">
                                                <input readOnly className={classNames(styles.input, styles.inputReadOnly)}
                                                    value={selectedRuntimeCharacter.state.floorNormal[0]} />
                                            </InspectorRow>
                                            <InspectorRow label="Floor Normal Y">
                                                <input readOnly className={classNames(styles.input, styles.inputReadOnly)}
                                                    value={selectedRuntimeCharacter.state.floorNormal[1]} />
                                            </InspectorRow>
                                        </div>
                                        <div className={styles.twoColumnGrid}>
                                            <InspectorRow label="Wall Normal X">
                                                <input readOnly className={classNames(styles.input, styles.inputReadOnly)}
                                                    value={selectedRuntimeCharacter.state.wallNormal[0]} />
                                            </InspectorRow>
                                            <InspectorRow label="Wall Normal Y">
                                                <input readOnly className={classNames(styles.input, styles.inputReadOnly)}
                                                    value={selectedRuntimeCharacter.state.wallNormal[1]} />
                                            </InspectorRow>
                                        </div>
                                        <div className={styles.twoColumnGrid}>
                                            <InspectorRow label="Last Safe X">
                                                <input readOnly className={classNames(styles.input, styles.inputReadOnly)}
                                                    value={selectedRuntimeCharacter.state.lastSafeWorldOrigin ?
                                                        selectedRuntimeCharacter.state.lastSafeWorldOrigin[0] : '—'} />
                                            </InspectorRow>
                                            <InspectorRow label="Last Safe Y">
                                                <input readOnly className={classNames(styles.input, styles.inputReadOnly)}
                                                    value={selectedRuntimeCharacter.state.lastSafeWorldOrigin ?
                                                        selectedRuntimeCharacter.state.lastSafeWorldOrigin[1] : '—'} />
                                            </InspectorRow>
                                        </div>
                                        <div className={styles.twoColumnGrid}>
                                            <InspectorRow label="Recovery">
                                                <input readOnly className={classNames(styles.input, styles.inputReadOnly)}
                                                    value={selectedRuntimeCharacter.state.recoveryStatus || 'uninitialized'} />
                                            </InspectorRow>
                                            <InspectorRow label="Recoveries">
                                                <input readOnly className={classNames(styles.input, styles.inputReadOnly)}
                                                    value={selectedRuntimeCharacter.state.recoveryCount || 0} />
                                            </InspectorRow>
                                        </div>
                                        <div className={styles.twoColumnGrid}>
                                            <InspectorRow label="Stable Floor">
                                                <input readOnly className={classNames(styles.input, styles.inputReadOnly)}
                                                    value={selectedRuntimeCharacter.state.stableFloorNodeId || '—'} />
                                            </InspectorRow>
                                            <InspectorRow label="Stable Wall">
                                                <input readOnly className={classNames(styles.input, styles.inputReadOnly)}
                                                    value={selectedRuntimeCharacter.state.stableWallNodeId || '—'} />
                                            </InspectorRow>
                                        </div>
                                        <div className={styles.groupLabel}>Authoring</div>
                                        <InspectorRow label="Max Slope">
                                            <DraftInput min={0} max={89.9} step={1} type="number"
                                                value={selectedRuntimeCharacter.config.maxSlopeDegrees}
                                                onCommit={value => commitSelectedRuntimeCharacterPatch({maxSlopeDegrees: value})} />
                                        </InspectorRow>
                                        <div className={styles.twoColumnGrid}>
                                            <InspectorRow label="Floor Snap">
                                                <DraftInput min={0} max={256} step={1} type="number"
                                                    value={selectedRuntimeCharacter.config.floorSnapLength}
                                                    onCommit={value => commitSelectedRuntimeCharacterPatch({floorSnapLength: value})} />
                                            </InspectorRow>
                                            <InspectorRow label="Step Height">
                                                <DraftInput min={0} max={256} step={1} type="number"
                                                    value={selectedRuntimeCharacter.config.stepHeight}
                                                    onCommit={value => commitSelectedRuntimeCharacterPatch({stepHeight: value})} />
                                            </InspectorRow>
                                        </div>
                                        <div className={styles.twoColumnGrid}>
                                            <InspectorRow label="Max Slides">
                                                <DraftInput min={1} max={16} step={1} type="number"
                                                    value={selectedRuntimeCharacter.config.maxSlides}
                                                    onCommit={value => commitSelectedRuntimeCharacterPatch({maxSlides: value})} />
                                            </InspectorRow>
                                            <InspectorRow label="Safe Margin">
                                                <DraftInput min={0} max={16} step={0.01} type="number"
                                                    value={selectedRuntimeCharacter.config.safeMargin}
                                                    onCommit={value => commitSelectedRuntimeCharacterPatch({safeMargin: value})} />
                                            </InspectorRow>
                                        </div>
                                        <div className={styles.twoColumnGrid}>
                                            <InspectorRow label="Up X">
                                                <DraftInput step={0.1} type="number"
                                                    value={selectedRuntimeCharacter.config.upDirection[0]}
                                                    onCommit={value => commitSelectedRuntimeCharacterUpAxis(0, value)} />
                                            </InspectorRow>
                                            <InspectorRow label="Up Y">
                                                <DraftInput step={0.1} type="number"
                                                    value={selectedRuntimeCharacter.config.upDirection[1]}
                                                    onCommit={value => commitSelectedRuntimeCharacterUpAxis(1, value)} />
                                            </InspectorRow>
                                        </div>
                                        <InspectorRow label="Floor Node">
                                            <input readOnly className={classNames(styles.input, styles.inputReadOnly)}
                                                value={selectedRuntimeCharacter.state.floorNodeId || '—'} />
                                        </InspectorRow>
                                        <InspectorRow label="Scratch export">
                                            <input readOnly className={classNames(styles.input, styles.inputReadOnly)}
                                                value="NGVGE native only" />
                                        </InspectorRow>
                                    </React.Fragment>
                                ) : (
                                    <div className={styles.nodeEmptyProperties}>CharacterController2D runtime is not available.</div>
                                )}
                                {runtimeCharacterError ? <div className={styles.extensionError}>{runtimeCharacterError}</div> : null}
                            </InspectorSection>
                        ) : null}

                        {selectedRuntimeRigidBodyComponent ? (
                            <InspectorSection
                                expanded={isExpanded('runtime-node:rigidbody2d')}
                                id="runtime-node:rigidbody2d"
                                label="RigidBody2D"
                                secondaryLabel={physicsRuntimeStatus && physicsRuntimeStatus.backendReady ? 'Physics2D' : 'Backend unavailable'}
                                onToggle={onToggleSection}
                            >
                                {selectedRuntimeRigidBody ? (
                                    <React.Fragment>
                                        <div className={styles.groupLabel}>Runtime Debug</div>
                                        <InspectorRow label="Backend">
                                            <input readOnly className={classNames(styles.input, styles.inputReadOnly)}
                                                value={physicsRuntimeStatus && physicsRuntimeStatus.backendId ? physicsRuntimeStatus.backendId : (physicsRuntimeStatus ? physicsRuntimeStatus.backendState : 'unavailable')} />
                                        </InspectorRow>
                                        <div className={styles.twoColumnGrid}>
                                            <InspectorRow label="Velocity X">
                                                <input readOnly className={classNames(styles.input, styles.inputReadOnly)}
                                                    value={selectedRuntimeRigidBody.state.velocity[0]} />
                                            </InspectorRow>
                                            <InspectorRow label="Velocity Y">
                                                <input readOnly className={classNames(styles.input, styles.inputReadOnly)}
                                                    value={selectedRuntimeRigidBody.state.velocity[1]} />
                                            </InspectorRow>
                                        </div>
                                        <div className={styles.twoColumnGrid}>
                                            <InspectorRow label="Angular Velocity">
                                                <input readOnly className={classNames(styles.input, styles.inputReadOnly)}
                                                    value={selectedRuntimeRigidBody.state.angularVelocity} />
                                            </InspectorRow>
                                            <InspectorRow label="Sleeping">
                                                <input readOnly className={classNames(styles.input, styles.inputReadOnly)}
                                                    value={selectedRuntimeRigidBody.state.sleeping ? 'Yes' : 'No'} />
                                            </InspectorRow>
                                        </div>
                                        <div className={styles.groupLabel}>Authoring / Initial State</div>
                                        <InspectorRow label="Enabled">
                                            <input checked={Boolean(selectedRuntimeRigidBody.config.enabled)} className={styles.checkbox} type="checkbox"
                                                onChange={event => commitSelectedRuntimeRigidBodyPatch({enabled: event.target.checked})} />
                                        </InspectorRow>
                                        <div className={styles.twoColumnGrid}>
                                            <InspectorRow label="Mass">
                                                <DraftInput min={0.000001} step={0.1} type="number" value={selectedRuntimeRigidBody.config.mass}
                                                    onCommit={value => commitSelectedRuntimeRigidBodyPatch({mass: value})} />
                                            </InspectorRow>
                                            <InspectorRow label="Gravity Scale">
                                                <DraftInput step={0.1} type="number" value={selectedRuntimeRigidBody.config.gravityScale}
                                                    onCommit={value => commitSelectedRuntimeRigidBodyPatch({gravityScale: value})} />
                                            </InspectorRow>
                                        </div>
                                        <div className={styles.twoColumnGrid}>
                                            <InspectorRow label="Initial VX">
                                                <DraftInput step={1} type="number" value={selectedRuntimeRigidBody.config.velocity[0]}
                                                    onCommit={value => commitSelectedRuntimeRigidBodyVelocityAxis(0, value)} />
                                            </InspectorRow>
                                            <InspectorRow label="Initial VY">
                                                <DraftInput step={1} type="number" value={selectedRuntimeRigidBody.config.velocity[1]}
                                                    onCommit={value => commitSelectedRuntimeRigidBodyVelocityAxis(1, value)} />
                                            </InspectorRow>
                                        </div>
                                        <div className={styles.twoColumnGrid}>
                                            <InspectorRow label="Linear Damping">
                                                <DraftInput min={0} step={0.1} type="number" value={selectedRuntimeRigidBody.config.linearDamping}
                                                    onCommit={value => commitSelectedRuntimeRigidBodyPatch({linearDamping: value})} />
                                            </InspectorRow>
                                            <InspectorRow label="Angular Damping">
                                                <DraftInput min={0} step={0.1} type="number" value={selectedRuntimeRigidBody.config.angularDamping}
                                                    onCommit={value => commitSelectedRuntimeRigidBodyPatch({angularDamping: value})} />
                                            </InspectorRow>
                                        </div>
                                        <div className={styles.twoColumnGrid}>
                                            <InspectorRow label="Friction">
                                                <DraftInput min={0} max={10} step={0.05} type="number" value={selectedRuntimeRigidBody.config.friction}
                                                    onCommit={value => commitSelectedRuntimeRigidBodyPatch({friction: value})} />
                                            </InspectorRow>
                                            <InspectorRow label="Restitution">
                                                <DraftInput min={0} max={1} step={0.05} type="number" value={selectedRuntimeRigidBody.config.restitution}
                                                    onCommit={value => commitSelectedRuntimeRigidBodyPatch({restitution: value})} />
                                            </InspectorRow>
                                        </div>
                                        <InspectorRow label="Physics Material">
                                            <select className={styles.select} value={selectedRuntimeRigidBody.config.physicsMaterialResourceId || ''}
                                                onChange={event => commitSelectedRuntimeRigidBodyPatch({physicsMaterialResourceId: event.target.value || null})}>
                                                <option value="">Inline material values</option>
                                                {availablePhysicsMaterials.map(material => (
                                                    <option key={material.resourceId} value={material.resourceId}>{material.name}</option>
                                                ))}
                                            </select>
                                        </InspectorRow>
                                        <div className={styles.twoColumnGrid}>
                                            <InspectorRow label="Freeze Rotation">
                                                <input checked={Boolean(selectedRuntimeRigidBody.config.freezeRotation)} className={styles.checkbox} type="checkbox"
                                                    onChange={event => commitSelectedRuntimeRigidBodyPatch({freezeRotation: event.target.checked})} />
                                            </InspectorRow>
                                            <InspectorRow label="CCD">
                                                <input checked={Boolean(selectedRuntimeRigidBody.config.ccd)} className={styles.checkbox} type="checkbox"
                                                    onChange={event => commitSelectedRuntimeRigidBodyPatch({ccd: event.target.checked})} />
                                            </InspectorRow>
                                        </div>
                                        <InspectorRow label="Start Sleeping">
                                            <input checked={Boolean(selectedRuntimeRigidBody.config.sleeping)} className={styles.checkbox} type="checkbox"
                                                onChange={event => commitSelectedRuntimeRigidBodyPatch({sleeping: event.target.checked})} />
                                        </InspectorRow>
                                        <InspectorRow label="Backend Handle">
                                            <input readOnly className={classNames(styles.input, styles.inputReadOnly)} value="Private / not project identity" />
                                        </InspectorRow>
                                    </React.Fragment>
                                ) : <div className={styles.nodeEmptyProperties}>RigidBody2D runtime is not available.</div>}
                                {runtimeRigidBodyError ? <div className={styles.extensionError}>{runtimeRigidBodyError}</div> : null}
                            </InspectorSection>
                        ) : null}

                        <InspectorSection
                            expanded={isExpanded('runtime-node:components')}
                            id="runtime-node:components"
                            label="Components"
                            secondaryLabel={selectedRuntimeComponents.length}
                            onToggle={onToggleSection}
                        >
                            {selectedRuntimeComponents.length ? selectedRuntimeComponents.map(component => (
                                <div className={styles.nodeEmptyProperties} key={component.id}>
                                    {component.typeId}
                                </div>
                            )) : (
                                <div className={styles.nodeEmptyProperties}>No components are attached.</div>
                            )}
                        </InspectorSection>

                        <InspectorSection
                            expanded={isExpanded('runtime-node:hierarchy')}
                            id="runtime-node:hierarchy"
                            label="Hierarchy"
                            secondaryLabel={`${selectedRuntimeNodeChildren.length} children`}
                            onToggle={onToggleSection}
                        >
                            <InspectorRow label="Parent">
                                <input
                                    readOnly
                                    className={classNames(styles.input, styles.inputReadOnly)}
                                    value={selectedRuntimeNodeParent ? selectedRuntimeNodeParent.name : 'Runtime root'}
                                />
                            </InspectorRow>
                            <InspectorRow label="Node ID">
                                <input
                                    readOnly
                                    className={classNames(styles.input, styles.inputReadOnly)}
                                    value={selectedRuntimeNode.id}
                                />
                            </InspectorRow>
                            <button
                                className={styles.dangerButton}
                                type="button"
                                onClick={deleteSelectedRuntimeNode}
                            >
                                Delete Node and Children
                            </button>
                        </InspectorSection>
                    </React.Fragment>
                ) : isCustomNode ? (
                    <React.Fragment>
                        <div className={styles.targetSummary}>
                            <span className={styles.targetIcon}>
                                {selectedNodeType ? selectedNodeType.icon : '�'}
                            </span>
                            <span className={styles.targetSummaryText}>
                                <strong>{selectedNode.name}</strong>
                                <small>{selectedNodeType ? selectedNodeType.label : selectedNode.typeId}</small>
                            </span>
                        </div>

                        <div className={styles.historyBar}>
                            <button
                                disabled={!historyState.canUndo}
                                title={historyState.undoLabel ? `Undo ${historyState.undoLabel}` : 'Nothing to undo'}
                                type="button"
                                onClick={handleHistoryUndo}
                            >
                                ↶ Undo
                            </button>
                            <button
                                disabled={!historyState.canRedo}
                                title={historyState.redoLabel ? `Redo ${historyState.redoLabel}` : 'Nothing to redo'}
                                type="button"
                                onClick={handleHistoryRedo}
                            >
                                Redo ↷
                            </button>
                            <span>{historyState.undoDepth} changes</span>
                        </div>

                        {isLegacyCompatibilityCollider ? (
                            <div className={styles.legacyCompatibilityNotice} data-ngvge-legacy-collider-warning="true">
                                <strong>Legacy Collider2D compatibility node</strong>
                                <span>
                                    This node only stores old Project Node properties. It does not own an
                                    ngvge.collider2d@1 Runtime Component, so it cannot render a collision gizmo or
                                    participate in Collider2D queries.
                                </span>
                                <span>
                                    Upgrade it to a Functional collision node. Existing shape, size, offset, layer and
                                    mask values will be transferred.
                                </span>
                                <div className={styles.legacyCompatibilityActions}>
                                    <button
                                        className={styles.secondaryButton}
                                        type="button"
                                        onClick={() => upgradeLegacyCollider(false)}
                                    >
                                        Upgrade as StaticBody2D
                                    </button>
                                    <button
                                        className={styles.secondaryButton}
                                        type="button"
                                        onClick={() => upgradeLegacyCollider(true)}
                                    >
                                        Upgrade as Area2D
                                    </button>
                                </div>
                                {runtimeNodeCommandError ? (
                                    <div className={styles.extensionError}>{runtimeNodeCommandError}</div>
                                ) : null}
                            </div>
                        ) : null}

                        <InspectorSection
                            expanded={isExpanded('node:identity')}
                            id="node:identity"
                            label="Node Identity"
                            onToggle={onToggleSection}
                        >
                            <InspectorRow label="Name">
                                <DraftInput
                                    value={selectedNode.name}
                                    onCommit={renameSelectedNode}
                                />
                            </InspectorRow>
                            <InspectorRow label="Enabled">
                                <input
                                    checked={Boolean(selectedNode.enabled)}
                                    className={styles.checkbox}
                                    type="checkbox"
                                    onChange={event => setSelectedNodeEnabled(event.target.checked)}
                                />
                            </InspectorRow>
                            <InspectorRow label="Node Type">
                                <input
                                    readOnly
                                    className={classNames(styles.input, styles.inputReadOnly)}
                                    value={selectedNode.typeId}
                                />
                            </InspectorRow>
                            <InspectorRow label="Node ID">
                                <input
                                    readOnly
                                    className={classNames(styles.input, styles.inputReadOnly)}
                                    value={selectedNode.id}
                                />
                            </InspectorRow>
                        </InspectorSection>

                        <InspectorSection
                            expanded={isExpanded('node:properties')}
                            id="node:properties"
                            label="Node Properties"
                            secondaryLabel={selectedNodeType ? selectedNodeType.category : 'Missing type'}
                            onToggle={onToggleSection}
                        >
                            {!selectedNodeType ? (
                                <div className={styles.extensionError}>
                                    This node type is not installed. Raw project data is preserved.
                                </div>
                            ) : selectedNodeType.fields.length ? selectedNodeType.fields.map(field => (
                                <InspectorRow key={field.id} label={field.label}>
                                    <ExtensionField
                                        field={Object.assign({}, field, {
                                            value: selectedNode.properties[field.id]
                                        })}
                                        onCommit={value => setSelectedNodeProperty(field.id, value)}
                                    />
                                </InspectorRow>
                            )) : (
                                <div className={styles.nodeEmptyProperties}>This node has no editable properties.</div>
                            )}
                        </InspectorSection>

                        <InspectorSection
                            expanded={isExpanded('node:hierarchy')}
                            id="node:hierarchy"
                            label="Hierarchy"
                            secondaryLabel={`${selectedNodeChildren.length} children`}
                            onToggle={onToggleSection}
                        >
                            <InspectorRow label="Parent">
                                <input
                                    readOnly
                                    className={classNames(styles.input, styles.inputReadOnly)}
                                    value={selectedNodeParent ? selectedNodeParent.name : 'Scene root'}
                                />
                            </InspectorRow>
                            <InspectorRow label="Children">
                                <input
                                    readOnly
                                    className={classNames(styles.input, styles.inputReadOnly)}
                                    value={selectedNodeChildren.length}
                                />
                            </InspectorRow>
                            <button
                                className={styles.dangerButton}
                                type="button"
                                onClick={deleteSelectedNode}
                            >
                                Delete Node and Children
                            </button>
                        </InspectorSection>
                    </React.Fragment>
                ) : !target ? (
                    <div className={styles.emptyState}>
                        Select a Stage, Sprite, or native node in Project Explorer to inspect its properties.
                    </div>
                ) : (
                    <React.Fragment>
                        <div className={styles.targetSummary}>
                            <span className={styles.targetIcon}>{target.isStage ? '▣' : '●'}</span>
                            <span className={styles.targetSummaryText}>
                                <strong>{target.getName()}</strong>
                                <small>{target.isStage ? 'Stage' : 'Sprite'}</small>
                            </span>
                        </div>

                        <div className={styles.historyBar}>
                            <button
                                disabled={!historyState.canUndo}
                                title={historyState.undoLabel ? `Undo ${historyState.undoLabel}` : 'Nothing to undo'}
                                type="button"
                                onClick={handleHistoryUndo}
                            >
                                ↶ Undo
                            </button>
                            <button
                                disabled={!historyState.canRedo}
                                title={historyState.redoLabel ? `Redo ${historyState.redoLabel}` : 'Nothing to redo'}
                                type="button"
                                onClick={handleHistoryRedo}
                            >
                                Redo ↷
                            </button>
                            <span>{historyState.undoDepth} changes</span>
                        </div>

                        <InspectorSection
                            expanded={isExpanded('identity')}
                            id="identity"
                            label="Identity"
                            onToggle={onToggleSection}
                        >
                            <InspectorRow label="Name">
                                <DraftInput
                                    disabled={target.isStage}
                                    value={target.getName()}
                                    onCommit={renameTarget}
                                />
                            </InspectorRow>
                            <InspectorRow label="Target ID">
                                <input
                                    readOnly
                                    className={classNames(styles.input, styles.inputReadOnly)}
                                    value={target.id}
                                />
                            </InspectorRow>
                        </InspectorSection>

                        {!target.isStage ? (
                            <InspectorSection
                                expanded={isExpanded('transform')}
                                id="transform"
                                label="Transform"
                                onToggle={onToggleSection}
                            >
                                <div className={styles.twoColumnGrid}>
                                    <InspectorRow label="X">
                                        <DraftInput
                                            step={1}
                                            type="number"
                                            value={target.x}
                                            onCommit={value => commitSpriteProperty('x', value, 'Set X')}
                                        />
                                    </InspectorRow>
                                    <InspectorRow label="Y">
                                        <DraftInput
                                            step={1}
                                            type="number"
                                            value={target.y}
                                            onCommit={value => commitSpriteProperty('y', value, 'Set Y')}
                                        />
                                    </InspectorRow>
                                </div>
                                <InspectorRow label="Direction">
                                    <DraftInput
                                        step={1}
                                        type="number"
                                        value={target.direction}
                                        onCommit={value => commitSpriteProperty('direction', value, 'Set direction')}
                                    />
                                </InspectorRow>
                                <InspectorRow label="Size">
                                    <div className={styles.inputWithUnit}>
                                        <DraftInput
                                            min={0}
                                            step={1}
                                            type="number"
                                            value={target.size}
                                            onCommit={value => commitSpriteProperty('size', value, 'Set size')}
                                        />
                                        <span>%</span>
                                    </div>
                                </InspectorRow>
                                <InspectorRow label="Rotation">
                                    <select
                                        className={styles.select}
                                        value={target.rotationStyle || 'all around'}
                                        onChange={event => commitSpriteProperty(
                                            'rotationStyle',
                                            event.target.value,
                                            'Set rotation style'
                                        )}
                                    >
                                        <option value="all around">All around</option>
                                        <option value="left-right">Left / right</option>
                                        <option value="don't rotate">Do not rotate</option>
                                    </select>
                                </InspectorRow>
                                <InspectorRow label="Visible">
                                    <input
                                        checked={Boolean(target.visible)}
                                        className={styles.checkbox}
                                        type="checkbox"
                                        onChange={event => commitSpriteProperty(
                                            'visible',
                                            event.target.checked,
                                            'Set visibility'
                                        )}
                                    />
                                </InspectorRow>
                                <InspectorRow label="Draggable">
                                    <input
                                        checked={Boolean(target.draggable)}
                                        className={styles.checkbox}
                                        type="checkbox"
                                        onChange={event => commitSpriteProperty(
                                            'draggable',
                                            event.target.checked,
                                            'Set draggable'
                                        )}
                                    />
                                </InspectorRow>
                            </InspectorSection>
                        ) : null}

                        {!target.isStage ? (
                            <InspectorSection
                                expanded={isExpanded('layer')}
                                id="layer"
                                label="Layer Manager"
                                secondaryLabel={selectedLayerIndex >= 0 ? (
                                    `${selectedLayerIndex + 1}/${originalSprites.length}`
                                ) : null}
                                onToggle={onToggleSection}
                            >
                                <div className={styles.layerActions}>
                                    <button type="button" onClick={() => moveLayer('front')}>Front</button>
                                    <button type="button" onClick={() => moveLayer('forward')}>Up</button>
                                    <button type="button" onClick={() => moveLayer('backward')}>Down</button>
                                    <button type="button" onClick={() => moveLayer('back')}>Back</button>
                                </div>
                                <div className={styles.layerHint}>Front → back</div>
                                <div className={styles.layerList}>
                                    {originalSprites.map((spriteTarget, index) => (
                                        <button
                                            className={classNames(styles.layerItem, {
                                                [styles.layerItemSelected]: spriteTarget.id === target.id
                                            })}
                                            data-layer-target-id={spriteTarget.id}
                                            key={spriteTarget.id}
                                            type="button"
                                            onClick={() => onSelectTarget(spriteTarget.id)}
                                        >
                                            <span className={styles.layerIndex}>{index + 1}</span>
                                            <span className={styles.layerName}>{spriteTarget.getName()}</span>
                                            <span className={styles.layerOrder}>
                                                {typeof spriteTarget.getLayerOrder === 'function' ? (
                                                    spriteTarget.getLayerOrder()
                                                ) : '—'}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </InspectorSection>
                        ) : null}

                        {extensionSections.map(({error, fields, section}) => {
                            const sectionId = `extension:${section.id}`;
                            return (
                                <InspectorSection
                                    expanded={isExpanded(sectionId)}
                                    id={sectionId}
                                    key={section.id}
                                    label={section.label}
                                    secondaryLabel="Extension"
                                    onToggle={onToggleSection}
                                >
                                    {error ? (
                                        <div className={styles.extensionError}>{error}</div>
                                    ) : fields.map(field => (
                                        <InspectorRow key={field.id} label={field.label}>
                                            <ExtensionField
                                                field={field}
                                                onCommit={value => {
                                                    const before = field.value;
                                                    const targetId = target.id;
                                                    applyExtensionValue(section.id, targetId, field.id, value);
                                                    const currentSection = registry.getSection(section.id);
                                                    const currentTarget = runtime.getTargetById(targetId);
                                                    let after = value;
                                                    try {
                                                        const currentFields = currentSection && currentTarget ?
                                                            currentSection.getFields(
                                                                currentTarget,
                                                                {registry, runtime, vm}
                                                            ) : [];
                                                        const currentField = currentFields.find(
                                                            candidate => candidate.id === field.id
                                                        );
                                                        if (currentField) after = currentField.value;
                                                    } catch {
                                                        after = value;
                                                    }
                                                    if (history) {
                                                        history.recordValue({
                                                            after,
                                                            apply: nextValue => applyExtensionValue(
                                                                section.id,
                                                                targetId,
                                                                field.id,
                                                                nextValue
                                                            ),
                                                            before,
                                                            label: `${section.label}: ${field.label}`,
                                                            metadata: {
                                                                fieldId: field.id,
                                                                sectionId: section.id,
                                                                targetId,
                                                                type: 'extension-property'
                                                            }
                                                        });
                                                    }
                                                }}
                                            />
                                        </InspectorRow>
                                    ))}
                                </InspectorSection>
                            );
                        })}
                    </React.Fragment>
                )}
            </div>

            <footer className={styles.footer}>
                <span className={styles.statusDot} />
                Project persistence active · {historyState.undoDepth} undo steps ·
                {' '}{extensionSections.length} extensions
            </footer>
        </aside>
    );
};

ProjectInspector.propTypes = {
    editingTargetId: PropTypes.string,
    expandedSectionIds: PropTypes.arrayOf(PropTypes.string),
    nodeCommandClient: PropTypes.shape({
        destroyNode: PropTypes.func.isRequired,
        patchNode: PropTypes.func.isRequired,
        selectNode: PropTypes.func.isRequired
    }),
    onClose: PropTypes.func,
    onSelectNode: PropTypes.func,
    onSelectTarget: PropTypes.func,
    onToggleSection: PropTypes.func.isRequired,
    selectedNodeId: PropTypes.string,
    showHeader: PropTypes.bool,
    vm: PropTypes.shape({
        editingTarget: PropTypes.shape({id: PropTypes.string}),
        emitTargetsUpdate: PropTypes.func,
        off: PropTypes.func.isRequired,
        on: PropTypes.func.isRequired,
        postSpriteInfo: PropTypes.func.isRequired,
        renameSprite: PropTypes.func.isRequired,
        runtime: PropTypes.shape({
            emitProjectChanged: PropTypes.func.isRequired,
            getTargetById: PropTypes.func.isRequired,
            targets: PropTypes.array.isRequired
        }).isRequired
    }).isRequired,
    width: PropTypes.number
};

ProjectInspector.defaultProps = {
    editingTargetId: null,
    expandedSectionIds: [],
    nodeCommandClient: null,
    onClose: () => {},
    onSelectNode: () => {},
    onSelectTarget: () => {},
    selectedNodeId: null,
    showHeader: true,
    width: 320
};

export default ProjectInspector;
