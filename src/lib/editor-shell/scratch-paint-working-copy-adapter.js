const SCRATCH_PAINT_WORKING_COPY_ADAPTER_ID = 'ngvge.workspace-paint-working-copy-adapter.scratch-paint@1';

const makeAdapterError = (code, message, ErrorClass = Error) => {
    const error = new ErrorClass(message);
    error.code = code;
    return error;
};

const decodeBase64Utf8 = payload => {
    if (typeof atob === 'function') {
        const binary = atob(payload);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
        if (typeof TextDecoder === 'function') return new TextDecoder('utf-8').decode(bytes);
        let encoded = '';
        for (let index = 0; index < bytes.length; index++) encoded += `%${bytes[index].toString(16).padStart(2, '0')}`;
        return decodeURIComponent(encoded);
    }
    const nodeBuffer = typeof globalThis !== 'undefined' ? globalThis.Buffer : null;
    if (nodeBuffer && typeof nodeBuffer.from === 'function') return nodeBuffer.from(payload, 'base64').toString('utf8');
    throw makeAdapterError(
        'NGVGE_WORKSPACE_PAINT_BASE64_DECODER_UNAVAILABLE',
        'No base64 decoder is available for the Paint backend adapter.'
    );
};

const decodeSvgDataUri = dataUri => {
    if (typeof dataUri !== 'string' || !dataUri.startsWith('data:')) {
        throw makeAdapterError('NGVGE_WORKSPACE_PAINT_SOURCE_INVALID', 'Paint SVG source must be a data URI.', TypeError);
    }
    const comma = dataUri.indexOf(',');
    if (comma < 0) throw makeAdapterError('NGVGE_WORKSPACE_PAINT_SOURCE_INVALID', 'Paint SVG data URI is malformed.');
    const header = dataUri.slice(0, comma).toLowerCase();
    const payload = dataUri.slice(comma + 1);
    try {
        return header.includes(';base64') ? decodeBase64Utf8(payload) : decodeURIComponent(payload);
    } catch (error) {
        throw makeAdapterError(
            'NGVGE_WORKSPACE_PAINT_SVG_DECODE_FAILED',
            `Unable to decode Paint SVG working copy: ${error.message || error}`
        );
    }
};

const encodeBitmapImageDataToPngDataUri = imageData => {
    if (!imageData || !Number.isInteger(imageData.width) || !Number.isInteger(imageData.height) || !imageData.data) {
        throw makeAdapterError(
            'NGVGE_WORKSPACE_PAINT_BITMAP_EDIT_INVALID',
            'Scratch Paint bitmap update must provide ImageData-like pixels.',
            TypeError
        );
    }
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
        throw makeAdapterError(
            'NGVGE_WORKSPACE_PAINT_BITMAP_ENCODER_UNAVAILABLE',
            'Bitmap working-copy encoding requires a browser canvas.'
        );
    }
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const context = canvas.getContext('2d');
    if (!context || typeof context.putImageData !== 'function' || typeof canvas.toDataURL !== 'function') {
        throw makeAdapterError(
            'NGVGE_WORKSPACE_PAINT_BITMAP_ENCODER_UNAVAILABLE',
            'Bitmap working-copy encoding requires Canvas 2D support.'
        );
    }
    context.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
};

const toScratchPaintDocument = (workingCopy, {sanitizeSvgText = value => value} = {}) => {
    if (!workingCopy || !workingCopy.content) return null;
    let image;
    let imageFormat = workingCopy.dataFormat;
    if (workingCopy.content.kind === 'svg-text') {
        image = sanitizeSvgText(workingCopy.content.text);
        imageFormat = 'svg';
    } else if (workingCopy.content.kind === 'data-uri') {
        if (workingCopy.dataFormat === 'svg') {
            image = sanitizeSvgText(decodeSvgDataUri(workingCopy.content.dataUri));
            imageFormat = 'svg';
        } else {
            image = workingCopy.content.dataUri;
            imageFormat = workingCopy.dataFormat === 'jpeg' ? 'jpg' : workingCopy.dataFormat;
        }
    } else {
        throw makeAdapterError(
            'NGVGE_WORKSPACE_PAINT_CONTENT_KIND_UNSUPPORTED',
            `Scratch Paint adapter cannot consume content kind: ${String(workingCopy.content.kind)}`
        );
    }
    return Object.freeze({
        adapterId: SCRATCH_PAINT_WORKING_COPY_ADAPTER_ID,
        imageId: workingCopy.workingCopyId,
        imageFormat,
        image,
        rotationCenterX: workingCopy.rotationCenterX,
        rotationCenterY: workingCopy.rotationCenterY
    });
};

const fromScratchPaintUpdate = ({
    isVector,
    image,
    rotationCenterX,
    rotationCenterY,
    encodeBitmap = encodeBitmapImageDataToPngDataUri
}) => {
    if (isVector) {
        if (typeof image !== 'string') {
            throw makeAdapterError(
                'NGVGE_WORKSPACE_PAINT_VECTOR_EDIT_INVALID',
                'Scratch Paint vector update must provide SVG text.',
                TypeError
            );
        }
        return Object.freeze({
            dataFormat: 'svg',
            bitmapResolution: 1,
            rotationCenterX,
            rotationCenterY,
            content: Object.freeze({kind: 'svg-text', text: image})
        });
    }
    const dataUri = encodeBitmap(image);
    return Object.freeze({
        dataFormat: 'png',
        bitmapResolution: 2,
        rotationCenterX,
        rotationCenterY,
        content: Object.freeze({kind: 'data-uri', dataUri})
    });
};

export {
    SCRATCH_PAINT_WORKING_COPY_ADAPTER_ID,
    decodeSvgDataUri,
    encodeBitmapImageDataToPngDataUri,
    toScratchPaintDocument,
    fromScratchPaintUpdate
};
