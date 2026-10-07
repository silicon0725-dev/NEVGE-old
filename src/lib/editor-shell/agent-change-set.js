const WORKSPACE_AGENT_CHANGESET_MODEL_ID = 'ngvge.workspace-agent-changeset-model@1';
const AGENT_CHANGESET_SCHEMA_VERSION = 1;
const AGENT_CHANGESET_OPERATION_SCHEMA_VERSION = 1;

const AGENT_CHANGESET_STATES = Object.freeze({
    PROPOSED: 'proposed',
    APPROVED: 'approved',
    APPLYING: 'applying',
    APPLIED: 'applied',
    REJECTED: 'rejected',
    FAILED: 'failed',
    ROLLED_BACK: 'rolled-back'
});

const AGENT_CHANGESET_OPERATION_KINDS = Object.freeze({
    WORKSPACE_NODE_COMMAND: 'workspace-node-command'
});

const AGENT_SUPPORTED_NODE_COMMANDS = Object.freeze([
    'CreateNode',
    'DuplicateNode',
    'PatchNode',
    'ReparentNode'
]);

const FORBIDDEN_KEYS = new Set([
    'backendId',
    'editingTargetId',
    'extensionManager',
    'rawVM',
    'renderer',
    'runtimeId',
    'scratchTargetId',
    'target',
    'targetId',
    'vm'
]);

let changeSetSequence = 0;

const isPlainObject = value => (
    value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
);

const clonePortable = value => {
    if (Array.isArray(value)) return value.map(clonePortable);
    if (isPlainObject(value)) {
        const output = {};
        Object.keys(value).forEach(key => {
            if (FORBIDDEN_KEYS.has(key)) {
                const error = new Error(`Agent ChangeSet forbids backend identity field: ${key}`);
                error.code = 'NGVGE_AGENT_CHANGESET_BACKEND_IDENTITY_FORBIDDEN';
                throw error;
            }
            output[key] = clonePortable(value[key]);
        });
        return output;
    }
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
    if (typeof value === 'undefined') throw new TypeError('Agent ChangeSet forbids undefined values.');
    throw new TypeError('Agent ChangeSet values must be portable JSON-compatible data.');
};

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return Object.freeze(value);
};

const assertNonEmptyString = (value, label) => {
    if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} must be a non-empty string.`);
    return value.trim();
};

const normalizeOperation = (operation, index) => {
    if (!isPlainObject(operation)) throw new TypeError('Agent ChangeSet operation must be a plain object.');
    const kind = operation.kind || AGENT_CHANGESET_OPERATION_KINDS.WORKSPACE_NODE_COMMAND;
    if (kind !== AGENT_CHANGESET_OPERATION_KINDS.WORKSPACE_NODE_COMMAND) {
        throw new TypeError(`Unsupported Agent ChangeSet operation kind: ${kind}`);
    }
    const command = clonePortable(operation.command);
    if (!isPlainObject(command) || !AGENT_SUPPORTED_NODE_COMMANDS.includes(command.type)) {
        const error = new Error(`Agent ChangeSet does not support reversible Node command: ${command && command.type}`);
        error.code = 'NGVGE_AGENT_CHANGESET_COMMAND_NOT_REVERSIBLE';
        throw error;
    }
    return deepFreeze({
        schemaVersion: AGENT_CHANGESET_OPERATION_SCHEMA_VERSION,
        operationId: typeof operation.operationId === 'string' && operation.operationId.trim() ?
            operation.operationId.trim() : `op-${index + 1}`,
        kind,
        command
    });
};

const createAgentChangeSet = proposal => {
    if (!isPlainObject(proposal)) throw new TypeError('Agent ChangeSet proposal must be a plain object.');
    const operations = Array.isArray(proposal.operations) ? proposal.operations.map(normalizeOperation) : [];
    if (!operations.length) throw new TypeError('Agent ChangeSet requires at least one proposed operation.');
    const changeSetId = typeof proposal.changeSetId === 'string' && proposal.changeSetId.trim() ?
        proposal.changeSetId.trim() : `ngvge.changeset.agent-${++changeSetSequence}`;
    if (!/^ngvge\.changeset\.[a-z0-9][a-z0-9.-]*$/.test(changeSetId)) {
        throw new TypeError('Agent ChangeSet requires a stable ngvge.changeset.* identity.');
    }
    return deepFreeze({
        schemaVersion: AGENT_CHANGESET_SCHEMA_VERSION,
        modelId: WORKSPACE_AGENT_CHANGESET_MODEL_ID,
        changeSetId,
        state: AGENT_CHANGESET_STATES.PROPOSED,
        summary: assertNonEmptyString(proposal.summary || 'Proposed workspace changes', 'Agent ChangeSet summary'),
        rationale: typeof proposal.rationale === 'string' ? proposal.rationale : '',
        createdAt: Number.isFinite(proposal.createdAt) ? proposal.createdAt : Date.now(),
        operations
    });
};

const withAgentChangeSetState = (changeSet, state, extra = {}) => {
    if (!changeSet || changeSet.modelId !== WORKSPACE_AGENT_CHANGESET_MODEL_ID) {
        throw new TypeError('Agent ChangeSet state transition requires a normalized ChangeSet.');
    }
    if (!Object.values(AGENT_CHANGESET_STATES).includes(state)) {
        throw new TypeError(`Unsupported Agent ChangeSet state: ${state}`);
    }
    return deepFreeze(Object.assign({}, changeSet, clonePortable(extra), {state}));
};

export {
    AGENT_CHANGESET_OPERATION_KINDS,
    AGENT_CHANGESET_OPERATION_SCHEMA_VERSION,
    AGENT_CHANGESET_SCHEMA_VERSION,
    AGENT_CHANGESET_STATES,
    AGENT_SUPPORTED_NODE_COMMANDS,
    WORKSPACE_AGENT_CHANGESET_MODEL_ID,
    createAgentChangeSet,
    withAgentChangeSetState
};
