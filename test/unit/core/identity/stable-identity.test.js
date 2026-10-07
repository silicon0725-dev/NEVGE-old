import {
    STABLE_ID_KINDS,
    STABLE_ID_SCHEMA,
    assertStableIdentity,
    createStableIdentity,
    formatStableIdentity,
    isStableIdentity,
    parseStableIdentity
} from '../../../../src/core/identity';

describe('ARC-C001 Stable Identity Foundation', () => {
    test('formats and parses canonical opaque stable identities', () => {
        const nodeId = formatStableIdentity(STABLE_ID_KINDS.NODE, '12345678-abcd-efgh');

        expect(nodeId).toBe('ngvge:node:12345678-abcd-efgh');
        expect(parseStableIdentity(nodeId)).toEqual({
            kind: STABLE_ID_KINDS.NODE,
            opaqueToken: '12345678-abcd-efgh',
            schema: STABLE_ID_SCHEMA,
            value: nodeId
        });
        expect(isStableIdentity(nodeId, STABLE_ID_KINDS.NODE)).toBe(true);
        expect(isStableIdentity(nodeId, STABLE_ID_KINDS.SCENE)).toBe(false);
    });

    test('requires identity entropy to be injected instead of reading a backend/global source', () => {
        const factory = jest.fn(() => 'opaque-token-0001');
        const id = createStableIdentity(STABLE_ID_KINDS.RESOURCE, factory);

        expect(id).toBe('ngvge:resource:opaque-token-0001');
        expect(factory).toHaveBeenCalledTimes(1);
        expect(() => createStableIdentity(STABLE_ID_KINDS.NODE)).toThrow(/injected opaque token factory/);
    });

    test('rejects unknown kinds, malformed tokens, and backend-derived legacy ids', () => {
        expect(() => formatStableIdentity('scratch-target', 'opaque-token-0001')).toThrow(/Unknown NGVGE stable identity kind/);
        expect(() => formatStableIdentity(STABLE_ID_KINDS.NODE, 'short')).toThrow(/opaque 8-128 character strings/);
        expect(isStableIdentity('target-node:scratch-runtime-id', STABLE_ID_KINDS.NODE)).toBe(false);
        expect(() => assertStableIdentity('target-node:scratch-runtime-id', STABLE_ID_KINDS.NODE))
            .toThrow(/canonical NGVGE node identity/);
    });
});
