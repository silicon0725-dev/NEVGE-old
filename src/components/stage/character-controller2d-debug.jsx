import PropTypes from 'prop-types';
import React from 'react';

import {CAMERA2D_RUNTIME_CAPABILITY_ID} from '../../lib/camera-system';
import {materializePortableCapabilityValue} from '../../lib/first-party-modules/materialize-portable-capability-value';
import {CHARACTER_CONTROLLER2D_RUNTIME_CAPABILITY_ID} from '../../lib/character-controller-system';
import styles from './stage.css';

const getCapability = (vm, capabilityId) => {
    const manager = vm && vm.runtime && vm.runtime.ngvgeFirstPartyModules;
    if (!manager || typeof manager.getCapability !== 'function') return null;
    try {
        return manager.getCapability(capabilityId);
    } catch {
        return null;
    }
};

const finitePoint = value => (
    Array.isArray(value) && value.length === 2 && value.every(item => Number.isFinite(Number(item)))
);

const CharacterController2DDebug = ({nodeId, stageDimensions, vm}) => {
    const [revision, setRevision] = React.useState(0);
    const characterRuntime = getCapability(vm, CHARACTER_CONTROLLER2D_RUNTIME_CAPABILITY_ID);
    const cameraRuntime = getCapability(vm, CAMERA2D_RUNTIME_CAPABILITY_ID);

    React.useEffect(() => {
        const unsubscribers = [];
        const refresh = () => setRevision(value => value + 1);
        if (characterRuntime && typeof characterRuntime.subscribe === 'function') {
            unsubscribers.push(characterRuntime.subscribe(refresh));
        }
        if (cameraRuntime && typeof cameraRuntime.subscribe === 'function') {
            unsubscribers.push(cameraRuntime.subscribe(refresh));
        }
        return () => unsubscribers.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') unsubscribe();
        });
    }, [cameraRuntime, characterRuntime]);

    const controller = React.useMemo(() => {
        if (!nodeId || !characterRuntime || typeof characterRuntime.getController !== 'function') return null;
        try {
            return materializePortableCapabilityValue(characterRuntime.getController(nodeId));
        } catch {
            return null;
        }
    }, [characterRuntime, nodeId, revision]);

    if (!controller || !controller.state || !finitePoint(controller.worldOrigin)) return null;

    const renderer = vm && vm.renderer;
    const nativeSize = renderer && typeof renderer.getNativeSize === 'function' ? renderer.getNativeSize() : [480, 360];
    const nativeWidth = Number(nativeSize && nativeSize[0]) || 480;
    const nativeHeight = Number(nativeSize && nativeSize[1]) || 360;
    const width = Number(stageDimensions && stageDimensions.width) || nativeWidth;
    const height = Number(stageDimensions && stageDimensions.height) || nativeHeight;
    const worldToScreen = point => {
        if (cameraRuntime && typeof cameraRuntime.worldToScreen === 'function') {
            try { return materializePortableCapabilityValue(cameraRuntime.worldToScreen(point)); } catch { /* baseline below */ }
        }
        return point;
    };
    const toStagePoint = point => {
        const screen = worldToScreen(point);
        return [
            (width / 2) + ((screen[0] / nativeWidth) * width),
            (height / 2) - ((screen[1] / nativeHeight) * height)
        ];
    };
    const origin = controller.worldOrigin;
    const center = toStagePoint(origin);
    const velocity = finitePoint(controller.state.velocity) ? controller.state.velocity.map(Number) : [0, 0];
    const velocityEnd = toStagePoint([
        origin[0] + (velocity[0] * 0.05),
        origin[1] + (velocity[1] * 0.05)
    ]);
    const floorNormal = finitePoint(controller.state.floorNormal) ? controller.state.floorNormal.map(Number) : [0, 0];
    const wallNormal = finitePoint(controller.state.wallNormal) ? controller.state.wallNormal.map(Number) : [0, 0];
    const floorEnd = toStagePoint([origin[0] + (floorNormal[0] * 28), origin[1] + (floorNormal[1] * 28)]);
    const wallEnd = toStagePoint([origin[0] + (wallNormal[0] * 28), origin[1] + (wallNormal[1] * 28)]);
    const lastSafe = finitePoint(controller.state.lastSafeWorldOrigin) ?
        toStagePoint(controller.state.lastSafeWorldOrigin.map(Number)) : null;
    const markerSize = Math.max(3, Math.min(width / nativeWidth, height / nativeHeight) * 4);

    return (
        <svg
            aria-hidden="true"
            className={styles.characterDebugOverlay}
            data-ngvge-character-debug-overlay="true"
            data-ngvge-character-node-id={controller.nodeId}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            width={width}
        >
            <circle
                className={styles.characterDebugOrigin}
                cx={center[0]}
                cy={center[1]}
                r={markerSize}
            />
            {(Math.abs(velocity[0]) > 1e-8 || Math.abs(velocity[1]) > 1e-8) ? (
                <line
                    className={styles.characterDebugVelocity}
                    data-ngvge-character-debug-vector="velocity"
                    x1={center[0]}
                    x2={velocityEnd[0]}
                    y1={center[1]}
                    y2={velocityEnd[1]}
                />
            ) : null}
            {controller.state.onFloor ? (
                <line
                    className={styles.characterDebugFloorNormal}
                    data-ngvge-character-debug-vector="floor-normal"
                    x1={center[0]}
                    x2={floorEnd[0]}
                    y1={center[1]}
                    y2={floorEnd[1]}
                />
            ) : null}
            {controller.state.onWall ? (
                <line
                    className={styles.characterDebugWallNormal}
                    data-ngvge-character-debug-vector="wall-normal"
                    x1={center[0]}
                    x2={wallEnd[0]}
                    y1={center[1]}
                    y2={wallEnd[1]}
                />
            ) : null}
            {lastSafe ? (
                <g data-ngvge-character-debug-anchor="last-safe">
                    <line
                        className={styles.characterDebugAnchor}
                        x1={lastSafe[0] - markerSize}
                        x2={lastSafe[0] + markerSize}
                        y1={lastSafe[1]}
                        y2={lastSafe[1]}
                    />
                    <line
                        className={styles.characterDebugAnchor}
                        x1={lastSafe[0]}
                        x2={lastSafe[0]}
                        y1={lastSafe[1] - markerSize}
                        y2={lastSafe[1] + markerSize}
                    />
                </g>
            ) : null}
        </svg>
    );
};

CharacterController2DDebug.propTypes = {
    nodeId: PropTypes.string,
    stageDimensions: PropTypes.shape({
        height: PropTypes.number,
        width: PropTypes.number
    }),
    vm: PropTypes.object
};

export default CharacterController2DDebug;
