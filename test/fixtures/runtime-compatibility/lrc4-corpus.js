'use strict';

const repeat = (opcode, count) => Array.from({length: count}, () => opcode);

module.exports = Object.freeze([
    Object.freeze({
        expected: {visualDomains: ['scratch.sprite.transform']},
        id: 'C01',
        opcodes: ['event_whenflagclicked', 'motion_movesteps', 'motion_turnright'],
        title: 'Pure Scratch sprite motion'
    }),
    Object.freeze({
        expected: {broadcastHeavy: true},
        id: 'C02',
        opcodes: repeat('event_broadcast', 8).concat(['event_whenbroadcastreceived']),
        title: 'Broadcast/event-heavy'
    }),
    Object.freeze({
        expected: {exactTickSensitive: true},
        id: 'C03',
        opcodes: ['event_whenflagclicked', 'control_wait', 'sensing_timer'],
        title: 'Wait/timer-sensitive'
    }),
    Object.freeze({
        expected: {usesPen: true, visualDomains: ['scratch.pen']},
        id: 'C04',
        opcodes: ['pen_penDown', 'pen_changePenSizeBy', 'motion_movesteps'],
        title: 'Pen-heavy'
    }),
    Object.freeze({
        expected: {usesStamp: true, visualDomains: ['scratch.stamp']},
        id: 'C05',
        opcodes: ['pen_stamp', 'motion_movesteps'],
        title: 'Stamp-heavy'
    }),
    Object.freeze({
        expected: {cloneHeavy: true},
        id: 'C06',
        opcodes: repeat('control_create_clone_of', 8),
        title: 'Clone-heavy'
    }),
    Object.freeze({
        expected: {},
        id: 'C07',
        opcodes: ['event_whenflagclicked', 'control_forever', 'motion_movesteps'],
        title: 'Turbo candidate'
    }),
    Object.freeze({
        expected: {exactTickSensitive: true},
        id: 'C08',
        opcodes: ['control_wait', 'motion_movesteps'],
        title: 'Custom FPS legacy'
    }),
    Object.freeze({
        expected: {visualDomains: ['scratch.sprite.transform']},
        id: 'C09',
        opcodes: ['motion_changexby', 'motion_changeyby'],
        title: 'Legacy interpolation'
    }),
    Object.freeze({
        expected: {},
        id: 'C10',
        opcodes: ['control_forever', 'operator_add'],
        title: 'OpsPerFrame legacy project'
    }),
    Object.freeze({
        expected: {customStageGeometry: true},
        id: 'C11',
        opcodes: ['event_whenflagclicked'],
        stage: {height: 360, width: 640},
        title: 'Custom stage size'
    }),
    Object.freeze({
        expected: {visualDomains: ['scratch.sprite.transform']},
        id: 'C12',
        opcodes: ['motion_gotoxy', 'motion_setx', 'motion_sety'],
        title: 'Fencing-sensitive offstage movement'
    }),
    Object.freeze({
        expected: {},
        id: 'C13',
        opcodes: ['sound_play', 'sound_playuntildone'],
        title: 'Sound limits'
    }),
    Object.freeze({
        expected: {usesPen: true},
        id: 'C14',
        opcodes: ['pen_setPenSizeTo', 'pen_changePenSizeBy'],
        title: 'Pen limits / HQ render'
    }),
    Object.freeze({
        expected: {unknownExtensionIds: ['exampleext'], usesCustomExtensions: true},
        id: 'C15',
        loadedExtensions: ['exampleext'],
        opcodes: ['exampleext_doSomething'],
        title: 'Custom Scratch extension'
    }),
    Object.freeze({
        expected: {highRenderLoad: true},
        id: 'C16',
        opcodes: repeat('looks_say', 1000),
        title: 'Renderer-heavy'
    }),
    Object.freeze({
        expected: {usesRendererPrivateExtension: true, visualDomains: ['extension.renderer.3d']},
        extensionDescriptors: [{
            exactTickSensitive: true,
            extensionId: 'render3d',
            rendererPrivate: true,
            visualDomains: ['extension.renderer.3d']
        }],
        id: 'C17',
        loadedExtensions: ['render3d'],
        opcodes: ['render3d_drawMesh'],
        title: '3D/custom renderer extension'
    })
]);
