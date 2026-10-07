import {
    SCRATCH_PAINT_WORKING_COPY_ADAPTER_ID,
    decodeSvgDataUri,
    fromScratchPaintUpdate,
    toScratchPaintDocument
} from '../../../../src/lib/editor-shell/scratch-paint-working-copy-adapter';

describe('WS-10B scratch-paint working-copy adapter', () => {
    test('decodes source SVG data URI into a backend document without changing identity', () => {
        const workingCopy = {
            workingCopyId: 'ngvge.workspace-paint-working-copy.1',
            dataFormat: 'svg',
            rotationCenterX: 2,
            rotationCenterY: 3,
            content: {kind: 'data-uri', dataUri: 'data:image/svg+xml,%3Csvg%3E%3Crect%2F%3E%3C%2Fsvg%3E'}
        };
        const document = toScratchPaintDocument(workingCopy, {sanitizeSvgText: value => value.replace('rect', 'path')});
        expect(document.adapterId).toBe(SCRATCH_PAINT_WORKING_COPY_ADAPTER_ID);
        expect(document.imageId).toBe(workingCopy.workingCopyId);
        expect(document.image).toContain('path');
        expect(decodeSvgDataUri(workingCopy.content.dataUri)).toContain('<rect/>');
    });

    test('normalizes scratch-paint vector updates into portable SVG working-copy edits', () => {
        const edit = fromScratchPaintUpdate({
            isVector: true,
            image: '<svg><circle/></svg>',
            rotationCenterX: 5,
            rotationCenterY: 6
        });
        expect(edit).toEqual(expect.objectContaining({dataFormat: 'svg', rotationCenterX: 5, rotationCenterY: 6}));
        expect(edit.content).toEqual({kind: 'svg-text', text: '<svg><circle/></svg>'});
    });

    test('normalizes bitmap ImageData through an injected browser encoder without exposing canvas handles', () => {
        const edit = fromScratchPaintUpdate({
            isVector: false,
            image: {width: 1, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255])},
            rotationCenterX: 1,
            rotationCenterY: 1,
            encodeBitmap: () => 'data:image/png;base64,AA=='
        });
        expect(edit.dataFormat).toBe('png');
        expect(edit.content).toEqual({kind: 'data-uri', dataUri: 'data:image/png;base64,AA=='});
        expect(edit.canvas).toBeUndefined();
    });
});
