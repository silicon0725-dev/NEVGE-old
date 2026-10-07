import PropTypes from 'prop-types';
import React from 'react';

import {CHARACTER_CONTROLLER2D_RUNTIME_CAPABILITY_ID} from '../../lib/character-controller-system';
import {
    CHARACTER_TEST_DRIVE_MODES,
    getCharacterTestDrive
} from '../../lib/editor-visualization';
import styles from './stage.css';

const FIXED_DT = 1 / 60;
const MAX_FRAME_TIME = 0.25;
const MAX_CATCHUP_STEPS = 8;

const getCapability = (vm, capabilityId) => {
    const manager = vm && vm.runtime && vm.runtime.ngvgeFirstPartyModules;
    if (!manager || typeof manager.getCapability !== 'function') return null;
    try { return manager.getCapability(capabilityId); } catch { return null; }
};

const isEditableTarget = target => {
    if (!target || !target.tagName) return false;
    const tag = String(target.tagName).toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || Boolean(target.isContentEditable);
};

const normalized = vector => {
    const length = Math.hypot(vector[0], vector[1]);
    return length > 1e-9 ? [vector[0] / length, vector[1] / length] : [0, 0];
};

const dot = (a, b) => (a[0] * b[0]) + (a[1] * b[1]);

const CharacterController2DTestDrive = ({vm}) => {
    const runtime = vm && vm.runtime;
    const testDrive = React.useMemo(() => (runtime ? getCharacterTestDrive(runtime) : null), [runtime]);
    const characterRuntime = getCapability(vm, CHARACTER_CONTROLLER2D_RUNTIME_CAPABILITY_ID);
    const [revision, setRevision] = React.useState(0);
    const keysRef = React.useRef(new Set());
    const jumpRequestedRef = React.useRef(false);

    React.useEffect(() => {
        if (!testDrive) return () => {};
        return testDrive.subscribe(() => setRevision(value => value + 1));
    }, [testDrive]);

    const state = testDrive ? testDrive.getState() : null;

    React.useEffect(() => {
        if (!testDrive || !characterRuntime || !state || !state.running || !state.activeNodeId ||
            typeof window === 'undefined') return () => {};

        const keys = keysRef.current;
        const onKeyDown = event => {
            if (isEditableTarget(event.target)) return;
            const code = event.code || event.key;
            if (code === 'Space' && !event.repeat) jumpRequestedRef.current = true;
            keys.add(code);
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(code)) event.preventDefault();
        };
        const onKeyUp = event => {
            const code = event.code || event.key;
            keys.delete(code);
        };
        window.addEventListener('keydown', onKeyDown, {passive: false});
        window.addEventListener('keyup', onKeyUp);

        let frame = null;
        let lastTime = null;
        let accumulator = 0;
        const pressed = (...codes) => codes.some(code => keys.has(code));
        const fixedStep = () => {
            const current = testDrive.getState();
            if (!current.running || !current.activeNodeId) return;
            const controller = characterRuntime.getController(current.activeNodeId);
            if (!controller || !controller.active) throw new Error('CharacterBody2D test drive lost its active controller.');

            if (current.mode === CHARACTER_TEST_DRIVE_MODES.TOP_DOWN) {
                const x = (pressed('ArrowRight', 'KeyD') ? 1 : 0) - (pressed('ArrowLeft', 'KeyA') ? 1 : 0);
                const y = (pressed('ArrowUp', 'KeyW') ? 1 : 0) - (pressed('ArrowDown', 'KeyS') ? 1 : 0);
                const direction = normalized([x, y]);
                characterRuntime.setVelocity(current.activeNodeId, [
                    direction[0] * current.speed,
                    direction[1] * current.speed
                ]);
                characterRuntime.moveUsingVelocity(current.activeNodeId, FIXED_DT);
                jumpRequestedRef.current = false;
                return;
            }

            const up = normalized(controller.config && controller.config.upDirection || [0, 1]);
            const tangent = [up[1], -up[0]];
            const horizontal = (pressed('ArrowRight', 'KeyD') ? 1 : 0) - (pressed('ArrowLeft', 'KeyA') ? 1 : 0);
            const existingVelocity = typeof characterRuntime.getVelocity === 'function' ?
                characterRuntime.getVelocity(current.activeNodeId) : (controller.state.velocity || [0, 0]);
            let upSpeed = dot(existingVelocity, up) - (current.gravity * FIXED_DT);
            if (jumpRequestedRef.current && controller.state && controller.state.onFloor) upSpeed = current.jumpSpeed;
            jumpRequestedRef.current = false;
            const velocity = [
                (tangent[0] * horizontal * current.speed) + (up[0] * upSpeed),
                (tangent[1] * horizontal * current.speed) + (up[1] * upSpeed)
            ];
            characterRuntime.setVelocity(current.activeNodeId, velocity);
            characterRuntime.moveUsingVelocity(current.activeNodeId, FIXED_DT);
        };
        const tick = now => {
            try {
                if (lastTime === null) lastTime = now;
                const elapsed = Math.min(MAX_FRAME_TIME, Math.max(0, (now - lastTime) / 1000));
                lastTime = now;
                accumulator += elapsed;
                let steps = 0;
                while (accumulator >= FIXED_DT && steps < MAX_CATCHUP_STEPS) {
                    fixedStep();
                    accumulator -= FIXED_DT;
                    steps += 1;
                }
                if (steps >= MAX_CATCHUP_STEPS && accumulator >= FIXED_DT) accumulator = 0;
                frame = window.requestAnimationFrame(tick);
            } catch (error) {
                testDrive.reportError(error);
            }
        };
        frame = window.requestAnimationFrame(tick);

        return () => {
            if (frame !== null) window.cancelAnimationFrame(frame);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            keys.clear();
            jumpRequestedRef.current = false;
        };
    }, [characterRuntime, revision, state && state.activeNodeId, state && state.running, testDrive]);

    if (!state || !state.running || !state.activeNodeId) return null;
    return (
        <div className={styles.characterTestDriveBadge} data-ngvge-character-test-drive="true">
            Test Drive · {state.mode === CHARACTER_TEST_DRIVE_MODES.PLATFORMER ? 'A/D + Space' : 'WASD / Arrows'}
        </div>
    );
};

CharacterController2DTestDrive.propTypes = {
    vm: PropTypes.object
};

export default CharacterController2DTestDrive;
