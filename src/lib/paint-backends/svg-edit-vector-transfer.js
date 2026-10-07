import {
    PAINT_BACKEND_TRANSFER_SCHEMA_ID,
    PAINT_BACKEND_TRANSFER_SCHEMA_VERSION,
    normalizePaintBackendTransfer
} from './paint-backend-contract';
import {
    VECTOR_ART_DOCUMENT_SCHEMA_ID,
    VECTOR_ART_DOCUMENT_SCHEMA_VERSION
} from '../art-documents/vector-art-document-schema';

const SVG_EDIT_VECTOR_TRANSFER_ADAPTER_ID = 'ngvge.paint-backend-transfer-adapter.svg-edit@1';

const makeVectorTransferError = (code, message, ErrorClass = Error) => {
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
    throw makeVectorTransferError(
        'NGVGE_PAINT_VECTOR_BASE64_DECODER_UNAVAILABLE',
        'No base64 decoder is available for the SVG-Edit vector transfer.'
    );
};

const decodeSvgDataUri = dataUri => {
    if (typeof dataUri !== 'string' || !dataUri.startsWith('data:')) {
        throw makeVectorTransferError(
            'NGVGE_PAINT_SVG_EDIT_SOURCE_INVALID',
            'SVG-Edit vector transfer requires SVG text or an SVG data URI.',
            TypeError
        );
    }
    const comma = dataUri.indexOf(',');
    if (comma < 0) {
        throw makeVectorTransferError(
            'NGVGE_PAINT_SVG_EDIT_SOURCE_INVALID',
            'SVG-Edit vector transfer received a malformed SVG data URI.'
        );
    }
    const header = dataUri.slice(0, comma).toLowerCase();
    if (!header.startsWith('data:image/svg+xml')) {
        throw makeVectorTransferError(
            'NGVGE_PAINT_SVG_EDIT_SOURCE_INVALID',
            'SVG-Edit vector transfer only accepts image/svg+xml data URIs.'
        );
    }
    const payload = dataUri.slice(comma + 1);
    try {
        return header.includes(';base64') ? decodeBase64Utf8(payload) : decodeURIComponent(payload);
    } catch (error) {
        throw makeVectorTransferError(
            'NGVGE_PAINT_SVG_EDIT_SOURCE_DECODE_FAILED',
            `Unable to decode the SVG Paint working copy: ${error.message || error}`
        );
    }
};

const getSvgWorkingCopyText = workingCopy => {
    if (!workingCopy || typeof workingCopy !== 'object' || workingCopy.dataFormat !== 'svg' || !workingCopy.content) {
        throw makeVectorTransferError(
            'NGVGE_PAINT_SVG_EDIT_SOURCE_INVALID',
            'SVG-Edit vector transfer requires an SVG Paint working copy.',
            TypeError
        );
    }
    if (workingCopy.content.kind === 'svg-text' && typeof workingCopy.content.text === 'string') {
        return workingCopy.content.text;
    }
    if (workingCopy.content.kind === 'data-uri') {
        return decodeSvgDataUri(workingCopy.content.dataUri);
    }
    throw makeVectorTransferError(
        'NGVGE_PAINT_SVG_EDIT_SOURCE_INVALID',
        `SVG-Edit vector transfer does not support Paint content kind: ${String(workingCopy.content.kind)}`,
        TypeError
    );
};

const makeDocumentId = resourceId => {
    if (typeof resourceId !== 'string' || !resourceId.startsWith('ngvge:resource:')) {
        throw new TypeError('SVG-Edit transfer requires canonical ResourceId.');
    }
    return `ngvge:art-document:${resourceId.slice('ngvge:resource:'.length)}`;
};

const parseDimension = value => {
    if (typeof value !== 'string') return null;
    const number = Number.parseFloat(value.trim());
    return Number.isFinite(number) && number > 0 ? number : null;
};

const isFiniteArtworkBounds = bounds => Boolean(
    bounds &&
    Number.isFinite(Number(bounds.x)) &&
    Number.isFinite(Number(bounds.y)) &&
    Number.isFinite(Number(bounds.width)) && Number(bounds.width) > 0 &&
    Number.isFinite(Number(bounds.height)) && Number(bounds.height) > 0
);

const formatSvgNumber = value => {
    const rounded = Math.round(Number(value) * 1000000) / 1000000;
    return Object.is(rounded, -0) ? '0' : String(rounded);
};

const NON_RENDERING_ROOT_ELEMENTS = new Set([
    'defs',
    'desc',
    'metadata',
    'style',
    'title'
]);

const replaceOrAppendSvgAttribute = (tag, name, value) => {
    const expression = new RegExp(`\\s${name}\\s*=\\s*(["'])[^"']*\\1`, 'i');
    if (expression.test(tag)) return tag.replace(expression, ` ${name}="${value}"`);
    return tag.replace(/\s*\/?>$/, match => ` ${name}="${value}"${match}`);
};

const removeSvgAttribute = (tag, name) => tag.replace(
    new RegExp(`\\s${name}\\s*=\\s*(["'])[^"']*\\1`, 'ig'),
    ''
);

const normalizeSvgTextWithoutDom = (svgText, bounds) => {
    const openingMatch = svgText.match(/<svg\b[^>]*>/i);
    const closingIndex = svgText.toLowerCase().lastIndexOf('</svg>');
    if (!openingMatch || closingIndex < 0) return null;
    const openingStart = openingMatch.index;
    const openingEnd = openingStart + openingMatch[0].length;
    const width = formatSvgNumber(bounds.width);
    const height = formatSvgNumber(bounds.height);
    let openingTag = openingMatch[0];
    openingTag = replaceOrAppendSvgAttribute(openingTag, 'width', width);
    openingTag = replaceOrAppendSvgAttribute(openingTag, 'height', height);
    openingTag = replaceOrAppendSvgAttribute(openingTag, 'viewBox', `0 0 ${width} ${height}`);
    openingTag = removeSvgAttribute(removeSvgAttribute(openingTag, 'x'), 'y');
    const prefix = svgText.slice(0, openingStart);
    let body = svgText.slice(openingEnd, closingIndex);
    const suffix = svgText.slice(closingIndex);
    if (Math.abs(bounds.x) > 1e-9 || Math.abs(bounds.y) > 1e-9) {
        body = `<g data-ngvge-export-normalized="true" transform="translate(${formatSvgNumber(-bounds.x)} ${formatSvgNumber(-bounds.y)})">${body}</g>`;
    }
    return `${prefix}${openingTag}${body}${suffix}`;
};

/**
 * Make an SVG portable after editing on NGVGE's unbounded presentation workspace.
 *
 * SVG-Edit's live svgcontent viewport is deliberately NOT the editing boundary. Objects may
 * therefore sit at negative coordinates or beyond the original document width/height. Before
 * the Working Copy is handed back to Resource review, clone the serialized SVG, translate only
 * renderable root children into a zero-based tight artwork viewport, and leave definitions and
 * metadata at the SVG root. This never mutates the live SVG-Edit document/history.
 *
 * @param {string} svgText canonical SVG text returned by SVG-Edit
 * @param {?object} bounds stroked artwork bounds in SVG document coordinates
 * @returns {{text: string, viewport: {width: number, height: number}, sourceOrigin: {x: number, y: number}, normalized: boolean}}
 */
const normalizeSvgToArtworkBounds = (svgText, bounds) => {
    const fallbackViewport = deriveSvgViewport(svgText);
    if (!isFiniteArtworkBounds(bounds)) {
        return Object.freeze({
            text: svgText,
            viewport: Object.freeze(fallbackViewport),
            sourceOrigin: Object.freeze({x: 0, y: 0}),
            normalized: false
        });
    }

    const Parser = typeof DOMParser === 'function' ? DOMParser : null;
    const Serializer = typeof XMLSerializer === 'function' ? XMLSerializer : null;
    if (!Parser || !Serializer) {
        // Node-based conformance/unit hosts do not necessarily expose browser DOMParser. Keep
        // export behavior deterministic there as well. The browser path below is more surgical
        // (defs/title/style stay at the SVG root); this fallback wraps the root body as one visual
        // group, which preserves rendered geometry and avoids silently dropping off-canvas art.
        const fallbackText = normalizeSvgTextWithoutDom(svgText, {
            x: Number(bounds.x),
            y: Number(bounds.y),
            width: Number(bounds.width),
            height: Number(bounds.height)
        });
        if (!fallbackText) {
            return Object.freeze({
                text: svgText,
                viewport: Object.freeze(fallbackViewport),
                sourceOrigin: Object.freeze({x: 0, y: 0}),
                normalized: false
            });
        }
        return Object.freeze({
            text: fallbackText,
            viewport: Object.freeze({width: Number(bounds.width), height: Number(bounds.height)}),
            sourceOrigin: Object.freeze({x: Number(bounds.x), y: Number(bounds.y)}),
            normalized: true
        });
    }

    const documentNode = new Parser().parseFromString(svgText, 'image/svg+xml');
    const parserError = documentNode && documentNode.querySelector && documentNode.querySelector('parsererror');
    const root = documentNode && documentNode.documentElement;
    if (parserError || !root || String(root.localName || root.nodeName).toLowerCase() !== 'svg') {
        throw makeVectorTransferError(
            'NGVGE_PAINT_SVG_EDIT_EXPORT_INVALID',
            'Unable to normalize SVG-Edit export because the serialized SVG is not valid XML.'
        );
    }

    const normalizedBounds = {
        x: Number(bounds.x),
        y: Number(bounds.y),
        width: Number(bounds.width),
        height: Number(bounds.height)
    };
    const width = formatSvgNumber(normalizedBounds.width);
    const height = formatSvgNumber(normalizedBounds.height);
    root.setAttribute('width', width);
    root.setAttribute('height', height);
    root.setAttribute('viewBox', `0 0 ${width} ${height}`);
    root.removeAttribute('x');
    root.removeAttribute('y');

    const needsTranslation = Math.abs(normalizedBounds.x) > 1e-9 || Math.abs(normalizedBounds.y) > 1e-9;
    if (needsTranslation) {
        const renderableChildren = Array.from(root.children || []).filter(child =>
            !NON_RENDERING_ROOT_ELEMENTS.has(String(child.localName || child.nodeName || '').toLowerCase())
        );
        if (renderableChildren.length) {
            const group = documentNode.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.setAttribute('data-ngvge-export-normalized', 'true');
            group.setAttribute(
                'transform',
                `translate(${formatSvgNumber(-normalizedBounds.x)} ${formatSvgNumber(-normalizedBounds.y)})`
            );
            root.insertBefore(group, renderableChildren[0]);
            renderableChildren.forEach(child => group.appendChild(child));
        }
    }

    return Object.freeze({
        text: new Serializer().serializeToString(root),
        viewport: Object.freeze({
            width: normalizedBounds.width,
            height: normalizedBounds.height
        }),
        sourceOrigin: Object.freeze({x: normalizedBounds.x, y: normalizedBounds.y}),
        normalized: true
    });
};

const deriveSvgViewport = (svgText, fallback = {width: 480, height: 360}) => {
    if (typeof svgText !== 'string') return {...fallback};
    const rootMatch = svgText.match(/<svg\b([^>]*)>/i);
    const attrs = rootMatch ? rootMatch[1] : '';
    const widthMatch = attrs.match(/\bwidth\s*=\s*["']([^"']+)["']/i);
    const heightMatch = attrs.match(/\bheight\s*=\s*["']([^"']+)["']/i);
    const width = parseDimension(widthMatch && widthMatch[1]);
    const height = parseDimension(heightMatch && heightMatch[1]);
    if (width && height) return {width, height};
    const viewBoxMatch = attrs.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
    if (viewBoxMatch) {
        const values = viewBoxMatch[1].trim()
            .split(/[\s,]+/)
            .map(Number);
        if (values.length === 4 && values.every(Number.isFinite) && values[2] > 0 && values[3] > 0) {
            return {width: values[2], height: values[3]};
        }
    }
    return {...fallback};
};

const createSvgEditVectorTransferFromWorkingCopy = workingCopy => {
    const svgText = getSvgWorkingCopyText(workingCopy);
    const documentId = makeDocumentId(workingCopy.resourceId);
    const viewport = deriveSvgViewport(svgText);
    return normalizePaintBackendTransfer({
        schemaId: PAINT_BACKEND_TRANSFER_SCHEMA_ID,
        schemaVersion: PAINT_BACKEND_TRANSFER_SCHEMA_VERSION,
        document: {
            schemaId: VECTOR_ART_DOCUMENT_SCHEMA_ID,
            schemaVersion: VECTOR_ART_DOCUMENT_SCHEMA_VERSION,
            documentId,
            resourceId: workingCopy.resourceId,
            viewport,
            sourceFormat: 'svg'
        },
        contentEntries: [{
            semanticId: documentId,
            role: 'document-source',
            dataFormat: 'svg',
            content: {kind: 'svg-text', text: svgText}
        }],
        activeTarget: {}
    });
};

const createWorkingCopyEditFromSvgEditTransfer = (transfer, metadata = {}) => {
    const normalized = normalizePaintBackendTransfer(transfer);
    if (normalized.document.schemaId !== VECTOR_ART_DOCUMENT_SCHEMA_ID) {
        throw new TypeError('SVG-Edit export must contain a VectorArtDocument.');
    }
    const source = normalized.contentEntries[0];
    const metadataRotationCenterX = Number(metadata.rotationCenterX);
    const metadataRotationCenterY = Number(metadata.rotationCenterY);
    return Object.freeze({
        dataFormat: 'svg',
        bitmapResolution: 1,
        rotationCenterX: Number.isFinite(metadataRotationCenterX) ?
            metadataRotationCenterX : normalized.document.viewport.width / 2,
        rotationCenterY: Number.isFinite(metadataRotationCenterY) ?
            metadataRotationCenterY : normalized.document.viewport.height / 2,
        content: {kind: 'svg-text', text: source.content.text}
    });
};

export {
    SVG_EDIT_VECTOR_TRANSFER_ADAPTER_ID,
    decodeSvgDataUri,
    getSvgWorkingCopyText,
    deriveSvgViewport,
    normalizeSvgToArtworkBounds,
    createSvgEditVectorTransferFromWorkingCopy,
    createWorkingCopyEditFromSvgEditTransfer
};
