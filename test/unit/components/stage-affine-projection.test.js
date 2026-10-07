import {
    createAffinePointProjector,
    createCameraWorldToStageProjector,
    createNodeLocalToWorldProjector
} from '../../../src/components/stage/stage-affine-projection';

describe('WS-10N8-HF2 Stage affine projection fast path', () => {
    test('samples an affine transform three times and projects arbitrary points locally afterwards', () => {
        const sample = jest.fn(([x, y]) => [10 + 2 * x + 3 * y, -5 - x + 4 * y]);
        const project = createAffinePointProjector(sample);
        expect(sample).toHaveBeenCalledTimes(3);
        for (let index = 0; index < 1000; index++) {
            expect(project([index, index * 0.25])).toEqual([
                10 + 2 * index + 3 * index * 0.25,
                -5 - index + 4 * index * 0.25
            ]);
        }
        expect(sample).toHaveBeenCalledTimes(3);
    });

    test('camera world-to-stage projection crosses the capability boundary only three times per projector', () => {
        const cameraRuntime = {
            worldToScreen: jest.fn(([x, y]) => [100 + x * 2 - y, -50 + x + y * 3])
        };
        const project = createCameraWorldToStageProjector({
            cameraRuntime,
            height: 360,
            materialize: value => value,
            nativeHeight: 360,
            nativeWidth: 480,
            width: 480
        });
        for (let index = 0; index < 4000; index++) project([index % 100, Math.floor(index / 100)]);
        expect(cameraRuntime.worldToScreen).toHaveBeenCalledTimes(3);
    });

    test('node local-to-world projection crosses its runtime capability only three times', () => {
        const runtime = {
            localPointToWorld: jest.fn((nodeId, [x, y]) => {
                expect(nodeId).toBe('tilemap');
                return [20 + x * 1.5, 30 + x * 0.25 + y * 2];
            })
        };
        const project = createNodeLocalToWorldProjector({
            materialize: value => value,
            nodeId: 'tilemap',
            runtime
        });
        for (let index = 0; index < 4096; index++) project([index % 64, Math.floor(index / 64)]);
        expect(runtime.localPointToWorld).toHaveBeenCalledTimes(3);
    });
});
