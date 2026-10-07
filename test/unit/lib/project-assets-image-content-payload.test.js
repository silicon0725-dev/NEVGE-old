import {
    MAX_IMAGE_CONTENT_REPLACE_BYTES,
    decodePortableImageContentToBytes,
    normalizePortableImageContent
} from '../../../src/lib/project-assets/image-content-payload';

describe('WS-10C portable image content payload', () => {
    test('normalizes SVG text into bounded portable content', () => {
        const payload = normalizePortableImageContent({
            dataFormat: 'svg',
            content: {kind: 'svg-text', text: '<svg><rect/></svg>'}
        });
        expect(payload).toEqual(expect.objectContaining({
            dataFormat: 'svg',
            byteLength: expect.any(Number),
            content: {kind: 'svg-text', text: '<svg><rect/></svg>'}
        }));
        expect(Object.isFrozen(payload)).toBe(true);
    });

    test('decodes PNG data URI without exposing storage/backend objects', () => {
        const bytes = decodePortableImageContentToBytes({
            dataFormat: 'png',
            content: {kind: 'data-uri', dataUri: 'data:image/png;base64,AQID'}
        });
        expect(Array.from(bytes)).toEqual([1, 2, 3]);
    });

    test('rejects MIME/format mismatch and oversized payloads', () => {
        expect(() => normalizePortableImageContent({
            dataFormat: 'png',
            content: {kind: 'data-uri', dataUri: 'data:image/jpeg;base64,AQID'}
        })).toThrow(expect.objectContaining({code: 'NGVGE_RESOURCE_IMAGE_CONTENT_MIME_MISMATCH'}));
        expect(() => normalizePortableImageContent({
            dataFormat: 'png',
            content: {kind: 'data-uri', dataUri: `data:image/png;base64,${'A'.repeat(Math.ceil(MAX_IMAGE_CONTENT_REPLACE_BYTES * 4 / 3) + 16)}`}
        })).toThrow(expect.objectContaining({code: 'NGVGE_RESOURCE_IMAGE_CONTENT_BUDGET_EXCEEDED'}));
    });
});
