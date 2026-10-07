const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    NODE_FAMILIES,
    NODE_SCOPES,
    SEMANTIC_RUNTIME_NODE_TYPE_IDS
} = require('./constants');
const {SpriteRuntimeNode} = require('./sprite-runtime-node');
const {compareCanonicalStrings} = require('./canonical-order');
const {
    RuntimeNode,
    UnknownRuntimeNode,
    RuntimeNode2D,
    RuntimeRootNode,
    RuntimeServiceNode
} = require('./runtime-node');

const DEFAULT_NODE_TYPE_OWNER = 'anonymous';
const BUILTIN_NODE_TYPE_OWNER = 'ngvge.scene-system';

const runtimeNodeTypeRegistryStates = new WeakMap();

const getRegistryState = registry => {
    const state = runtimeNodeTypeRegistryStates.get(registry);
    if (!state) throw new TypeError('Invalid RuntimeNodeTypeRegistry receiver.');
    return state;
};

class RuntimeNodeTypeRegistrationError extends Error {
    constructor (code, message, details = {}) {
        super(message);
        this.name = 'RuntimeNodeTypeRegistrationError';
        this.code = code;
        Object.assign(this, details);
    }
}

const normalizeOwner = owner => {
    const normalized = typeof owner === 'string' ? owner.trim() : '';
    return normalized || DEFAULT_NODE_TYPE_OWNER;
};

const normalizeScopes = scopes => {
    const source = Array.isArray(scopes) ? scopes : Object.values(NODE_SCOPES);
    const normalized = Array.from(new Set(source.filter(scope => Object.values(NODE_SCOPES).includes(scope))));
    if (!normalized.length) throw new TypeError('Runtime node type must allow at least one scope.');
    return normalized;
};

const validateRuntimeNodeType = definition => {
    if (!definition || typeof definition !== 'object') {
        throw new TypeError('Runtime node type definition must be an object.');
    }
    if (typeof definition.id !== 'string' || !definition.id.trim()) {
        throw new TypeError('Runtime node type requires a non-empty id.');
    }
    if (typeof definition.label !== 'string' || !definition.label.trim()) {
        throw new TypeError(`Runtime node type "${definition.id}" requires a label.`);
    }
    if (typeof definition.ctor !== 'function' && typeof definition.create !== 'function') {
        throw new TypeError(`Runtime node type "${definition.id}" requires ctor or create.`);
    }
};

const normalizeRuntimeNodeType = (definition, registration = {}) => {
    validateRuntimeNodeType(definition);
    const allowedScopes = normalizeScopes(definition.allowedScopes);
    const defaultScope = allowedScopes.includes(definition.defaultScope) ?
        definition.defaultScope : allowedScopes[0];
    const owner = normalizeOwner(registration.owner || definition.owner);
    const version = typeof definition.version === 'string' && definition.version.trim() ?
        definition.version.trim() : null;
    return Object.freeze(Object.assign({
        abstract: false,
        allowChildren: true,
        category: 'Core',
        family: NODE_FAMILIES.NODE,
        hidden: false,
        order: 0
    }, definition, {
        allowedScopes: Object.freeze(allowedScopes),
        defaultScope,
        id: definition.id.trim(),
        label: definition.label.trim(),
        owner,
        registeredAt: Number.isFinite(registration.registeredAt) ? registration.registeredAt : Date.now(),
        version
    }));
};

class RuntimeNodeTypeRegistry {
    constructor () {
        runtimeNodeTypeRegistryStates.set(this, {
            listenerErrorCount: 0,
            listeners: new Set(),
            revision: 0,
            types: new Map()
        });
        Object.defineProperty(this, '_revision', {
            configurable: false,
            enumerable: false,
            get: () => getRegistryState(this).revision
        });
        Object.seal(this);
    }

    _emit (change) {
        const state = getRegistryState(this);
        state.revision += 1;
        const payload = Object.freeze(Object.assign({revision: state.revision}, change));
        state.listeners.forEach(listener => {
            try {
                listener(payload);
            } catch (error) {
                state.listenerErrorCount += 1;
            }
        });
        return payload;
    }

    register (definition, options = {}) {
        validateRuntimeNodeType(definition);
        const typeId = definition.id.trim();
        const types = getRegistryState(this).types;
        const existing = types.get(typeId) || null;
        const replace = options.replace === true || definition.replace === true;
        const explicitOwner = options.owner || definition.owner;
        const requestedOwner = normalizeOwner(explicitOwner);

        if (existing && !replace) {
            throw new RuntimeNodeTypeRegistrationError(
                'RUNTIME_NODE_TYPE_ALREADY_EXISTS',
                `Runtime node type is already registered: ${typeId}`,
                {existingOwner: existing.owner, owner: requestedOwner, typeId}
            );
        }
        if (existing && replace && (typeof explicitOwner !== 'string' || !explicitOwner.trim())) {
            throw new RuntimeNodeTypeRegistrationError(
                'RUNTIME_NODE_TYPE_REPLACE_OWNER_REQUIRED',
                `Replacing runtime node type "${typeId}" requires an explicit owner.`,
                {existingOwner: existing.owner, owner: requestedOwner, typeId}
            );
        }
        if (existing && existing.owner !== requestedOwner) {
            throw new RuntimeNodeTypeRegistrationError(
                'RUNTIME_NODE_TYPE_OWNER_MISMATCH',
                `Runtime node type "${typeId}" is owned by "${existing.owner}" and cannot be replaced by "${requestedOwner}".`,
                {existingOwner: existing.owner, owner: requestedOwner, typeId}
            );
        }

        const normalized = normalizeRuntimeNodeType(definition, {
            owner: requestedOwner,
            registeredAt: Date.now()
        });
        types.set(normalized.id, normalized);
        this._emit({
            definition: normalized,
            owner: normalized.owner,
            previousDefinition: existing,
            type: existing ? 'replace' : 'register',
            typeId: normalized.id
        });

        return () => {
            const currentTypes = getRegistryState(this).types;
            if (currentTypes.get(normalized.id) !== normalized) return false;
            currentTypes.delete(normalized.id);
            this._emit({
                definition: normalized,
                owner: normalized.owner,
                type: 'unregister',
                typeId: normalized.id
            });
            return true;
        };
    }

    get (typeId) {
        return getRegistryState(this).types.get(typeId) || null;
    }

    getRevision () {
        return getRegistryState(this).revision;
    }

    has (typeId) {
        return getRegistryState(this).types.has(typeId);
    }

    list (options = {}) {
        const includeHidden = Boolean(options.includeHidden);
        return Array.from(getRegistryState(this).types.values())
            .filter(definition => includeHidden || !definition.hidden)
            .sort((first, second) => (
                compareCanonicalStrings(first.category, second.category) ||
                first.order - second.order ||
                compareCanonicalStrings(first.label, second.label) ||
                compareCanonicalStrings(first.id, second.id)
            ));
    }

    create (typeId, options = {}) {
        const definition = this.get(typeId);
        if (!definition) throw new Error(`Unknown runtime node type: ${typeId}`);
        if (definition.abstract && options.allowAbstract !== true) {
            throw new Error(`Runtime node type is abstract: ${typeId}`);
        }
        if (!definition.allowedScopes.includes(options.scope)) {
            throw new Error(`Runtime node type "${typeId}" does not support scope "${options.scope}".`);
        }
        const createOptions = Object.assign({}, options, {
            family: definition.family,
            typeId: definition.id
        });
        const node = typeof definition.create === 'function' ?
            definition.create(createOptions) : new definition.ctor(createOptions);
        if (!(node instanceof RuntimeNode)) {
            throw new TypeError(`Runtime node type "${typeId}" did not create a RuntimeNode.`);
        }
        // Providers may finish defining their concrete surface during construction,
        // but live Runtime Nodes must not acquire shadow methods or ad-hoc semantic
        // fields after they enter the graph.
        Object.seal(node);
        return node;
    }

    subscribe (listener) {
        if (typeof listener !== 'function') return () => {};
        const listeners = getRegistryState(this).listeners;
        listeners.add(listener);
        return () => listeners.delete(listener);
    }
}

const registerBuiltinRuntimeNodeTypes = registry => {
    const register = definition => registry.register(Object.assign({owner: BUILTIN_NODE_TYPE_OWNER}, definition));
    register({
        abstract: false,
        allowedScopes: [NODE_SCOPES.GLOBAL, NODE_SCOPES.SCENE],
        category: 'Core',
        ctor: RuntimeNode,
        defaultScope: NODE_SCOPES.SCENE,
        family: NODE_FAMILIES.NODE,
        id: BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE,
        label: 'Node',
        order: 0,
        version: '1'
    });
    register({
        abstract: false,
        allowedScopes: [NODE_SCOPES.SCENE],
        category: 'Core',
        ctor: RuntimeNode2D,
        defaultScope: NODE_SCOPES.SCENE,
        family: NODE_FAMILIES.NODE_2D,
        id: BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE_2D,
        label: 'Node2D',
        order: 10,
        version: '1'
    });
    register({
        abstract: false,
        allowChildren: true,
        allowedScopes: [NODE_SCOPES.SCENE],
        category: '2D',
        ctor: SpriteRuntimeNode,
        defaultScope: NODE_SCOPES.SCENE,
        family: NODE_FAMILIES.NODE_2D,
        hidden: true,
        id: SEMANTIC_RUNTIME_NODE_TYPE_IDS.SPRITE,
        label: 'Sprite',
        order: 11,
        version: '1'
    });
    register({
        abstract: false,
        allowedScopes: [NODE_SCOPES.GLOBAL, NODE_SCOPES.SCENE],
        category: 'Core',
        ctor: RuntimeServiceNode,
        defaultScope: NODE_SCOPES.GLOBAL,
        family: NODE_FAMILIES.SERVICE,
        id: BUILTIN_RUNTIME_NODE_TYPE_IDS.SERVICE_NODE,
        label: 'ServiceNode',
        order: 20,
        version: '1'
    });
    register({
        abstract: false,
        allowedScopes: [NODE_SCOPES.GLOBAL],
        category: 'Internal',
        ctor: RuntimeRootNode,
        defaultScope: NODE_SCOPES.GLOBAL,
        family: NODE_FAMILIES.ROOT,
        hidden: true,
        id: BUILTIN_RUNTIME_NODE_TYPE_IDS.GLOBAL_ROOT,
        label: 'GlobalRoot',
        order: -100,
        version: '1'
    });
    register({
        abstract: false,
        allowedScopes: [NODE_SCOPES.SCENE],
        category: 'Internal',
        ctor: RuntimeRootNode,
        defaultScope: NODE_SCOPES.SCENE,
        family: NODE_FAMILIES.ROOT,
        hidden: true,
        id: BUILTIN_RUNTIME_NODE_TYPE_IDS.SCENE_ROOT,
        label: 'SceneRoot',
        order: -90,
        version: '1'
    });
    register({
        abstract: false,
        allowedScopes: [NODE_SCOPES.GLOBAL, NODE_SCOPES.SCENE],
        category: 'Internal',
        ctor: UnknownRuntimeNode,
        defaultScope: NODE_SCOPES.SCENE,
        family: NODE_FAMILIES.NODE,
        hidden: true,
        id: BUILTIN_RUNTIME_NODE_TYPE_IDS.UNKNOWN_NODE,
        label: 'Missing Node Type',
        order: -80,
        version: '1'
    });
    return registry;
};

const createRuntimeNodeTypeRegistry = () => registerBuiltinRuntimeNodeTypes(new RuntimeNodeTypeRegistry());

module.exports = {
    BUILTIN_NODE_TYPE_OWNER,
    DEFAULT_NODE_TYPE_OWNER,
    RuntimeNodeTypeRegistrationError,
    RuntimeNodeTypeRegistry,
    createRuntimeNodeTypeRegistry,
    normalizeRuntimeNodeType,
    registerBuiltinRuntimeNodeTypes,
    validateRuntimeNodeType
};
