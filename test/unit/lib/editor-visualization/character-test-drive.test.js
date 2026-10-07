import {
    CHARACTER_TEST_DRIVE_MODES,
    getCharacterTestDrive
} from '../../../../src/lib/editor-visualization';

describe('WS-10N6-HF4 CharacterBody2D editor test drive state', () => {
    test('is editor-only, defaults to a platformer preview and does not mutate runtime project data', () => {
        const runtime = {projectData: {sentinel: true}};
        const drive = getCharacterTestDrive(runtime);
        expect(drive.getState()).toEqual(expect.objectContaining({
            activeNodeId: null,
            gravity: 1200,
            jumpSpeed: 420,
            mode: CHARACTER_TEST_DRIVE_MODES.PLATFORMER,
            running: false,
            speed: 180,
            status: 'idle'
        }));
        drive.patchSettings({mode: CHARACTER_TEST_DRIVE_MODES.TOP_DOWN, speed: 240});
        drive.start('player');
        expect(drive.getState()).toEqual(expect.objectContaining({
            activeNodeId: 'player',
            mode: CHARACTER_TEST_DRIVE_MODES.TOP_DOWN,
            running: true,
            speed: 240
        }));
        expect(runtime.projectData).toEqual({sentinel: true});
    });

    test('supports pause, restart and stop without inventing persistent controller state', () => {
        const drive = getCharacterTestDrive({});
        drive.start('player');
        drive.pause();
        expect(drive.getState()).toEqual(expect.objectContaining({activeNodeId: 'player', running: false, status: 'paused'}));
        drive.start('player');
        expect(drive.getState().running).toBe(true);
        drive.stop();
        expect(drive.getState()).toEqual(expect.objectContaining({activeNodeId: null, running: false, status: 'idle'}));
    });
});
