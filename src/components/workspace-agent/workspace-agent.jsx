/* eslint-disable react/jsx-no-bind, react/jsx-no-literals */
import PropTypes from 'prop-types';
import React from 'react';

import {AGENT_CHANGESET_STATES} from '../../lib/editor-shell/agent-change-set';
import {WORKSPACE_AGENT_MODEL_ID} from '../../lib/editor-shell/agent-workspace-model';
import {AGENT_TRANSACTION_STATES} from '../../lib/editor-shell/agent-transaction-host';

import styles from './workspace-agent.css';

const StatusPill = ({state}) => (
    <span
        className={styles.status}
        data-state={state}
    >
        {state}
    </span>
);

StatusPill.propTypes = {
    state: PropTypes.string.isRequired
};

const ContextPanel = ({view}) => (
    <section className={styles.panel}>
        <div className={styles.panelHeader}>
            <div>
                <div className={styles.eyebrow}>Current Context</div>
                <h3>Workspace selection</h3>
            </div>
            <span className={styles.readOnlyBadge}>read-only context</span>
        </div>
        {view.context && view.context.node ? (
            <dl className={styles.contextGrid}>
                <div><dt>NodeId</dt><dd>{view.context.node.id}</dd></div>
                <div><dt>Name</dt><dd>{view.context.node.name}</dd></div>
                <div><dt>Type</dt><dd>{view.context.node.typeId}</dd></div>
                <div><dt>Domain</dt><dd>{view.context.node.domain}</dd></div>
                <div><dt>Parent</dt><dd>{view.context.node.parentId || '—'}</dd></div>
                <div><dt>Enabled</dt><dd>{view.context.node.enabled ? 'Yes' : 'No'}</dd></div>
            </dl>
        ) : (
            <div className={styles.empty}>Select a Node in Node Explorer to establish Agent context.</div>
        )}
        <div className={styles.visibilityGrid}>
            <div>
                <div className={styles.eyebrow}>What AI can see</div>
                <ul>{view.whatAIcanSee.map(item => <li key={item}>{item}</li>)}</ul>
            </div>
            <div>
                <div className={styles.eyebrow}>Explicitly unavailable</div>
                <ul>{view.whatAIcannotSee.map(item => <li key={item}>{item}</li>)}</ul>
            </div>
        </div>
    </section>
);

ContextPanel.propTypes = {
    view: PropTypes.shape({
        context: PropTypes.object,
        whatAIcanSee: PropTypes.arrayOf(PropTypes.string).isRequired,
        whatAIcannotSee: PropTypes.arrayOf(PropTypes.string).isRequired
    }).isRequired
};

const ProposalList = ({view, model}) => (
    <section className={`${styles.panel} ${styles.proposalsPanel}`}>
        <div className={styles.panelHeader}>
            <div>
                <div className={styles.eyebrow}>Proposed Changes</div>
                <h3>ChangeSets</h3>
            </div>
            <span className={styles.countBadge}>{view.changeSets.length}</span>
        </div>
        <div className={styles.proposalList}>
            {view.changeSets.length ? view.changeSets.map(changeSet => (
                <button
                    className={styles.proposalItem}
                    data-selected={view.selectedChangeSetId === changeSet.changeSetId ? 'true' : 'false'}
                    data-agent-changeset-id={changeSet.changeSetId}
                    key={changeSet.changeSetId}
                    onClick={() => model.selectChangeSet(changeSet.changeSetId)}
                    type="button"
                >
                    <span className={styles.proposalTitle}>{changeSet.summary}</span>
                    <span className={styles.proposalMeta}>
                        {changeSet.operations.length} operation{changeSet.operations.length === 1 ? '' : 's'}
                    </span>
                    <StatusPill state={changeSet.state} />
                </button>
            )) : (
                <div className={styles.empty}>
                    No pending ChangeSet. Agent/provider adapters submit portable proposals through the Workspace Agent
                    model.
                </div>
            )}
        </div>
    </section>
);

ProposalList.propTypes = {
    model: PropTypes.shape({selectChangeSet: PropTypes.func.isRequired}).isRequired,
    view: PropTypes.shape({
        changeSets: PropTypes.arrayOf(PropTypes.object).isRequired,
        selectedChangeSetId: PropTypes.string
    }).isRequired
};

const ReviewPanel = ({changeSet, busy, error, onApply, onReject}) => (
    <section className={`${styles.panel} ${styles.reviewPanel}`}>
        <div className={styles.panelHeader}>
            <div>
                <div className={styles.eyebrow}>Review</div>
                <h3>{changeSet ? changeSet.summary : 'Select a ChangeSet'}</h3>
            </div>
            {changeSet ? <StatusPill state={changeSet.state} /> : null}
        </div>
        {changeSet ? (
            <React.Fragment>
                {changeSet.rationale ? <p className={styles.rationale}>{changeSet.rationale}</p> : null}
                <div className={styles.diffLabel}>Portable diff</div>
                <div className={styles.diffList}>
                    {changeSet.operations.map(operation => (
                        <div
                            className={styles.diffItem}
                            key={operation.operationId}
                        >
                            <div className={styles.diffHeading}>
                                <code>{operation.operationId}</code>
                                <span>{operation.command.type}</span>
                            </div>
                            <pre>{JSON.stringify(operation.command, null, 2)}</pre>
                        </div>
                    ))}
                </div>
                {error ? <div className={styles.error}>{error}</div> : null}
                {changeSet.state === AGENT_CHANGESET_STATES.PROPOSED ? (
                    <div className={styles.reviewActions}>
                        <button
                            className={styles.rejectButton}
                            disabled={busy}
                            onClick={onReject}
                            type="button"
                        >
                            Reject
                        </button>
                        <button
                            className={styles.applyButton}
                            disabled={busy}
                            onClick={onApply}
                            type="button"
                        >
                            {busy ? 'Applying…' : 'Apply reviewed ChangeSet'}
                        </button>
                    </div>
                ) : null}
            </React.Fragment>
        ) : (
            <div className={styles.empty}>
                Review a proposed ChangeSet before any Authority receives a mutation command.
            </div>
        )}
    </section>
);

ReviewPanel.propTypes = {
    busy: PropTypes.bool.isRequired,
    changeSet: PropTypes.object,
    error: PropTypes.string,
    onApply: PropTypes.func.isRequired,
    onReject: PropTypes.func.isRequired
};

const HistoryPanel = ({history, busy, onUndo}) => (
    <section className={`${styles.panel} ${styles.historyPanel}`}>
        <div className={styles.panelHeader}>
            <div>
                <div className={styles.eyebrow}>Undo history</div>
                <h3>Reviewed transactions</h3>
            </div>
        </div>
        <div className={styles.historyList}>
            {history.length ? history.map(entry => (
                <div
                    className={styles.historyItem}
                    key={entry.transactionId}
                >
                    <div>
                        <code>{entry.transactionId}</code>
                        <div className={styles.proposalMeta}>{entry.changeSetId}</div>
                    </div>
                    <div className={styles.historyActions}>
                        <StatusPill state={entry.state} />
                        {entry.state === AGENT_TRANSACTION_STATES.COMMITTED ? (
                            <button
                                disabled={busy}
                                onClick={() => onUndo(entry.transactionId)}
                                type="button"
                            >
                                Undo
                            </button>
                        ) : null}
                    </div>
                </div>
            )) : <div className={styles.empty}>No reviewed transactions yet.</div>}
        </div>
    </section>
);

HistoryPanel.propTypes = {
    busy: PropTypes.bool.isRequired,
    history: PropTypes.arrayOf(PropTypes.object).isRequired,
    onUndo: PropTypes.func.isRequired
};

const WorkspaceAgent = ({model}) => {
    const [revision, setRevision] = React.useState(model.revision);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState('');

    React.useEffect(() => model.subscribe(event => setRevision(event.revision)), [model]);
    const view = React.useMemo(() => model.getView(), [model, revision]);
    const selected = view.changeSets.find(changeSet => changeSet.changeSetId === view.selectedChangeSetId) || null;

    const handleApply = React.useCallback(async () => {
        if (!selected) return;
        setBusy(true);
        setError('');
        try {
            await model.applyChangeSet(selected.changeSetId);
        } catch (nextError) {
            setError(nextError.message || String(nextError));
        } finally {
            setBusy(false);
        }
    }, [model, selected]);

    const handleReject = React.useCallback(() => {
        if (!selected) return;
        setError('');
        model.rejectChangeSet(selected.changeSetId);
    }, [model, selected]);

    const handleUndo = React.useCallback(async transactionId => {
        setBusy(true);
        setError('');
        try {
            await model.undo(transactionId);
        } catch (nextError) {
            setError(nextError.message || String(nextError));
        } finally {
            setBusy(false);
        }
    }, [model]);

    return (
        <div
            className={styles.root}
            data-ngvge-agent-model={WORKSPACE_AGENT_MODEL_ID}
            data-ngvge-agent-revision={revision}
        >
            <header className={styles.header}>
                <div>
                    <div className={styles.eyebrow}>NGVGE Agent Workspace</div>
                    <h2>Review-first project changes</h2>
                    <p>AI proposes portable ChangeSets. Only reviewed transactions can reach Engine Authority.</p>
                </div>
                <div className={styles.guardrail}>No raw VM / renderer mutation</div>
            </header>
            <div className={styles.workspaceGrid}>
                <div className={styles.leftColumn}>
                    <ContextPanel view={view} />
                    <ProposalList
                        model={model}
                        view={view}
                    />
                </div>
                <div className={styles.rightColumn}>
                    <ReviewPanel
                        busy={busy}
                        changeSet={selected}
                        error={error}
                        onApply={handleApply}
                        onReject={handleReject}
                    />
                    <HistoryPanel
                        busy={busy}
                        history={view.history}
                        onUndo={handleUndo}
                    />
                </div>
            </div>
        </div>
    );
};

WorkspaceAgent.propTypes = {
    model: PropTypes.shape({
        applyChangeSet: PropTypes.func.isRequired,
        getView: PropTypes.func.isRequired,
        rejectChangeSet: PropTypes.func.isRequired,
        revision: PropTypes.number.isRequired,
        selectChangeSet: PropTypes.func.isRequired,
        subscribe: PropTypes.func.isRequired,
        undo: PropTypes.func.isRequired
    }).isRequired
};

export default WorkspaceAgent;
