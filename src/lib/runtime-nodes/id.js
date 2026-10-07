let fallbackCounter = 0;

const createRuntimeId = prefix => {
    if (
        typeof globalThis !== 'undefined' &&
        globalThis.crypto &&
        typeof globalThis.crypto.randomUUID === 'function'
    ) {
        return `${prefix}:${globalThis.crypto.randomUUID()}`;
    }
    fallbackCounter += 1;
    return `${prefix}:${Date.now().toString(36)}:${fallbackCounter.toString(36)}`;
};

module.exports = {
    createRuntimeId
};
