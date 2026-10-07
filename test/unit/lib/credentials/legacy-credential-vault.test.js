import {
    LEGACY_CREDENTIAL_VAULT_ID,
    LegacyCredentialVault
} from '../../../../src/lib/credentials/legacy-credential-vault';

describe('LSC-0 legacy credential vault', () => {
    test('keeps credentials in module memory without serializing secret data', () => {
        const vault = new LegacyCredentialVault();
        expect(vault.id).toBe(LEGACY_CREDENTIAL_VAULT_ID);
        vault.set('agent', 'provider-1', 'secret-token');
        expect(vault.get('agent', 'provider-1')).toBe('secret-token');
        expect(vault.has('agent', 'provider-1')).toBe(true);
        expect(vault.getStatus()).toEqual({
            id: LEGACY_CREDENTIAL_VAULT_ID,
            namespaceCount: 1,
            credentialCount: 1
        });
        expect(JSON.stringify(vault.getStatus())).not.toContain('secret-token');
        expect(JSON.stringify(vault.getStatus())).not.toContain('provider-1');
    });

    test('empty credential values delete existing secrets', () => {
        const vault = new LegacyCredentialVault();
        vault.set('git', 'origin', 'token');
        vault.set('git', 'origin', '');
        expect(vault.get('git', 'origin')).toBe('');
        expect(vault.getStatus().credentialCount).toBe(0);
    });

    test('isolates namespaces and supports explicit clearing', () => {
        const vault = new LegacyCredentialVault();
        vault.set('agent', 'same', 'agent-key');
        vault.set('git', 'same', 'git-key');
        expect(vault.get('agent', 'same')).toBe('agent-key');
        expect(vault.get('git', 'same')).toBe('git-key');
        expect(vault.clearNamespace('agent')).toBe(true);
        expect(vault.get('agent', 'same')).toBe('');
        expect(vault.get('git', 'same')).toBe('git-key');
        vault.clear();
        expect(vault.getStatus().credentialCount).toBe(0);
    });
});
