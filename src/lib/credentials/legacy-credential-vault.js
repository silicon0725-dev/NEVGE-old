/**
 * LSC-0 containment vault for legacy credentials.
 *
 * This is intentionally ephemeral: secrets live only in this module's process/page memory.
 * It is NOT the final NGVGE credential service and does not claim protection from a fully
 * compromised same-origin renderer. Its purpose is to stop legacy features from persisting
 * long-lived credentials in localStorage while desktop/system keychain integration is deferred.
 */

const LEGACY_CREDENTIAL_VAULT_ID = 'ngvge.legacy-credential-vault@1';

const assertPart = (value, label) => {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new TypeError(`${label} must be a non-empty string`);
    }
    return value;
};

class LegacyCredentialVault {
    constructor () {
        this.id = LEGACY_CREDENTIAL_VAULT_ID;
        this._namespaces = new Map();
    }

    _getNamespace (namespace, create = false) {
        const normalized = assertPart(namespace, 'Credential namespace');
        let bucket = this._namespaces.get(normalized);
        if (!bucket && create) {
            bucket = new Map();
            this._namespaces.set(normalized, bucket);
        }
        return bucket || null;
    }

    set (namespace, key, value) {
        const normalizedKey = assertPart(key, 'Credential key');
        if (typeof value !== 'string') {
            throw new TypeError('Credential value must be a string');
        }
        if (value === '') {
            this.delete(namespace, normalizedKey);
            return '';
        }
        this._getNamespace(namespace, true).set(normalizedKey, value);
        return value;
    }

    get (namespace, key) {
        const normalizedKey = assertPart(key, 'Credential key');
        const bucket = this._getNamespace(namespace, false);
        return bucket && bucket.has(normalizedKey) ? bucket.get(normalizedKey) : '';
    }

    has (namespace, key) {
        const normalizedKey = assertPart(key, 'Credential key');
        const bucket = this._getNamespace(namespace, false);
        return Boolean(bucket && bucket.has(normalizedKey));
    }

    delete (namespace, key) {
        const normalizedKey = assertPart(key, 'Credential key');
        const bucket = this._getNamespace(namespace, false);
        if (!bucket) return false;
        const deleted = bucket.delete(normalizedKey);
        if (bucket.size === 0) this._namespaces.delete(namespace);
        return deleted;
    }

    clearNamespace (namespace) {
        return this._namespaces.delete(assertPart(namespace, 'Credential namespace'));
    }

    clear () {
        this._namespaces.clear();
    }

    /**
     * Metadata-only diagnostics. Never returns keys or secret values.
     * @returns {{id: string, namespaceCount: number, credentialCount: number}}
     */
    getStatus () {
        let credentialCount = 0;
        for (const bucket of this._namespaces.values()) credentialCount += bucket.size;
        return Object.freeze({
            id: this.id,
            namespaceCount: this._namespaces.size,
            credentialCount
        });
    }
}

const legacyCredentialVault = new LegacyCredentialVault();

export {
    LEGACY_CREDENTIAL_VAULT_ID,
    LegacyCredentialVault,
    legacyCredentialVault
};

export default legacyCredentialVault;
