const PORTABLE_PROJECT_FILES_FORMAT = 'ngvge.vm-project-files';
const PORTABLE_PROJECT_FILES_VERSION = 2;

const createPortableProjectFilesError = (code, message, ErrorClass = Error) => {
    const error = new ErrorClass(message);
    error.code = code;
    return error;
};

const encodeBase64Bytes = bytes => {
    if (!(bytes instanceof Uint8Array)) {
        throw createPortableProjectFilesError(
            'PORTABLE_PROJECT_BYTES_REQUIRED',
            'Portable project encoding requires Uint8Array bytes.',
            TypeError
        );
    }
    if (typeof btoa === 'function') {
        let binary = '';
        const chunkSize = 0x8000;
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
        }
        return btoa(binary);
    }
    if (typeof globalThis !== 'undefined' && globalThis.Buffer) {
        return globalThis.Buffer.from(bytes).toString('base64');
    }
    throw createPortableProjectFilesError(
        'PORTABLE_PROJECT_BASE64_UNAVAILABLE',
        'This environment does not provide base64 encoding support.'
    );
};

const decodeBase64Bytes = base64 => {
    if (typeof base64 !== 'string') {
        throw createPortableProjectFilesError(
            'PORTABLE_PROJECT_BASE64_REQUIRED',
            'Portable project file data must be a base64 string.',
            TypeError
        );
    }
    if (typeof atob === 'function') {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
        return bytes;
    }
    if (typeof globalThis !== 'undefined' && globalThis.Buffer) {
        return new Uint8Array(globalThis.Buffer.from(base64, 'base64'));
    }
    throw createPortableProjectFilesError(
        'PORTABLE_PROJECT_BASE64_UNAVAILABLE',
        'This environment does not provide base64 decoding support.'
    );
};

const encodeUTF8 = value => {
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(String(value));
    if (typeof globalThis !== 'undefined' && globalThis.Buffer) {
        return new Uint8Array(globalThis.Buffer.from(String(value), 'utf8'));
    }
    throw createPortableProjectFilesError('PORTABLE_PROJECT_UTF8_UNAVAILABLE', 'UTF-8 encoding is unavailable.');
};

const decodeUTF8 = bytes => {
    if (typeof TextDecoder === 'function') return new TextDecoder().decode(bytes);
    if (typeof globalThis !== 'undefined' && globalThis.Buffer) {
        return globalThis.Buffer.from(bytes).toString('utf8');
    }
    throw createPortableProjectFilesError('PORTABLE_PROJECT_UTF8_UNAVAILABLE', 'UTF-8 decoding is unavailable.');
};

const toUint8Array = async (value, fileName = 'project file') => {
    if (typeof value === 'string') return encodeUTF8(value);
    if (value instanceof Uint8Array) return new Uint8Array(value);
    if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
        return new Uint8Array(value.slice(0));
    }
    if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(value)) {
        const start = value.byteOffset;
        const end = value.byteOffset + value.byteLength;
        return new Uint8Array(value.buffer.slice(start, end));
    }
    if (typeof Blob !== 'undefined' && value instanceof Blob) {
        return new Uint8Array(await value.arrayBuffer());
    }
    throw createPortableProjectFilesError(
        'PORTABLE_PROJECT_FILE_DATA_UNSUPPORTED',
        `Unsupported project file data for "${fileName}".`,
        TypeError
    );
};

const normalizeFileRecords = files => {
    if (!Array.isArray(files)) {
        throw createPortableProjectFilesError(
            'PORTABLE_PROJECT_FILES_INVALID',
            'Portable project payload files must be an array.',
            TypeError
        );
    }
    const names = new Set();
    return files.map(file => {
        if (!file || typeof file !== 'object' || typeof file.name !== 'string' || !file.name) {
            throw createPortableProjectFilesError(
                'PORTABLE_PROJECT_FILE_INVALID',
                'Portable project payload contains an invalid file record.'
            );
        }
        if (names.has(file.name)) {
            throw createPortableProjectFilesError(
                'PORTABLE_PROJECT_FILE_DUPLICATE',
                `Portable project payload contains duplicate file "${file.name}".`
            );
        }
        names.add(file.name);
        if (typeof file.data !== 'string') {
            throw createPortableProjectFilesError(
                'PORTABLE_PROJECT_FILE_DATA_INVALID',
                `Portable project file "${file.name}" does not contain base64 text.`
            );
        }
        return {data: file.data, name: file.name};
    }).sort((first, second) => first.name.localeCompare(second.name));
};

const createPortableProjectPayload = files => JSON.stringify({
    files: normalizeFileRecords(files),
    format: PORTABLE_PROJECT_FILES_FORMAT,
    version: PORTABLE_PROJECT_FILES_VERSION
});

const parsePortableProjectPayload = payload => {
    if (typeof payload !== 'string' || !payload) {
        throw createPortableProjectFilesError(
            'PORTABLE_PROJECT_PAYLOAD_INVALID',
            'Portable project payload must be a non-empty string.',
            TypeError
        );
    }
    let parsed;
    try {
        parsed = JSON.parse(payload);
    } catch (error) {
        const wrapped = createPortableProjectFilesError(
            'PORTABLE_PROJECT_PAYLOAD_JSON_INVALID',
            'Portable project payload is not valid JSON.'
        );
        wrapped.cause = error;
        throw wrapped;
    }
    if (!parsed || parsed.format !== PORTABLE_PROJECT_FILES_FORMAT || parsed.version !== PORTABLE_PROJECT_FILES_VERSION) {
        throw createPortableProjectFilesError(
            'PORTABLE_PROJECT_PAYLOAD_VERSION_UNSUPPORTED',
            'Portable project payload format/version is unsupported.'
        );
    }
    return {
        files: normalizeFileRecords(parsed.files),
        format: parsed.format,
        version: parsed.version
    };
};

const getPortableFile = (payload, fileName) => {
    const parsed = typeof payload === 'string' ? parsePortableProjectPayload(payload) : payload;
    return parsed.files.find(file => file.name === fileName) || null;
};

const readPortableTextFile = (payload, fileName) => {
    const file = getPortableFile(payload, fileName);
    if (!file) return null;
    return decodeUTF8(decodeBase64Bytes(file.data));
};

const replacePortableTextFile = (payload, fileName, text) => {
    const parsed = typeof payload === 'string' ? parsePortableProjectPayload(payload) : payload;
    const data = encodeBase64Bytes(encodeUTF8(text));
    let replaced = false;
    const files = parsed.files.map(file => {
        if (file.name !== fileName) return file;
        replaced = true;
        return {data, name: file.name};
    });
    if (!replaced) files.push({data, name: fileName});
    return createPortableProjectPayload(files);
};

const getPortablePayloadByteLength = payload => encodeUTF8(payload).byteLength;

module.exports = {
    PORTABLE_PROJECT_FILES_FORMAT,
    PORTABLE_PROJECT_FILES_VERSION,
    createPortableProjectFilesError,
    createPortableProjectPayload,
    decodeBase64Bytes,
    decodeUTF8,
    encodeBase64Bytes,
    encodeUTF8,
    getPortableFile,
    getPortablePayloadByteLength,
    parsePortableProjectPayload,
    readPortableTextFile,
    replacePortableTextFile,
    toUint8Array
};
