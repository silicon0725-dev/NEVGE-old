class ExtensionRegistry {
    constructor () {
        this._entries = new Map();
        this._listeners = new Set();
        this._revision = 0;
    }

    get revision () {
        return this._revision;
    }

    _emit (type, extensionId) {
        this._revision += 1;
        const event = Object.freeze({extensionId, revision: this._revision, type});
        this._listeners.forEach(listener => listener(event));
        return event;
    }

    subscribe (listener) {
        if (typeof listener !== 'function') throw new TypeError('ExtensionRegistry listener must be a function.');
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    register (manifest, galleryItem = null) {
        if (!manifest || typeof manifest.id !== 'string' || !manifest.id) {
            throw new TypeError('Extension manifest must have a non-empty string id.');
        }
        const entry = Object.freeze({manifest, galleryItem});
        this._entries.set(manifest.id, entry);
        this._emit('extension:registered', manifest.id);
        return entry;
    }

    registerMany (items) {
        return items.map(item => this.register(item.manifest, item.galleryItem || null));
    }

    get (extensionId) {
        return this._entries.get(extensionId) || null;
    }

    list () {
        return Array.from(this._entries.values());
    }

    listBySource (sourceId) {
        return this.list().filter(entry => entry.manifest.source.id === sourceId);
    }

    unregister (extensionId) {
        const removed = this._entries.delete(extensionId);
        if (removed) this._emit('extension:unregistered', extensionId);
        return removed;
    }

    clear () {
        if (!this._entries.size) return;
        this._entries.clear();
        this._emit('extension:cleared', null);
    }
}

module.exports = ExtensionRegistry;
