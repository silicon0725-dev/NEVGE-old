// Name: NGVGE Input Core
// ID: ngvgeInput
// Description: Unified keyboard, mouse, wheel, gamepad and action-map input.
// By: NGVGE Team
// License: MIT
// Clean-room implementation inspired by common input and gamepad extensions.

(function (Scratch) {
    'use strict';

    if (!Scratch.extensions.unsandboxed) {
        throw new Error('NGVGE Input Core must run unsandboxed.');
    }

    const Cast = Scratch.Cast;
    const BlockType = Scratch.BlockType;
    const ArgumentType = Scratch.ArgumentType;
    const vm = Scratch.vm;
    const runtime = vm.runtime;
    const SERVICE_KEY = 'ngvgeInputCore';

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const finite = (value, fallback = 0) => {
        const number = Cast.toNumber(value);
        return Number.isFinite(number) ? number : fallback;
    };

    const deepFreeze = value => {
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
        Object.freeze(value);
        Object.keys(value).forEach(key => deepFreeze(value[key]));
        return value;
    };

    const isEditableTarget = target => {
        if (!target || typeof target !== 'object') return false;
        const tag = String(target.tagName || '').toLowerCase();
        return Boolean(target.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select');
    };

    const keyAliases = Object.freeze({
        space: 'Space',
        ' ': 'Space',
        enter: 'Enter',
        return: 'Enter',
        escape: 'Escape',
        esc: 'Escape',
        tab: 'Tab',
        backspace: 'Backspace',
        delete: 'Delete',
        shift: 'ShiftLeft|ShiftRight',
        control: 'ControlLeft|ControlRight',
        ctrl: 'ControlLeft|ControlRight',
        alt: 'AltLeft|AltRight',
        meta: 'MetaLeft|MetaRight',
        command: 'MetaLeft|MetaRight',
        up: 'ArrowUp',
        down: 'ArrowDown',
        left: 'ArrowLeft',
        right: 'ArrowRight'
    });

    const normalizeKeyQuery = value => {
        const raw = Cast.toString(value).trim();
        if (!raw) return [];
        const lower = raw.toLowerCase();
        if (keyAliases[lower]) return keyAliases[lower].split('|').map(code => `code:${code}`);
        if (/^(Key[A-Z]|Digit[0-9]|Numpad\w+|F(?:[1-9]|1[0-2])|Arrow(?:Up|Down|Left|Right)|Space|Enter|Escape|Tab|Backspace|Delete|Home|End|PageUp|PageDown|Insert|CapsLock|ShiftLeft|ShiftRight|ControlLeft|ControlRight|AltLeft|AltRight|MetaLeft|MetaRight)$/.test(raw)) {
            return [`code:${raw}`];
        }
        if (raw.length === 1 && /[a-z]/i.test(raw)) return [`code:Key${raw.toUpperCase()}`, `key:${lower}`];
        if (raw.length === 1 && /[0-9]/.test(raw)) return [`code:Digit${raw}`, `key:${raw}`];
        return [`key:${lower}`];
    };

    const mouseButtonNumber = value => {
        const raw = Cast.toString(value).trim().toLowerCase();
        if (raw === 'left') return 0;
        if (raw === 'middle') return 1;
        if (raw === 'right') return 2;
        return Math.max(0, Math.floor(finite(raw)));
    };

    const createService = () => {
        const keysDown = new Set();
        const keysPressed = new Set();
        const keysReleased = new Set();
        const mouseDown = new Set();
        const mousePressed = new Set();
        const mouseReleased = new Set();
        const actionMap = new Map();
        const listeners = new Set();
        let mouseX = 0;
        let mouseY = 0;
        let wheelX = 0;
        let wheelY = 0;
        let gamepadDeadzone = 0.1;
        let gamepadSnapshot = [];
        let gamepadPressed = new Set();
        let gamepadReleased = new Set();
        let disposed = false;

        const emit = change => {
            const event = deepFreeze(Object.assign({type: 'input:change'}, change));
            listeners.forEach(listener => {
                try {
                    listener(event);
                } catch (error) {
                    console.error('[NGVGE Input] listener failed', error);
                }
            });
        };

        const updateMousePosition = event => {
            const canvas = vm.renderer && vm.renderer.canvas;
            if (!canvas || typeof canvas.getBoundingClientRect !== 'function') return;
            const rect = canvas.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            const stageWidth = finite(runtime.stageWidth, 480);
            const stageHeight = finite(runtime.stageHeight, 360);
            mouseX = ((event.clientX - rect.left) / rect.width) * stageWidth - stageWidth / 2;
            mouseY = stageHeight / 2 - ((event.clientY - rect.top) / rect.height) * stageHeight;
        };

        const tokensForKeyboardEvent = event => {
            const tokens = [];
            if (event.code) tokens.push(`code:${event.code}`);
            if (event.key) tokens.push(`key:${String(event.key).toLowerCase()}`);
            return tokens;
        };

        const onKeyDown = event => {
            if (disposed || isEditableTarget(event.target)) return;
            tokensForKeyboardEvent(event).forEach(token => {
                if (!keysDown.has(token)) keysPressed.add(token);
                keysDown.add(token);
            });
            emit({kind: 'keyboard', phase: event.repeat ? 'repeat' : 'pressed', code: event.code, key: event.key});
        };

        const onKeyUp = event => {
            if (disposed) return;
            tokensForKeyboardEvent(event).forEach(token => {
                if (keysDown.delete(token)) keysReleased.add(token);
            });
            emit({kind: 'keyboard', phase: 'released', code: event.code, key: event.key});
        };

        const onPointerDown = event => {
            if (disposed || isEditableTarget(event.target)) return;
            updateMousePosition(event);
            if (!mouseDown.has(event.button)) mousePressed.add(event.button);
            mouseDown.add(event.button);
            emit({kind: 'mouse', phase: 'pressed', button: event.button});
        };

        const onPointerUp = event => {
            if (disposed) return;
            updateMousePosition(event);
            if (mouseDown.delete(event.button)) mouseReleased.add(event.button);
            emit({kind: 'mouse', phase: 'released', button: event.button});
        };

        const onPointerMove = event => {
            if (disposed) return;
            updateMousePosition(event);
        };

        const onWheel = event => {
            if (disposed || isEditableTarget(event.target)) return;
            const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? finite(runtime.stageHeight, 360) : 1;
            wheelX += event.deltaX * multiplier;
            wheelY += event.deltaY * multiplier;
            emit({kind: 'wheel', x: event.deltaX * multiplier, y: event.deltaY * multiplier});
        };

        const clearHeldState = () => {
            keysDown.clear();
            mouseDown.clear();
            keysPressed.clear();
            keysReleased.clear();
            mousePressed.clear();
            mouseReleased.clear();
            gamepadPressed.clear();
            gamepadReleased.clear();
            wheelX = 0;
            wheelY = 0;
        };

        const readGamepads = () => {
            const raw = typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function' ?
                Array.from(navigator.getGamepads() || []) : [];
            const previous = gamepadSnapshot;
            const nextPressed = new Set();
            const nextReleased = new Set();
            const snapshot = raw.map((pad, padIndex) => {
                if (!pad) return null;
                const previousPad = previous[padIndex];
                const buttons = Array.from(pad.buttons || []).map((button, buttonIndex) => {
                    const value = typeof button === 'number' ? button : finite(button && button.value);
                    const pressed = Boolean(button && button.pressed) || value > 0.5;
                    const oldPressed = Boolean(previousPad && previousPad.buttons[buttonIndex] && previousPad.buttons[buttonIndex].pressed);
                    const token = `${padIndex}:${buttonIndex}`;
                    if (pressed && !oldPressed) nextPressed.add(token);
                    if (!pressed && oldPressed) nextReleased.add(token);
                    return {pressed, value: clamp(value, 0, 1)};
                });
                return {
                    connected: pad.connected !== false,
                    id: String(pad.id || ''),
                    index: Number.isFinite(pad.index) ? pad.index : padIndex,
                    mapping: String(pad.mapping || ''),
                    timestamp: finite(pad.timestamp),
                    buttons,
                    axes: Array.from(pad.axes || []).map(axis => clamp(finite(axis), -1, 1))
                };
            });
            gamepadSnapshot = snapshot;
            gamepadPressed = nextPressed;
            gamepadReleased = nextReleased;
        };

        const afterExecute = () => {
            keysPressed.clear();
            keysReleased.clear();
            mousePressed.clear();
            mouseReleased.clear();
            gamepadPressed.clear();
            gamepadReleased.clear();
            wheelX = 0;
            wheelY = 0;
        };

        const keyMatches = (set, query) => normalizeKeyQuery(query).some(token => set.has(token));

        const axisWithDeadzone = value => {
            const raw = clamp(finite(value), -1, 1);
            const magnitude = Math.abs(raw);
            if (magnitude <= gamepadDeadzone) return 0;
            return Math.sign(raw) * ((magnitude - gamepadDeadzone) / (1 - gamepadDeadzone));
        };

        const getPad = index => {
            if (!gamepadSnapshot.length) readGamepads();
            const numeric = Math.max(0, Math.floor(finite(index)));
            return gamepadSnapshot[numeric] || null;
        };

        const bindingValue = binding => {
            const parts = Cast.toString(binding).trim().split(':');
            const type = (parts.shift() || '').toLowerCase();
            if (type === 'key') return keyMatches(keysDown, parts.join(':')) ? 1 : 0;
            if (type === 'mouse') return mouseDown.has(mouseButtonNumber(parts[0])) ? 1 : 0;
            if (type !== 'gamepad') return 0;

            if (!gamepadSnapshot.length) readGamepads();
            const padToken = (parts.shift() || '0').toLowerCase();
            const control = (parts.shift() || '').toLowerCase();
            const controlIndex = Math.max(0, Math.floor(finite(parts.shift())));
            const direction = (parts.shift() || '').trim();
            const padIndexes = padToken === 'any' ? gamepadSnapshot.map((_, index) => index) : [Math.max(0, Math.floor(finite(padToken)))];
            let best = 0;
            padIndexes.forEach(padIndex => {
                const pad = gamepadSnapshot[padIndex];
                if (!pad) return;
                let value = 0;
                if (control === 'button') value = pad.buttons[controlIndex] ? pad.buttons[controlIndex].value : 0;
                if (control === 'axis') {
                    value = axisWithDeadzone(pad.axes[controlIndex] || 0);
                    if (direction === '+') value = Math.max(0, value);
                    if (direction === '-') value = Math.max(0, -value);
                }
                if (Math.abs(value) > Math.abs(best)) best = value;
            });
            return best;
        };

        const actionValue = action => {
            const bindings = actionMap.get(Cast.toString(action)) || [];
            let best = 0;
            bindings.forEach(binding => {
                const value = bindingValue(binding);
                if (Math.abs(value) > Math.abs(best)) best = value;
            });
            return best;
        };

        const dispose = () => {
            if (disposed) return;
            disposed = true;
            window.removeEventListener('keydown', onKeyDown, true);
            window.removeEventListener('keyup', onKeyUp, true);
            window.removeEventListener('pointerdown', onPointerDown, true);
            window.removeEventListener('pointerup', onPointerUp, true);
            window.removeEventListener('pointermove', onPointerMove, true);
            window.removeEventListener('wheel', onWheel, true);
            window.removeEventListener('blur', clearHeldState);
            window.removeEventListener('gamepadconnected', readGamepads);
            window.removeEventListener('gamepaddisconnected', readGamepads);
            runtime.off('BEFORE_EXECUTE', readGamepads);
            runtime.off('AFTER_EXECUTE', afterExecute);
            runtime.off('PROJECT_STOP_ALL', clearHeldState);
            listeners.clear();
            if (runtime[SERVICE_KEY] === service) delete runtime[SERVICE_KEY];
        };

        window.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('keyup', onKeyUp, true);
        window.addEventListener('pointerdown', onPointerDown, true);
        window.addEventListener('pointerup', onPointerUp, true);
        window.addEventListener('pointermove', onPointerMove, true);
        window.addEventListener('wheel', onWheel, {capture: true, passive: true});
        window.addEventListener('blur', clearHeldState);
        window.addEventListener('gamepadconnected', readGamepads);
        window.addEventListener('gamepaddisconnected', readGamepads);
        readGamepads();
        runtime.on('BEFORE_EXECUTE', readGamepads);
        runtime.on('AFTER_EXECUTE', afterExecute);
        runtime.on('PROJECT_STOP_ALL', clearHeldState);
        runtime.once('RUNTIME_DISPOSED', dispose);

        const service = {
            version: 1,
            isKeyDown: query => keyMatches(keysDown, query),
            wasKeyPressed: query => keyMatches(keysPressed, query),
            wasKeyReleased: query => keyMatches(keysReleased, query),
            isMouseDown: button => mouseDown.has(mouseButtonNumber(button)),
            wasMousePressed: button => mousePressed.has(mouseButtonNumber(button)),
            wasMouseReleased: button => mouseReleased.has(mouseButtonNumber(button)),
            getMousePosition: () => deepFreeze({x: mouseX, y: mouseY}),
            getWheel: () => deepFreeze({x: wheelX, y: wheelY}),
            getGamepad: index => deepFreeze(getPad(index) || {connected: false, buttons: [], axes: []}),
            getGamepadButtonValue: (pad, button) => {
                const item = getPad(pad);
                const entry = item && item.buttons[Math.max(0, Math.floor(finite(button)))];
                return entry ? entry.value : 0;
            },
            getGamepadAxisValue: (pad, axis) => {
                const item = getPad(pad);
                return item ? axisWithDeadzone(item.axes[Math.max(0, Math.floor(finite(axis)))] || 0) : 0;
            },
            wasGamepadButtonPressed: (pad, button) => {
                return gamepadPressed.has(`${Math.max(0, Math.floor(finite(pad)))}:${Math.max(0, Math.floor(finite(button)))}`);
            },
            wasGamepadButtonReleased: (pad, button) => {
                return gamepadReleased.has(`${Math.max(0, Math.floor(finite(pad)))}:${Math.max(0, Math.floor(finite(button)))}`);
            },
            setGamepadDeadzone: value => {
                gamepadDeadzone = clamp(finite(value, 0.1), 0, 0.95);
                emit({kind: 'settings', gamepadDeadzone});
            },
            getGamepadDeadzone: () => gamepadDeadzone,
            defineAction: (name, bindings) => {
                const key = Cast.toString(name);
                const values = Cast.toString(bindings).split(',').map(item => item.trim()).filter(Boolean);
                actionMap.set(key, values);
                emit({kind: 'action-map', action: key});
            },
            removeAction: name => {
                const key = Cast.toString(name);
                actionMap.delete(key);
                emit({kind: 'action-map', action: key});
            },
            getActionValue: actionValue,
            getActionMap: () => deepFreeze(Object.fromEntries(Array.from(actionMap, ([name, bindings]) => [name, bindings.slice()]))),
            getSnapshot: () => deepFreeze({
                keysDown: Array.from(keysDown),
                mouseButtons: Array.from(mouseDown),
                mouse: {x: mouseX, y: mouseY, wheelX, wheelY},
                gamepads: gamepadSnapshot,
                gamepadDeadzone,
                actions: Object.fromEntries(Array.from(actionMap, ([name, bindings]) => [name, bindings.slice()]))
            }),
            subscribe: listener => {
                if (typeof listener !== 'function') return () => {};
                listeners.add(listener);
                return () => listeners.delete(listener);
            },
            dispose
        };

        return Object.freeze(service);
    };

    const input = runtime[SERVICE_KEY] && runtime[SERVICE_KEY].version === 1 ? runtime[SERVICE_KEY] : createService();
    runtime[SERVICE_KEY] = input;

    class NGVGEInputCore {
        getInfo () {
            return {
                id: 'ngvgeInput',
                name: 'NGVGE Input Core',
                color1: '#14B8A6',
                color2: '#0F9488',
                color3: '#0B7169',
                blocks: [
                    {
                        opcode: 'keyDown',
                        blockType: BlockType.BOOLEAN,
                        text: 'key [KEY] down?',
                        arguments: {KEY: {type: ArgumentType.STRING, defaultValue: 'Space'}}
                    },
                    {
                        opcode: 'keyPressed',
                        blockType: BlockType.BOOLEAN,
                        text: 'key [KEY] pressed this frame?',
                        arguments: {KEY: {type: ArgumentType.STRING, defaultValue: 'Space'}}
                    },
                    {
                        opcode: 'keyReleased',
                        blockType: BlockType.BOOLEAN,
                        text: 'key [KEY] released this frame?',
                        arguments: {KEY: {type: ArgumentType.STRING, defaultValue: 'Space'}}
                    },
                    '---',
                    {
                        opcode: 'mouseDown',
                        blockType: BlockType.BOOLEAN,
                        text: 'mouse [BUTTON] down?',
                        arguments: {BUTTON: {type: ArgumentType.STRING, menu: 'mouseButtonMenu', defaultValue: 'left'}}
                    },
                    {
                        opcode: 'mousePressed',
                        blockType: BlockType.BOOLEAN,
                        text: 'mouse [BUTTON] pressed this frame?',
                        arguments: {BUTTON: {type: ArgumentType.STRING, menu: 'mouseButtonMenu', defaultValue: 'left'}}
                    },
                    {
                        opcode: 'mouseReleased',
                        blockType: BlockType.BOOLEAN,
                        text: 'mouse [BUTTON] released this frame?',
                        arguments: {BUTTON: {type: ArgumentType.STRING, menu: 'mouseButtonMenu', defaultValue: 'left'}}
                    },
                    {
                        opcode: 'mouseX',
                        blockType: BlockType.REPORTER,
                        text: 'mouse stage x'
                    },
                    {
                        opcode: 'mouseY',
                        blockType: BlockType.REPORTER,
                        text: 'mouse stage y'
                    },
                    {
                        opcode: 'wheelX',
                        blockType: BlockType.REPORTER,
                        text: 'mouse wheel x this frame'
                    },
                    {
                        opcode: 'wheelY',
                        blockType: BlockType.REPORTER,
                        text: 'mouse wheel y this frame'
                    },
                    '---',
                    {
                        opcode: 'gamepadConnected',
                        blockType: BlockType.BOOLEAN,
                        text: 'gamepad [PAD] connected?',
                        arguments: {PAD: {type: ArgumentType.NUMBER, defaultValue: 0}}
                    },
                    {
                        opcode: 'gamepadButtonDown',
                        blockType: BlockType.BOOLEAN,
                        text: 'gamepad [PAD] button [BUTTON] down?',
                        arguments: {
                            PAD: {type: ArgumentType.NUMBER, defaultValue: 0},
                            BUTTON: {type: ArgumentType.NUMBER, defaultValue: 0}
                        }
                    },
                    {
                        opcode: 'gamepadButtonPressed',
                        blockType: BlockType.BOOLEAN,
                        text: 'gamepad [PAD] button [BUTTON] pressed this frame?',
                        arguments: {
                            PAD: {type: ArgumentType.NUMBER, defaultValue: 0},
                            BUTTON: {type: ArgumentType.NUMBER, defaultValue: 0}
                        }
                    },
                    {
                        opcode: 'gamepadButtonValue',
                        blockType: BlockType.REPORTER,
                        text: 'gamepad [PAD] button [BUTTON] value',
                        arguments: {
                            PAD: {type: ArgumentType.NUMBER, defaultValue: 0},
                            BUTTON: {type: ArgumentType.NUMBER, defaultValue: 0}
                        }
                    },
                    {
                        opcode: 'gamepadAxisValue',
                        blockType: BlockType.REPORTER,
                        text: 'gamepad [PAD] axis [AXIS] value',
                        arguments: {
                            PAD: {type: ArgumentType.NUMBER, defaultValue: 0},
                            AXIS: {type: ArgumentType.NUMBER, defaultValue: 0}
                        }
                    },
                    {
                        opcode: 'setDeadzone',
                        blockType: BlockType.COMMAND,
                        text: 'set gamepad deadzone to [VALUE]',
                        arguments: {VALUE: {type: ArgumentType.NUMBER, defaultValue: 0.1}}
                    },
                    {
                        opcode: 'getDeadzone',
                        blockType: BlockType.REPORTER,
                        text: 'gamepad deadzone'
                    },
                    '---',
                    {
                        opcode: 'defineAction',
                        blockType: BlockType.COMMAND,
                        text: 'define action [ACTION] bindings [BINDINGS]',
                        arguments: {
                            ACTION: {type: ArgumentType.STRING, defaultValue: 'jump'},
                            BINDINGS: {type: ArgumentType.STRING, defaultValue: 'key:Space,gamepad:any:button:0'}
                        }
                    },
                    {
                        opcode: 'removeAction',
                        blockType: BlockType.COMMAND,
                        text: 'remove action [ACTION]',
                        arguments: {ACTION: {type: ArgumentType.STRING, defaultValue: 'jump'}}
                    },
                    {
                        opcode: 'actionDown',
                        blockType: BlockType.BOOLEAN,
                        text: 'action [ACTION] down?',
                        arguments: {ACTION: {type: ArgumentType.STRING, defaultValue: 'jump'}}
                    },
                    {
                        opcode: 'actionValue',
                        blockType: BlockType.REPORTER,
                        text: 'action [ACTION] value',
                        arguments: {ACTION: {type: ArgumentType.STRING, defaultValue: 'moveX'}}
                    },
                    {
                        opcode: 'actionMapJSON',
                        blockType: BlockType.REPORTER,
                        text: 'action map JSON',
                        disableMonitor: true
                    }
                ],
                menus: {
                    mouseButtonMenu: {
                        acceptReporters: true,
                        items: ['left', 'middle', 'right']
                    }
                }
            };
        }

        keyDown (args) { return input.isKeyDown(args.KEY); }
        keyPressed (args) { return input.wasKeyPressed(args.KEY); }
        keyReleased (args) { return input.wasKeyReleased(args.KEY); }
        mouseDown (args) { return input.isMouseDown(args.BUTTON); }
        mousePressed (args) { return input.wasMousePressed(args.BUTTON); }
        mouseReleased (args) { return input.wasMouseReleased(args.BUTTON); }
        mouseX () { return input.getMousePosition().x; }
        mouseY () { return input.getMousePosition().y; }
        wheelX () { return input.getWheel().x; }
        wheelY () { return input.getWheel().y; }
        gamepadConnected (args) { return input.getGamepad(args.PAD).connected; }
        gamepadButtonDown (args) { return input.getGamepadButtonValue(args.PAD, args.BUTTON) > 0.5; }
        gamepadButtonPressed (args) { return input.wasGamepadButtonPressed(args.PAD, args.BUTTON); }
        gamepadButtonValue (args) { return input.getGamepadButtonValue(args.PAD, args.BUTTON); }
        gamepadAxisValue (args) { return input.getGamepadAxisValue(args.PAD, args.AXIS); }
        setDeadzone (args) { input.setGamepadDeadzone(args.VALUE); }
        getDeadzone () { return input.getGamepadDeadzone(); }
        defineAction (args) { input.defineAction(args.ACTION, args.BINDINGS); }
        removeAction (args) { input.removeAction(args.ACTION); }
        actionDown (args) { return Math.abs(input.getActionValue(args.ACTION)) > 0.5; }
        actionValue (args) { return input.getActionValue(args.ACTION); }
        actionMapJSON () { return JSON.stringify(input.getActionMap()); }
    }

    Scratch.extensions.register(new NGVGEInputCore());
})(Scratch);
