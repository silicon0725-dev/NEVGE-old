import {
    FIRST_PARTY_MODULE_PROJECT_SECTION_ID,
    LEGACY_SCENE_SNAPSHOT_ENCODING,
    LEGACY_SCENE_SNAPSHOT_FORMAT,
    SCENE_SNAPSHOT_ENCODING,
    SCENE_SNAPSHOT_FORMAT,
    SCENE_SNAPSHOT_SCHEMA_VERSION,
    SceneSnapshotValidationError,
    UnsupportedSceneSnapshotVersionError,
    assertSupportedSceneSnapshot,
    createSceneSnapshot,
    isLegacySceneSnapshot,
    sanitizeProjectJSONForSceneSnapshot,
    validateSceneSnapshot
} from '../../../../src/lib/scene-system';

describe('NGVGE scene snapshots V2', () => {
    test('creates a portable payload snapshot envelope', () => {
        const snapshot = createSceneSnapshot({
            payload: JSON.stringify({files: [], format: 'ngvge.vm-project-files', version: 2}),
            metadata: {targetCount: 2}
        });

        expect(snapshot).toMatchObject({
            encoding: SCENE_SNAPSHOT_ENCODING,
            format: SCENE_SNAPSHOT_FORMAT,
            metadata: {targetCount: 2},
            schemaVersion: SCENE_SNAPSHOT_SCHEMA_VERSION
        });
        expect(snapshot.byteLength).toBeGreaterThan(0);
        expect(validateSceneSnapshot(snapshot).valid).toBe(true);
    });

    test('accepts legacy V1 archives for migration without treating them as current snapshots', () => {
        const legacy = {
            archive: 'AA==',
            byteLength: 1,
            encoding: LEGACY_SCENE_SNAPSHOT_ENCODING,
            format: LEGACY_SCENE_SNAPSHOT_FORMAT,
            metadata: {},
            schemaVersion: 1
        };
        expect(validateSceneSnapshot(legacy).valid).toBe(true);
        expect(isLegacySceneSnapshot(legacy)).toBe(true);
        expect(assertSupportedSceneSnapshot(legacy)).toEqual(legacy);
    });

    test('removes the first-party module project section without removing target metadata', () => {
        const input = {
            ngvge: {
                projectSections: {
                    [FIRST_PARTY_MODULE_PROJECT_SECTION_ID]: {
                        moduleData: {'ngvge.scene-system': {scenes: [{snapshot: {recursive: true}}]}}
                    },
                    'other-project-section': {value: true}
                },
                version: 1
            },
            projectVersion: 3,
            targets: [{ngvge: {sections: {target: {value: true}}}}]
        };
        const sanitized = sanitizeProjectJSONForSceneSnapshot(input);

        expect(sanitized.ngvge.projectSections[FIRST_PARTY_MODULE_PROJECT_SECTION_ID]).toBeUndefined();
        expect(sanitized.ngvge.projectSections['other-project-section']).toEqual({value: true});
        expect(sanitized.targets[0].ngvge.sections.target).toEqual({value: true});
        expect(input.ngvge.projectSections[FIRST_PARTY_MODULE_PROJECT_SECTION_ID]).toBeDefined();
    });

    test('rejects malformed and future snapshots with structured errors', () => {
        expect(() => createSceneSnapshot({payload: ''})).toThrow(SceneSnapshotValidationError);
        expect(() => assertSupportedSceneSnapshot({
            byteLength: 1,
            encoding: SCENE_SNAPSHOT_ENCODING,
            format: SCENE_SNAPSHOT_FORMAT,
            metadata: {},
            payload: 'x',
            schemaVersion: 99
        })).toThrow(UnsupportedSceneSnapshotVersionError);
    });
});
