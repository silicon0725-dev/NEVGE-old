/* eslint-disable react/jsx-no-literals, react/jsx-no-bind, react/jsx-max-props-per-line, react/jsx-handler-names, max-len */
import PropTypes from 'prop-types';
import React from 'react';

import WorkspaceScratchPaintEditor from '../components/workspace-paint/workspace-scratch-paint-editor.jsx';
import PaintEditorWrapper from './paint-editor-wrapper.jsx';
import {
    NATIVE_PAINT_EDITOR_MODES,
    NATIVE_PAINT_MODES,
    createNativePaintHostBinding
} from '../lib/editor-shell/native-paint-host';

import styles from '../components/native-paint/native-paint-host.css';

const EDITOR_MODE_OPTIONS = Object.freeze([
    {id: NATIVE_PAINT_EDITOR_MODES.AUTO, label: 'Auto'},
    {id: NATIVE_PAINT_EDITOR_MODES.VECTOR, label: 'Vector'},
    {id: NATIVE_PAINT_EDITOR_MODES.BITMAP, label: 'Bitmap'},
    {id: NATIVE_PAINT_EDITOR_MODES.PIXEL, label: 'Pixel'},
    {id: NATIVE_PAINT_EDITOR_MODES.COMPATIBILITY, label: 'Scratch'}
]);

const getActiveBackendLabel = mode => {
    if (mode === NATIVE_PAINT_MODES.VECTOR) return 'Scratch Paint Modular · Vector';
    if (mode === NATIVE_PAINT_MODES.BITMAP) return 'Scratch Paint Modular · Bitmap';
    return 'Scratch Paint compatibility';
};

const NativePaintHost = ({
    assetDatabase,
    hostNotice,
    onResourceSelectionChange,
    paintSession,
    selectedCostumeIndex,
    target
}) => {
    const [, setRevision] = React.useState(0);
    const [busy, setBusy] = React.useState(false);
    const [localError, setLocalError] = React.useState(null);
    const [preferredMode, setPreferredMode] = React.useState(NATIVE_PAINT_EDITOR_MODES.AUTO);
    const [selection, setSelection] = React.useState(null);

    const binding = React.useMemo(() => createNativePaintHostBinding({
        paintSession,
        assetDatabase,
        onResourceSelectionChange
    }), [assetDatabase, onResourceSelectionChange, paintSession]);

    React.useEffect(() => paintSession.subscribe(event => {
        setRevision(event.revision);
    }), [paintSession]);

    React.useEffect(() => {
        setLocalError(null);
        try {
            setSelection(binding.syncSelection(target, selectedCostumeIndex, preferredMode));
        } catch (error) {
            try {
                setSelection(binding.describeSelection(target, selectedCostumeIndex, preferredMode));
            } catch {
                setSelection(binding.describeSelection(target, selectedCostumeIndex, NATIVE_PAINT_EDITOR_MODES.AUTO));
            }
            setLocalError(error);
        }
    }, [binding, preferredMode, selectedCostumeIndex, target]);

    const state = paintSession.getState();
    const workingCopy = state.workingCopy;
    const workingContent = workingCopy && workingCopy.loaded ? paintSession.getWorkingCopyContent() : null;
    const nativeReady = Boolean(
        selection &&
        (selection.mode === NATIVE_PAINT_MODES.VECTOR || selection.mode === NATIVE_PAINT_MODES.BITMAP) &&
        selection.resourceId &&
        workingContent &&
        workingContent.resourceId === selection.resourceId
    );
    const isDirtySwitchBlocked = Boolean(
        localError && localError.code === 'NGVGE_NATIVE_PAINT_DIRTY_SWITCH_BLOCKED'
    );

    const run = React.useCallback(async operation => {
        setBusy(true);
        setLocalError(null);
        try {
            await operation();
            return true;
        } catch (error) {
            setLocalError(error);
            return false;
        } finally {
            setBusy(false);
        }
    }, []);

    const retrySync = React.useCallback(() => {
        try {
            setLocalError(null);
            setSelection(binding.syncSelection(target, selectedCostumeIndex, preferredMode));
        } catch (error) {
            setLocalError(error);
        }
    }, [binding, preferredMode, selectedCostumeIndex, target]);

    const resolvePendingChanges = async operation => {
        const succeeded = await run(operation);
        if (succeeded) retrySync();
    };

    const handleModeChange = nextMode => {
        if (nextMode === preferredMode || busy) return;
        try {
            setLocalError(null);
            const nextSelection = binding.syncSelection(target, selectedCostumeIndex, nextMode);
            setPreferredMode(nextMode);
            setSelection(nextSelection);
        } catch (error) {
            setLocalError(error);
        }
    };

    if (!selection) {
        return <div className={styles.placeholder}>Preparing Native Paint host…</div>;
    }

    const review = state.proposalReview;
    const errorMessage = localError && localError.message ? localError.message : null;
    const notice = errorMessage || hostNotice;
    const costumes = target && typeof target.getCostumes === 'function' ? target.getCostumes() :
        (target && target.sprite && Array.isArray(target.sprite.costumes) ? target.sprite.costumes : []);
    const selectedCostume = costumes[selectedCostumeIndex];
    const resourceLabel = selectedCostume && selectedCostume.name ? selectedCostume.name : 'Paint resource';
    const runtimeStageWidth = Number(target && target.runtime && target.runtime.stageWidth);
    const runtimeStageHeight = Number(target && target.runtime && target.runtime.stageHeight);
    const stageSize = {
        width: Number.isFinite(runtimeStageWidth) && runtimeStageWidth > 0 ? runtimeStageWidth : 480,
        height: Number.isFinite(runtimeStageHeight) && runtimeStageHeight > 0 ? runtimeStageHeight : 360
    };
    const modeAvailability = selection.modeAvailability || {};
    const sourceFormatLabel = selection.dataFormat ? selection.dataFormat.toUpperCase() : 'UNKNOWN';
    const activeBackendLabel = getActiveBackendLabel(selection.mode);

    const isModeDisabled = mode => {
        if (busy) return true;
        if (mode === NATIVE_PAINT_EDITOR_MODES.AUTO || mode === NATIVE_PAINT_EDITOR_MODES.COMPATIBILITY) return false;
        if (mode === NATIVE_PAINT_EDITOR_MODES.VECTOR) return !modeAvailability.vector;
        if (mode === NATIVE_PAINT_EDITOR_MODES.BITMAP) return !modeAvailability.bitmap;
        return true;
    };

    return (
        <section
            className={styles.root}
            data-ngvge-native-paint-host="true"
            data-ngvge-paint-presentation="native-costume-tab"
            data-ngvge-paint-mode={selection.mode}
            data-ngvge-paint-requested-mode={preferredMode}
            data-ngvge-resource-id={selection.resourceId || ''}
        >
            <div className={styles.modeSwitchBar} data-ngvge-paint-mode-switch="true">
                <div className={styles.modeSwitchIdentity}>
                    <strong>Editor Mode</strong>
                    <span>{sourceFormatLabel}</span>
                </div>
                <div className={styles.modeSwitchOptions} role="group" aria-label="Paint editor mode">
                    {EDITOR_MODE_OPTIONS.map(option => {
                        const disabled = isModeDisabled(option.id);
                        const active = preferredMode === option.id;
                        const title = option.id === NATIVE_PAINT_EDITOR_MODES.PIXEL ?
                            'Pixel mode will be implemented as a Bitmap policy module after the Scratch Paint modular baseline.' :
                            (disabled ? `This ${option.label} mode is incompatible with ${sourceFormatLabel} source content.` : `Open ${option.label} editor mode`);
                        return (
                            <button
                                key={option.id}
                                type="button"
                                className={active ? styles.modeSwitchButtonActive : styles.modeSwitchButton}
                                data-ngvge-paint-mode-option={option.id}
                                aria-pressed={active}
                                disabled={disabled}
                                title={title}
                                onClick={() => handleModeChange(option.id)}
                            >
                                {option.label}
                            </button>
                        );
                    })}
                </div>
                <div className={styles.modeSwitchStatus} data-ngvge-active-paint-backend={activeBackendLabel}>
                    <span>Active</span>
                    <strong>{activeBackendLabel}</strong>
                </div>
            </div>

            {isDirtySwitchBlocked ? (
                <div className={styles.blocked}>
                    <strong>Unsaved Paint changes</strong>
                    <span>The selected costume or editor mode will open after the current working copy is committed or discarded.</span>
                    <div className={styles.blockedActions}>
                        <button type="button" disabled={busy} onClick={() => run(() => paintSession.reviewChanges())}>Review</button>
                        <button
                            type="button"
                            disabled={!review || !review.canCommit || busy}
                            onClick={() => resolvePendingChanges(() => paintSession.commitReviewedChanges())}
                        >
                            Commit
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => resolvePendingChanges(() => paintSession.discardWorkingCopy())}
                        >
                            Discard
                        </button>
                    </div>
                </div>
            ) : selection.mode === NATIVE_PAINT_MODES.LEGACY_RASTER ? (
                <div className={styles.compatibilitySurface}>
                    {notice ? <div className={styles.compatibilityNotice} role="status">{notice}</div> : null}
                    <PaintEditorWrapper selectedCostumeIndex={selectedCostumeIndex} />
                </div>
            ) : nativeReady ? (
                <div className={styles.modularPaintSurface} data-ngvge-modular-scratch-paint="true">
                    <div className={styles.workingCopyBar}>
                        <div className={styles.workingCopyIdentity}>
                            <strong>{resourceLabel}</strong>
                            <span>{workingCopy && workingCopy.dirty ? 'Working Copy · Modified' : 'Working Copy · Clean'}</span>
                            {workingCopy && workingCopy.stale ? <span className={styles.stale}>Source changed</span> : null}
                        </div>
                        <div className={styles.workingCopyActions}>
                            <button type="button" disabled={busy} onClick={() => run(() => paintSession.reviewChanges())}>Review</button>
                            <button
                                type="button"
                                disabled={!review || !review.canCommit || busy}
                                onClick={() => resolvePendingChanges(() => paintSession.commitReviewedChanges())}
                            >
                                Commit
                            </button>
                            <button
                                type="button"
                                disabled={!workingCopy || !workingCopy.dirty || busy}
                                onClick={() => resolvePendingChanges(() => paintSession.discardWorkingCopy())}
                            >
                                Discard
                            </button>
                        </div>
                    </div>
                    {notice ? <div className={styles.compatibilityNotice} role="status">{notice}</div> : null}
                    <WorkspaceScratchPaintEditor
                        name={state.draft && typeof state.draft.name === 'string' ? state.draft.name : resourceLabel}
                        stageSize={stageSize}
                        theme="dark"
                        workingCopy={workingContent}
                        onApplyEdit={paintSession.applyWorkingCopyEdit}
                        onError={setLocalError}
                        onUpdateName={paintSession.setDraftName}
                    />
                </div>
            ) : (
                <div className={styles.placeholder}>Preparing canonical Paint working copy…</div>
            )}
        </section>
    );
};

NativePaintHost.propTypes = {
    assetDatabase: PropTypes.shape({
        ensureCostumeResource: PropTypes.func.isRequired,
        getCostumeResourceId: PropTypes.func.isRequired
    }).isRequired,
    hostNotice: PropTypes.string,
    onResourceSelectionChange: PropTypes.func,
    paintSession: PropTypes.shape({
        applyWorkingCopyEdit: PropTypes.func.isRequired,
        commitReviewedChanges: PropTypes.func.isRequired,
        discardWorkingCopy: PropTypes.func.isRequired,
        getState: PropTypes.func.isRequired,
        getWorkingCopyContent: PropTypes.func.isRequired,
        reviewChanges: PropTypes.func.isRequired,
        selectResource: PropTypes.func.isRequired,
        setDraftName: PropTypes.func.isRequired,
        subscribe: PropTypes.func.isRequired
    }).isRequired,
    selectedCostumeIndex: PropTypes.number.isRequired,
    target: PropTypes.shape({
        getCostumes: PropTypes.func,
        id: PropTypes.string.isRequired,
        isOriginal: PropTypes.bool,
        runtime: PropTypes.shape({
            stageWidth: PropTypes.number,
            stageHeight: PropTypes.number
        }),
        sprite: PropTypes.object
    }).isRequired
};

export default NativePaintHost;
