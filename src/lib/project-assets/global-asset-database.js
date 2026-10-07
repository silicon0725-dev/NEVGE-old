import {sanitizeSvg} from '@turbowarp/scratch-svg-renderer';
import {loadCostumeFromAsset} from 'scratch-vm/src/import/load-costume';
import {getInspectorRegistry} from '../project-inspector/inspector-registry';
import {installProjectLifecycleHost} from '../project-lifecycle';
import {
    STABLE_ID_KINDS,
    createStableIdentity,
    isStableIdentity
} from '../../core/identity/stable-identity';
import {
    decodePortableImageContentToBytes,
    normalizePortableImageContent
} from './image-content-payload';

const DATABASE_PROPERTY = 'ngvgeGlobalAssetDatabase';
const DATABASE_SECTION_ID = 'ngvge-global-assets';
const DATABASE_VERSION = 3;
const COSTUME_BINDING_PROPERTY = '__ngvgeGlobalAssetId';
const SOUND_BINDING_PROPERTY = '__ngvgeGlobalSoundAssetId';
const LIFECYCLE_HOOK_ID = 'ngvge.project-lifecycle.global-assets@1';
const MAX_HISTORY_LENGTH = 100;

let fallbackId = 0;

const createOpaqueIdentityToken = () => {
    if (
        typeof globalThis !== 'undefined' &&
        globalThis.crypto &&
        typeof globalThis.crypto.randomUUID === 'function'
    ) {
        return globalThis.crypto.randomUUID();
    }
    fallbackId += 1;
    return `legacy${Date.now().toString(36)}${fallbackId.toString(36)}${Math.random().toString(36).slice(2, 10)}`;
};

const createResourceId = () => createStableIdentity(STABLE_ID_KINDS.RESOURCE, createOpaqueIdentityToken);

const normalizeResourceId = value => (
    isStableIdentity(value, STABLE_ID_KINDS.RESOURCE) ? value : createResourceId()
);

const createId = prefix => {
    if (
        typeof globalThis !== 'undefined' &&
        globalThis.crypto &&
        typeof globalThis.crypto.randomUUID === 'function'
    ) {
        return `${prefix}:${globalThis.crypto.randomUUID()}`;
    }
    fallbackId += 1;
    return `${prefix}:${Date.now().toString(36)}:${fallbackId.toString(36)}`;
};

const getOriginalTargets = runtime => (
    runtime && Array.isArray(runtime.targets) ?
        runtime.targets.filter(target => target && target.isOriginal) : []
);

const getCostumes = target => (
    target && typeof target.getCostumes === 'function' ?
        target.getCostumes() :
        (target && target.sprite && Array.isArray(target.sprite.costumes) ? target.sprite.costumes : [])
);

const getSounds = target => (
    target && typeof target.getSounds === 'function' ?
        target.getSounds() :
        (target && target.sprite && Array.isArray(target.sprite.sounds) ? target.sprite.sounds : [])
);

const getItems = (target, kind) => kind === 'sound' ? getSounds(target) : getCostumes(target);

const getCurrentCostume = target => {
    const costumes = getCostumes(target);
    const index = target && Number.isInteger(target.currentCostume) ? target.currentCostume : 0;
    return costumes[index] || null;
};

const getMd5ext = item => {
    if (!item) return '';
    return item.md5 || item.md5ext || (
        item.assetId && item.dataFormat ? `${item.assetId}.${item.dataFormat}` : ''
    );
};

const getRuntimeAsset = item => {
    if (!item) return null;
    if (item.asset) return item.asset;
    if (item.broken && item.broken.asset) return item.broken.asset;
    return null;
};

const getBindingProperty = kind => kind === 'sound' ? SOUND_BINDING_PROPERTY : COSTUME_BINDING_PROPERTY;

const sanitizeName = (name, kind = 'costume') => {
    const value = typeof name === 'string' ? name.trim() : '';
    if (value) return value;
    return kind === 'sound' ? 'Global Sound' : 'Global Costume';
};

const sanitizeFolderName = name => {
    const value = typeof name === 'string' ? name.trim() : '';
    return value || 'New Folder';
};

const makeUniqueName = (name, records, ignoreId = null, kind = 'costume') => {
    const base = sanitizeName(name, kind);
    const used = new Set(
        Array.from(records.values())
            .filter(record => record.id !== ignoreId)
            .map(record => record.name)
    );
    if (!used.has(base)) return base;
    let index = 2;
    while (used.has(`${base} ${index}`)) index += 1;
    return `${base} ${index}`;
};

const makeUniqueFolderName = (name, folders, ignoreId = null) => {
    const base = sanitizeFolderName(name);
    const used = new Set(
        Array.from(folders.values())
            .filter(folder => folder.id !== ignoreId)
            .map(folder => folder.name)
    );
    if (!used.has(base)) return base;
    let index = 2;
    while (used.has(`${base} ${index}`)) index += 1;
    return `${base} ${index}`;
};

const createRecordFromCostume = (costume, name, id = createId('asset'), folderId = null) => {
    const asset = getRuntimeAsset(costume);
    const dataFormat = String(costume.dataFormat || (asset && asset.dataFormat) || '').toLowerCase();
    const assetId = costume.assetId || (asset && asset.assetId) || '';
    const md5ext = getMd5ext(costume) || (assetId && dataFormat ? `${assetId}.${dataFormat}` : '');
    if (!assetId || !dataFormat || !md5ext) {
        throw new Error('The costume has no loaded Scratch asset.');
    }
    return {
        asset,
        assetId,
        bitmapResolution: Number.isFinite(costume.bitmapResolution) ? costume.bitmapResolution : 1,
        dataFormat,
        folderId,
        id,
        kind: 'costume',
        md5ext,
        name: sanitizeName(name || costume.name, 'costume'),
        resourceId: createResourceId(),
        contentRevision: 0,
        rotationCenterX: Number.isFinite(costume.rotationCenterX) ? costume.rotationCenterX : 0,
        rotationCenterY: Number.isFinite(costume.rotationCenterY) ? costume.rotationCenterY : 0,
        skinId: Number.isFinite(costume.skinId) ? costume.skinId : null
    };
};

const createRecordFromSound = (sound, name, id = createId('asset'), folderId = null) => {
    const asset = getRuntimeAsset(sound);
    const dataFormat = String(sound.dataFormat || sound.format || (asset && asset.dataFormat) || '').toLowerCase();
    const assetId = sound.assetId || (asset && asset.assetId) || '';
    const md5ext = getMd5ext(sound) || (assetId && dataFormat ? `${assetId}.${dataFormat}` : '');
    if (!assetId || !dataFormat || !md5ext) {
        throw new Error('The sound has no loaded Scratch asset.');
    }
    return {
        asset,
        assetId,
        dataFormat,
        folderId,
        format: sound.format || '',
        id,
        kind: 'sound',
        md5ext,
        name: sanitizeName(name || sound.name, 'sound'),
        resourceId: createResourceId(),
        rate: Number.isFinite(sound.rate) ? sound.rate : null,
        sampleCount: Number.isFinite(sound.sampleCount) ? sound.sampleCount : null,
        soundId: sound.soundId || null
    };
};

const serializeRecord = record => {
    const serialized = {
        assetId: record.assetId,
        dataFormat: record.dataFormat,
        folderId: record.folderId || null,
        id: record.id,
        kind: record.kind,
        md5ext: record.md5ext,
        name: record.name,
        resourceId: record.resourceId
    };
    if (record.kind === 'sound') {
        serialized.format = record.format || '';
        serialized.rate = record.rate;
        serialized.sampleCount = record.sampleCount;
    } else {
        serialized.bitmapResolution = record.bitmapResolution;
        serialized.rotationCenterX = record.rotationCenterX;
        serialized.rotationCenterY = record.rotationCenterY;
    }
    return serialized;
};

const createRuntimeCostume = (record, name) => {
    const costume = {
        asset: record.asset || undefined,
        assetId: record.assetId,
        bitmapResolution: record.bitmapResolution,
        dataFormat: record.dataFormat,
        md5: record.md5ext,
        name: sanitizeName(name || record.name, 'costume'),
        rotationCenterX: record.rotationCenterX,
        rotationCenterY: record.rotationCenterY
    };
    if (Number.isFinite(record.skinId)) costume.skinId = record.skinId;
    return costume;
};

const createRuntimeSound = (record, name) => {
    const sound = {
        asset: record.asset || undefined,
        assetId: record.assetId,
        dataFormat: record.dataFormat,
        format: record.format || '',
        md5: record.md5ext,
        name: sanitizeName(name || record.name, 'sound')
    };
    if (Number.isFinite(record.rate)) sound.rate = record.rate;
    if (Number.isFinite(record.sampleCount)) sound.sampleCount = record.sampleCount;
    if (record.soundId) sound.soundId = record.soundId;
    return sound;
};

const cloneRecord = record => Object.assign({}, record);
const cloneItem = item => Object.assign({}, item);

const createGlobalAssetDatabase = vm => {
    const runtime = vm.runtime;
    const assets = new Map();
    const folders = new Map();
    const listeners = new Set();
    const historyPast = [];
    const historyFuture = [];
    let revision = 0;
    let performingHistory = false;
    let operationQueue = Promise.resolve();

    const emit = change => {
        revision += 1;
        listeners.forEach(listener => listener(Object.assign({revision}, change)));
    };

    const findRuntimeAsset = record => {
        const targets = getOriginalTargets(runtime);
        for (let targetIndex = 0; targetIndex < targets.length; targetIndex++) {
            const items = getItems(targets[targetIndex], record.kind);
            for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
                const item = items[itemIndex];
                if (
                    item &&
                    item.assetId === record.assetId &&
                    String(item.dataFormat || item.format).toLowerCase() === record.dataFormat
                ) {
                    const asset = getRuntimeAsset(item);
                    if (asset) {
                        record.asset = asset;
                        if (record.kind === 'sound') {
                            record.soundId = item.soundId || record.soundId;
                            record.rate = Number.isFinite(item.rate) ? item.rate : record.rate;
                            record.sampleCount = Number.isFinite(item.sampleCount) ? item.sampleCount : record.sampleCount;
                        } else if (Number.isFinite(item.skinId)) {
                            record.skinId = item.skinId;
                        }
                        return asset;
                    }
                }
            }
        }
        return null;
    };

    const hydrateRecord = async (record, archive) => {
        if (record.asset || findRuntimeAsset(record)) return record.asset;
        if (!archive || typeof archive.file !== 'function' || !runtime.storage) return null;

        let file = archive.file(record.md5ext);
        if (!file) {
            const escaped = record.md5ext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const matches = archive.file(new RegExp(`^([^/]*/)?${escaped}$`));
            file = matches && matches[0];
        }
        if (!file || typeof file.async !== 'function') return null;

        const data = await file.async('uint8array');
        const storage = runtime.storage;
        const assetType = record.kind === 'sound' ?
            storage.AssetType.Sound :
            (record.dataFormat === 'svg' ? storage.AssetType.ImageVector : storage.AssetType.ImageBitmap);
        record.asset = storage.createAsset(
            assetType,
            record.dataFormat,
            data,
            record.assetId,
            false
        );
        return record.asset;
    };

    const markChanged = change => {
        if (runtime && typeof runtime.emitProjectChanged === 'function') runtime.emitProjectChanged();
        if (typeof vm.emitTargetsUpdate === 'function') vm.emitTargetsUpdate(false);
        emit(change);
    };

    const captureSnapshot = () => ({
        assets: Array.from(assets.values()).map(cloneRecord),
        folders: Array.from(folders.values()).map(folder => Object.assign({}, folder)),
        targets: getOriginalTargets(runtime).map(target => ({
            costumes: getCostumes(target).map(cloneItem),
            currentCostume: target.currentCostume,
            id: target.id,
            sounds: getSounds(target).map(cloneItem)
        }))
    });

    const applySnapshot = snapshot => {
        performingHistory = true;
        assets.clear();
        snapshot.assets.forEach(record => assets.set(record.id, cloneRecord(record)));
        folders.clear();
        snapshot.folders.forEach(folder => folders.set(folder.id, Object.assign({}, folder)));
        snapshot.targets.forEach(targetSnapshot => {
            const target = runtime.getTargetById(targetSnapshot.id);
            if (!target || !target.sprite) return;
            target.sprite.costumes = targetSnapshot.costumes.map(cloneItem);
            target.sprite.sounds = targetSnapshot.sounds.map(cloneItem);
            if (target.sprite.costumes.length) {
                const nextIndex = Math.max(0, Math.min(
                    Number.isInteger(targetSnapshot.currentCostume) ? targetSnapshot.currentCostume : 0,
                    target.sprite.costumes.length - 1
                ));
                target.currentCostume = nextIndex;
                if (typeof target.setCostume === 'function') target.setCostume(nextIndex);
            }
            if (runtime && typeof runtime.requestTargetsUpdate === 'function') runtime.requestTargetsUpdate(target);
        });
        performingHistory = false;
        markChanged({type: 'history:apply'});
    };

    const getHistoryState = () => ({
        canRedo: historyFuture.length > 0,
        canUndo: historyPast.length > 0,
        nextRedoLabel: historyFuture.length ? historyFuture[historyFuture.length - 1].label : null,
        nextUndoLabel: historyPast.length ? historyPast[historyPast.length - 1].label : null,
        redoCount: historyFuture.length,
        undoCount: historyPast.length
    });

    const perform = (label, action) => {
        if (typeof action !== 'function') return Promise.resolve(null);
        const run = async () => {
            if (performingHistory) return action();
            const before = captureSnapshot();
            const result = await action();
            const after = captureSnapshot();
            historyPast.push({after, before, label: label || 'Asset change'});
            if (historyPast.length > MAX_HISTORY_LENGTH) historyPast.shift();
            historyFuture.length = 0;
            emit({history: getHistoryState(), type: 'history:push'});
            return result;
        };
        const result = operationQueue.then(run, run);
        operationQueue = result.catch(() => null);
        return result;
    };

    const undo = () => {
        const command = historyPast.pop();
        if (!command) return false;
        historyFuture.push(command);
        applySnapshot(command.before);
        emit({history: getHistoryState(), label: command.label, type: 'history:undo'});
        return true;
    };

    const redo = () => {
        const command = historyFuture.pop();
        if (!command) return false;
        historyPast.push(command);
        applySnapshot(command.after);
        emit({history: getHistoryState(), label: command.label, type: 'history:redo'});
        return true;
    };

    const clearHistory = () => {
        historyPast.length = 0;
        historyFuture.length = 0;
        emit({history: getHistoryState(), type: 'history:clear'});
    };

    const getReferences = globalAssetId => {
        const record = assets.get(globalAssetId);
        if (!record) return [];
        const bindingProperty = getBindingProperty(record.kind);
        const references = [];
        getOriginalTargets(runtime).forEach(target => {
            getItems(target, record.kind).forEach((item, itemIndex) => {
                if (item && item[bindingProperty] === globalAssetId) {
                    references.push({
                        costumeIndex: record.kind === 'costume' ? itemIndex : null,
                        itemIndex,
                        itemName: item.name,
                        kind: record.kind,
                        soundIndex: record.kind === 'sound' ? itemIndex : null,
                        targetId: target.id,
                        targetName: typeof target.getName === 'function' ? target.getName() : target.sprite && target.sprite.name
                    });
                }
            });
        });
        return references;
    };

    const bindItem = (target, itemIndex, globalAssetId, silent = false) => {
        const record = assets.get(globalAssetId);
        if (!record) return false;
        const item = getItems(target, record.kind)[itemIndex];
        if (!item) return false;
        item[getBindingProperty(record.kind)] = globalAssetId;
        if (!silent) markChanged({assetId: globalAssetId, type: 'binding'});
        return true;
    };

    const bindCostume = (target, costumeIndex, globalAssetId, silent = false) => {
        const record = assets.get(globalAssetId);
        if (!record || record.kind !== 'costume') return false;
        return bindItem(target, costumeIndex, globalAssetId, silent);
    };

    const captureCostume = (target, costumeIndex, folderId = null) => {
        const costume = getCostumes(target)[costumeIndex];
        if (!costume) throw new Error('Select a target with a costume first.');

        const exactRecord = Array.from(assets.values()).find(record => (
            record.kind === 'costume' &&
            record.assetId === costume.assetId &&
            record.dataFormat === String(costume.dataFormat).toLowerCase() &&
            record.bitmapResolution === (Number.isFinite(costume.bitmapResolution) ? costume.bitmapResolution : 1) &&
            record.rotationCenterX === (Number.isFinite(costume.rotationCenterX) ? costume.rotationCenterX : 0) &&
            record.rotationCenterY === (Number.isFinite(costume.rotationCenterY) ? costume.rotationCenterY : 0)
        ));

        const record = exactRecord || createRecordFromCostume(costume, costume.name, createId('asset'), folderId);
        if (!exactRecord) {
            record.name = makeUniqueName(record.name, assets, null, record.kind);
            assets.set(record.id, record);
        } else if (!record.asset) {
            record.asset = getRuntimeAsset(costume);
            record.skinId = Number.isFinite(costume.skinId) ? costume.skinId : record.skinId;
        }
        costume[COSTUME_BINDING_PROPERTY] = record.id;
        markChanged({assetId: record.id, type: exactRecord ? 'binding' : 'create'});
        return record.id;
    };

    const captureCurrentCostume = (target, folderId = null) => captureCostume(
        target,
        target && Number.isInteger(target.currentCostume) ? target.currentCostume : 0,
        folderId
    );

    const getCostumeResourceId = (target, costumeIndex) => {
        const costume = getCostumes(target)[costumeIndex];
        if (!costume) return null;
        const globalAssetId = costume[COSTUME_BINDING_PROPERTY];
        if (!globalAssetId) return null;
        const record = assets.get(globalAssetId);
        return record && record.kind === 'costume' ? record.resourceId : null;
    };

    const ensureCostumeResource = (target, costumeIndex, folderId = null) => {
        const existingResourceId = getCostumeResourceId(target, costumeIndex);
        if (existingResourceId) return existingResourceId;

        const costume = getCostumes(target)[costumeIndex];
        if (!costume) throw new Error('Select a target with a costume first.');

        // Native Paint adoption must preserve costume identity. Unlike explicit Global Asset
        // capture, two byte-identical costumes are not silently collapsed into one shared
        // Resource because editing either native costume must not unexpectedly mutate the other.
        const record = createRecordFromCostume(costume, costume.name, createId('asset'), folderId);
        record.name = makeUniqueName(record.name, assets, null, record.kind);
        assets.set(record.id, record);
        costume[COSTUME_BINDING_PROPERTY] = record.id;
        markChanged({
            assetId: record.id,
            costumeIndex,
            resourceId: record.resourceId,
            targetId: target && target.id ? target.id : null,
            type: 'native-paint:adopt'
        });
        return record.resourceId;
    };

    const importCostume = (costume, name, folderId = null) => {
        const record = createRecordFromCostume(costume, name, createId('asset'), folderId);
        record.name = makeUniqueName(record.name, assets, null, record.kind);
        assets.set(record.id, record);
        markChanged({assetId: record.id, type: 'import'});
        return record.id;
    };

    const importSound = (sound, name, folderId = null) => {
        const record = createRecordFromSound(sound, name, createId('asset'), folderId);
        record.name = makeUniqueName(record.name, assets, null, record.kind);
        assets.set(record.id, record);
        markChanged({assetId: record.id, type: 'import'});
        return record.id;
    };

    const addAssetToTarget = async (globalAssetId, targetId) => {
        const record = assets.get(globalAssetId);
        const target = runtime.getTargetById(targetId);
        if (!record) throw new Error('Global asset not found.');
        if (!target || !target.isOriginal) throw new Error('Select a Stage or Sprite target first.');
        await hydrateRecord(record, null);
        if (!record.asset) throw new Error('The global asset data is not loaded.');

        const items = getItems(target, record.kind);
        const beforeLength = items.length;
        if (record.kind === 'sound') {
            if (typeof vm.addSound !== 'function') throw new Error('The VM does not support adding sounds.');
            await vm.addSound(createRuntimeSound(record, record.name), targetId);
        } else {
            if (typeof vm.addCostume !== 'function') throw new Error('The VM does not support adding costumes.');
            await vm.addCostume(record.md5ext, createRuntimeCostume(record, record.name), targetId);
        }
        const updatedItems = getItems(target, record.kind);
        const itemIndex = Math.max(beforeLength, updatedItems.length - 1);
        if (updatedItems[itemIndex]) updatedItems[itemIndex][getBindingProperty(record.kind)] = record.id;
        markChanged({assetId: record.id, targetId, type: 'attach'});
        return itemIndex;
    };

    const unlinkReference = (globalAssetId, targetId, itemIndex) => {
        const record = assets.get(globalAssetId);
        const target = runtime.getTargetById(targetId);
        if (!record || !target) return false;
        const item = getItems(target, record.kind)[itemIndex];
        const bindingProperty = getBindingProperty(record.kind);
        if (!item || item[bindingProperty] !== globalAssetId) return false;
        delete item[bindingProperty];
        markChanged({assetId: globalAssetId, targetId, type: 'unlink'});
        return true;
    };

    const unlinkCostume = (target, costumeIndex) => {
        const costume = getCostumes(target)[costumeIndex];
        if (!costume || !costume[COSTUME_BINDING_PROPERTY]) return false;
        return unlinkReference(costume[COSTUME_BINDING_PROPERTY], target.id, costumeIndex);
    };

    const getResourceContentRevision = resourceId => {
        const record = findRecordByResourceId(resourceId);
        if (!record || record.kind !== 'costume') return null;
        return Number.isInteger(record.contentRevision) && record.contentRevision >= 0 ? record.contentRevision : 0;
    };

    const replaceImageResourceContent = async (resourceId, input) => {
        const previousRecord = findRecordByResourceId(resourceId);
        if (!previousRecord || previousRecord.kind !== 'costume') {
            const error = new Error(`Image Resource is unavailable: ${resourceId}`);
            error.code = 'NGVGE_RESOURCE_IMAGE_CONTENT_RESOURCE_NOT_FOUND';
            throw error;
        }
        const normalized = normalizePortableImageContent(input);
        const expectedRevision = input && input.expectedSourceAuthorityRevision;
        const bitmapResolution = input && input.bitmapResolution;
        const rotationCenterX = input && input.rotationCenterX;
        const rotationCenterY = input && input.rotationCenterY;
        const bitmapResolutionValid = normalized.dataFormat === 'svg' ? bitmapResolution === 1 :
            (bitmapResolution === 1 || bitmapResolution === 2);
        if (!bitmapResolutionValid || !Number.isFinite(rotationCenterX) || !Number.isFinite(rotationCenterY)) {
            const error = new TypeError(
                'Image Resource content replacement requires valid bitmapResolution and finite rotation center geometry.'
            );
            error.code = 'NGVGE_RESOURCE_IMAGE_CONTENT_GEOMETRY_INVALID';
            throw error;
        }
        const currentRevision = getResourceContentRevision(resourceId);
        if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
            const error = new TypeError('Image Resource content replacement requires a non-negative expected source revision.');
            error.code = 'NGVGE_RESOURCE_IMAGE_CONTENT_SOURCE_REVISION_INVALID';
            throw error;
        }
        if (expectedRevision !== currentRevision) {
            const error = new Error(
                `Image Resource content changed since the working copy was loaded (${expectedRevision} != ${currentRevision}).`
            );
            error.code = 'NGVGE_RESOURCE_IMAGE_CONTENT_SOURCE_STALE';
            throw error;
        }
        const storage = runtime && runtime.storage;
        if (!storage || typeof storage.createAsset !== 'function') {
            const error = new Error('Scratch image storage adapter is unavailable.');
            error.code = 'NGVGE_RESOURCE_IMAGE_CONTENT_STORAGE_UNAVAILABLE';
            throw error;
        }
        let bytes = decodePortableImageContentToBytes(normalized);
        if (normalized.dataFormat === 'svg') bytes = sanitizeSvg.sanitizeByteStream(bytes);
        const assetType = normalized.dataFormat === 'svg' ? storage.AssetType.ImageVector : storage.AssetType.ImageBitmap;
        const asset = storage.createAsset(assetType, normalized.dataFormat, bytes, null, true);
        if (!asset || typeof asset.assetId !== 'string' || !asset.assetId) {
            const error = new Error('Scratch image storage adapter failed to create a replacement asset.');
            error.code = 'NGVGE_RESOURCE_IMAGE_CONTENT_STORAGE_CREATE_FAILED';
            throw error;
        }
        const candidate = {
            asset,
            assetId: asset.assetId,
            bitmapResolution,
            dataFormat: normalized.dataFormat,
            md5: `${asset.assetId}.${normalized.dataFormat}`,
            name: previousRecord.name,
            rotationCenterX,
            rotationCenterY
        };
        await loadCostumeFromAsset(candidate, runtime);
        if (candidate.broken) {
            const error = new Error('Replacement image content could not be loaded by the Scratch compatibility backend.');
            error.code = 'NGVGE_RESOURCE_IMAGE_CONTENT_BACKEND_DECODE_FAILED';
            throw error;
        }
        const replacement = Object.assign({}, previousRecord, {
            asset: candidate.asset || asset,
            assetId: candidate.assetId || asset.assetId,
            bitmapResolution: Number.isFinite(candidate.bitmapResolution) ? candidate.bitmapResolution : bitmapResolution,
            contentRevision: currentRevision + 1,
            dataFormat: normalized.dataFormat,
            md5ext: `${candidate.assetId || asset.assetId}.${normalized.dataFormat}`,
            rotationCenterX: Number.isFinite(candidate.rotationCenterX) ? candidate.rotationCenterX : rotationCenterX,
            rotationCenterY: Number.isFinite(candidate.rotationCenterY) ? candidate.rotationCenterY : rotationCenterY,
            skinId: Number.isFinite(candidate.skinId) ? candidate.skinId : null
        });
        assets.set(previousRecord.id, replacement);
        getOriginalTargets(runtime).forEach(referenceTarget => {
            getCostumes(referenceTarget).forEach((costume, index) => {
                if (!costume || costume[COSTUME_BINDING_PROPERTY] !== previousRecord.id) return;
                const localName = costume.name;
                const runtimeCostume = createRuntimeCostume(replacement, localName);
                Object.assign(costume, runtimeCostume);
                if (!Number.isFinite(replacement.skinId)) delete costume.skinId;
                costume[COSTUME_BINDING_PROPERTY] = previousRecord.id;
                if (typeof referenceTarget.setCostume === 'function' && referenceTarget.currentCostume === index) {
                    referenceTarget.setCostume(index);
                }
            });
        });
        markChanged({
            assetId: previousRecord.id,
            contentRevision: replacement.contentRevision,
            resourceId,
            type: 'replace'
        });
        return true;
    };

    const replaceAssetFromCostume = (globalAssetId, target, costumeIndex) => {
        const previousRecord = assets.get(globalAssetId);
        const sourceCostume = getCostumes(target)[costumeIndex];
        if (!previousRecord || previousRecord.kind !== 'costume') {
            throw new Error('Select an image asset first.');
        }
        if (!sourceCostume) throw new Error('Select a source costume first.');

        const replacement = createRecordFromCostume(
            sourceCostume,
            previousRecord.name,
            globalAssetId,
            previousRecord.folderId
        );
        replacement.name = previousRecord.name;
        replacement.resourceId = previousRecord.resourceId;
        replacement.contentRevision = getResourceContentRevision(previousRecord.resourceId) + 1;
        assets.set(globalAssetId, replacement);

        getOriginalTargets(runtime).forEach(referenceTarget => {
            const costumes = getCostumes(referenceTarget);
            costumes.forEach((costume, index) => {
                if (costume && costume[COSTUME_BINDING_PROPERTY] === globalAssetId) {
                    const localName = costume.name;
                    Object.assign(costume, createRuntimeCostume(replacement, localName));
                    costume[COSTUME_BINDING_PROPERTY] = globalAssetId;
                    if (typeof referenceTarget.setCostume === 'function' && referenceTarget.currentCostume === index) {
                        referenceTarget.setCostume(index);
                    }
                }
            });
        });

        sourceCostume[COSTUME_BINDING_PROPERTY] = globalAssetId;
        if (typeof target.setCostume === 'function') target.setCostume(costumeIndex);
        markChanged({
            assetId: globalAssetId,
            contentRevision: replacement.contentRevision,
            resourceId: replacement.resourceId,
            type: 'replace'
        });
        return true;
    };

    const replaceAssetFromCurrent = (globalAssetId, target) => replaceAssetFromCostume(
        globalAssetId,
        target,
        target && Number.isInteger(target.currentCostume) ? target.currentCostume : 0
    );

    const renameAsset = (globalAssetId, name) => {
        const record = assets.get(globalAssetId);
        if (!record) return false;
        const nextName = makeUniqueName(name, assets, globalAssetId, record.kind);
        if (nextName === record.name) return false;
        record.name = nextName;
        markChanged({assetId: globalAssetId, type: 'rename'});
        return true;
    };

    const moveAsset = (globalAssetId, folderId) => {
        const record = assets.get(globalAssetId);
        if (!record) return false;
        const nextFolderId = folderId && folders.has(folderId) ? folderId : null;
        if (record.folderId === nextFolderId) return false;
        record.folderId = nextFolderId;
        markChanged({assetId: globalAssetId, folderId: nextFolderId, type: 'move'});
        return true;
    };

    const createFolder = name => {
        const id = createId('folder');
        const folder = {id, name: makeUniqueFolderName(name, folders)};
        folders.set(id, folder);
        markChanged({folderId: id, type: 'folder:create'});
        return id;
    };

    const renameFolder = (folderId, name) => {
        const folder = folders.get(folderId);
        if (!folder) return false;
        const nextName = makeUniqueFolderName(name, folders, folderId);
        if (nextName === folder.name) return false;
        folder.name = nextName;
        markChanged({folderId, type: 'folder:rename'});
        return true;
    };

    const removeFolder = folderId => {
        if (!folders.has(folderId)) return false;
        assets.forEach(record => {
            if (record.folderId === folderId) record.folderId = null;
        });
        folders.delete(folderId);
        markChanged({folderId, type: 'folder:delete'});
        return true;
    };

    const removeAsset = globalAssetId => {
        if (!assets.has(globalAssetId)) return false;
        const references = getReferences(globalAssetId);
        if (references.length) {
            throw new Error(`Unlink the asset from ${references.length} item(s) before deleting it.`);
        }
        assets.delete(globalAssetId);
        markChanged({assetId: globalAssetId, type: 'delete'});
        return true;
    };

    const reset = ({silent = false} = {}) => {
        assets.clear();
        folders.clear();
        historyPast.length = 0;
        historyFuture.length = 0;
        if (!silent) emit({type: 'reset'});
    };

    const deserializeProject = (data, context) => {
        assets.clear();
        folders.clear();
        const serializedFolders = data && Array.isArray(data.folders) ? data.folders : [];
        serializedFolders.forEach(folder => {
            if (!folder || typeof folder.id !== 'string') return;
            folders.set(folder.id, {
                id: folder.id,
                name: sanitizeFolderName(folder.name)
            });
        });
        const records = data && Array.isArray(data.assets) ? data.assets : [];
        records.forEach(serialized => {
            if (!serialized || typeof serialized.id !== 'string') return;
            const kind = serialized.kind === 'sound' ? 'sound' : 'costume';
            assets.set(serialized.id, Object.assign({}, serialized, {
                asset: null,
                folderId: serialized.folderId && folders.has(serialized.folderId) ? serialized.folderId : null,
                kind,
                resourceId: normalizeResourceId(serialized.resourceId),
                contentRevision: 0,
                skinId: null,
                soundId: null
            }));
        });
        emit({type: 'restore-metadata'});
        const archive = context && context.archive;
        return Promise.all(Array.from(assets.values()).map(record => hydrateRecord(record, archive)))
            .then(() => {
                emit({type: 'hydrate'});
                return true;
            })
            .catch(() => {
                emit({type: 'hydrate-error'});
                return false;
            });
    };

    const findRecordByResourceId = resourceId => {
        if (!isStableIdentity(resourceId, STABLE_ID_KINDS.RESOURCE)) return null;
        for (const record of assets.values()) {
            if (record.resourceId === resourceId) return record;
        }
        return null;
    };

    const getResourceDescriptor = resourceId => {
        const record = findRecordByResourceId(resourceId);
        if (!record) return null;
        return Object.assign(serializeRecord(record), {referenceCount: getReferences(record.id).length});
    };

    const deserializeTarget = (target, data) => {
        const costumeBindings = data && Array.isArray(data.costumeBindings) ? data.costumeBindings : [];
        const soundBindings = data && Array.isArray(data.soundBindings) ? data.soundBindings : [];
        getCostumes(target).forEach((costume, index) => {
            const globalAssetId = costumeBindings[index];
            if (
                typeof globalAssetId === 'string' &&
                assets.has(globalAssetId) &&
                assets.get(globalAssetId).kind === 'costume'
            ) {
                costume[COSTUME_BINDING_PROPERTY] = globalAssetId;
            } else if (costume) {
                delete costume[COSTUME_BINDING_PROPERTY];
            }
        });
        getSounds(target).forEach((sound, index) => {
            const globalAssetId = soundBindings[index];
            if (
                typeof globalAssetId === 'string' &&
                assets.has(globalAssetId) &&
                assets.get(globalAssetId).kind === 'sound'
            ) {
                sound[SOUND_BINDING_PROPERTY] = globalAssetId;
            } else if (sound) {
                delete sound[SOUND_BINDING_PROPERTY];
            }
        });
        emit({targetId: target.id, type: 'restore-bindings'});
    };

    return {
        version: DATABASE_VERSION,
        addAssetToTarget,
        bindCostume,
        bindItem,
        captureCostume,
        captureCurrentCostume,
        clearHistory,
        createFolder,
        deserializeProject,
        deserializeTarget,
        getAsset: id => assets.get(id) || null,
        getAssetIdForResourceId (resourceId) {
            const record = findRecordByResourceId(resourceId);
            return record ? record.id : null;
        },
        getResource: getResourceDescriptor,
        getResourceContentRevision,
        getCurrentBinding (target) {
            const costume = getCurrentCostume(target);
            return costume ? costume[COSTUME_BINDING_PROPERTY] || null : null;
        },
        getCostumeResourceId,
        getHistoryState,
        getDataURL (globalAssetId) {
            const record = assets.get(globalAssetId);
            if (!record) return null;
            const asset = record.asset || findRuntimeAsset(record);
            if (!asset || typeof asset.encodeDataURI !== 'function') return null;
            try {
                return asset.encodeDataURI();
            } catch {
                return null;
            }
        },
        getPreviewURL (globalAssetId) {
            const record = assets.get(globalAssetId);
            if (!record || record.kind === 'sound') return null;
            const asset = record.asset || findRuntimeAsset(record);
            if (!asset || typeof asset.encodeDataURI !== 'function') return null;
            try {
                return asset.encodeDataURI();
            } catch {
                return null;
            }
        },
        getReferences,
        getRevision: () => revision,
        hydrateRecord,
        ensureCostumeResource,
        importCostume,
        importSound,
        listAssets () {
            return Array.from(assets.values()).map(record => Object.assign(
                serializeRecord(record),
                {referenceCount: getReferences(record.id).length}
            ));
        },
        listResources () {
            return Array.from(assets.values()).map(record => Object.assign(
                serializeRecord(record),
                {referenceCount: getReferences(record.id).length}
            ));
        },
        listFolders () {
            return Array.from(folders.values()).map(folder => Object.assign({}, folder));
        },
        moveAsset,
        perform,
        redo,
        removeAsset,
        removeFolder,
        renameAsset,
        renameFolder,
        replaceAssetFromCostume,
        replaceAssetFromCurrent,
        replaceImageResourceContent,
        reset,
        serializeProject () {
            if (!assets.size && !folders.size) return null;
            return {
                assets: Array.from(assets.values()).map(serializeRecord),
                folders: Array.from(folders.values()).map(folder => Object.assign({}, folder)),
                version: DATABASE_VERSION
            };
        },
        serializeTarget (target) {
            const costumeBindings = getCostumes(target).map(costume => (
                costume && costume[COSTUME_BINDING_PROPERTY] ? costume[COSTUME_BINDING_PROPERTY] : null
            ));
            const soundBindings = getSounds(target).map(sound => (
                sound && sound[SOUND_BINDING_PROPERTY] ? sound[SOUND_BINDING_PROPERTY] : null
            ));
            if (!costumeBindings.some(Boolean) && !soundBindings.some(Boolean)) return null;
            return {costumeBindings, soundBindings, version: DATABASE_VERSION};
        },
        subscribe (listener) {
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        undo,
        unlinkCostume,
        unlinkReference
    };
};

const findAssetForSerialization = (record, runtime) => {
    const targets = getOriginalTargets(runtime);
    for (let targetIndex = 0; targetIndex < targets.length; targetIndex++) {
        const items = getItems(targets[targetIndex], record.kind);
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            const candidate = getRuntimeAsset(items[itemIndex]);
            if (candidate && candidate.assetId === record.assetId) return candidate;
        }
    }
    return null;
};

const installGlobalAssetDatabase = vm => {
    if (!vm || !vm.runtime) return null;
    const runtime = vm.runtime;
    const current = runtime[DATABASE_PROPERTY];
    if (current && current.version === DATABASE_VERSION) return current;

    const database = createGlobalAssetDatabase(vm);
    runtime[DATABASE_PROPERTY] = database;

    const registry = getInspectorRegistry(runtime);
    registry.register({
        hidden: true,
        id: DATABASE_SECTION_ID,
        label: 'Global Asset Database',
        order: -1000,
        appliesTo: target => Boolean(target && target.isOriginal),
        deserializeProject: (data, context) => database.deserializeProject(data, context),
        deserializeTarget: (target, data) => database.deserializeTarget(target, data),
        getFields: () => [],
        serializeProject: () => database.serializeProject(),
        serializeTarget: target => database.serializeTarget(target),
        setValue: () => {}
    });

    const lifecycle = installProjectLifecycleHost(vm);
    if (lifecycle) {
        lifecycle.registerHook({
            id: LIFECYCLE_HOOK_ID,
            priority: -800,
            beforeLoad: () => database.reset({silent: true}),
            afterSerializeAssets: (context, descriptors) => {
                if (!Array.isArray(descriptors)) return descriptors;
                const targetId = context.args[0];
                const byFileName = new Map(descriptors.map(descriptor => [descriptor.fileName, descriptor]));
                let records = database.listAssets();
                if (targetId) {
                    const target = runtime.getTargetById(targetId);
                    const referencedIds = new Set([
                        ...getCostumes(target).map(costume => costume && costume[COSTUME_BINDING_PROPERTY]),
                        ...getSounds(target).map(sound => sound && sound[SOUND_BINDING_PROPERTY])
                    ].filter(Boolean));
                    records = records.filter(record => referencedIds.has(record.id));
                }
                records.forEach(serializedRecord => {
                    const record = database.getAsset(serializedRecord.id);
                    if (!record) return;
                    const asset = record.asset || findAssetForSerialization(record, runtime);
                    if (!asset || !asset.data) return;
                    byFileName.set(record.md5ext, {
                        fileContent: asset.data,
                        fileName: record.md5ext
                    });
                });
                return Array.from(byFileName.values());
            }
        });
    }

    return database;
};

const getGlobalAssetDatabase = runtime => (
    runtime && runtime[DATABASE_PROPERTY] ? runtime[DATABASE_PROPERTY] : null
);

export {
    COSTUME_BINDING_PROPERTY,
    DATABASE_PROPERTY,
    DATABASE_SECTION_ID,
    DATABASE_VERSION,
    SOUND_BINDING_PROPERTY,
    createGlobalAssetDatabase,
    getGlobalAssetDatabase,
    installGlobalAssetDatabase
};
