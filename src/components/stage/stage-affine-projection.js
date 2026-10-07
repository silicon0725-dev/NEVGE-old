const validPoint = point => Array.isArray(point) && point.length >= 2 &&
    Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1]));

const createAffinePointProjector = samplePoint => {
    if (typeof samplePoint !== 'function') return point => point;
    let origin;
    let axisX;
    let axisY;
    try {
        origin = samplePoint([0, 0]);
        const sampleX = samplePoint([1, 0]);
        const sampleY = samplePoint([0, 1]);
        if (!validPoint(origin) || !validPoint(sampleX) || !validPoint(sampleY)) throw new Error('invalid affine samples');
        axisX = [sampleX[0] - origin[0], sampleX[1] - origin[1]];
        axisY = [sampleY[0] - origin[0], sampleY[1] - origin[1]];
    } catch {
        return point => {
            try {
                const sampled = samplePoint(point);
                return validPoint(sampled) ? [Number(sampled[0]), Number(sampled[1])] : [Number(point[0]) || 0, Number(point[1]) || 0];
            } catch {
                return [Number(point[0]) || 0, Number(point[1]) || 0];
            }
        };
    }
    return point => {
        const x = Number(point && point[0]) || 0;
        const y = Number(point && point[1]) || 0;
        return [
            origin[0] + axisX[0] * x + axisY[0] * y,
            origin[1] + axisX[1] * x + axisY[1] * y
        ];
    };
};

const createCameraWorldToStageProjector = options => {
    const {
        cameraRuntime,
        height,
        materialize,
        nativeHeight,
        nativeWidth,
        width
    } = options;
    const sampleWorldToScreen = point => {
        if (!cameraRuntime || typeof cameraRuntime.worldToScreen !== 'function') return point;
        const value = cameraRuntime.worldToScreen(point);
        return typeof materialize === 'function' ? materialize(value) : value;
    };
    const worldToScreen = createAffinePointProjector(sampleWorldToScreen);
    return point => {
        const screen = worldToScreen(point);
        return [
            (width / 2) + ((screen[0] / nativeWidth) * width),
            (height / 2) - ((screen[1] / nativeHeight) * height)
        ];
    };
};

const createNodeLocalToWorldProjector = options => {
    const {materialize, nodeId, runtime} = options;
    if (!runtime || typeof runtime.localPointToWorld !== 'function' || !nodeId) return point => point;
    return createAffinePointProjector(point => {
        const value = runtime.localPointToWorld(nodeId, point);
        return typeof materialize === 'function' ? materialize(value) : value;
    });
};

export {
    createAffinePointProjector,
    createCameraWorldToStageProjector,
    createNodeLocalToWorldProjector
};
