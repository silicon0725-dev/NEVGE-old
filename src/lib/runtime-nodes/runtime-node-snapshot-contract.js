const {RUNTIME_NODE_SNAPSHOT_CAPABILITY_ID} = require('./constants');
const {clonePortableData} = require('./portable-data');
const RUNTIME_NODE_SNAPSHOT_CONTRACT_ID = 'ngvge.runtime-node-snapshot@1';
const RUNTIME_NODE_SNAPSHOT_VERSION = '1';
const RUNTIME_NODE_REVISION_CONTRACT_ID = 'ngvge.runtime-node-revision@1';

const RUNTIME_NODE_SNAPSHOT_KINDS = Object.freeze({
    COMPONENT: 'component',
    GRAPH: 'graph',
    NODE: 'node',
    NODE_LIST: 'node-list',
    NODE_TYPES: 'node-types',
    SCENE: 'scene',
    SUBTREE: 'subtree'
});


const RUNTIME_NODE_SNAPSHOT_METHODS = Object.freeze([
    'assertCurrent',
    'capture',
    'getContract',
    'getRevision',
    'isCurrent'
]);

const RUNTIME_NODE_SNAPSHOT_METADATA_KEYS = Object.freeze([
    'capabilityId',
    'contractId',
    'version'
]);

const RUNTIME_NODE_SNAPSHOT_PUBLIC_SURFACE_KEYS = Object.freeze([
    ...RUNTIME_NODE_SNAPSHOT_METADATA_KEYS,
    ...RUNTIME_NODE_SNAPSHOT_METHODS
].sort());

const RUNTIME_NODE_REVISION_FIELDS = Object.freeze([
    'contractId',
    'runtimeGeneration',
    'graphRevision',
    'registryRevision'
]);

const RUNTIME_NODE_SNAPSHOT_ENVELOPE_FIELDS = Object.freeze([
    'contractId',
    'kind',
    'query',
    'revision',
    'snapshot'
]);

const createRevisionError = (code, message, details = {}) => {
    const error = new Error(message);
    error.code = code;
    Object.keys(details).forEach(key => {
        error[key] = details[key];
    });
    return error;
};

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return Object.freeze(value);
};

const isPlainRecord = value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
};

const assertExactFields = (value, fields, code, label) => {
    const expected = new Set(fields);
    const unsupported = Object.keys(value).filter(key => !expected.has(key));
    if (!unsupported.length) return;
    throw createRevisionError(
        code,
        `${label} contains unsupported fields: ${unsupported.join(', ')}`,
        {fields: Object.freeze(unsupported.slice().sort())}
    );
};

const normalizeNonNegativeInteger = (value, field) => {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw createRevisionError(
            'RUNTIME_NODE_REVISION_TOKEN_INVALID',
            `Runtime node revision token ${field} must be a non-negative integer.`,
            {field}
        );
    }
    return Object.is(value, -0) ? 0 : value;
};

const normalizePositiveInteger = (value, field) => {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw createRevisionError(
            'RUNTIME_NODE_REVISION_TOKEN_INVALID',
            `Runtime node revision token ${field} must be a positive integer.`,
            {field}
        );
    }
    return value;
};

const normalizeRuntimeNodeRevisionToken = token => {
    if (!isPlainRecord(token)) {
        throw createRevisionError(
            'RUNTIME_NODE_REVISION_TOKEN_INVALID',
            'Runtime node revision token must be a plain object.'
        );
    }
    assertExactFields(
        token,
        RUNTIME_NODE_REVISION_FIELDS,
        'RUNTIME_NODE_REVISION_TOKEN_INVALID',
        'Runtime node revision token'
    );
    if (token.contractId !== RUNTIME_NODE_REVISION_CONTRACT_ID) {
        throw createRevisionError(
            'RUNTIME_NODE_REVISION_TOKEN_INVALID',
            `Unsupported Runtime node revision contract: ${String(token.contractId)}`,
            {contractId: token.contractId}
        );
    }
    const normalized = {
        contractId: RUNTIME_NODE_REVISION_CONTRACT_ID,
        runtimeGeneration: normalizePositiveInteger(token.runtimeGeneration, 'runtimeGeneration'),
        graphRevision: normalizeNonNegativeInteger(token.graphRevision, 'graphRevision'),
        registryRevision: normalizeNonNegativeInteger(token.registryRevision, 'registryRevision')
    };
    return Object.freeze(normalized);
};

const createRuntimeNodeRevisionToken = values => normalizeRuntimeNodeRevisionToken(Object.assign({
    contractId: RUNTIME_NODE_REVISION_CONTRACT_ID
}, values));

const areRuntimeNodeRevisionTokensEqual = (first, second) => {
    const left = normalizeRuntimeNodeRevisionToken(first);
    const right = normalizeRuntimeNodeRevisionToken(second);
    return left.runtimeGeneration === right.runtimeGeneration &&
        left.graphRevision === right.graphRevision &&
        left.registryRevision === right.registryRevision;
};

const createRuntimeNodeSnapshotEnvelope = ({kind, query, revision, snapshot}) => {
    if (!Object.values(RUNTIME_NODE_SNAPSHOT_KINDS).includes(kind)) {
        throw createRevisionError(
            'RUNTIME_NODE_SNAPSHOT_KIND_UNSUPPORTED',
            `Unsupported Runtime node snapshot kind: ${String(kind)}`,
            {kind}
        );
    }
    const normalizedQuery = clonePortableData(query);
    const normalizedSnapshot = clonePortableData(snapshot);
    return deepFreeze({
        contractId: RUNTIME_NODE_SNAPSHOT_CONTRACT_ID,
        kind,
        query: normalizedQuery,
        revision: normalizeRuntimeNodeRevisionToken(revision),
        snapshot: normalizedSnapshot
    });
};

const RUNTIME_NODE_SNAPSHOT_CONTRACT = Object.freeze({
    capabilityId: RUNTIME_NODE_SNAPSHOT_CAPABILITY_ID,
    contractId: RUNTIME_NODE_SNAPSHOT_CONTRACT_ID,
    envelopeFields: RUNTIME_NODE_SNAPSHOT_ENVELOPE_FIELDS,
    kinds: RUNTIME_NODE_SNAPSHOT_KINDS,
    methods: RUNTIME_NODE_SNAPSHOT_METHODS,
    publicSurfaceKeys: RUNTIME_NODE_SNAPSHOT_PUBLIC_SURFACE_KEYS,
    revisionContractId: RUNTIME_NODE_REVISION_CONTRACT_ID,
    revisionFields: RUNTIME_NODE_REVISION_FIELDS,
    semantics: Object.freeze({
        canonicalOrdering: true,
        canonicalStringOrder: 'unicode-code-point-lexicographic',
        deepFrozen: true,
        mixedRevisionSnapshotsAllowed: false,
        plainDataOnly: true,
        revisionIdentity: '(runtimeGeneration, graphRevision, registryRevision)',
        transactionRevision: false
    }),
    version: RUNTIME_NODE_SNAPSHOT_VERSION
});

module.exports = {
    RUNTIME_NODE_REVISION_CONTRACT_ID,
    RUNTIME_NODE_REVISION_FIELDS,
    RUNTIME_NODE_SNAPSHOT_CAPABILITY_ID,
    RUNTIME_NODE_SNAPSHOT_CONTRACT,
    RUNTIME_NODE_SNAPSHOT_CONTRACT_ID,
    RUNTIME_NODE_SNAPSHOT_ENVELOPE_FIELDS,
    RUNTIME_NODE_SNAPSHOT_KINDS,
    RUNTIME_NODE_SNAPSHOT_METHODS,
    RUNTIME_NODE_SNAPSHOT_METADATA_KEYS,
    RUNTIME_NODE_SNAPSHOT_PUBLIC_SURFACE_KEYS,
    RUNTIME_NODE_SNAPSHOT_VERSION,
    areRuntimeNodeRevisionTokensEqual,
    createRuntimeNodeRevisionToken,
    createRuntimeNodeSnapshotEnvelope,
    normalizeRuntimeNodeRevisionToken
};
