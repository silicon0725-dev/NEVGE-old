const LEGACY_BRIDGE_TOKEN_BYTES = 16;
const LEGACY_BRIDGE_SECURE_RANDOM_UNAVAILABLE_CODE = 'NGVGE_LEGACY_BRIDGE_SECURE_RANDOM_UNAVAILABLE';

const resolveCryptoProvider = () => {
    if (typeof window !== 'undefined' && window.crypto) return window.crypto;
    return null;
};

const createSecureRandomUnavailableError = () => {
    const error = new Error(
        'Legacy 02Agent bridge requires crypto.getRandomValues; insecure token fallback is forbidden.'
    );
    error.code = LEGACY_BRIDGE_SECURE_RANDOM_UNAVAILABLE_CODE;
    return error;
};

/**
 * Create an ephemeral bridge bearer token with a CSPRNG only.
 * LSC-G1 deliberately fails closed instead of falling back to Math.random/Date.now.
 * @param {object} cryptoProvider optional provider for tests/alternate browser globals
 * @returns {string} lowercase hex token
 */
const createLegacyBridgeToken = (cryptoProvider = resolveCryptoProvider()) => {
    if (!cryptoProvider || typeof cryptoProvider.getRandomValues !== 'function') {
        throw createSecureRandomUnavailableError();
    }
    const bytes = new Uint8Array(LEGACY_BRIDGE_TOKEN_BYTES);
    cryptoProvider.getRandomValues(bytes);
    return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
};

export {
    LEGACY_BRIDGE_SECURE_RANDOM_UNAVAILABLE_CODE,
    LEGACY_BRIDGE_TOKEN_BYTES,
    createLegacyBridgeToken
};

export default createLegacyBridgeToken;
