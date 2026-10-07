import {LEGACY_SPRITES_COMPATIBILITY_UI_ID, LEGACY_SPRITES_WINDOW_ID} from './runtime-node-primary-mode';
import {WINDOW_ROLES} from './window-model';

const WORKSPACE_TOOL_REGISTRY_ID = 'ngvge.workspace-tool-registry@1';
const TOOL_DEFINITION_SCHEMA_VERSION = 1;

const TOOL_SOURCE_KINDS = Object.freeze({
    FIRST_PARTY: 'first-party',
    EXTENSION: 'extension',
    DEVELOPER: 'developer',
    COMPATIBILITY: 'compatibility'
});

const TOOL_IDS = Object.freeze({
    NODE_EXPLORER: 'ngvge.tool.node-explorer',
    INSPECTOR: 'ngvge.tool.inspector',
    ASSETS: 'ngvge.tool.assets',
    STAGE: 'ngvge.tool.stage',
    LEGACY_SPRITES: 'ngvge.tool.legacy-sprites',
    EXTENSION_MANAGER: 'ngvge.tool.extension-manager',
    AGENT: 'ngvge.tool.agent',
    TODO: 'ngvge.tool.todo',
    PAINT: 'ngvge.tool.paint',
    EDITOR: 'ngvge.tool.editor'
});

const WINDOW_IDS = Object.freeze({
    NODE_EXPLORER: 'project-explorer',
    INSPECTOR: 'project-inspector',
    ASSETS: 'asset-manager',
    STAGE: 'stage',
    LEGACY_SPRITES: LEGACY_SPRITES_WINDOW_ID,
    EXTENSION_MANAGER: 'extension-manager',
    AGENT: 'agent',
    TODO: 'todo',
    PAINT: 'paint',
    EDITOR_PREFIX: 'editor-'
});

const isPlainObject = value => (
    value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
);

const freezeDeep = value => {
    if (Array.isArray(value)) {
        value.forEach(freezeDeep);
        return Object.freeze(value);
    }
    if (isPlainObject(value)) {
        Object.keys(value).forEach(key => freezeDeep(value[key]));
        return Object.freeze(value);
    }
    return value;
};


const normalizeToolSource = definition => {
    const fallbackKind = definition.compatibility ? TOOL_SOURCE_KINDS.COMPATIBILITY : TOOL_SOURCE_KINDS.FIRST_PARTY;
    const source = isPlainObject(definition.source) ? definition.source : {kind: fallbackKind};
    const allowedKeys = new Set(['kind', 'providerId']);
    Object.keys(source).forEach(key => {
        if (!allowedKeys.has(key)) {
            throw new TypeError(`ToolDefinition source contains unsupported field: ${key}`);
        }
    });
    if (!Object.values(TOOL_SOURCE_KINDS).includes(source.kind)) {
        throw new TypeError('ToolDefinition source.kind must be first-party, extension, developer, or compatibility.');
    }
    if (typeof source.providerId !== 'undefined' &&
        (typeof source.providerId !== 'string' || source.providerId.trim().length === 0)) {
        throw new TypeError('ToolDefinition source.providerId must be a non-empty string when provided.');
    }
    if (definition.compatibility && source.kind !== TOOL_SOURCE_KINDS.COMPATIBILITY) {
        throw new TypeError('Compatibility ToolDefinition source.kind must be compatibility.');
    }
    return freezeDeep({
        kind: source.kind,
        providerId: typeof source.providerId === 'string' ? source.providerId : null
    });
};

const assertDefinition = definition => {
    if (!isPlainObject(definition)) {
        throw new TypeError('ToolDefinition must be a plain object.');
    }
    if (definition.schemaVersion !== TOOL_DEFINITION_SCHEMA_VERSION) {
        throw new TypeError(`ToolDefinition schemaVersion must be ${TOOL_DEFINITION_SCHEMA_VERSION}.`);
    }
    if (typeof definition.id !== 'string' || !/^ngvge\.tool\.[a-z0-9][a-z0-9.-]*$/.test(definition.id)) {
        throw new TypeError('ToolDefinition id must be a stable ngvge.tool.* identifier.');
    }
    if (typeof definition.title !== 'string' || definition.title.trim().length === 0) {
        throw new TypeError('ToolDefinition title must be a non-empty string.');
    }
    if (typeof definition.singleton !== 'boolean') {
        throw new TypeError('ToolDefinition singleton must be boolean.');
    }
    if (!isPlainObject(definition.window) || !isPlainObject(definition.window.capabilities)) {
        throw new TypeError('ToolDefinition must contain a window template and capabilities.');
    }
    if (definition.singleton) {
        if (typeof definition.window.id !== 'string' || definition.window.id.length === 0) {
            throw new TypeError('Singleton ToolDefinition requires window.id.');
        }
    } else if (typeof definition.window.idPrefix !== 'string' || definition.window.idPrefix.length === 0) {
        throw new TypeError('Multi-instance ToolDefinition requires window.idPrefix.');
    }
    return definition;
};

class ToolRegistry {
    constructor(definitions = []) {
        this.id = WORKSPACE_TOOL_REGISTRY_ID;
        this._definitions = new Map();
        this._listeners = new Set();
        this._revision = 0;
        definitions.forEach(definition => this.register(definition));
    }

    get revision() {
        return this._revision;
    }

    subscribe(listener) {
        if (typeof listener !== 'function') {
            throw new TypeError('ToolRegistry listener must be a function.');
        }
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    _emit(type, toolId) {
        this._revision += 1;
        const event = Object.freeze({
            registryId: this.id,
            revision: this._revision,
            type,
            toolId
        });
        this._listeners.forEach(listener => listener(event));
        return event;
    }

    register(definition) {
        const valid = assertDefinition(definition);
        if (this._definitions.has(valid.id)) {
            throw new Error(`ToolDefinition already registered: ${valid.id}`);
        }
        const frozen = freezeDeep({...valid, source: normalizeToolSource(valid)});
        this._definitions.set(frozen.id, frozen);
        this._emit('tool:registered', frozen.id);
        return frozen;
    }

    unregister(toolId) {
        if (typeof toolId !== 'string' || toolId.trim().length === 0) {
            throw new TypeError('ToolRegistry toolId must be a non-empty string.');
        }
        if (!this._definitions.has(toolId)) return false;
        this._definitions.delete(toolId);
        this._emit('tool:unregistered', toolId);
        return true;
    }

    has(toolId) {
        return this._definitions.has(toolId);
    }

    get(toolId) {
        return this._definitions.get(toolId) || null;
    }

    require(toolId) {
        const definition = this.get(toolId);
        if (!definition) {
            throw new Error(`ToolDefinition is not registered: ${toolId}`);
        }
        return definition;
    }

    list() {
        return Object.freeze(Array.from(this._definitions.values()));
    }
}

const createWindowTemplate = ({
    id,
    idPrefix,
    title,
    role,
    defaultVisible,
    defaultPosition,
    defaultSize,
    minSize,
    maxSize,
    close = true,
    minimize = true,
    maximize = true,
    resize = true,
    persist = true
}) => ({
    id,
    idPrefix,
    title,
    role,
    defaultVisible,
    defaultPosition,
    defaultSize,
    minSize,
    maxSize,
    capabilities: {close, minimize, maximize, resize, persist}
});

const CORE_TOOL_DEFINITIONS = freezeDeep([
    {
        schemaVersion: TOOL_DEFINITION_SCHEMA_VERSION,
        id: TOOL_IDS.NODE_EXPLORER,
        title: 'Node Explorer',
        iconKey: 'node-explorer',
        commandScope: 'project',
        source: {kind: TOOL_SOURCE_KINDS.FIRST_PARTY, providerId: 'ngvge.core'},
        singleton: true,
        window: createWindowTemplate({
            id: WINDOW_IDS.NODE_EXPLORER,
            title: 'Node Explorer',
            role: WINDOW_ROLES.PRIMARY,
            defaultVisible: true,
            defaultPosition: {x: 18, y: 54},
            defaultSize: {width: 280, height: 520},
            minSize: {width: 220, height: 220},
            maxSize: {width: 560, height: 900},
            maximize: false
        })
    },
    {
        schemaVersion: TOOL_DEFINITION_SCHEMA_VERSION,
        id: TOOL_IDS.INSPECTOR,
        title: 'Inspector',
        iconKey: 'inspector',
        commandScope: 'project',
        source: {kind: TOOL_SOURCE_KINDS.FIRST_PARTY, providerId: 'ngvge.core'},
        singleton: true,
        window: createWindowTemplate({
            id: WINDOW_IDS.INSPECTOR,
            title: 'Inspector',
            role: WINDOW_ROLES.SUPPORTING,
            defaultVisible: true,
            defaultPosition: {x: 990, y: 54},
            defaultSize: {width: 320, height: 620},
            minSize: {width: 260, height: 280},
            maxSize: {width: 560, height: 940},
            maximize: false
        })
    },
    {
        schemaVersion: TOOL_DEFINITION_SCHEMA_VERSION,
        id: TOOL_IDS.ASSETS,
        title: 'Asset Workspace',
        iconKey: 'assets',
        commandScope: 'assets',
        source: {kind: TOOL_SOURCE_KINDS.FIRST_PARTY, providerId: 'ngvge.core'},
        singleton: true,
        window: createWindowTemplate({
            id: WINDOW_IDS.ASSETS,
            title: 'Asset Workspace',
            role: WINDOW_ROLES.SUPPORTING,
            defaultVisible: true,
            defaultPosition: {x: 180, y: 90},
            defaultSize: {width: 900, height: 620},
            minSize: {width: 800, height: 440},
            maxSize: {width: 1280, height: 940}
        })
    },
    {
        schemaVersion: TOOL_DEFINITION_SCHEMA_VERSION,
        id: TOOL_IDS.STAGE,
        title: 'Stage',
        iconKey: 'stage',
        commandScope: 'project',
        source: {kind: TOOL_SOURCE_KINDS.FIRST_PARTY, providerId: 'ngvge.core'},
        singleton: true,
        window: createWindowTemplate({
            id: WINDOW_IDS.STAGE,
            title: 'Stage',
            role: WINDOW_ROLES.SURFACE,
            defaultVisible: true,
            defaultPosition: {x: 350, y: 200},
            defaultSize: {width: 485, height: 483},
            minSize: {width: 74, height: 25},
            maxSize: {width: 964, height: 795},
            maximize: false
        })
    },
    {
        schemaVersion: TOOL_DEFINITION_SCHEMA_VERSION,
        id: TOOL_IDS.LEGACY_SPRITES,
        title: 'Legacy Sprites',
        iconKey: 'legacy-sprites',
        commandScope: 'project',
        source: {kind: TOOL_SOURCE_KINDS.COMPATIBILITY, providerId: 'scratch.compatibility'},
        singleton: true,
        compatibility: {
            uiId: LEGACY_SPRITES_COMPATIBILITY_UI_ID,
            authority: 'scratch.compatibility'
        },
        window: createWindowTemplate({
            id: WINDOW_IDS.LEGACY_SPRITES,
            title: 'Legacy Sprites',
            role: WINDOW_ROLES.COMPATIBILITY,
            defaultVisible: false,
            defaultPosition: {x: 400, y: 275},
            defaultSize: {width: 485, height: 447},
            minSize: {width: 471, height: 211},
            maxSize: {width: 600, height: 800}
        })
    },
    {
        schemaVersion: TOOL_DEFINITION_SCHEMA_VERSION,
        id: TOOL_IDS.EXTENSION_MANAGER,
        title: 'Extension Manager',
        iconKey: 'extension-manager',
        commandScope: 'extensions',
        source: {kind: TOOL_SOURCE_KINDS.FIRST_PARTY, providerId: 'ngvge.core'},
        singleton: true,
        window: createWindowTemplate({
            id: WINDOW_IDS.EXTENSION_MANAGER,
            title: 'Extension Manager',
            role: WINDOW_ROLES.SUPPORTING,
            defaultVisible: false,
            defaultPosition: {x: 150, y: 82},
            defaultSize: {width: 1040, height: 650},
            minSize: {width: 760, height: 480},
            maxSize: {width: 1440, height: 960}
        })
    },
    {
        schemaVersion: TOOL_DEFINITION_SCHEMA_VERSION,
        id: TOOL_IDS.AGENT,
        title: 'NGVGE Agent',
        iconKey: 'agent',
        commandScope: 'agent',
        source: {kind: TOOL_SOURCE_KINDS.FIRST_PARTY, providerId: 'ngvge.core'},
        singleton: true,
        window: createWindowTemplate({
            id: WINDOW_IDS.AGENT,
            title: 'NGVGE Agent',
            role: WINDOW_ROLES.SUPPORTING,
            defaultVisible: false,
            defaultPosition: {x: 220, y: 96},
            defaultSize: {width: 980, height: 680},
            minSize: {width: 720, height: 500},
            maxSize: {width: 1440, height: 980}
        })
    },
    {
        schemaVersion: TOOL_DEFINITION_SCHEMA_VERSION,
        id: TOOL_IDS.TODO,
        title: 'Todo',
        iconKey: 'todo',
        commandScope: 'workspace',
        source: {kind: TOOL_SOURCE_KINDS.FIRST_PARTY, providerId: 'ngvge.core'},
        singleton: true,
        window: createWindowTemplate({
            id: WINDOW_IDS.TODO,
            title: 'Todo',
            role: WINDOW_ROLES.SUPPORTING,
            defaultVisible: false,
            defaultPosition: {x: 286, y: 124},
            defaultSize: {width: 440, height: 520},
            minSize: {width: 340, height: 360},
            maxSize: {width: 760, height: 900}
        })
    },
    {
        schemaVersion: TOOL_DEFINITION_SCHEMA_VERSION,
        id: TOOL_IDS.PAINT,
        title: 'Better Paint',
        iconKey: 'paint',
        commandScope: 'project',
        source: {kind: TOOL_SOURCE_KINDS.FIRST_PARTY, providerId: 'ngvge.oss.scratch-paint-adapter'},
        singleton: true,
        window: createWindowTemplate({
            id: WINDOW_IDS.PAINT,
            title: 'Better Paint',
            role: WINDOW_ROLES.EDITOR,
            defaultVisible: false,
            defaultPosition: {x: 176, y: 78},
            defaultSize: {width: 980, height: 700},
            minSize: {width: 720, height: 500},
            maxSize: {width: 1480, height: 1040}
        })
    },
    {
        schemaVersion: TOOL_DEFINITION_SCHEMA_VERSION,
        id: TOOL_IDS.EDITOR,
        title: 'Editor',
        iconKey: 'editor',
        commandScope: 'project',
        source: {kind: TOOL_SOURCE_KINDS.FIRST_PARTY, providerId: 'ngvge.core'},
        singleton: false,
        window: createWindowTemplate({
            idPrefix: WINDOW_IDS.EDITOR_PREFIX,
            title: 'Editor',
            role: WINDOW_ROLES.EDITOR,
            defaultVisible: true,
            defaultPosition: {x: 12, y: 40},
            defaultSize: {width: 760, height: 560},
            minSize: {width: 0, height: 0},
            maxSize: {width: Number.MAX_SAFE_INTEGER, height: Number.MAX_SAFE_INTEGER},
            persist: false
        })
    }
]);

const createCoreToolRegistry = () => new ToolRegistry(CORE_TOOL_DEFINITIONS);

export {
    WORKSPACE_TOOL_REGISTRY_ID,
    TOOL_DEFINITION_SCHEMA_VERSION,
    TOOL_SOURCE_KINDS,
    TOOL_IDS,
    WINDOW_IDS,
    CORE_TOOL_DEFINITIONS,
    ToolRegistry,
    createCoreToolRegistry
};
