jest.mock('scratch-render', () => function ScratchRendererMock () {}, {virtual: true});
jest.mock('scratch-vm', () => function ScratchVMMock () {}, {virtual: true});
jest.mock('@turbowarp/scratch-svg-renderer', () => ({
    BitmapAdapter: function BitmapAdapterMock () {}
}), {virtual: true});
jest.mock('../../../src/components/stage/stage.jsx', () => function StageComponentMock () { return null; });

import {Stage} from '../../../src/containers/stage.jsx';

const makeStage = () => {
    const rect = {height: 360, left: 10, top: 20, width: 480};
    const canvas = {
        getBoundingClientRect: jest.fn(() => rect)
    };
    const renderer = {
        canvas,
        getNativeSize: () => [480, 360]
    };
    const runtime = {};
    const vm = {
        attachV2BitmapAdapter: jest.fn(),
        postIOData: jest.fn(),
        renderer,
        runtime
    };
    const stage = new Stage({
        customStageSize: {height: 360, width: 480},
        onHighQualityPenChanged: jest.fn(),
        vm
    });
    return {canvas, rect, stage, vm};
};

describe('WS-10N8-HF14.8 Stage mouse input layout cache', () => {
    test('reuses a fresh Stage rect during high-frequency mousemove', () => {
        const {canvas, stage, vm} = makeStage();
        stage.updateRect();
        expect(canvas.getBoundingClientRect).toHaveBeenCalledTimes(1);

        stage.onMouseMove({clientX: 110, clientY: 120});
        stage.onMouseMove({clientX: 130, clientY: 140});

        expect(canvas.getBoundingClientRect).toHaveBeenCalledTimes(1);
        expect(vm.postIOData).toHaveBeenLastCalledWith('mouse', {
            canvasHeight: 360,
            canvasWidth: 480,
            x: 120,
            y: 120
        });
    });

    test('refreshes a stale rect before projecting mouse input', () => {
        const {canvas, stage} = makeStage();
        stage.updateRect();
        stage.lastRectReadAt = -Infinity;
        stage.onMouseMove({clientX: 110, clientY: 120});
        expect(canvas.getBoundingClientRect).toHaveBeenCalledTimes(2);
    });
});
