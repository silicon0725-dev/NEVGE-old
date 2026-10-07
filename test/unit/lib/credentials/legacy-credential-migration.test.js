import {LegacyCredentialVault} from '../../../../src/lib/credentials/legacy-credential-vault';
import {migrateLegacyPlaintextCredentials} from '../../../../src/lib/credentials/legacy-credential-migration';
import {
    LEGACY_AGENT_STORAGE_KEY,
    LEGACY_AGENT_CREDENTIAL_NAMESPACE,
    LEGACY_BRIDGE_STORAGE_KEY,
    LEGACY_BRIDGE_CREDENTIAL_NAMESPACE,
    LEGACY_BRIDGE_CREDENTIAL_KEY,
    LEGACY_GIT_AUTH_STORAGE_KEY,
    LEGACY_GIT_CREDENTIAL_NAMESPACE
} from '../../../../src/lib/credentials/legacy-credential-contract';

const makeStorage = seed => {
    const map = new Map(Object.entries(seed || {}));
    return {
        getItem: key => map.has(key) ? map.get(key) : null,
        setItem: (key, value) => map.set(key, value),
        dump: key => map.get(key)
    };
};

describe('LSC-0 startup plaintext credential migration', () => {
    test('scrubs known legacy stores before their optional UI is opened', () => {
        const storage = makeStorage({
            [LEGACY_AGENT_STORAGE_KEY]: JSON.stringify([{id: 'openai', name: 'OpenAI', apiKey: 'sk-secret'}]),
            [LEGACY_BRIDGE_STORAGE_KEY]: JSON.stringify({enabled: true, port: 40202, token: 'bridge-secret'}),
            [LEGACY_GIT_AUTH_STORAGE_KEY]: JSON.stringify({
                'https://github.com/example/repo.git': {
                    username: 'user', token: 'git-secret', disableCorsProxy: true
                }
            })
        });
        const vault = new LegacyCredentialVault();
        const result = migrateLegacyPlaintextCredentials({storage, vault});

        expect(result).toEqual({agentApiKeys: 1, bridgeTokens: 1, gitTokens: 1, total: 3});
        expect(vault.get(LEGACY_AGENT_CREDENTIAL_NAMESPACE, 'openai')).toBe('sk-secret');
        expect(vault.get(LEGACY_BRIDGE_CREDENTIAL_NAMESPACE, LEGACY_BRIDGE_CREDENTIAL_KEY)).toBe('bridge-secret');
        expect(vault.get(LEGACY_GIT_CREDENTIAL_NAMESPACE, 'https://github.com/example/repo.git')).toBe('git-secret');

        expect(JSON.parse(storage.dump(LEGACY_AGENT_STORAGE_KEY))[0].apiKey).toBe('');
        expect(JSON.parse(storage.dump(LEGACY_BRIDGE_STORAGE_KEY))).toEqual({enabled: true, port: 40202});
        expect(JSON.parse(storage.dump(LEGACY_GIT_AUTH_STORAGE_KEY))).toEqual({
            'https://github.com/example/repo.git': {username: 'user', disableCorsProxy: true}
        });
        expect(storage.dump(LEGACY_AGENT_STORAGE_KEY)).not.toContain('sk-secret');
        expect(storage.dump(LEGACY_BRIDGE_STORAGE_KEY)).not.toContain('bridge-secret');
        expect(storage.dump(LEGACY_GIT_AUTH_STORAGE_KEY)).not.toContain('git-secret');
    });

    test('is idempotent once durable stores have been sanitized', () => {
        const storage = makeStorage({
            [LEGACY_AGENT_STORAGE_KEY]: JSON.stringify([{id: 'openai', apiKey: ''}]),
            [LEGACY_BRIDGE_STORAGE_KEY]: JSON.stringify({enabled: false, port: 40202}),
            [LEGACY_GIT_AUTH_STORAGE_KEY]: JSON.stringify({origin: {username: '', disableCorsProxy: false}})
        });
        const vault = new LegacyCredentialVault();
        expect(migrateLegacyPlaintextCredentials({storage, vault}).total).toBe(0);
        expect(migrateLegacyPlaintextCredentials({storage, vault}).total).toBe(0);
        expect(vault.getStatus().credentialCount).toBe(0);
    });
});
