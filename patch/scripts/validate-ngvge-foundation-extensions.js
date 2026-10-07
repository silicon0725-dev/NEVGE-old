#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vmModule = require('vm');
const assert = require('assert');
const {EventEmitter} = require('events');

const makeScratch = () => {
    const registered = [];
    const runtime = new EventEmitter();
    runtime.stageWidth = 480;
    runtime.stageHeight = 360;
    runtime.off = runtime.removeListener.bind(runtime);
    const scratch = {
        Cast: {
            toNumber: value => Number(value) || 0,
            toString: value => String(value ?? '')
        },
        BlockType: {REPORTER: 'reporter', BOOLEAN: 'boolean', COMMAND: 'command', HAT: 'hat'},
        ArgumentType: {NUMBER: 'number', STRING: 'string', ANGLE: 'angle'},
        extensions: {
            unsandboxed: true,
            register: extension => registered.push(extension)
        },
        vm: {
            runtime,
            renderer: {
                canvas: {getBoundingClientRect: () => ({left: 0, top: 0, width: 480, height: 360})}
            }
        }
    };
    return {scratch, registered, runtime};
};

const load = (filename, contextExtras = {}) => {
    const {scratch, registered, runtime} = makeScratch();
    const context = {
        Scratch: scratch,
        console,
        TextEncoder,
        TextDecoder,
        Blob,
        Response,
        CompressionStream,
        DecompressionStream,
        atob,
        btoa,
        Uint8Array,
        ArrayBuffer,
        Math,
        JSON,
        Object,
        Number,
        String,
        Boolean,
        Map,
        Set,
        Symbol,
        Promise,
        globalThis: null,
        ...contextExtras
    };
    context.globalThis = context;
    vmModule.runInNewContext(fs.readFileSync(filename, 'utf8'), context, {filename});
    assert.strictEqual(registered.length, 1, `${filename} should register exactly one extension`);
    return {extension: registered[0], runtime};
};

const run = async () => {
    const base = path.resolve(__dirname, '../static/extensions');

    const motion = load(path.join(base, 'NGVGE-Motion-Toolkit.js')).extension;
    assert.strictEqual(motion.clampValue({VALUE: 2, MIN: 0, MAX: 1}), 1);
    assert.strictEqual(motion.normalizeValue({VALUE: 50, MIN: 0, MAX: 100}), 0.5);
    assert(Math.abs(motion.cubicBezier({X1: 0.42, Y1: 0, X2: 0.58, Y2: 1, T: 0.5}) - 0.5) < 1e-4);
    assert(motion.spring({TIME: 1, STIFFNESS: 170, DAMPING: 26, MASS: 1}) > 0.9);

    const data = load(path.join(base, 'NGVGE-Data-Toolkit.js')).extension;
    assert.strictEqual(data.getJSONPath({PATH: 'a.b[1]', JSON: '{"a":{"b":[1,2]}}'}), 2);
    assert.strictEqual(data.stableJSON({JSON: '{"b":2,"a":1}'}), '{"a":1,"b":2}');
    const encoded = data.utf8ToBase64({TEXT: 'Hello 世界', MODE: 'standard'});
    assert.strictEqual(data.base64ToUtf8({BASE64: encoded}), 'Hello 世界');
    assert.strictEqual(data.checksum({ALGORITHM: 'crc32', TEXT: '123456789'}), 'cbf43926');
    if (data.compressionSupported()) {
        const compressed = await data.gzipCompress({TEXT: 'NGVGE '.repeat(100)});
        assert.strictEqual(await data.gzipDecompress({BASE64: compressed}), 'NGVGE '.repeat(100));
    }

    class WindowTarget extends EventTarget {}
    const windowTarget = new WindowTarget();
    const gamepads = [];
    const inputLoad = load(path.join(base, 'NGVGE-Input-Core.js'), {
        window: windowTarget,
        navigator: {getGamepads: () => gamepads}
    });
    const input = inputLoad.extension;
    const keyDown = new Event('keydown');
    Object.defineProperties(keyDown, {
        code: {value: 'Space'},
        key: {value: ' '},
        repeat: {value: false}
    });
    windowTarget.dispatchEvent(keyDown);
    assert.strictEqual(input.keyDown({KEY: 'Space'}), true);
    assert.strictEqual(input.keyPressed({KEY: 'Space'}), true);
    inputLoad.runtime.emit('AFTER_EXECUTE');
    assert.strictEqual(input.keyPressed({KEY: 'Space'}), false);

    gamepads[0] = {
        connected: true,
        id: 'Test Gamepad',
        index: 0,
        mapping: 'standard',
        timestamp: 1,
        buttons: [{pressed: true, value: 1}],
        axes: [0, 0.5]
    };
    inputLoad.runtime.emit('BEFORE_EXECUTE');
    assert.strictEqual(input.gamepadConnected({PAD: 0}), true);
    assert.strictEqual(input.gamepadButtonPressed({PAD: 0, BUTTON: 0}), true);
    input.defineAction({ACTION: 'jump', BINDINGS: 'key:Space,gamepad:any:button:0'});
    assert.strictEqual(input.actionDown({ACTION: 'jump'}), true);
    inputLoad.runtime.emit('RUNTIME_DISPOSED');

    console.log('NGVGE foundation extension validation passed.');
};

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
