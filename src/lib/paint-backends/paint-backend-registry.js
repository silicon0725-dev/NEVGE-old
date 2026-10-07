import {normalizeBackendDescriptor} from './paint-backend-contract';

const PAINT_BACKEND_REGISTRY_ID = 'ngvge.paint-backend-registry@1';

class PaintBackendRegistry {
    constructor () {
        this.id = PAINT_BACKEND_REGISTRY_ID;
        this._descriptors = new Map();
        this._disposed = false;
    }

    _assertActive () {
        if (this._disposed) throw new Error('Paint backend registry has been disposed.');
    }

    register (descriptor) {
        this._assertActive();
        const normalized = normalizeBackendDescriptor(descriptor);
        if (this._descriptors.has(normalized.backendId)) {
            throw new Error(`Paint backend is already registered: ${normalized.backendId}`);
        }
        this._descriptors.set(normalized.backendId, normalized);
        return normalized;
    }

    unregister (backendId) {
        this._assertActive();
        return this._descriptors.delete(backendId);
    }

    get (backendId) {
        this._assertActive();
        return this._descriptors.get(backendId) || null;
    }

    list ({kind, admission} = {}) {
        this._assertActive();
        return Object.freeze([...this._descriptors.values()].filter(descriptor => (
            (!kind || descriptor.kind === kind) && (!admission || descriptor.admission === admission)
        )));
    }

    dispose () {
        if (this._disposed) return false;
        this._disposed = true;
        this._descriptors.clear();
        return true;
    }
}

export {PAINT_BACKEND_REGISTRY_ID, PaintBackendRegistry};
