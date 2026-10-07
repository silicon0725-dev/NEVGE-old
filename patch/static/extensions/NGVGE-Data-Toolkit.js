// Name: NGVGE Data Toolkit
// ID: ngvgeData
// Description: JSON paths, stable serialization, Unicode/Base64, checksums and GZIP.
// By: NGVGE Team
// License: MIT
// Clean-room implementation inspired by common data, checksum and compression extensions.

(function (Scratch) {
    'use strict';

    const Cast = Scratch.Cast;
    const BlockType = Scratch.BlockType;
    const ArgumentType = Scratch.ArgumentType;
    const encoder = new TextEncoder();
    const decoder = new TextDecoder('utf-8', {fatal: false});

    const INVALID_JSON = Symbol('invalid-json');

    const parseJSON = (value, fallback = INVALID_JSON) => {
        try {
            return JSON.parse(Cast.toString(value));
        } catch (error) {
            return fallback;
        }
    };

    const parseValue = value => {
        const text = Cast.toString(value);
        try {
            return JSON.parse(text);
        } catch (error) {
            return text;
        }
    };

    const cloneJSON = value => JSON.parse(JSON.stringify(value));

    const outputValue = value => {
        if (value === undefined || value === null) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return value;
    };

    const parsePath = value => {
        const source = Cast.toString(value).trim();
        if (!source) return [];
        const parts = [];
        let token = '';
        let index = 0;
        const pushToken = () => {
            if (token.length) {
                parts.push(token);
                token = '';
            }
        };
        while (index < source.length) {
            const char = source[index];
            if (char === '\\') {
                index++;
                if (index < source.length) token += source[index];
                index++;
                continue;
            }
            if (char === '.') {
                pushToken();
                index++;
                continue;
            }
            if (char === '[') {
                pushToken();
                index++;
                while (index < source.length && /\s/.test(source[index])) index++;
                let quote = null;
                if (source[index] === '"' || source[index] === "'") quote = source[index++];
                let content = '';
                while (index < source.length) {
                    const current = source[index];
                    if (current === '\\') {
                        index++;
                        if (index < source.length) content += source[index++];
                        continue;
                    }
                    if (quote && current === quote) {
                        index++;
                        break;
                    }
                    if (!quote && current === ']') break;
                    content += current;
                    index++;
                }
                while (index < source.length && source[index] !== ']') index++;
                if (source[index] === ']') index++;
                const trimmed = content.trim();
                parts.push(/^-?\d+$/.test(trimmed) ? Number(trimmed) : trimmed);
                continue;
            }
            token += char;
            index++;
        }
        pushToken();
        return parts;
    };

    const getAtPath = (root, path) => {
        let current = root;
        for (const part of path) {
            if (current === null || current === undefined || typeof current !== 'object') return undefined;
            current = current[part];
        }
        return current;
    };

    const ensureContainer = nextPart => typeof nextPart === 'number' ? [] : {};

    const setAtPath = (root, path, value) => {
        if (!path.length) return value;
        const output = root && typeof root === 'object' ? cloneJSON(root) : ensureContainer(path[0]);
        let current = output;
        for (let index = 0; index < path.length - 1; index++) {
            const part = path[index];
            const nextPart = path[index + 1];
            if (!current[part] || typeof current[part] !== 'object') current[part] = ensureContainer(nextPart);
            current = current[part];
        }
        current[path[path.length - 1]] = value;
        return output;
    };

    const deleteAtPath = (root, path) => {
        if (!root || typeof root !== 'object') return root;
        if (!path.length) return null;
        const output = cloneJSON(root);
        let current = output;
        for (let index = 0; index < path.length - 1; index++) {
            current = current[path[index]];
            if (!current || typeof current !== 'object') return output;
        }
        const finalPart = path[path.length - 1];
        if (Array.isArray(current) && typeof finalPart === 'number') current.splice(finalPart, 1);
        else delete current[finalPart];
        return output;
    };

    const stableValue = value => {
        if (Array.isArray(value)) return value.map(stableValue);
        if (!value || typeof value !== 'object') return value;
        const result = {};
        Object.keys(value).sort().forEach(key => {
            result[key] = stableValue(value[key]);
        });
        return result;
    };

    const bytesToBase64 = (bytes, urlSafe = false) => {
        let binary = '';
        const chunkSize = 0x8000;
        for (let index = 0; index < bytes.length; index += chunkSize) {
            const chunk = bytes.subarray(index, Math.min(index + chunkSize, bytes.length));
            binary += String.fromCharCode(...chunk);
        }
        let encoded = btoa(binary);
        if (urlSafe) encoded = encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
        return encoded;
    };

    const base64ToBytes = value => {
        let source = Cast.toString(value).trim().replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
        source = source.replace(/-/g, '+').replace(/_/g, '/');
        while (source.length % 4) source += '=';
        const binary = atob(source);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
        return bytes;
    };

    const crcTable = (() => {
        const table = new Uint32Array(256);
        for (let index = 0; index < 256; index++) {
            let value = index;
            for (let bit = 0; bit < 8; bit++) value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
            table[index] = value >>> 0;
        }
        return table;
    })();

    const crc32 = bytes => {
        let crc = 0xFFFFFFFF;
        for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
        return (crc ^ 0xFFFFFFFF) >>> 0;
    };

    const adler32 = bytes => {
        let a = 1;
        let b = 0;
        for (const byte of bytes) {
            a = (a + byte) % 65521;
            b = (b + a) % 65521;
        }
        return (((b << 16) | a) >>> 0);
    };

    const fnv1a = bytes => {
        let hash = 0x811C9DC5;
        for (const byte of bytes) {
            hash ^= byte;
            hash = Math.imul(hash, 0x01000193);
        }
        return hash >>> 0;
    };

    const hex32 = value => value.toString(16).padStart(8, '0');

    const streamTransform = async (bytes, mode) => {
        const Constructor = mode === 'compress' ? globalThis.CompressionStream : globalThis.DecompressionStream;
        if (typeof Constructor !== 'function') throw new Error(`${mode === 'compress' ? 'CompressionStream' : 'DecompressionStream'} is not supported`);
        const stream = new Blob([bytes]).stream().pipeThrough(new Constructor('gzip'));
        const result = await new Response(stream).arrayBuffer();
        return new Uint8Array(result);
    };

    class NGVGEDataToolkit {
        getInfo () {
            return {
                id: 'ngvgeData',
                name: 'NGVGE Data Toolkit',
                color1: '#F59E0B',
                color2: '#D88307',
                color3: '#A96305',
                blocks: [
                    {
                        opcode: 'isJSONValid',
                        blockType: BlockType.BOOLEAN,
                        text: 'JSON [JSON] is valid?',
                        arguments: {JSON: {type: ArgumentType.STRING, defaultValue: '{"score":10}'}}
                    },
                    {
                        opcode: 'getJSONPath',
                        blockType: BlockType.REPORTER,
                        text: 'get path [PATH] from JSON [JSON]',
                        arguments: {
                            PATH: {type: ArgumentType.STRING, defaultValue: 'player.stats.hp'},
                            JSON: {type: ArgumentType.STRING, defaultValue: '{"player":{"stats":{"hp":100}}}'}
                        }
                    },
                    {
                        opcode: 'setJSONPath',
                        blockType: BlockType.REPORTER,
                        text: 'set path [PATH] to [VALUE] in JSON [JSON]',
                        arguments: {
                            PATH: {type: ArgumentType.STRING, defaultValue: 'player.stats.hp'},
                            VALUE: {type: ArgumentType.STRING, defaultValue: '80'},
                            JSON: {type: ArgumentType.STRING, defaultValue: '{"player":{"stats":{"hp":100}}}'}
                        }
                    },
                    {
                        opcode: 'deleteJSONPath',
                        blockType: BlockType.REPORTER,
                        text: 'delete path [PATH] from JSON [JSON]',
                        arguments: {
                            PATH: {type: ArgumentType.STRING, defaultValue: 'player.stats.hp'},
                            JSON: {type: ArgumentType.STRING, defaultValue: '{"player":{"stats":{"hp":100}}}'}
                        }
                    },
                    {
                        opcode: 'stableJSON',
                        blockType: BlockType.REPORTER,
                        text: 'stable stringify JSON [JSON]',
                        arguments: {JSON: {type: ArgumentType.STRING, defaultValue: '{"b":2,"a":1}'}}
                    },
                    '---',
                    {
                        opcode: 'utf8ToBase64',
                        blockType: BlockType.REPORTER,
                        text: 'UTF-8 text [TEXT] to [MODE] Base64',
                        arguments: {
                            TEXT: {type: ArgumentType.STRING, defaultValue: 'Hello 世界'},
                            MODE: {type: ArgumentType.STRING, menu: 'base64Mode', defaultValue: 'standard'}
                        }
                    },
                    {
                        opcode: 'base64ToUtf8',
                        blockType: BlockType.REPORTER,
                        text: 'Base64 [BASE64] to UTF-8 text',
                        arguments: {BASE64: {type: ArgumentType.STRING, defaultValue: 'SGVsbG8g5LiW55WM'}}
                    },
                    {
                        opcode: 'utf8ByteLength',
                        blockType: BlockType.REPORTER,
                        text: 'UTF-8 byte length of [TEXT]',
                        arguments: {TEXT: {type: ArgumentType.STRING, defaultValue: 'Hello 世界'}}
                    },
                    {
                        opcode: 'checksum',
                        blockType: BlockType.REPORTER,
                        text: '[ALGORITHM] checksum of [TEXT]',
                        arguments: {
                            ALGORITHM: {type: ArgumentType.STRING, menu: 'checksumMenu', defaultValue: 'crc32'},
                            TEXT: {type: ArgumentType.STRING, defaultValue: 'NGVGE'}
                        }
                    },
                    '---',
                    {
                        opcode: 'compressionSupported',
                        blockType: BlockType.BOOLEAN,
                        text: 'GZIP compression supported?'
                    },
                    {
                        opcode: 'gzipCompress',
                        blockType: BlockType.REPORTER,
                        text: 'GZIP compress text [TEXT] to Base64',
                        arguments: {TEXT: {type: ArgumentType.STRING, defaultValue: 'NGVGE data'}}
                    },
                    {
                        opcode: 'gzipDecompress',
                        blockType: BlockType.REPORTER,
                        text: 'GZIP decompress Base64 [BASE64] to text',
                        arguments: {BASE64: {type: ArgumentType.STRING, defaultValue: ''}}
                    }
                ],
                menus: {
                    base64Mode: {
                        acceptReporters: true,
                        items: [
                            {text: 'standard', value: 'standard'},
                            {text: 'URL-safe', value: 'url'}
                        ]
                    },
                    checksumMenu: {
                        acceptReporters: true,
                        items: [
                            {text: 'CRC32', value: 'crc32'},
                            {text: 'Adler-32', value: 'adler32'},
                            {text: 'FNV-1a', value: 'fnv1a'}
                        ]
                    }
                }
            };
        }

        isJSONValid (args) {
            try {
                JSON.parse(Cast.toString(args.JSON));
                return true;
            } catch (error) {
                return false;
            }
        }

        getJSONPath (args) {
            const root = parseJSON(args.JSON);
            if (root === INVALID_JSON) return '';
            return outputValue(getAtPath(root, parsePath(args.PATH)));
        }

        setJSONPath (args) {
            const root = parseJSON(args.JSON, {});
            return JSON.stringify(setAtPath(root, parsePath(args.PATH), parseValue(args.VALUE)));
        }

        deleteJSONPath (args) {
            const root = parseJSON(args.JSON, {});
            return JSON.stringify(deleteAtPath(root, parsePath(args.PATH)));
        }

        stableJSON (args) {
            const root = parseJSON(args.JSON);
            if (root === INVALID_JSON) return '';
            return JSON.stringify(stableValue(root));
        }

        utf8ToBase64 (args) {
            return bytesToBase64(encoder.encode(Cast.toString(args.TEXT)), Cast.toString(args.MODE) === 'url');
        }

        base64ToUtf8 (args) {
            try {
                return decoder.decode(base64ToBytes(args.BASE64));
            } catch (error) {
                return '';
            }
        }

        utf8ByteLength (args) {
            return encoder.encode(Cast.toString(args.TEXT)).length;
        }

        checksum (args) {
            const bytes = encoder.encode(Cast.toString(args.TEXT));
            const algorithm = Cast.toString(args.ALGORITHM).toLowerCase();
            if (algorithm === 'adler32') return hex32(adler32(bytes));
            if (algorithm === 'fnv1a') return hex32(fnv1a(bytes));
            return hex32(crc32(bytes));
        }

        compressionSupported () {
            return typeof globalThis.CompressionStream === 'function' && typeof globalThis.DecompressionStream === 'function';
        }

        async gzipCompress (args) {
            try {
                const compressed = await streamTransform(encoder.encode(Cast.toString(args.TEXT)), 'compress');
                return bytesToBase64(compressed);
            } catch (error) {
                return `ERROR: ${error.message}`;
            }
        }

        async gzipDecompress (args) {
            try {
                const decompressed = await streamTransform(base64ToBytes(args.BASE64), 'decompress');
                return decoder.decode(decompressed);
            } catch (error) {
                return `ERROR: ${error.message}`;
            }
        }
    }

    Scratch.extensions.register(new NGVGEDataToolkit());
})(Scratch);
