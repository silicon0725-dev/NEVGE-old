import {
    PAINT_BACKEND_TRANSFER_SCHEMA_ID,
    PAINT_BACKEND_TRANSFER_SCHEMA_VERSION,
    normalizePaintBackendTransfer
} from './paint-backend-contract';
import {
    ANIMATED_RASTER_DOCUMENT_SCHEMA_ID,
    ANIMATED_RASTER_DOCUMENT_SCHEMA_VERSION
} from '../art-documents/animated-raster-document-schema';

const CANVAS_RASTER_TRANSFER_ADAPTER_ID = 'ngvge.paint-backend-transfer-adapter.canvas-raster@1';

const requireResourceSuffix = resourceId => {
    const prefix = 'ngvge:resource:';
    if (typeof resourceId !== 'string' || !resourceId.startsWith(prefix) || resourceId.length <= prefix.length) {
        throw new TypeError('Raster transfer requires canonical ResourceId.');
    }
    return resourceId.slice(prefix.length);
};

const makeStaticIds = resourceId => {
    const suffix = requireResourceSuffix(resourceId);
    return Object.freeze({
        documentId: `ngvge:art-document:${suffix}`,
        layerId: `ngvge:art-layer:${suffix}:layer-1`,
        frameId: `ngvge:animation-frame:${suffix}:frame-1`,
        celId: `ngvge:animation-cel:${suffix}:cel-1`,
        contentId: `ngvge:cel-content:${suffix}:content-1`
    });
};

const normalizeBitmapWorkingCopy = workingCopy => {
    if (!workingCopy || typeof workingCopy !== 'object' || !workingCopy.content ||
        workingCopy.content.kind !== 'data-uri' || typeof workingCopy.content.dataUri !== 'string') {
        throw new TypeError('Bitmap Raster transfer requires a data-uri Paint working copy.');
    }
    const dataFormat = workingCopy.dataFormat === 'jpeg' ? 'jpg' : workingCopy.dataFormat;
    if (dataFormat !== 'png' && dataFormat !== 'jpg') {
        throw new TypeError(`Bitmap Raster transfer does not support ${String(dataFormat)}.`);
    }
    return {workingCopy, dataFormat};
};


const probeBitmapWorkingCopyDimensions = (workingCopy, {
    ImageClass = typeof Image === 'undefined' ? null : Image
} = {}) => new Promise((resolve, reject) => {
    normalizeBitmapWorkingCopy(workingCopy);
    if (!ImageClass) {
        reject(new TypeError('Bitmap dimension probing requires browser Image decoding.'));
        return;
    }
    const image = new ImageClass();
    image.onload = () => {
        const width = Number(image.naturalWidth || image.width);
        const height = Number(image.naturalHeight || image.height);
        if (!Number.isFinite(width) || width < 1 || !Number.isFinite(height) || height < 1) {
            reject(new TypeError('Decoded Bitmap dimensions are invalid.'));
            return;
        }
        resolve(Object.freeze({width: Math.round(width), height: Math.round(height)}));
    };
    image.onerror = () => reject(new Error('Unable to decode Bitmap Paint working-copy image.'));
    image.src = workingCopy.content.dataUri;
});

const createStaticBitmapTransferFromWorkingCopy = (workingCopy, {width, height}) => {
    const source = normalizeBitmapWorkingCopy(workingCopy);
    const w = Math.round(Number(width));
    const h = Math.round(Number(height));
    if (!Number.isFinite(w) || w < 1 || !Number.isFinite(h) || h < 1) {
        throw new TypeError('Bitmap Raster transfer requires positive decoded image dimensions.');
    }
    const ids = makeStaticIds(workingCopy.resourceId);
    return normalizePaintBackendTransfer({
        schemaId: PAINT_BACKEND_TRANSFER_SCHEMA_ID,
        schemaVersion: PAINT_BACKEND_TRANSFER_SCHEMA_VERSION,
        document: {
            schemaId: ANIMATED_RASTER_DOCUMENT_SCHEMA_ID,
            schemaVersion: ANIMATED_RASTER_DOCUMENT_SCHEMA_VERSION,
            documentId: ids.documentId,
            resourceId: workingCopy.resourceId,
            mode: 'bitmap',
            canvas: {width: w, height: h, colorMode: 'rgba'},
            layers: [{
                layerId: ids.layerId,
                name: 'Artwork',
                type: 'raster',
                parentLayerId: null,
                visible: true,
                locked: false,
                alphaLocked: false,
                opacity: 1,
                blendMode: 'normal',
                clipToLayerId: null,
                maskTargetLayerId: null
            }],
            frames: [{frameId: ids.frameId, durationMs: 100}],
            celContents: [{contentId: ids.contentId, kind: 'rgba-raster'}],
            cels: [{
                celId: ids.celId,
                layerId: ids.layerId,
                frameId: ids.frameId,
                contentId: ids.contentId,
                x: 0,
                y: 0,
                opacity: 1
            }],
            clips: [],
            markers: [],
            palette: null,
            slices: []
        },
        contentEntries: [{
            semanticId: ids.contentId,
            role: 'cel-content',
            dataFormat: source.dataFormat,
            content: {kind: 'data-uri', dataUri: workingCopy.content.dataUri}
        }],
        activeTarget: {
            layerId: ids.layerId,
            frameId: ids.frameId,
            celId: ids.celId,
            contentId: ids.contentId
        }
    });
};

const createWorkingCopyEditFromCanvasRasterTransfer = (transfer, metadata = {}) => {
    const normalized = normalizePaintBackendTransfer(transfer);
    if (normalized.document.schemaId !== ANIMATED_RASTER_DOCUMENT_SCHEMA_ID || normalized.document.mode !== 'bitmap') {
        throw new TypeError('Canvas Raster export must contain a Bitmap AnimatedRasterDocument.');
    }
    const contentId = normalized.activeTarget && normalized.activeTarget.contentId;
    const source = normalized.contentEntries.find(entry => entry.semanticId === contentId) || normalized.contentEntries[0];
    if (!source || source.role !== 'cel-content' || source.content.kind !== 'data-uri') {
        throw new TypeError('Canvas Raster export requires one RGBA cel-content data URI.');
    }
    const rotationCenterX = Number(metadata.rotationCenterX);
    const rotationCenterY = Number(metadata.rotationCenterY);
    const bitmapResolution = Number(metadata.bitmapResolution);
    return Object.freeze({
        dataFormat: source.dataFormat === 'jpg' ? 'jpg' : 'png',
        bitmapResolution: Number.isFinite(bitmapResolution) && bitmapResolution > 0 ? bitmapResolution : 2,
        rotationCenterX: Number.isFinite(rotationCenterX) ? rotationCenterX : normalized.document.canvas.width / 2,
        rotationCenterY: Number.isFinite(rotationCenterY) ? rotationCenterY : normalized.document.canvas.height / 2,
        content: Object.freeze({kind: 'data-uri', dataUri: source.content.dataUri})
    });
};

export {
    CANVAS_RASTER_TRANSFER_ADAPTER_ID,
    makeStaticIds,
    probeBitmapWorkingCopyDimensions,
    createStaticBitmapTransferFromWorkingCopy,
    createWorkingCopyEditFromCanvasRasterTransfer
};
