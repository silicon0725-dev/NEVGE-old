import legacyCredentialVault from './legacy-credential-vault';
import {
    LEGACY_AGENT_STORAGE_KEY,
    LEGACY_AGENT_CREDENTIAL_NAMESPACE,
    LEGACY_BRIDGE_STORAGE_KEY,
    LEGACY_BRIDGE_CREDENTIAL_NAMESPACE,
    LEGACY_BRIDGE_CREDENTIAL_KEY,
    LEGACY_GIT_AUTH_STORAGE_KEY,
    LEGACY_GIT_CREDENTIAL_NAMESPACE
} from './legacy-credential-contract';

const readJSON = (storage, key, fallback) => {
    try {
        const raw = storage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
};

const writeJSON = (storage, key, value) => {
    try {
        storage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        return false;
    }
};

const migrateAgents = (storage, vault) => {
    const agents = readJSON(storage, LEGACY_AGENT_STORAGE_KEY, null);
    if (!Array.isArray(agents)) return 0;
    let migrated = 0;
    const sanitized = agents.map(agent => {
        if (!agent || typeof agent !== 'object') return agent;
        const id = typeof agent.id === 'string' && agent.id ? agent.id : '';
        const apiKey = typeof agent.apiKey === 'string' ? agent.apiKey : '';
        if (id && apiKey) {
            vault.set(LEGACY_AGENT_CREDENTIAL_NAMESPACE, id, apiKey);
            migrated += 1;
        }
        return {...agent, apiKey: ''};
    });
    if (migrated > 0) writeJSON(storage, LEGACY_AGENT_STORAGE_KEY, sanitized);
    return migrated;
};

const migrateBridge = (storage, vault) => {
    const config = readJSON(storage, LEGACY_BRIDGE_STORAGE_KEY, null);
    if (!config || typeof config !== 'object') return 0;
    const token = typeof config.token === 'string' ? config.token : '';
    if (!token) return 0;
    vault.set(LEGACY_BRIDGE_CREDENTIAL_NAMESPACE, LEGACY_BRIDGE_CREDENTIAL_KEY, token);
    writeJSON(storage, LEGACY_BRIDGE_STORAGE_KEY, {
        enabled: Boolean(config.enabled),
        port: Number(config.port) || 40202
    });
    return 1;
};

const migrateGit = (storage, vault) => {
    const auth = readJSON(storage, LEGACY_GIT_AUTH_STORAGE_KEY, null);
    if (!auth || typeof auth !== 'object' || Array.isArray(auth)) return 0;
    let migrated = 0;
    const durable = {};
    Object.keys(auth).forEach(remoteUrl => {
        const record = auth[remoteUrl] && typeof auth[remoteUrl] === 'object' ? auth[remoteUrl] : {};
        const token = typeof record.token === 'string' ? record.token : '';
        if (remoteUrl && token) {
            vault.set(LEGACY_GIT_CREDENTIAL_NAMESPACE, remoteUrl, token);
            migrated += 1;
        }
        durable[remoteUrl] = {
            username: typeof record.username === 'string' ? record.username : '',
            disableCorsProxy: Boolean(record.disableCorsProxy)
        };
    });
    if (migrated > 0) writeJSON(storage, LEGACY_GIT_AUTH_STORAGE_KEY, durable);
    return migrated;
};

/**
 * One-time/early-startup migration for known legacy plaintext credential stores.
 * This removes durable plaintext secrets even when the corresponding legacy UI is disabled.
 * @param {{storage?: Storage|Object, vault?: Object}} options migration dependencies
 * @returns {{agentApiKeys: number, bridgeTokens: number, gitTokens: number, total: number}}
 */
const getDefaultStorage = () => {
    try {
        return typeof window !== 'undefined' ? window.localStorage : null;
    } catch (e) {
        return null;
    }
};

const migrateLegacyPlaintextCredentials = ({storage, vault = legacyCredentialVault} = {}) => {
    const targetStorage = storage || getDefaultStorage();
    if (!targetStorage || typeof targetStorage.getItem !== 'function' || typeof targetStorage.setItem !== 'function') {
        return Object.freeze({agentApiKeys: 0, bridgeTokens: 0, gitTokens: 0, total: 0});
    }
    const agentApiKeys = migrateAgents(targetStorage, vault);
    const bridgeTokens = migrateBridge(targetStorage, vault);
    const gitTokens = migrateGit(targetStorage, vault);
    return Object.freeze({
        agentApiKeys,
        bridgeTokens,
        gitTokens,
        total: agentApiKeys + bridgeTokens + gitTokens
    });
};

export {migrateLegacyPlaintextCredentials};
export default migrateLegacyPlaintextCredentials;
