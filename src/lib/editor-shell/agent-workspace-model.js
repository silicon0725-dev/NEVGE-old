import {
    AGENT_CHANGESET_STATES,
    createAgentChangeSet,
    withAgentChangeSetState
} from './agent-change-set';

const WORKSPACE_AGENT_MODEL_ID = 'ngvge.workspace-agent-model@1';

const WHAT_AI_CAN_SEE = Object.freeze([
    'Stable NodeId of the current Workspace selection',
    'Portable Node snapshot: name, type, parent, enabled state',
    'Reviewed ChangeSet proposals and their portable diffs',
    'Transaction result and undo history'
]);

const WHAT_AI_CANNOT_SEE = Object.freeze([
    'Raw VM object',
    'Renderer internals',
    'Scratch target/runtime identity',
    'Credential vault contents',
    'Unreviewed mutation authority'
]);

const freeze = value => Object.freeze(value);

class WorkspaceAgentModel {
    constructor ({transactionHost, getCurrentContext = () => ({nodeId: null, node: null})}) {
        if (!transactionHost || typeof transactionHost.applyChangeSet !== 'function') {
            throw new TypeError('Workspace Agent model requires the reviewed Agent transaction host.');
        }
        this.id = WORKSPACE_AGENT_MODEL_ID;
        this._transactionHost = transactionHost;
        this._getCurrentContext = getCurrentContext;
        this._changeSets = new Map();
        this._order = [];
        this._history = [];
        this._selectedChangeSetId = null;
        this._listeners = new Set();
        this._revision = 0;
    }

    get revision () {
        return this._revision;
    }

    subscribe (listener) {
        if (typeof listener !== 'function') throw new TypeError('Workspace Agent listener must be a function.');
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    notifyContextChanged () {
        return this._emit('context:changed');
    }

    _emit (type, detail = {}) {
        this._revision += 1;
        const event = freeze(Object.assign({modelId: this.id, revision: this._revision, type}, detail));
        this._listeners.forEach(listener => listener(event));
        return event;
    }

    proposeChangeSet (proposal) {
        const changeSet = createAgentChangeSet(proposal);
        if (this._changeSets.has(changeSet.changeSetId)) {
            throw new Error(`Agent ChangeSet already exists: ${changeSet.changeSetId}`);
        }
        this._changeSets.set(changeSet.changeSetId, changeSet);
        this._order.unshift(changeSet.changeSetId);
        this._selectedChangeSetId = changeSet.changeSetId;
        this._emit('changeset:proposed', {changeSetId: changeSet.changeSetId});
        return changeSet;
    }

    selectChangeSet (changeSetId) {
        if (changeSetId !== null && !this._changeSets.has(changeSetId)) {
            throw new Error(`Unknown Agent ChangeSet: ${changeSetId}`);
        }
        this._selectedChangeSetId = changeSetId;
        this._emit('changeset:selected', {changeSetId});
    }

    rejectChangeSet (changeSetId) {
        const current = this._requireChangeSet(changeSetId);
        if (current.state !== AGENT_CHANGESET_STATES.PROPOSED) {
            throw new Error(`Agent ChangeSet cannot be rejected from state: ${current.state}`);
        }
        const rejected = withAgentChangeSetState(current, AGENT_CHANGESET_STATES.REJECTED, {
            reviewedAt: Date.now()
        });
        this._changeSets.set(changeSetId, rejected);
        this._emit('changeset:rejected', {changeSetId});
        return rejected;
    }

    async applyChangeSet (changeSetId) {
        const current = this._requireChangeSet(changeSetId);
        if (current.state !== AGENT_CHANGESET_STATES.PROPOSED) {
            throw new Error(`Agent ChangeSet cannot be applied from state: ${current.state}`);
        }
        const approved = withAgentChangeSetState(current, AGENT_CHANGESET_STATES.APPROVED, {
            reviewedAt: Date.now()
        });
        this._changeSets.set(changeSetId, withAgentChangeSetState(approved, AGENT_CHANGESET_STATES.APPLYING));
        this._emit('changeset:applying', {changeSetId});
        try {
            const transaction = await this._transactionHost.applyChangeSet(approved);
            const applied = withAgentChangeSetState(approved, AGENT_CHANGESET_STATES.APPLIED, {
                appliedAt: Date.now(),
                transactionId: transaction.transactionId
            });
            this._changeSets.set(changeSetId, applied);
            this._history.unshift(freeze({
                changeSetId,
                transactionId: transaction.transactionId,
                state: transaction.state,
                appliedAt: applied.appliedAt
            }));
            this._emit('changeset:applied', {changeSetId, transactionId: transaction.transactionId});
            return applied;
        } catch (error) {
            const failed = withAgentChangeSetState(approved, AGENT_CHANGESET_STATES.FAILED, {
                failedAt: Date.now(),
                error: error.message
            });
            this._changeSets.set(changeSetId, failed);
            this._emit('changeset:failed', {changeSetId, error: error.message});
            throw error;
        }
    }

    async undo (transactionId) {
        const transaction = await this._transactionHost.rollback(transactionId);
        const historyIndex = this._history.findIndex(entry => entry.transactionId === transactionId);
        if (historyIndex !== -1) {
            const previous = this._history[historyIndex];
            this._history[historyIndex] = freeze(Object.assign({}, previous, {state: transaction.state}));
            const changeSet = this._changeSets.get(previous.changeSetId);
            if (changeSet && changeSet.state === AGENT_CHANGESET_STATES.APPLIED) {
                this._changeSets.set(previous.changeSetId, withAgentChangeSetState(
                    changeSet,
                    AGENT_CHANGESET_STATES.ROLLED_BACK,
                    {rolledBackAt: Date.now()}
                ));
            }
        }
        this._emit('transaction:rolled-back', {transactionId});
        return transaction;
    }

    _requireChangeSet (changeSetId) {
        const changeSet = this._changeSets.get(changeSetId);
        if (!changeSet) throw new Error(`Unknown Agent ChangeSet: ${changeSetId}`);
        return changeSet;
    }

    getView () {
        let context = null;
        try {
            context = this._getCurrentContext() || {nodeId: null, node: null};
        } catch (error) {
            context = {nodeId: null, node: null, unavailable: error.message};
        }
        const changeSets = this._order.map(id => this._changeSets.get(id)).filter(Boolean);
        return freeze({
            modelId: this.id,
            revision: this._revision,
            context: freeze(context),
            whatAIcanSee: WHAT_AI_CAN_SEE,
            whatAIcannotSee: WHAT_AI_CANNOT_SEE,
            changeSets: freeze(changeSets.slice()),
            selectedChangeSetId: this._selectedChangeSetId,
            history: freeze(this._history.slice())
        });
    }
}

export {
    WHAT_AI_CAN_SEE,
    WHAT_AI_CANNOT_SEE,
    WORKSPACE_AGENT_MODEL_ID,
    WorkspaceAgentModel
};
