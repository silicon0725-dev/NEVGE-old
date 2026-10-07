'use strict';

const {
    LEGACY_AGENT_MUTATING_TOOL_NAMES,
    LEGACY_AGENT_MUTATION_BLOCKED_CODE
} = require('../../../src/addons/addons/02agent/legacySafetyPolicy');
const {callAITool} = require('../../../src/addons/addons/02agent/toolRuntime');
const {scratchToolSchemas} = require('../../../src/addons/addons/02agent/toolSchemas');
const {createBridgeManifest} = require('../../../src/addons/addons/02agent/bridgeManifest');
const {
    LEGACY_BRIDGE_SECURE_RANDOM_UNAVAILABLE_CODE,
    LEGACY_BRIDGE_TOKEN_BYTES,
    createLegacyBridgeToken
} = require('../../../src/lib/credentials/legacy-bridge-token');
const {LegacyCredentialVault} = require('../../../src/lib/credentials/legacy-credential-vault');
const {migrateLegacyPlaintextCredentials} = require('../../../src/lib/credentials/legacy-credential-migration');
const {
    LEGACY_AGENT_CREDENTIAL_NAMESPACE,
    LEGACY_AGENT_STORAGE_KEY,
    LEGACY_BRIDGE_CREDENTIAL_KEY,
    LEGACY_BRIDGE_CREDENTIAL_NAMESPACE,
    LEGACY_BRIDGE_STORAGE_KEY,
    LEGACY_GIT_AUTH_STORAGE_KEY,
    LEGACY_GIT_CREDENTIAL_NAMESPACE
} = require('../../../src/lib/credentials/legacy-credential-contract');

const makeStorage = seed => {
    const values = new Map(Object.entries(seed || {}));
    return {
        dump: key => values.get(key),
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, value)
    };
};

const argumentsForMutationTool = name => {
    switch (name) {
    case 'applyPatch': return {patch: '*** Begin Patch\n*** End Patch'};
    case 'createSpriteWithSvg': return {svg: '<svg xmlns="http://www.w3.org/2000/svg" />'};
    case 'addCostumeWithSvg': return {svg: '<svg xmlns="http://www.w3.org/2000/svg" />'};
    case 'batchAddCostumesWithSvg': return {costumes: []};
    case 'reorderCostume': return {newIndex: 0};
    default: return {};
    }
};

describe('LSC-G1 Credentials & Unsafe Agent Containment Certification', () => {
    test('every declared legacy mutating tool is withheld from the model/bridge manifest', () => {
        const advertised = new Set(scratchToolSchemas.map(schema => schema.function.name));
        for (const name of LEGACY_AGENT_MUTATING_TOOL_NAMES) {
            expect(advertised.has(name)).toBe(false);
        }
        expect(advertised.size).toBeGreaterThan(0);
    });

    test('runtime blocks every declared mutating tool before the implementation is invoked', async () => {
        for (const name of LEGACY_AGENT_MUTATING_TOOL_NAMES) {
            const implementation = jest.fn(() => ({unexpected: true}));
            await expect(callAITool({[name]: implementation}, name, argumentsForMutationTool(name)))
                .rejects.toEqual(expect.objectContaining({
                    code: LEGACY_AGENT_MUTATION_BLOCKED_CODE,
                    toolName: name
                }));
            expect(implementation).not.toHaveBeenCalled();
        }
    });

    test('a read-only tool still executes through the same guarded dispatcher', async () => {
        const read = jest.fn(() => ['ok']);
        await expect(callAITool({listFiles: read}, 'listFiles', {})).resolves.toEqual(['ok']);
        expect(read).toHaveBeenCalledTimes(1);
    });

    test('bridge manifest is read-only and advertises no mutating tool', () => {
        const manifest = createBridgeManifest({projectOverview: {nodeCount: 3}});
        const advertised = new Set(manifest.tools.map(schema => schema.function.name));
        expect(manifest.security).toEqual(expect.objectContaining({
            apiKeysExposed: false,
            dangerousOperationsMayMutateProject: false,
            requiresToken: true
        }));
        expect(manifest.capabilities.readOnly).toBe(true);
        for (const name of LEGACY_AGENT_MUTATING_TOOL_NAMES) expect(advertised.has(name)).toBe(false);
        const serialized = JSON.stringify(manifest);
        expect(serialized).not.toContain('sk-secret');
        expect(serialized).not.toContain('bridge-secret');
        expect(serialized).not.toContain('git-secret');
    });

    test('bridge bearer token uses CSPRNG only and fails closed without secure randomness', () => {
        const provider = {
            getRandomValues: array => {
                for (let index = 0; index < array.length; index++) array[index] = index;
                return array;
            }
        };
        const token = createLegacyBridgeToken(provider);
        expect(token).toHaveLength(LEGACY_BRIDGE_TOKEN_BYTES * 2);
        expect(token).toBe('000102030405060708090a0b0c0d0e0f');
        expect(() => createLegacyBridgeToken(null)).toThrow(expect.objectContaining({
            code: LEGACY_BRIDGE_SECURE_RANDOM_UNAVAILABLE_CODE
        }));
    });

    test('known legacy plaintext secrets are scrubbed into page-memory vault namespaces', () => {
        const storage = makeStorage({
            [LEGACY_AGENT_STORAGE_KEY]: JSON.stringify([{id: 'provider', apiKey: 'sk-secret'}]),
            [LEGACY_BRIDGE_STORAGE_KEY]: JSON.stringify({enabled: true, port: 40202, token: 'bridge-secret'}),
            [LEGACY_GIT_AUTH_STORAGE_KEY]: JSON.stringify({origin: {
                disableCorsProxy: false,
                token: 'git-secret',
                username: 'user'
            }})
        });
        const vault = new LegacyCredentialVault();
        expect(migrateLegacyPlaintextCredentials({storage, vault}).total).toBe(3);
        expect(vault.get(LEGACY_AGENT_CREDENTIAL_NAMESPACE, 'provider')).toBe('sk-secret');
        expect(vault.get(LEGACY_BRIDGE_CREDENTIAL_NAMESPACE, LEGACY_BRIDGE_CREDENTIAL_KEY)).toBe('bridge-secret');
        expect(vault.get(LEGACY_GIT_CREDENTIAL_NAMESPACE, 'origin')).toBe('git-secret');
        expect(storage.dump(LEGACY_AGENT_STORAGE_KEY)).not.toContain('sk-secret');
        expect(storage.dump(LEGACY_BRIDGE_STORAGE_KEY)).not.toContain('bridge-secret');
        expect(storage.dump(LEGACY_GIT_AUTH_STORAGE_KEY)).not.toContain('git-secret');
    });

    test('credential diagnostics expose counts only, never secret keys or values', () => {
        const vault = new LegacyCredentialVault();
        vault.set('secret-namespace', 'secret-key-name', 'secret-value');
        const serialized = JSON.stringify(vault.getStatus());
        expect(serialized).not.toContain('secret-namespace');
        expect(serialized).not.toContain('secret-key-name');
        expect(serialized).not.toContain('secret-value');
        expect(vault.getStatus().credentialCount).toBe(1);
    });
});
