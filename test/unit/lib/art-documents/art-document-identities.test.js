import {
    assertStableSemanticId,
    assertCanonicalResourceId
} from '../../../../src/lib/art-documents/art-document-identities';

describe('NGVGE art semantic identities', () => {
    test.each([
        ['documentId', 'ngvge:art-document:hero'],
        ['layerId', 'ngvge:art-layer:body'],
        ['frameId', 'ngvge:animation-frame:1'],
        ['celId', 'ngvge:animation-cel:1'],
        ['contentId', 'ngvge:cel-content:1'],
        ['clipId', 'ngvge:animation-clip:walk'],
        ['markerId', 'ngvge:animation-marker:hit'],
        ['paletteId', 'ngvge:palette:main'],
        ['paletteEntryId', 'ngvge:palette-entry:red'],
        ['sliceId', 'ngvge:slice:body']
    ])('accepts stable %s', (kind, id) => {
        expect(assertStableSemanticId(id, kind)).toBe(id);
    });

    test('rejects backend-local IDs as semantic identities', () => {
        expect(() => assertStableSemanticId('frame-12', 'frameId')).toThrow(/stable ngvge:animation-frame/i);
        expect(() => assertStableSemanticId('layer_4', 'layerId')).toThrow(/stable ngvge:art-layer/i);
        expect(() => assertCanonicalResourceId('asset:123')).toThrow(/canonical ngvge:resource/i);
    });
});
