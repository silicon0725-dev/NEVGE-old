class ExtensionSourceRegistry {
    constructor () {
        this._sources = new Map();
    }

    register (source) {
        if (!source || typeof source.id !== 'string' || !source.id) {
            throw new TypeError('Extension source must have a non-empty string id.');
        }
        if (typeof source.fetchExtensions !== 'function') {
            throw new TypeError(`Extension source "${source.id}" must provide fetchExtensions().`);
        }
        const normalized = Object.freeze({
            enabled: true,
            group: 'online',
            priority: 0,
            ...source
        });
        this._sources.set(normalized.id, normalized);
        return normalized;
    }

    unregister (sourceId) {
        return this._sources.delete(sourceId);
    }

    get (sourceId) {
        return this._sources.get(sourceId) || null;
    }

    has (sourceId) {
        return this._sources.has(sourceId);
    }

    list ({enabledOnly = false} = {}) {
        return Array.from(this._sources.values())
            .filter(source => !enabledOnly || source.enabled)
            .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
    }

    async fetch (sourceId, context = {}) {
        const source = this.get(sourceId);
        if (!source) {
            throw new Error(`Unknown extension source: ${sourceId}`);
        }
        if (!source.enabled) {
            return [];
        }
        const result = await source.fetchExtensions(context);
        return Array.isArray(result) ? result : [];
    }

    clear () {
        this._sources.clear();
    }
}

module.exports = ExtensionSourceRegistry;
