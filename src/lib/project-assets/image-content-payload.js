const IMAGE_CONTENT_PAYLOAD_SCHEMA_VERSION = 1;
const MAX_IMAGE_CONTENT_REPLACE_BYTES = 32 * 1024 * 1024;

const makePayloadError = (code, message, ErrorClass = Error) => {
    const error = new ErrorClass(message);
    error.code = code;
    return error;
};

const freezeDeep = value => {
    if (Array.isArray(value)) {
        value.forEach(freezeDeep);
        return Object.freeze(value);
    }
    if (value && typeof value === 'object' &&
        (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
        Object.keys(value).forEach(key => freezeDeep(value[key]));
        return Object.freeze(value);
    }
    return value;
};

const normalizeImageDataFormat = value => {
    const format = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (format === 'jpeg') return 'jpg';
    if (format === 'svg' || format === 'png' || format === 'jpg') return format;
    throw makePayloadError(
        'NGVGE_RESOURCE_IMAGE_CONTENT_FORMAT_UNSUPPORTED',
        `Unsupported image Resource content format: ${format || 'unknown'}`,
        TypeError
    );
};

const estimateDataUriBytes = dataUri => {
    const comma = dataUri.indexOf(',');
    if (comma < 0) return dataUri.length;
    const header = dataUri.slice(0, comma).toLowerCase();
    const payloadLength = dataUri.length - comma - 1;
    if (header.includes(';base64')) return Math.floor((payloadLength * 3) / 4);
    try {
        return decodeURIComponent(dataUri.slice(comma + 1)).length;
    } catch {
        return payloadLength;
    }
};

const estimateUtf8Bytes = text => {
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(text).byteLength;
    const nodeBuffer = typeof globalThis !== 'undefined' ? globalThis.Buffer : null;
    if (nodeBuffer && typeof nodeBuffer.byteLength === 'function') return nodeBuffer.byteLength(text, 'utf8');
    const encoded = encodeURIComponent(text);
    let byteLength = 0;
    for (let index = 0; index < encoded.length; index++) {
        if (encoded[index] === '%' && index + 2 < encoded.length) index += 2;
        byteLength += 1;
    }
    return byteLength;
};

const assertContentBudget = byteLength => {
    if (!Number.isFinite(byteLength) || byteLength < 0) {
        throw makePayloadError(
            'NGVGE_RESOURCE_IMAGE_CONTENT_SIZE_INVALID',
            'Image Resource content size is invalid.',
            TypeError
        );
    }
    if (byteLength > MAX_IMAGE_CONTENT_REPLACE_BYTES) {
        throw makePayloadError(
            'NGVGE_RESOURCE_IMAGE_CONTENT_BUDGET_EXCEEDED',
            `Image Resource content exceeds the ${MAX_IMAGE_CONTENT_REPLACE_BYTES} byte replacement budget.`
        );
    }
    return byteLength;
};

const normalizePortableImageContent = ({dataFormat, content}) => {
    const format = normalizeImageDataFormat(dataFormat);
    if (!content || typeof content !== 'object') {
        throw makePayloadError(
            'NGVGE_RESOURCE_IMAGE_CONTENT_INVALID',
            'Image Resource content must be a portable content record.',
            TypeError
        );
    }
    if (content.kind === 'svg-text') {
        if (format !== 'svg' || typeof content.text !== 'string') {
            throw makePayloadError(
                'NGVGE_RESOURCE_IMAGE_CONTENT_SVG_INVALID',
                'SVG text content requires dataFormat=svg and string text.',
                TypeError
            );
        }
        const byteLength = assertContentBudget(estimateUtf8Bytes(content.text));
        return freezeDeep({
            dataFormat: format,
            byteLength,
            content: {kind: 'svg-text', text: content.text}
        });
    }
    if (content.kind === 'data-uri') {
        if (typeof content.dataUri !== 'string' || !content.dataUri.startsWith('data:')) {
            throw makePayloadError(
                'NGVGE_RESOURCE_IMAGE_CONTENT_DATA_URI_INVALID',
                'Image Resource data URI content is invalid.',
                TypeError
            );
        }
        const mime = content.dataUri.slice(5, content.dataUri.indexOf(';') > -1 ? content.dataUri.indexOf(';') : content.dataUri.indexOf(','))
            .toLowerCase();
        const allowedMime = format === 'svg' ? 'image/svg+xml' : (format === 'png' ? 'image/png' : 'image/jpeg');
        if (mime && mime !== allowedMime && !(format === 'jpg' && mime === 'image/jpg')) {
            throw makePayloadError(
                'NGVGE_RESOURCE_IMAGE_CONTENT_MIME_MISMATCH',
                `Image Resource data URI MIME (${mime}) does not match ${format}.`,
                TypeError
            );
        }
        const byteLength = assertContentBudget(estimateDataUriBytes(content.dataUri));
        return freezeDeep({
            dataFormat: format,
            byteLength,
            content: {kind: 'data-uri', dataUri: content.dataUri}
        });
    }
    throw makePayloadError(
        'NGVGE_RESOURCE_IMAGE_CONTENT_KIND_UNSUPPORTED',
        `Unsupported image Resource content kind: ${String(content.kind)}`,
        TypeError
    );
};

const decodeBase64Bytes = payload => {
    if (typeof atob === 'function') {
        const binary = atob(payload);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
        return bytes;
    }
    const nodeBuffer = typeof globalThis !== 'undefined' ? globalThis.Buffer : null;
    if (nodeBuffer && typeof nodeBuffer.from === 'function') return new Uint8Array(nodeBuffer.from(payload, 'base64'));
    throw makePayloadError(
        'NGVGE_RESOURCE_IMAGE_CONTENT_BASE64_DECODER_UNAVAILABLE',
        'No base64 decoder is available for image Resource content.'
    );
};

const encodeUtf8 = text => {
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(text);
    const nodeBuffer = typeof globalThis !== 'undefined' ? globalThis.Buffer : null;
    if (nodeBuffer && typeof nodeBuffer.from === 'function') return new Uint8Array(nodeBuffer.from(text, 'utf8'));
    throw makePayloadError(
        'NGVGE_RESOURCE_IMAGE_CONTENT_TEXT_ENCODER_UNAVAILABLE',
        'No UTF-8 encoder is available for image Resource content.'
    );
};

const decodeDataUriBytes = dataUri => {
    const comma = dataUri.indexOf(',');
    if (comma < 0) {
        throw makePayloadError('NGVGE_RESOURCE_IMAGE_CONTENT_DATA_URI_INVALID', 'Image Resource data URI is malformed.');
    }
    const header = dataUri.slice(0, comma).toLowerCase();
    const payload = dataUri.slice(comma + 1);
    if (header.includes(';base64')) return decodeBase64Bytes(payload);
    try {
        return encodeUtf8(decodeURIComponent(payload));
    } catch (error) {
        throw makePayloadError(
            'NGVGE_RESOURCE_IMAGE_CONTENT_DATA_URI_DECODE_FAILED',
            `Unable to decode image Resource data URI: ${error.message || error}`
        );
    }
};

const decodePortableImageContentToBytes = normalized => {
    const portable = normalizePortableImageContent(normalized);
    if (portable.content.kind === 'svg-text') return encodeUtf8(portable.content.text);
    return decodeDataUriBytes(portable.content.dataUri);
};

export {
    IMAGE_CONTENT_PAYLOAD_SCHEMA_VERSION,
    MAX_IMAGE_CONTENT_REPLACE_BYTES,
    normalizeImageDataFormat,
    estimateDataUriBytes,
    normalizePortableImageContent,
    decodePortableImageContentToBytes
};
