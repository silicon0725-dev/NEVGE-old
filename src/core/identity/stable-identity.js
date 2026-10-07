/**
 * ARC-C001 runtime identity vocabulary.
 * These aliases intentionally remain JavaScript/JSDoc in C001.1-B so the
 * frozen R9 TypeScript trust boundary is not expanded implicitly.
 * @typedef {string} NodeId
 * @typedef {string} SceneId
 * @typedef {string} ResourceId
 * @typedef {string} ModuleId
 * @typedef {string} ComponentTypeId
 * @typedef {string} BindingId
 * @typedef {string} TransactionId
 */

const STABLE_ID_SCHEMA = 'ngvge-stable-identity/v1';

const STABLE_ID_KINDS = Object.freeze({
    BINDING: 'binding',
    COMPONENT_TYPE: 'component-type',
    MODULE: 'module',
    NODE: 'node',
    RESOURCE: 'resource',
    SCENE: 'scene',
    TRANSACTION: 'transaction'
});

const STABLE_ID_KIND_VALUES = Object.freeze(Object.values(STABLE_ID_KINDS));
const OPAQUE_TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._~-]{7,127}$/;

const assertStableIdentityKind = kind => {
    if (!STABLE_ID_KIND_VALUES.includes(kind)) {
        const error = new TypeError(`Unknown NGVGE stable identity kind: ${String(kind)}`);
        error.code = 'NGVGE_STABLE_ID_KIND_INVALID';
        throw error;
    }
    return kind;
};

const normalizeOpaqueToken = token => {
    const value = typeof token === 'string' ? token.trim() : '';
    if (!OPAQUE_TOKEN_PATTERN.test(value)) {
        const error = new TypeError('NGVGE stable identity tokens must be opaque 8-128 character strings.');
        error.code = 'NGVGE_STABLE_ID_TOKEN_INVALID';
        throw error;
    }
    return value;
};

const getStableIdentityPrefix = kind => `ngvge:${assertStableIdentityKind(kind)}:`;

const formatStableIdentity = (kind, opaqueToken) => (
    `${getStableIdentityPrefix(kind)}${normalizeOpaqueToken(opaqueToken)}`
);

const createStableIdentity = (kind, opaqueTokenFactory) => {
    if (typeof opaqueTokenFactory !== 'function') {
        const error = new TypeError('NGVGE stable identity creation requires an injected opaque token factory.');
        error.code = 'NGVGE_STABLE_ID_FACTORY_REQUIRED';
        throw error;
    }
    return formatStableIdentity(kind, opaqueTokenFactory());
};

const parseStableIdentity = value => {
    if (typeof value !== 'string') return null;
    for (const kind of STABLE_ID_KIND_VALUES) {
        const prefix = `ngvge:${kind}:`;
        if (!value.startsWith(prefix)) continue;
        const opaqueToken = value.slice(prefix.length);
        if (!OPAQUE_TOKEN_PATTERN.test(opaqueToken)) return null;
        return Object.freeze({
            kind,
            opaqueToken,
            schema: STABLE_ID_SCHEMA,
            value
        });
    }
    return null;
};

const isStableIdentity = (value, kind = null) => {
    const parsed = parseStableIdentity(value);
    if (!parsed) return false;
    return kind === null || parsed.kind === kind;
};

const assertStableIdentity = (value, kind = null) => {
    const parsed = parseStableIdentity(value);
    if (!parsed || (kind !== null && parsed.kind !== kind)) {
        const error = new TypeError(
            kind === null ? 'Value is not a canonical NGVGE stable identity.' :
                `Value is not a canonical NGVGE ${kind} identity.`
        );
        error.code = 'NGVGE_STABLE_ID_INVALID';
        error.kind = kind;
        error.value = value;
        throw error;
    }
    return value;
};

export {
    STABLE_ID_KINDS,
    STABLE_ID_SCHEMA,
    assertStableIdentity,
    assertStableIdentityKind,
    createStableIdentity,
    formatStableIdentity,
    getStableIdentityPrefix,
    isStableIdentity,
    parseStableIdentity
};
