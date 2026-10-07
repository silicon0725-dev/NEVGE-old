import {WORKSPACE_DOCK_RUNTIME_MODEL_ID} from './dock-runtime-model';
import {TOOL_SOURCE_KINDS, WORKSPACE_TOOL_REGISTRY_ID} from './tool-registry';
import {WORKSPACE_WINDOW_MANAGER_ID} from './window-manager';

const WORKSPACE_LAUNCHPAD_MODEL_ID = 'ngvge.workspace-launchpad-model@1';
const LAUNCHPAD_ENTRY_SCHEMA_VERSION = 1;
const LAUNCHPAD_SNAPSHOT_SCHEMA_VERSION = 1;

const LAUNCHPAD_SECTIONS = Object.freeze({
    ALL: 'all',
    PINNED: 'pinned',
    RECENT: 'recent',
    FIRST_PARTY: 'first-party',
    EXTENSIONS: 'extensions',
    DEVELOPER: 'developer',
    COMPATIBILITY: 'compatibility'
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

const assertDependencies = ({toolRegistry, windowManager, dockRuntimeModel}) => {
    if (!toolRegistry || toolRegistry.id !== WORKSPACE_TOOL_REGISTRY_ID ||
        typeof toolRegistry.list !== 'function' || typeof toolRegistry.subscribe !== 'function') {
        throw new TypeError('Launchpad Model requires the Workspace Tool Registry.');
    }
    if (!windowManager || windowManager.id !== WORKSPACE_WINDOW_MANAGER_ID ||
        typeof windowManager.listStates !== 'function' || typeof windowManager.subscribe !== 'function') {
        throw new TypeError('Launchpad Model requires the Workspace Window Manager.');
    }
    if (!dockRuntimeModel || dockRuntimeModel.id !== WORKSPACE_DOCK_RUNTIME_MODEL_ID ||
        typeof dockRuntimeModel.listItems !== 'function' || typeof dockRuntimeModel.subscribe !== 'function') {
        throw new TypeError('Launchpad Model requires the Dock Runtime Model.');
    }
};

const normalizeSection = section => {
    if (!Object.values(LAUNCHPAD_SECTIONS).includes(section)) {
        throw new TypeError(`Unknown Launchpad section: ${section}`);
    }
    return section;
};

const normalizeQuery = query => {
    if (typeof query === 'undefined' || query === null) return '';
    if (typeof query !== 'string') throw new TypeError('Launchpad query must be a string.');
    return query.trim().toLocaleLowerCase();
};

const sourceKindToSection = sourceKind => {
    switch (sourceKind) {
    case TOOL_SOURCE_KINDS.EXTENSION:
        return LAUNCHPAD_SECTIONS.EXTENSIONS;
    case TOOL_SOURCE_KINDS.DEVELOPER:
        return LAUNCHPAD_SECTIONS.DEVELOPER;
    case TOOL_SOURCE_KINDS.COMPATIBILITY:
        return LAUNCHPAD_SECTIONS.COMPATIBILITY;
    default:
        return LAUNCHPAD_SECTIONS.FIRST_PARTY;
    }
};

class LaunchpadModel {
    constructor ({toolRegistry, windowManager, dockRuntimeModel} = {}) {
        assertDependencies({toolRegistry, windowManager, dockRuntimeModel});
        this.id = WORKSPACE_LAUNCHPAD_MODEL_ID;
        this._toolRegistry = toolRegistry;
        this._windowManager = windowManager;
        this._dockRuntimeModel = dockRuntimeModel;
        this._revision = 0;
        this._listeners = new Set();
        this._unsubscribers = [
            toolRegistry.subscribe(event => this._emit('launchpad:tool-registry-changed', event)),
            windowManager.subscribe(event => this._emit('launchpad:window-state-changed', event)),
            dockRuntimeModel.subscribe(event => this._emit('launchpad:dock-state-changed', event))
        ];
    }

    get revision () {
        return this._revision;
    }

    subscribe (listener) {
        if (typeof listener !== 'function') {
            throw new TypeError('Launchpad Model listener must be a function.');
        }
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    dispose () {
        this._unsubscribers.splice(0).forEach(unsubscribe => unsubscribe());
        this._listeners.clear();
    }

    _emit (type, sourceEvent) {
        this._revision += 1;
        const event = Object.freeze({
            modelId: this.id,
            revision: this._revision,
            type,
            sourceEvent: sourceEvent || null
        });
        this._listeners.forEach(listener => listener(event));
        return event;
    }

    _lastFocusedAt (toolId) {
        return this._windowManager.listStates()
            .filter(state => state.toolId === toolId)
            .reduce((latest, state) => Math.max(latest, state.lastFocusedAt || 0), 0);
    }

    _baseEntries () {
        const dockItems = this._dockRuntimeModel.listItems({includeStopped: true});
        return dockItems.map(item => {
            const tool = this._toolRegistry.require(item.toolId);
            const source = tool.source || {kind: TOOL_SOURCE_KINDS.FIRST_PARTY, providerId: null};
            const lastFocusedAt = this._lastFocusedAt(tool.id);
            return freezeDeep({
                schemaVersion: LAUNCHPAD_ENTRY_SCHEMA_VERSION,
                modelId: this.id,
                toolId: tool.id,
                title: tool.title,
                iconKey: tool.iconKey || null,
                commandScope: tool.commandScope || null,
                sourceKind: source.kind,
                providerId: source.providerId || null,
                section: sourceKindToSection(source.kind),
                singleton: Boolean(tool.singleton),
                pinned: item.pinned,
                running: item.running,
                minimized: item.minimized,
                active: item.active,
                runningWindowIds: item.runningWindowIds.slice(),
                lastFocusedAt,
                recent: lastFocusedAt > 0
            });
        });
    }

    listEntries ({section = LAUNCHPAD_SECTIONS.ALL, query = ''} = {}) {
        const normalizedSection = normalizeSection(section);
        const normalizedQuery = normalizeQuery(query);
        let entries = this._baseEntries();
        if (normalizedSection === LAUNCHPAD_SECTIONS.PINNED) {
            entries = entries.filter(entry => entry.pinned);
        } else if (normalizedSection === LAUNCHPAD_SECTIONS.RECENT) {
            entries = entries
                .filter(entry => entry.recent)
                .sort((a, b) => {
                    if (b.lastFocusedAt !== a.lastFocusedAt) return b.lastFocusedAt - a.lastFocusedAt;
                    return a.title.localeCompare(b.title);
                });
        } else if (normalizedSection !== LAUNCHPAD_SECTIONS.ALL) {
            entries = entries.filter(entry => entry.section === normalizedSection);
        }
        if (normalizedQuery) {
            entries = entries.filter(entry => (
                entry.title.toLocaleLowerCase().includes(normalizedQuery) ||
                entry.toolId.toLocaleLowerCase().includes(normalizedQuery) ||
                (entry.providerId || '').toLocaleLowerCase().includes(normalizedQuery)
            ));
        }
        return Object.freeze(entries);
    }

    getCounts () {
        const entries = this._baseEntries();
        const counts = {
            [LAUNCHPAD_SECTIONS.ALL]: entries.length,
            [LAUNCHPAD_SECTIONS.PINNED]: entries.filter(entry => entry.pinned).length,
            [LAUNCHPAD_SECTIONS.RECENT]: entries.filter(entry => entry.recent).length,
            [LAUNCHPAD_SECTIONS.FIRST_PARTY]: 0,
            [LAUNCHPAD_SECTIONS.EXTENSIONS]: 0,
            [LAUNCHPAD_SECTIONS.DEVELOPER]: 0,
            [LAUNCHPAD_SECTIONS.COMPATIBILITY]: 0
        };
        entries.forEach(entry => {
            counts[entry.section] += 1;
        });
        return freezeDeep(counts);
    }

    getSnapshot ({section = LAUNCHPAD_SECTIONS.ALL, query = ''} = {}) {
        return freezeDeep({
            schemaVersion: LAUNCHPAD_SNAPSHOT_SCHEMA_VERSION,
            modelId: this.id,
            revision: this._revision,
            section: normalizeSection(section),
            query: typeof query === 'string' ? query : '',
            counts: this.getCounts(),
            entries: this.listEntries({section, query})
        });
    }
}

export {
    WORKSPACE_LAUNCHPAD_MODEL_ID,
    LAUNCHPAD_ENTRY_SCHEMA_VERSION,
    LAUNCHPAD_SNAPSHOT_SCHEMA_VERSION,
    LAUNCHPAD_SECTIONS,
    LaunchpadModel
};
