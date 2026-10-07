import {
    STABLE_ID_KINDS,
    createStableIdentity
} from '../../core/identity';

let fallbackCounter = 0;

const createHostOpaqueIdentityToken = () => {
    if (
        typeof globalThis !== 'undefined' &&
        globalThis.crypto &&
        typeof globalThis.crypto.randomUUID === 'function'
    ) {
        return globalThis.crypto.randomUUID();
    }
    fallbackCounter += 1;
    return `fallback-${Date.now().toString(36)}-${fallbackCounter.toString(36).padStart(8, '0')}`;
};

const createHostStableIdentity = kind => createStableIdentity(kind, createHostOpaqueIdentityToken);
const createStableNodeId = () => createHostStableIdentity(STABLE_ID_KINDS.NODE);
const createStableBindingId = () => createHostStableIdentity(STABLE_ID_KINDS.BINDING);

export {
    createHostOpaqueIdentityToken,
    createHostStableIdentity,
    createStableBindingId,
    createStableNodeId
};
