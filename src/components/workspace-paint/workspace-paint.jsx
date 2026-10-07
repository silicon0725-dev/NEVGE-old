import {sanitizeSvg} from '@turbowarp/scratch-svg-renderer';
import PropTypes from 'prop-types';
import React from 'react';

import PaintEditor from '../../lib/tw-scratch-paint';
import WorkspaceVectorEditor from './workspace-vector-editor.jsx';
import {
    fromScratchPaintUpdate,
    toScratchPaintDocument
} from '../../lib/editor-shell/scratch-paint-working-copy-adapter';

import styles from './workspace-paint.css';

const WorkspacePaint = ({session, onActivateBackend}) => {
    const [, setRevision] = React.useState(0);
    const [busy, setBusy] = React.useState(false);
    const [localError, setLocalError] = React.useState(null);
    const [backendReady, setBackendReady] = React.useState(false);

    React.useEffect(() => session.subscribe(event => setRevision(event.revision)), [session]);
    const state = session.getState();
    const resource = state.resource;
    const review = state.proposalReview;
    const workingCopy = state.workingCopy;
    const workingContent = workingCopy && workingCopy.loaded ? session.getWorkingCopyContent() : null;
    const isVectorWorkingCopy = Boolean(workingContent && workingContent.dataFormat === 'svg');

    React.useEffect(() => {
        if (isVectorWorkingCopy || !workingContent || typeof onActivateBackend !== 'function') {
            if (isVectorWorkingCopy) setBackendReady(false);
            return;
        }
        onActivateBackend();
        setBackendReady(true);
        return;
    }, [isVectorWorkingCopy, onActivateBackend, workingContent && workingContent.workingCopyId]);

    const backendDocument = !isVectorWorkingCopy && backendReady && workingContent ? toScratchPaintDocument(workingContent, {
        sanitizeSvgText: sanitizeSvg.sanitizeSvgText
    }) : null;

    const run = React.useCallback(async operation => {
        setBusy(true);
        setLocalError(null);
        try {
            await operation();
        } catch (error) {
            setLocalError(error && error.message ? error.message : String(error));
        } finally {
            setBusy(false);
        }
    }, []);

    const handleVectorError = React.useCallback(error => {
        setLocalError(error && error.message ? error.message : String(error));
    }, []);

    const handleBackendUpdate = React.useCallback((isVector, image, rotationCenterX, rotationCenterY) => {
        try {
            const edit = fromScratchPaintUpdate({isVector, image, rotationCenterX, rotationCenterY});
            session.applyWorkingCopyEdit(edit);
        } catch (error) {
            setLocalError(error && error.message ? error.message : String(error));
        }
    }, [session]);

    return (
        <section
            className={styles.root}
            data-ngvge-paint-session={state.sessionId}
            data-ngvge-paint-backend={state.backend.adapterId}
            data-ngvge-tool-id="ngvge.tool.paint"
        >
            <header className={styles.header}>
                <div>
                    <h2>Better Paint</h2>
                    <p>Resource working-copy session</p>
                </div>
                <span className={styles.backendBadge}>{state.backend.package}</span>
            </header>

            <div className={styles.notice}>
                WS-10F routes SVG working copies through the SVG-Edit vector backend while raster compatibility stays on Scratch Paint.
                All drawing changes remain isolated until Review and Commit Reviewed.
            </div>

            <div className={styles.layout}>
                <aside className={styles.sidebar}>
                    <label htmlFor="ngvge-paint-resource">Image Resource</label>
                    <select
                        id="ngvge-paint-resource"
                        value={state.selectedResourceId || ''}
                        disabled={busy}
                        onChange={event => run(() => session.selectResource(event.target.value || null))}
                    >
                        <option value="">Select image…</option>
                        {state.imageResources.map(item => (
                            <option key={item.resourceId} value={item.resourceId}>{item.name}</option>
                        ))}
                    </select>
                    {resource ? (
                        <dl className={styles.meta}>
                            <div><dt>ResourceId</dt><dd title={resource.resourceId}>{resource.resourceId}</dd></div>
                            <div><dt>Format</dt><dd>{resource.dataFormat || 'unknown'}</dd></div>
                            <div><dt>References</dt><dd>{resource.referenceCount}</dd></div>
                            <div>
                                <dt>Working copy</dt>
                                <dd>{workingCopy && workingCopy.loaded ? workingCopy.workingCopyId : 'not loaded'}</dd>
                            </div>
                            <div>
                                <dt>Content state</dt>
                                <dd>
                                    {workingCopy && workingCopy.dirty ? 'dirty' : 'clean'}
                                    {workingCopy && workingCopy.stale ? ' / stale' : ''}
                                </dd>
                            </div>
                        </dl>
                    ) : (
                        <p className={styles.empty}>Select an image in Asset Workspace or choose one here.</p>
                    )}
                    <div className={styles.workingCopyActions}>
                        <button
                            disabled={!workingCopy || !workingCopy.loaded || !workingCopy.dirty || busy}
                            type="button"
                            onClick={() => run(() => session.discardWorkingCopy())}
                        >
                            Discard Local Edits
                        </button>
                        <button
                            disabled={!workingCopy || !workingCopy.loaded || workingCopy.dirty || !workingCopy.stale || busy}
                            type="button"
                            onClick={() => run(() => session.reloadWorkingCopy())}
                        >
                            Reload Source
                        </button>
                    </div>
                </aside>

                <main className={styles.main}>
                    <div className={styles.metadataPanel}>
                        <div className={styles.field}>
                            <label htmlFor="ngvge-paint-resource-name">Resource name</label>
                            <input
                                id="ngvge-paint-resource-name"
                                disabled={!resource || busy}
                                value={state.draft.name}
                                onChange={event => session.setDraftName(event.target.value)}
                            />
                        </div>
                        <div className={styles.actions}>
                            <button disabled={!resource || busy} type="button" onClick={() => run(() => session.reviewChanges())}>
                                Review Changes
                            </button>
                            <button
                                disabled={!review || !review.canCommit || busy}
                                type="button"
                                onClick={() => run(() => session.commitReviewedChanges())}
                            >
                                Commit Reviewed
                            </button>
                            <button
                                disabled={!state.transactionId || busy}
                                type="button"
                                onClick={() => run(() => session.rollbackLastTransaction())}
                            >
                                Review & Rollback
                            </button>
                        </div>
                    </div>

                    <section className={styles.editorSection} data-working-copy-dirty={workingCopy && workingCopy.dirty ? 'true' : 'false'}>
                        <div className={styles.editorHeader}>
                            <div>
                                <h3>Transient Canvas</h3>
                                <span>{workingCopy && workingCopy.loaded ? `${workingCopy.dataFormat} · source r${workingCopy.sourceAuthorityRevision}` : 'No working copy'}</span>
                            </div>
                            {workingCopy && workingCopy.stale ? (
                                <strong className={styles.stale}>Source changed</strong>
                            ) : null}
                        </div>
                        {isVectorWorkingCopy ? (
                            <div className={styles.paintBackendSurface} data-ngvge-working-copy-id={workingCopy.workingCopyId}>
                                <WorkspaceVectorEditor
                                    workingCopy={workingContent}
                                    onApplyEdit={session.applyWorkingCopyEdit}
                                    onError={handleVectorError}
                                />
                            </div>
                        ) : backendDocument ? (
                            <div className={styles.paintBackendSurface} data-ngvge-working-copy-id={workingCopy.workingCopyId}>
                                <PaintEditor
                                    image={backendDocument.image}
                                    imageFormat={backendDocument.imageFormat}
                                    imageId={backendDocument.imageId}
                                    name={state.draft.name}
                                    onUpdateImage={handleBackendUpdate}
                                    onUpdateName={session.setDraftName}
                                    rotationCenterX={backendDocument.rotationCenterX}
                                    rotationCenterY={backendDocument.rotationCenterY}
                                    rtl={false}
                                    theme="dark"
                                    width={640}
                                    height={420}
                                />
                            </div>
                        ) : (
                            <div className={styles.editorPlaceholder}>
                                {resource ? 'Preparing isolated paint backend…' : 'Select an image Resource to start a working copy.'}
                            </div>
                        )}
                    </section>

                    {review ? (
                        <section className={styles.review} data-review-state={review.state}>
                            <h3>Project Transaction Review</h3>
                            <div className={styles.reviewSummary}>
                                <span>{review.state}</span>
                                <span>{review.impact.changedCommandCount} change(s)</span>
                                <span>{review.canCommit ? 'Commit allowed' : 'Commit blocked'}</span>
                            </div>
                            {review.commands.map(command => (
                                <div className={styles.command} key={`${command.commandIndex}:${command.resourceId}`}>
                                    <strong>{command.kind}</strong>
                                    <span>
                                        {command.kind === 'resource.content.replace' ? (
                                            `${command.before ? command.before.dataFormat : '—'} r${command.before ? command.before.sourceAuthorityRevision : '—'} ` +
                                            `→ ${command.after ? command.after.dataFormat : '—'} r${command.after ? command.after.sourceAuthorityRevision : '—'}`
                                        ) : (
                                            `${command.before ? command.before.name : '—'} → ${command.after ? command.after.name : '—'}`
                                        )}
                                    </span>
                                </div>
                            ))}
                            {review.diagnostics.length ? (
                                <ul className={styles.diagnostics}>
                                    {review.diagnostics.map((diagnostic, index) => (
                                        <li key={`${diagnostic.code}:${index}`}>{diagnostic.message}</li>
                                    ))}
                                </ul>
                            ) : null}
                        </section>
                    ) : null}

                    {(localError || state.lastError) ? (
                        <div className={styles.error} role="alert">
                            {localError || state.lastError.message}
                        </div>
                    ) : null}
                </main>
            </div>
        </section>
    );
};

WorkspacePaint.propTypes = {
    session: PropTypes.shape({
        getState: PropTypes.func.isRequired,
        getWorkingCopyContent: PropTypes.func.isRequired,
        selectResource: PropTypes.func.isRequired,
        applyWorkingCopyEdit: PropTypes.func.isRequired,
        discardWorkingCopy: PropTypes.func.isRequired,
        reloadWorkingCopy: PropTypes.func.isRequired,
        setDraftName: PropTypes.func.isRequired,
        reviewChanges: PropTypes.func.isRequired,
        commitReviewedChanges: PropTypes.func.isRequired,
        rollbackLastTransaction: PropTypes.func.isRequired,
        subscribe: PropTypes.func.isRequired
    }).isRequired,
    onActivateBackend: PropTypes.func
};

export default WorkspacePaint;
