import {
    SCENE_DATA_SCHEMA_VERSION,
    VARIABLE_SCOPES,
    VARIABLE_TYPES,
    UnsupportedSceneDataVersionError,
    createScene,
    createSceneProject,
    createSceneVariable,
    migrateSceneProject,
    normalizeSceneProject,
    validateSceneProject
} from '../../../../src/lib/scene-system';

const sequenceFactory = prefix => {
    let index = 0;
    return () => `${prefix}-${++index}`;
};

describe('NGVGE scene data model', () => {
    test('creates a valid one-scene project with stable active and startup references', () => {
        const project = createSceneProject({
            sceneIdFactory: sequenceFactory('scene')
        });

        expect(project.schemaVersion).toBe(SCENE_DATA_SCHEMA_VERSION);
        expect(project.scenes).toHaveLength(1);
        expect(project.activeSceneId).toBe(project.scenes[0].id);
        expect(project.startupSceneId).toBe(project.scenes[0].id);
        expect(validateSceneProject(project).valid).toBe(true);
    });

    test('normalizes duplicate scene and variable ids without sharing mutable input', () => {
        const input = {
            activeSceneId: 'duplicate',
            scenes: [
                createScene({
                    id: 'duplicate',
                    name: 'One',
                    variables: {
                        items: [
                            createSceneVariable({id: 'same', name: 'Score'}),
                            createSceneVariable({id: 'same', name: 'Lives'})
                        ]
                    }
                }),
                createScene({id: 'duplicate', name: 'Two'})
            ],
            schemaVersion: 1,
            startupSceneId: 'duplicate'
        };
        const project = normalizeSceneProject(input, {
            sceneIdFactory: sequenceFactory('replacement-scene'),
            variableIdFactory: sequenceFactory('replacement-variable')
        });

        expect(new Set(project.scenes.map(scene => scene.id)).size).toBe(2);
        expect(new Set(project.scenes[0].variables.items.map(variable => variable.id)).size).toBe(2);
        project.scenes[0].name = 'Changed';
        expect(input.scenes[0].name).toBe('One');
    });

    test('defines global, scene and target variable scopes without duplicating global data', () => {
        expect(VARIABLE_SCOPES).toEqual({
            GLOBAL: 'global',
            SCENE: 'scene',
            TARGET: 'target'
        });
        const variable = createSceneVariable({name: 'Wave', type: VARIABLE_TYPES.SCALAR, value: 2});
        expect(variable).toMatchObject({name: 'Wave', type: 'scalar', value: 2});
    });

    test('migrates the provisional unversioned scene shape', () => {
        const migrated = migrateSceneProject({
            currentSceneId: 'scene-a',
            entrySceneId: 'scene-a',
            sceneList: [{sceneId: 'scene-a', name: 'Legacy', sceneVariables: []}]
        });

        expect(migrated).toMatchObject({
            activeSceneId: 'scene-a',
            schemaVersion: 1,
            startupSceneId: 'scene-a'
        });
        expect(migrated.scenes[0].id).toBe('scene-a');
    });

    test('rejects future schema versions instead of silently downgrading them', () => {
        expect(() => normalizeSceneProject({schemaVersion: 99, scenes: []}))
            .toThrow(UnsupportedSceneDataVersionError);
    });

    test('reports invalid references and duplicate ids', () => {
        const project = createSceneProject({sceneIdFactory: sequenceFactory('scene')});
        project.scenes.push(Object.assign({}, project.scenes[0]));
        project.activeSceneId = 'missing';

        const validation = validateSceneProject(project);
        expect(validation.valid).toBe(false);
        expect(validation.errors.map(error => error.code)).toEqual(expect.arrayContaining([
            'scene.id.duplicate',
            'project.active-scene.missing'
        ]));
    });
});
