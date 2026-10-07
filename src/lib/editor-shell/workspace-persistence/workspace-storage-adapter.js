import {
    WORKSPACE_LAYOUT_SCHEMA_ID,
    normalizeWorkspaceLayout,
    normalizeWorkspacePreferences
} from './workspace-schema';

const WORKSPACE_STORAGE_ADAPTER_ID = 'ngvge.workspace-storage-adapter.local@1';
const WORKSPACE_STORAGE_KEYS = Object.freeze({
    LAYOUT: 'ngvge:workspace:layout:v1',
    WORKSPACE_PREFERENCES: 'ngvge:workspace:preferences:workspace:v1',
    USER_PREFERENCES: 'ngvge:workspace:preferences:user:v1',
    DEVICE_PREFERENCES: 'ngvge:workspace:preferences:device:v1'
});

const getDefaultStorage = () => (
    typeof localStorage === 'undefined' ? null : localStorage
);

class WorkspaceStorageAdapter {
    constructor ({storage = getDefaultStorage()} = {}) {
        this.id = WORKSPACE_STORAGE_ADAPTER_ID;
        this._storage = storage;
    }

    _get (key) {
        if (!this._storage || typeof this._storage.getItem !== 'function') return null;
        return this._storage.getItem(key);
    }

    _set (key, value) {
        if (!this._storage || typeof this._storage.setItem !== 'function') return false;
        this._storage.setItem(key, value);
        return true;
    }

    _remove (key) {
        if (!this._storage || typeof this._storage.removeItem !== 'function') return false;
        this._storage.removeItem(key);
        return true;
    }

    readJSON (key) {
        const raw = this._get(key);
        if (raw === null) return null;
        return JSON.parse(raw);
    }

    writeJSON (key, value) {
        return this._set(key, JSON.stringify(value));
    }

    readLayout (options = {}) {
        const raw = this.readJSON(WORKSPACE_STORAGE_KEYS.LAYOUT);
        return raw === null ? null : normalizeWorkspaceLayout(raw, options);
    }

    writeLayout (layout, options = {}) {
        const normalized = normalizeWorkspaceLayout(layout, options);
        return this.writeJSON(WORKSPACE_STORAGE_KEYS.LAYOUT, {
            schemaId: WORKSPACE_LAYOUT_SCHEMA_ID,
            ...normalized
        });
    }

    readPreferences () {
        const workspace = this.readJSON(WORKSPACE_STORAGE_KEYS.WORKSPACE_PREFERENCES) || {};
        const user = this.readJSON(WORKSPACE_STORAGE_KEYS.USER_PREFERENCES) || {};
        const device = this.readJSON(WORKSPACE_STORAGE_KEYS.DEVICE_PREFERENCES) || {};
        if (!Object.keys(workspace).length && !Object.keys(user).length && !Object.keys(device).length) return null;
        return normalizeWorkspacePreferences({
            workspace,
            user,
            device
        });
    }

    writePreferences (preferences) {
        const normalized = normalizeWorkspacePreferences(preferences);
        const results = [
            this.writeJSON(WORKSPACE_STORAGE_KEYS.WORKSPACE_PREFERENCES, normalized.workspace),
            this.writeJSON(WORKSPACE_STORAGE_KEYS.USER_PREFERENCES, normalized.user),
            this.writeJSON(WORKSPACE_STORAGE_KEYS.DEVICE_PREFERENCES, normalized.device)
        ];
        return results.every(Boolean);
    }

    clearLayout () {
        return this._remove(WORKSPACE_STORAGE_KEYS.LAYOUT);
    }

    clearPreferences () {
        return [
            WORKSPACE_STORAGE_KEYS.WORKSPACE_PREFERENCES,
            WORKSPACE_STORAGE_KEYS.USER_PREFERENCES,
            WORKSPACE_STORAGE_KEYS.DEVICE_PREFERENCES
        ].map(key => this._remove(key)).every(Boolean);
    }

    get storage () {
        return this._storage;
    }
}

export {
    WORKSPACE_STORAGE_ADAPTER_ID,
    WORKSPACE_STORAGE_KEYS,
    WorkspaceStorageAdapter
};
