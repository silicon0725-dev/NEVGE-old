import {
    CANVAS_RASTER_TRANSFER_ADAPTER_ID,
    createStaticBitmapTransferFromWorkingCopy,
    createWorkingCopyEditFromCanvasRasterTransfer,
    probeBitmapWorkingCopyDimensions
} from '../../../../src/lib/paint-backends/canvas-raster-transfer';

const RESOURCE_ID = 'ngvge:resource:11111111-1111-4111-8111-111111111111';
const workingCopy = {
    workingCopyId: 'ngvge.workspace-paint-working-copy.bitmap',
    resourceId: RESOURCE_ID,
    dataFormat: 'png',
    bitmapResolution: 2,
    rotationCenterX: 17,
    rotationCenterY: 11,
    content: {kind: 'data-uri', dataUri: 'data:image/png;base64,AAAA'}
};

class FakeImage {
    set src (value) {
        this._src = value;
        this.naturalWidth = 33;
        this.naturalHeight = 21;
        this.onload();
    }
}

describe('WS-10G1 Canvas raster transfer', () => {
    test('maps static Bitmap Working Copy into frozen Layer × Frame = Cel semantics', () => {
        expect(CANVAS_RASTER_TRANSFER_ADAPTER_ID).toBe('ngvge.paint-backend-transfer-adapter.canvas-raster@1');
        const transfer = createStaticBitmapTransferFromWorkingCopy(workingCopy, {width: 33, height: 21});
        expect(transfer.document).toEqual(expect.objectContaining({
            schemaId: 'ngvge.animated-raster-document@1',
            resourceId: RESOURCE_ID,
            mode: 'bitmap',
            canvas: {width: 33, height: 21, colorMode: 'rgba'}
        }));
        expect(transfer.document.layers).toHaveLength(1);
        expect(transfer.document.frames).toHaveLength(1);
        expect(transfer.document.cels).toHaveLength(1);
        expect(transfer.document.celContents).toHaveLength(1);
        expect(transfer.activeTarget.contentId).toBe(transfer.document.cels[0].contentId);
        expect(transfer.contentEntries[0].content.dataUri).toBe(workingCopy.content.dataUri);
    });

    test('exports PNG bytes back to Working Copy without changing rotation metadata', () => {
        const transfer = createStaticBitmapTransferFromWorkingCopy(workingCopy, {width: 33, height: 21});
        const edited = JSON.parse(JSON.stringify(transfer));
        edited.contentEntries[0].content.dataUri = 'data:image/png;base64,EDITED';
        const result = createWorkingCopyEditFromCanvasRasterTransfer(edited, workingCopy);
        expect(result).toEqual({
            dataFormat: 'png',
            bitmapResolution: 2,
            rotationCenterX: 17,
            rotationCenterY: 11,
            content: {kind: 'data-uri', dataUri: 'data:image/png;base64,EDITED'}
        });
    });

    test('probes browser-decoded Bitmap dimensions', async () => {
        await expect(probeBitmapWorkingCopyDimensions(workingCopy, {ImageClass: FakeImage})).resolves.toEqual({width: 33, height: 21});
    });
});
