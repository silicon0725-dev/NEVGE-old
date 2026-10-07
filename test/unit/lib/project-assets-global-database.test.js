import {
    COSTUME_BINDING_PROPERTY,
    SOUND_BINDING_PROPERTY,
    createGlobalAssetDatabase,
    installGlobalAssetDatabase
} from '../../../src/lib/project-assets/global-asset-database';

jest.mock('@turbowarp/scratch-svg-renderer', () => ({
    sanitizeSvg: {sanitizeByteStream: data => data}
}));

const createAsset = (assetId, dataFormat = 'svg', kind = 'image') => ({
    assetId,
    data: new Uint8Array([1, 2, 3]),
    dataFormat,
    encodeDataURI: () => `data:${kind}/${dataFormat};base64,AAAA`
});

const createCostume = (name, assetId, dataFormat = 'svg') => {
    const asset = createAsset(assetId, dataFormat);
    return {
        asset,
        assetId,
        bitmapResolution: 1,
        dataFormat,
        md5: `${assetId}.${dataFormat}`,
        name,
        rotationCenterX: 10,
        rotationCenterY: 20,
        skinId: 5
    };
};

const createSound = (name, assetId, dataFormat = 'wav') => {
    const asset = createAsset(assetId, dataFormat, 'audio');
    return {
        asset,
        assetId,
        dataFormat,
        md5: `${assetId}.${dataFormat}`,
        name,
        rate: 48000,
        sampleCount: 96000,
        soundId: `sound-${assetId}`
    };
};

const createTarget = (id, name, costumes, sounds = []) => ({
    id,
    currentCostume: 0,
    isOriginal: true,
    isStage: false,
    sprite: {costumes, sounds},
    getCostumes () {
        return this.sprite.costumes;
    },
    getSounds () {
        return this.sprite.sounds;
    },
    getName: () => name,
    setCostume: jest.fn(function (index) {
        this.currentCostume = index;
    })
});

const createFixture = () => {
    const player = createTarget('player', 'Player', [createCostume('Idle', 'hash-a')]);
    const enemy = createTarget('enemy', 'Enemy', [createCostume('Enemy', 'hash-b')]);
    let generatedAsset = 0;
    const runtime = {
        emitProjectChanged: jest.fn(),
        getTargetById: id => runtime.targets.find(target => target.id === id) || null,
        requestTargetsUpdate: jest.fn(),
        renderer: {
            createSVGSkin: jest.fn(() => 42),
            getSkinSize: jest.fn(() => [100, 80]),
            getSkinRotationCenter: jest.fn(() => [50, 40])
        },
        storage: {
            AssetType: {
                ImageBitmap: 'ImageBitmap',
                ImageVector: 'ImageVector',
                Sound: 'Sound'
            },
            createAsset: jest.fn((assetType, dataFormat, data, assetId, generateId) => {
                const resolvedId = assetId || (generateId ? `generated-${++generatedAsset}` : assetId);
                return {
                    assetId: resolvedId,
                    assetType,
                    data,
                    dataFormat,
                    decodeText: () => '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>',
                    encodeDataURI: () => `data:${dataFormat === 'svg' ? 'image/svg+xml' : `image/${dataFormat}`};base64,AAAA`
                };
            })
        },
        targets: [player, enemy]
    };
    const vm = {
        addCostume: jest.fn(async (md5ext, costume, targetId) => {
            const target = runtime.getTargetById(targetId);
            target.sprite.costumes.push(costume);
            target.currentCostume = target.sprite.costumes.length - 1;
        }),
        addSound: jest.fn(async (sound, targetId) => {
            const target = runtime.getTargetById(targetId);
            target.sprite.sounds.push(sound);
        }),
        emitTargetsUpdate: jest.fn(),
        loadProject: jest.fn(() => Promise.resolve()),
        runtime,
        serializeAssets: jest.fn(() => [])
    };
    return {enemy, player, runtime, vm};
};

describe('Global Asset Database', () => {
    test('captures a costume and persists project and target references', () => {
        const {player, vm} = createFixture();
        const database = createGlobalAssetDatabase(vm);
        const globalAssetId = database.captureCurrentCostume(player);

        expect(database.listAssets()).toHaveLength(1);
        expect(player.getCostumes()[0][COSTUME_BINDING_PROPERTY]).toBe(globalAssetId);
        expect(database.serializeProject().assets[0].assetId).toBe('hash-a');
        expect(database.serializeTarget(player).costumeBindings).toEqual([globalAssetId]);
    });

    test('adopts native costumes into distinct canonical Resources without deduplicating identical bytes', () => {
        const {player, vm} = createFixture();
        player.sprite.costumes.push(createCostume('Idle Copy', 'hash-a'));
        const database = createGlobalAssetDatabase(vm);

        const firstResourceId = database.ensureCostumeResource(player, 0);
        const secondResourceId = database.ensureCostumeResource(player, 1);

        expect(firstResourceId).toMatch(/^ngvge:resource:/);
        expect(secondResourceId).toMatch(/^ngvge:resource:/);
        expect(secondResourceId).not.toBe(firstResourceId);
        expect(database.ensureCostumeResource(player, 0)).toBe(firstResourceId);
        expect(database.getCostumeResourceId(player, 0)).toBe(firstResourceId);
        expect(database.getCostumeResourceId(player, 1)).toBe(secondResourceId);
        expect(database.listResources()).toHaveLength(2);
        expect(player.getCostumes()[0][COSTUME_BINDING_PROPERTY]).not.toBe(
            player.getCostumes()[1][COSTUME_BINDING_PROPERTY]
        );
    });

    test('assigns and persists canonical ResourceId while keeping legacy asset id internal', () => {
        const {player, vm} = createFixture();
        const database = createGlobalAssetDatabase(vm);
        const legacyAssetId = database.captureCurrentCostume(player);
        const listed = database.listResources()[0];

        expect(legacyAssetId).toMatch(/^asset:/);
        expect(listed.resourceId).toMatch(/^ngvge:resource:/);
        expect(database.getAssetIdForResourceId(listed.resourceId)).toBe(legacyAssetId);
        expect(database.getResource(listed.resourceId)).toEqual(expect.objectContaining({
            resourceId: listed.resourceId,
            name: 'Idle'
        }));
        expect(database.getResource(listed.resourceId)).not.toHaveProperty('asset');
        expect(database.serializeProject().assets[0].resourceId).toBe(listed.resourceId);
    });

    test('imports and attaches a shared sound asset', async () => {
        const {enemy, player, vm} = createFixture();
        const database = createGlobalAssetDatabase(vm);
        const globalAssetId = database.importSound(createSound('Theme', 'sound-a'), 'Theme');

        await database.addAssetToTarget(globalAssetId, player.id);
        await database.addAssetToTarget(globalAssetId, enemy.id);

        expect(player.getSounds()[0][SOUND_BINDING_PROPERTY]).toBe(globalAssetId);
        expect(enemy.getSounds()[0][SOUND_BINDING_PROPERTY]).toBe(globalAssetId);
        expect(database.getReferences(globalAssetId)).toHaveLength(2);
        expect(database.serializeTarget(player).soundBindings).toEqual([globalAssetId]);
    });

    test('organizes assets in persistent folders', () => {
        const {player, vm} = createFixture();
        const database = createGlobalAssetDatabase(vm);
        const folderId = database.createFolder('Characters');
        const globalAssetId = database.captureCurrentCostume(player, folderId);

        expect(database.listFolders()).toEqual([
            expect.objectContaining({id: folderId, name: 'Characters'})
        ]);
        expect(database.getAsset(globalAssetId).folderId).toBe(folderId);
        expect(database.serializeProject().folders[0].name).toBe('Characters');

        database.removeFolder(folderId);
        expect(database.getAsset(globalAssetId).folderId).toBeNull();
    });

    test('attaches one global costume to multiple targets without duplicating the binary asset', async () => {
        const {enemy, player, vm} = createFixture();
        const database = createGlobalAssetDatabase(vm);
        const globalAssetId = database.captureCurrentCostume(player);

        await database.addAssetToTarget(globalAssetId, enemy.id);

        const added = enemy.getCostumes()[1];
        expect(added.assetId).toBe('hash-a');
        expect(added[COSTUME_BINDING_PROPERTY]).toBe(globalAssetId);
        expect(database.getReferences(globalAssetId)).toHaveLength(2);
    });

    test('undoes and redoes global asset operations', async () => {
        const {player, vm} = createFixture();
        const database = createGlobalAssetDatabase(vm);

        await database.perform('Capture costume', () => database.captureCurrentCostume(player));
        expect(database.listAssets()).toHaveLength(1);
        expect(database.getHistoryState().canUndo).toBe(true);

        database.undo();
        expect(database.listAssets()).toHaveLength(0);
        expect(player.getCostumes()[0][COSTUME_BINDING_PROPERTY]).toBeUndefined();

        database.redo();
        expect(database.listAssets()).toHaveLength(1);
        expect(player.getCostumes()[0][COSTUME_BINDING_PROPERTY]).toBeDefined();
    });

    test('replaces all linked costumes from a single source costume', async () => {
        const {enemy, player, vm} = createFixture();
        const database = createGlobalAssetDatabase(vm);
        const globalAssetId = database.captureCurrentCostume(player);
        await database.addAssetToTarget(globalAssetId, enemy.id);

        player.sprite.costumes.push(createCostume('Replacement', 'hash-c'));
        player.currentCostume = 1;
        database.replaceAssetFromCurrent(globalAssetId, player);

        const references = database.getReferences(globalAssetId);
        expect(references).toHaveLength(3);
        references.forEach(reference => {
            const target = vm.runtime.getTargetById(reference.targetId);
            expect(target.getCostumes()[reference.costumeIndex].assetId).toBe('hash-c');
        });
    });

    test('replaces canonical image Resource content with per-resource revision and updates linked costumes', async () => {
        const {enemy, player, vm} = createFixture();
        const database = createGlobalAssetDatabase(vm);
        const globalAssetId = database.captureCurrentCostume(player);
        await database.addAssetToTarget(globalAssetId, enemy.id);
        const resourceId = database.getAsset(globalAssetId).resourceId;
        expect(database.getResourceContentRevision(resourceId)).toBe(0);

        await database.replaceImageResourceContent(resourceId, {
            expectedSourceAuthorityRevision: 0,
            dataFormat: 'svg',
            bitmapResolution: 1,
            rotationCenterX: 12,
            rotationCenterY: 13,
            content: {kind: 'svg-text', text: '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'}
        });

        expect(database.getResourceContentRevision(resourceId)).toBe(1);
        expect(database.getAsset(globalAssetId)).toEqual(expect.objectContaining({
            assetId: expect.stringMatching(/^generated-/),
            bitmapResolution: 1,
            rotationCenterX: 12,
            rotationCenterY: 13
        }));
        database.getReferences(globalAssetId).forEach(reference => {
            const target = vm.runtime.getTargetById(reference.targetId);
            const costume = target.getCostumes()[reference.costumeIndex];
            expect(costume.assetId).toMatch(/^generated-/);
            expect(costume.skinId).toBe(42);
        });
        await expect(database.replaceImageResourceContent(resourceId, {
            expectedSourceAuthorityRevision: 1,
            dataFormat: 'svg',
            bitmapResolution: 2,
            rotationCenterX: 0,
            rotationCenterY: 0,
            content: {kind: 'svg-text', text: '<svg/>'}
        })).rejects.toMatchObject({code: 'NGVGE_RESOURCE_IMAGE_CONTENT_GEOMETRY_INVALID'});

        await expect(database.replaceImageResourceContent(resourceId, {
            expectedSourceAuthorityRevision: 0,
            dataFormat: 'svg',
            bitmapResolution: 1,
            rotationCenterX: 0,
            rotationCenterY: 0,
            content: {kind: 'svg-text', text: '<svg/>'}
        })).rejects.toMatchObject({code: 'NGVGE_RESOURCE_IMAGE_CONTENT_SOURCE_STALE'});
    });

    test('keeps unused global image and sound binaries in SB3 asset serialization', () => {
        const {player, vm} = createFixture();
        const database = installGlobalAssetDatabase(vm);
        const imageId = database.captureCurrentCostume(player);
        const soundId = database.importSound(createSound('Theme', 'sound-a'), 'Theme');
        database.unlinkCostume(player, 0);

        const descriptors = vm.serializeAssets();
        expect(database.getReferences(imageId)).toHaveLength(0);
        expect(database.getReferences(soundId)).toHaveLength(0);
        expect(descriptors).toEqual(expect.arrayContaining([
            expect.objectContaining({fileName: 'hash-a.svg'}),
            expect.objectContaining({fileName: 'sound-a.wav'})
        ]));
    });

    test('hydrates orphan image and sound assets from the SB3 archive', async () => {
        const {runtime, vm} = createFixture();
        const database = createGlobalAssetDatabase(vm);
        const archive = {
            file: jest.fn(name => ({
                async: jest.fn(() => Promise.resolve(new Uint8Array(name === 'orphan.svg' ? [9] : [8])))
            }))
        };

        await database.deserializeProject({
            assets: [{
                assetId: 'orphan',
                bitmapResolution: 1,
                dataFormat: 'svg',
                id: 'asset:orphan',
                kind: 'costume',
                md5ext: 'orphan.svg',
                name: 'Orphan',
                rotationCenterX: 0,
                rotationCenterY: 0
            }, {
                assetId: 'orphan-sound',
                dataFormat: 'wav',
                id: 'asset:orphan-sound',
                kind: 'sound',
                md5ext: 'orphan-sound.wav',
                name: 'Orphan Sound'
            }],
            folders: [],
            version: 2
        }, {archive});

        const migrated = database.serializeProject().assets;
        expect(migrated).toHaveLength(2);
        migrated.forEach(record => expect(record.resourceId).toMatch(/^ngvge:resource:/));

        expect(runtime.storage.createAsset).toHaveBeenCalledWith(
            'ImageVector',
            'svg',
            expect.any(Uint8Array),
            'orphan',
            false
        );
        expect(runtime.storage.createAsset).toHaveBeenCalledWith(
            'Sound',
            'wav',
            expect.any(Uint8Array),
            'orphan-sound',
            false
        );
    });
});
