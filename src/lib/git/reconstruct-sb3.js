/**
 * Reconstruct SB3 from working tree directory structure
 * Parses scripts from XML, loads assets, and builds a valid SB3 project
 */

import JSZip from '@turbowarp/jszip';
import sb3Serialization from 'scratch-vm/src/serialization/sb3';

const sanitizePathPart = name => {
    if (!name || typeof name !== 'string') {
        return 'unnamed';
    }
    
    return String(name)
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\.+$/g, '')
        .trim() || 'unnamed';
};

const validateWorkingTreeAssetPath = (filePath, expectedDirectory) => {
    if (!filePath || typeof filePath !== 'string') {
        throw new Error(`Invalid ${expectedDirectory} asset path`);
    }

    const normalized = filePath.replace(/\\/g, '/');
    const segments = normalized.split('/');
    if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized) ||
        segments.some(segment => segment === '..') || segments[0] !== expectedDirectory) {
        throw new Error(`Asset path escapes ${expectedDirectory} directory: ${filePath}`);
    }

    return normalized;
};

/**
 * Generate a unique block ID
 * @returns {string}
 */
let blockIdCounter = 0;
const generateBlockId = () => {
    blockIdCounter++;
    const random = Math.floor(Math.random() * 0xFFFFFF).toString(16)
        .padStart(6, '0');
    return `b${Date.now().toString(36)}${random}`;
};

/**
 * Parse mutation element
 * @param {Element} node - Mutation DOM element
 * @returns {object}
 */
const getElementChildren = node => {
    if (!node) return [];
    if (node.children) return Array.from(node.children);
    if (!node.childNodes) return [];
    return Array.from(node.childNodes).filter(child => child && (child.tagName || child.nodeType === 1));
};

const parseMutation = node => {
    if (!node || !node.tagName) {
        return null;
    }

    const mutation = {
        tagName: node.tagName.toLowerCase(),
        children: []
    };

    if (node.attributes) {
        for (let i = 0; i < node.attributes.length; i++) {
            const attr = node.attributes[i];
            if (attr.name === 'xmlns') continue;
            if (attr.name.toLowerCase() === 'blockinfo') {
                mutation.blockInfo = JSON.parse(attr.value);
            } else {
                mutation[attr.name] = attr.value;
            }
        }
    }

    mutation.children = getElementChildren(node).map(parseMutation).filter(Boolean);
    return mutation;
};

/**
 * Extract block structure from XML using DOMParser
 * @param {string} xml - XML string for blocks
 * @returns {object} Blocks structure {blockId: {opcode, inputs, fields, children...}}
 */
const parseScriptFromXML = xml => {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');
        const blocks = {};
        const comments = {};

        if (!doc) {
            throw new Error('DOMParser returned no document');
        }

        const parserErrors = typeof doc.getElementsByTagName === 'function' ?
            doc.getElementsByTagName('parsererror') : [];
        if (parserErrors && parserErrors.length > 0) {
            const diagnostic = parserErrors[0].textContent || 'Malformed XML';
            throw new Error(`Malformed XML: ${diagnostic}`);
        }

        const processNode = (node, parentId = null, forcedId = null) => {
            if (!node || !node.tagName) return null;

            const tagName = node.tagName.toLowerCase();

            if (tagName === 'block' || tagName === 'shadow') {
                const blockId = forcedId || node.getAttribute('id') || generateBlockId();
                const opcode = node.getAttribute('type') || '';

                const block = {
                    id: blockId,
                    opcode: opcode,
                    parent: parentId,
                    inputs: {},
                    fields: {},
                    next: null,
                    topLevel: parentId === null,
                    shadow: tagName === 'shadow',
                    comment: null,
                    mutation: null,
                    x: parseFloat(node.getAttribute('x') || '0'),
                    y: parseFloat(node.getAttribute('y') || '0')
                };

                if (blocks[blockId]) {
                    throw new Error(`Duplicate block id ${blockId} within XML`);
                }

                // Register before descending so recursive references resolve to
                // the same object identity/id rather than generating duplicates.
                blocks[blockId] = block;

                for (const child of getElementChildren(node)) {
                    if (!child.tagName) continue;

                    const childName = child.tagName.toLowerCase();

                    if (childName === 'field') {
                        const fieldName = child.getAttribute('name');
                        const fieldId = child.getAttribute('id');
                        const fieldData = child.textContent || '';

                        block.fields[fieldName] = {
                            name: fieldName,
                            id: fieldId,
                            value: fieldData,
                            variableType: child.getAttribute('variabletype') || undefined
                        };
                    } else if (childName === 'mutation') {
                        block.mutation = parseMutation(child);
                    } else if (childName === 'comment') {
                        const commentId = child.getAttribute('id');
                        if (!commentId) {
                            throw new Error(`Comment attached to block ${blockId} has no id`);
                        }
                        if (comments[commentId]) {
                            throw new Error(`Duplicate comment id ${commentId} within XML`);
                        }
                        block.comment = commentId;
                        comments[commentId] = {
                            blockId: child.getAttribute('pinned') === 'true' ? blockId : null,
                            x: parseFloat(child.getAttribute('x') || '0'),
                            y: parseFloat(child.getAttribute('y') || '0'),
                            width: parseFloat(child.getAttribute('w') || '100'),
                            height: parseFloat(child.getAttribute('h') || '100'),
                            minimized: child.getAttribute('minimized') === 'true',
                            text: child.textContent || ''
                        };
                    } else if (childName === 'value' || childName === 'statement') {
                        const inputName = child.getAttribute('name');
                        let childBlockNode = null;
                        let childShadowNode = null;

                        for (const grandChild of getElementChildren(child)) {
                            if (!grandChild.tagName) continue;

                            const gcName = grandChild.tagName.toLowerCase();
                            if (gcName === 'block') {
                                childBlockNode = grandChild;
                            } else if (gcName === 'shadow') {
                                childShadowNode = grandChild;
                            }
                        }

                        if (childShadowNode && !childBlockNode) {
                            childBlockNode = childShadowNode;
                        }

                        const blockInputId = childBlockNode ?
                            (childBlockNode.getAttribute('id') || generateBlockId()) : null;
                        const shadowInputId = childShadowNode ?
                            (childShadowNode === childBlockNode ? blockInputId :
                                (childShadowNode.getAttribute('id') || generateBlockId())) : null;

                        if (childBlockNode) {
                            block.inputs[inputName] = {
                                name: inputName,
                                block: blockInputId,
                                shadow: shadowInputId
                            };

                            processNode(childBlockNode, blockId, blockInputId);
                        }

                        if (childShadowNode && childShadowNode !== childBlockNode) {
                            processNode(childShadowNode, blockId, shadowInputId);
                        }
                    } else if (childName === 'next') {
                        for (const grandChild of getElementChildren(child)) {
                            if (!grandChild.tagName) continue;

                            const gcName = grandChild.tagName.toLowerCase();
                            if (gcName === 'block' || gcName === 'shadow') {
                                const nextId = grandChild.getAttribute('id') || generateBlockId();
                                block.next = nextId;
                                processNode(grandChild, blockId, nextId);
                                break;
                            }
                        }
                    }
                }

                return blockId;
            }

            if (tagName === 'xml') {
                for (const child of getElementChildren(node)) {
                    processNode(child, parentId);
                }
            }
            return null;
        };

        const roots = getElementChildren(doc);
        if (roots.length === 0 && doc.documentElement) {
            processNode(doc.documentElement);
        } else {
            for (const child of roots) {
                processNode(child);
            }
        }

        return {blocks, comments};
    } catch (e) {
        throw new Error(`Failed to parse XML: ${e.message}`);
    }
};

export const parseBlocksFromXML = xml => parseScriptFromXML(xml).blocks;

/**
 * Read file from filesystem
 * @param {object} pfs - Promisified filesystem
 * @param {string} filePath - Path to file
 * @returns {Promise<Uint8Array>}
 */
const readFile = async (pfs, filePath) => {
    if (!pfs || !filePath) {
        throw new Error('Invalid filesystem or file path');
    }

    try {
        const data = await pfs.readFile(filePath);
        return data instanceof Uint8Array ? data : new Uint8Array(data);
    } catch (e) {
        throw new Error(`Failed to read file ${filePath}: ${e.message}`);
    }
};

/**
 * Read text file from filesystem
 * @param {object} pfs - Promisified filesystem
 * @param {string} filePath - Path to file
 * @returns {Promise<string>}
 */
const readTextFile = async (pfs, filePath) => {
    const data = await readFile(pfs, filePath);
    return new TextDecoder().decode(data);
};

/**
 * List directory contents
 * @param {object} pfs - Promisified filesystem
 * @param {string} dirPath - Directory path
 * @returns {Promise<string[]>}
 */
const readDirectory = async (pfs, dirPath) => {
    if (!pfs || !dirPath) {
        throw new Error('Invalid filesystem or directory path');
    }

    try {
        return await pfs.readdir(dirPath);
    } catch (e) {
        if (e.code === 'ENOENT') {
            return [];
        }
        throw e;
    }
};

/**
 * Compute MD5-like hash of data (fallback for environments without crypto)
 * @param {Uint8Array} data - Data to hash
 * @returns {Promise<string>}
 */
const computeMD5 = async data => {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        try {
            const hashBuffer = await crypto.subtle.digest('MD5', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) {
            // Fall through to simple hash
        }
    }

    // Simple FNV-1a hash (not cryptographically secure but works for asset IDs)
    let hash = 2166136261;
    for (let i = 0; i < data.length; i++) {
        hash ^= data[i];
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(32, '0')
        .slice(0, 32);
};

/**
 * Read sprite metadata from index.json
 * @param {object} pfs - Filesystem
 * @param {string} spriteDir - Sprite directory path
 * @returns {Promise<object>}
 */
export const readSpriteIndex = async (pfs, spriteDir) => {
    const indexPath = `${spriteDir}/index.json`;
    try {
        const content = await readTextFile(pfs, indexPath);
        return JSON.parse(content);
    } catch (e) {
        throw new Error(`Failed to read sprite index at ${indexPath}: ${e.message}`);
    }
};

/**
 * Read and parse all script XML files for a sprite
 * @param {object} pfs - Filesystem
 * @param {string} spriteDir - Sprite directory path
 * @returns {Promise<{blocks: object, blockCount: number}>}
 */
export const readSpriteScripts = async (pfs, spriteDir) => {
    const scriptsDir = `${spriteDir}/scripts`;
    const allBlocks = {};
    const allComments = {};
    let blockCount = 0;

    try {
        const scriptFiles = await readDirectory(pfs, scriptsDir);
        const xmlFiles = scriptFiles.filter(f => f.endsWith('.xml'));

        for (const xmlFile of xmlFiles) {
            const scriptPath = `${scriptsDir}/${xmlFile}`;
            let scriptData;
            try {
                const xmlContent = await readTextFile(pfs, scriptPath);
                scriptData = parseScriptFromXML(xmlContent);
            } catch (e) {
                throw new Error(`Failed to parse script ${scriptPath}: ${e.message}`);
            }

            for (const [blockId, block] of Object.entries(scriptData.blocks)) {
                if (allBlocks[blockId]) {
                    throw new Error(`Duplicate block id ${blockId} across script files in ${scriptsDir}`);
                }
                allBlocks[blockId] = block;
                blockCount++;
            }

            for (const [commentId, comment] of Object.entries(scriptData.comments)) {
                if (allComments[commentId]) {
                    throw new Error(`Duplicate comment id ${commentId} across script files in ${scriptsDir}`);
                }
                allComments[commentId] = comment;
            }
        }
    } catch (e) {
        if (e && e.code === 'ENOENT') {
            return {blocks: allBlocks, comments: allComments, blockCount};
        }
        throw e;
    }

    return {blocks: allBlocks, comments: allComments, blockCount};
};

/**
 * Read costume files for a sprite
 * @param {object} pfs - Filesystem
 * @param {string} spriteDir - Sprite directory path
 * @returns {Promise<Array<{name, file, dataFormat, data, dataExt}>>}
 */
export const readSpriteCostumes = async (pfs, spriteDir, costumeIndex = null) => {
    const costumesDir = `${spriteDir}/costumes`;
    let descriptors;

    if (Array.isArray(costumeIndex)) {
        descriptors = costumeIndex.map(entry => ({...entry}));
    } else {
        const costumeFiles = await readDirectory(pfs, costumesDir);
        descriptors = costumeFiles.map(file => ({file: `costumes/${file}`}));
    }

    const costumes = [];
    for (const descriptor of descriptors) {
        const relativeFile = validateWorkingTreeAssetPath(descriptor.file, 'costumes');
        const filePath = `${spriteDir}/${relativeFile}`;
        const data = await readFile(pfs, filePath);
        const filename = relativeFile.split('/').pop();
        const ext = descriptor.dataFormat || filename.split('.').pop().toLowerCase();
        const fallbackName = filename.replace(new RegExp(`\\.${ext}$`, 'i'), '');

        costumes.push({
            name: descriptor.name || fallbackName,
            file: relativeFile,
            dataFormat: ext,
            data: data,
            dataExt: ext,
            assetId: null,
            md5ext: null
        });
    }

    return costumes;
};

/**
 * Read sound files for a sprite
 * @param {object} pfs - Filesystem
 * @param {string} spriteDir - Sprite directory path
 * @returns {Promise<Array<{name, file, dataFormat, data}>>}
 */
export const readSpriteSounds = async (pfs, spriteDir, soundIndex = null) => {
    const soundsDir = `${spriteDir}/sounds`;
    let descriptors;

    if (Array.isArray(soundIndex)) {
        descriptors = soundIndex.map(entry => ({...entry}));
    } else {
        const soundFiles = await readDirectory(pfs, soundsDir);
        descriptors = soundFiles.map(file => ({file: `sounds/${file}`}));
    }

    const sounds = [];
    for (const descriptor of descriptors) {
        const relativeFile = validateWorkingTreeAssetPath(descriptor.file, 'sounds');
        const filePath = `${spriteDir}/${relativeFile}`;
        const data = await readFile(pfs, filePath);
        const filename = relativeFile.split('/').pop();
        const ext = descriptor.dataFormat || filename.split('.').pop().toLowerCase();
        const fallbackName = filename.replace(new RegExp(`\\.${ext}$`, 'i'), '');

        let sampleCount = descriptor.sampleCount !== undefined ? descriptor.sampleCount : null;
        let rate = descriptor.rate !== undefined ? descriptor.rate : null;

        if (ext === 'wav' && (sampleCount === null || rate === null)) {
            const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
            if (data.byteLength >= 28 && view.getUint32(0, true) === 0x46464952) {
                if (rate === null) rate = view.getUint32(24, true);
                if (sampleCount === null) sampleCount = data.byteLength / 2;
            }
        }

        sounds.push({
            name: descriptor.name || fallbackName,
            file: relativeFile,
            dataFormat: ext,
            data: data,
            sampleCount,
            rate,
            assetId: null,
            md5ext: null
        });
    }

    return sounds;
};

/**
 * Build target object from working tree sprite directory
 * @param {object} pfs - Filesystem
 * @param {string} spriteDir - Sprite directory path
 * @returns {Promise<object>}
 */
export const buildTargetFromWorkingTree = async (pfs, spriteDir) => {
    const spriteName = sanitizePathPart(spriteDir.split('/').pop());

    const index = await readSpriteIndex(pfs, spriteDir);
    const [scriptsData, costumes, sounds] = await Promise.all([
        readSpriteScripts(pfs, spriteDir),
        readSpriteCostumes(pfs, spriteDir, index.costumes),
        readSpriteSounds(pfs, spriteDir, index.sounds)
    ]);

    const target = {
        isStage: index.isStage || false,
        name: index.name || spriteName,
        variables: index.variables || {},
        lists: index.lists || {},
        broadcasts: index.broadcasts || {},
        blocks: scriptsData.blocks,
        comments: scriptsData.comments,
        currentCostume: index.currentCostume || 0,
        costumes: costumes.map((c, i) => {
            const indexCostume = index.costumes && index.costumes[i] ? index.costumes[i] : {};
            return {
                name: indexCostume.name || c.name,
                file: c.file,
                bitmapResolution: indexCostume.bitmapResolution !== undefined ?
                    indexCostume.bitmapResolution : (c.dataFormat === 'svg' ? 1 : 2),
                layerOrder: indexCostume.layerOrder,
                rotationCenterX: indexCostume.rotationCenterX !== undefined ? indexCostume.rotationCenterX : 0.5,
                rotationCenterY: indexCostume.rotationCenterY !== undefined ? indexCostume.rotationCenterY : 0.5,
                dataFormat: c.dataFormat,
                assetId: c.assetId,
                md5ext: c.md5ext,
                skinId: i
            };
        }),
        sounds: sounds.map((s, i) => {
            const indexSound = index.sounds && index.sounds[i] ? index.sounds[i] : {};
            return {
                name: indexSound.name || s.name,
                file: s.file,
                dataFormat: s.dataFormat,
                format: s.dataFormat,
                assetId: s.assetId,
                md5ext: s.md5ext,
                rate: indexSound.rate !== undefined ? indexSound.rate : (s.rate || 44100),
                sampleCount: indexSound.sampleCount !== undefined ? indexSound.sampleCount : s.sampleCount,
                soundId: i
            };
        }),
        volume: index.volume !== undefined ? index.volume : 100,
        layerOrder: index.layerOrder || 0,
        visible: index.visible !== undefined ? index.visible : true,
        x: index.x !== undefined ? index.x : 0,
        y: index.y !== undefined ? index.y : 0,
        size: index.size !== undefined ? index.size : 100,
        direction: index.direction !== undefined ? index.direction : 90,
        draggable: index.draggable !== undefined ? index.draggable : false,
        rotationStyle: index.rotationStyle !== undefined ? index.rotationStyle : 'all around',
        sayThreshold: index.sayThreshold || 10,
        thinkThreshold: index.thinkThreshold || 10,
        tempo: index.tempo !== undefined ? index.tempo : 60,
        videoTransparency: index.videoTransparency !== undefined ? index.videoTransparency : 50,
        videoState: index.videoState || 'on',
        textToSpeechLanguage: index.textToSpeechLanguage || null
    };

    return target;
};

/**
 * Reconstruct SB3 from working tree directory
 * @param {object} fs - Filesystem
 * @param {string} dir - Repository directory
 * @param {object} options - Options
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<ArrayBuffer>}
 */
export const reconstructSb3FromWorkingTree = async ({fs, dir, onProgress}) => {
    if (!fs || !dir) {
        throw new Error('Filesystem and directory are required');
    }

    const pfs = fs.promises;
    const zip = new JSZip();
    const targets = [];

    try {
        const entries = await readDirectory(pfs, dir);
        const spriteDirs = entries.filter(e =>
            !e.startsWith('.') &&
            e !== 'project.sb3'
        ).map(e => `${dir}/${e}`);

        let processed = 0;

        if (typeof onProgress === 'function') {
            onProgress({phase: 'reading', message: 'Reading sprites...', completed: 0, total: spriteDirs.length + 2});
        }

        for (const spriteDir of spriteDirs) {
            try {
                const stat = await pfs.stat(spriteDir);
                if (!stat.isDirectory()) continue;

                const target = await buildTargetFromWorkingTree(pfs, spriteDir);
                
                for (const costume of target.costumes) {
                    if (costume.file) {
                        const costumeFile = await readFile(pfs, `${spriteDir}/${costume.file}`);
                        const ext = costume.dataFormat || costume.file.split('.').pop();
                        const md5 = await computeMD5(costumeFile);
                        costume.md5ext = `${md5}.${ext}`;
                        costume.assetId = md5;
                        
                        zip.file(`${md5}.${ext}`, costumeFile);
                    }
                }

                for (const sound of target.sounds) {
                    if (sound.file) {
                        const soundFile = await readFile(pfs, `${spriteDir}/${sound.file}`);
                        const ext = sound.dataFormat || sound.file.split('.').pop();
                        const md5 = await computeMD5(soundFile);
                        sound.md5ext = `${md5}.${ext}`;
                        sound.assetId = md5;
                        
                        zip.file(`${md5}.${ext}`, soundFile);
                    }
                }

                targets.push(target);

                processed++;
                if (typeof onProgress === 'function' && processed % 5 === 0) {
                    onProgress({phase: 'reading', message: `Read sprite ${target.name}...`, completed: processed, total: spriteDirs.length + 2});
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            } catch (e) {
                throw new Error(`Failed to process sprite directory ${spriteDir}: ${e.message}`);
            }
        }

        if (targets.length === 0) {
            throw new Error('No sprites found in working tree');
        }

        if (typeof onProgress === 'function') {
            onProgress({phase: 'building', message: 'Building SB3 file...', completed: processed + 1, total: processed + 2});
        }

        const reconstructedExtensions = new Set();
        const projectJson = {
            targets: targets.map(t => {
                const clean = {...t};
                const [serializedBlocks, targetExtensions] = sb3Serialization.serializeBlocks(t.blocks);
                targetExtensions.forEach(extensionId => reconstructedExtensions.add(extensionId));
                clean.blocks = serializedBlocks;
                clean.costumes = t.costumes.map(costume => {
                    const cleanCostume = {...costume};
                    delete cleanCostume.file;
                    return cleanCostume;
                });
                clean.sounds = t.sounds.map(sound => {
                    const cleanSound = {...sound};
                    delete cleanSound.file;
                    return cleanSound;
                });
                return clean;
            }),
            monitors: [],
            extensions: Array.from(reconstructedExtensions).sort(),
            meta: {
                semver: '3.0.0',
                vm: '0.2.0-prerelease',
                agent: '02Engine-GUI'
            }
        };

        zip.file('project.json', JSON.stringify(projectJson, null, 2));

        if (typeof onProgress === 'function') {
            onProgress({phase: 'finishing', message: 'Generating SB3...', completed: processed + 2, total: processed + 2});
        }

        const blob = await zip.generateAsync({
            type: 'arraybuffer',
            compression: 'DEFLATE',
            compressionOptions: {level: 6}
        });

        return blob;
    } catch (e) {
        throw new Error(`Failed to reconstruct SB3: ${e.message}`);
    }
};

/**
 * Verify the working tree structure
 * @param {object} fs - Filesystem
 * @param {string} dir - Repository directory
 * @returns {Promise<boolean>}
 */
export const verifyWorkingTree = async ({fs, dir}) => {
    try {
        const pfs = fs.promises;
        const entries = await readDirectory(pfs, dir);

        let hasSprites = false;
        for (const entry of entries) {
            if (entry.startsWith('.') || entry === 'project.sb3') continue;

            const entryPath = `${dir}/${entry}`;
            try {
                const stat = await pfs.stat(entryPath);
                if (stat.isDirectory()) {
                    hasSprites = true;

                    const indexPath = `${entryPath}/index.json`;
                    try {
                        await pfs.stat(indexPath);
                    } catch (e) {
                        return false;
                    }
                }
            } catch (e) {
                return false;
            }
        }

        return hasSprites;
    } catch (e) {
        return false;
    }
};
