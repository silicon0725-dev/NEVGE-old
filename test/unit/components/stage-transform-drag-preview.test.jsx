jest.mock('scratch-render', () => function ScratchRendererMock () {}, {virtual: true});
jest.mock('scratch-vm', () => function ScratchVMMock () {}, {virtual: true});
jest.mock('@turbowarp/scratch-svg-renderer', () => ({
    BitmapAdapter: function BitmapAdapterMock () {}
}), {virtual: true});

jest.mock('../../../src/components/stage/stage.jsx', () => function StageComponentMock () { return null; });
import {Stage} from '../../../src/containers/stage.jsx';
import {getEditorTransformPreview} from '../../../src/lib/editor-visualization';
import {getPropertyHistory} from '../../../src/lib/project-inspector/property-history';

const makeStage = () => {
    const canvas = {height: 360, width: 480};
    const target = {
        draggable: false,
        goToFront: jest.fn(),
        id: 'scratch-player',
        setVisible: jest.fn(value => { target.visible = value; }),
        visible: true,
        x: 10,
        y: -20
    };
    const executeTransformCommand = jest.fn(() => ({kind: 'event', type: 'PatchComponentApplied'}));
    const capabilities = new Map([
        ['ngvge.camera2d-runtime', {
            screenToWorld: point => point
        }],
        ['ngvge.scratch-sprite-node-adapter', {
            getBindingByTargetRuntimeId: targetId => targetId === target.id ? {
                nodeId: 'sprite-node',
                targetRuntimeId: target.id
            } : null
        }],
        ['ngvge.runtime-node-model', {
            getNodeSnapshot: nodeId => nodeId === 'sprite-node' ? {
                components: [{id: 'transform-component', typeId: 'ngvge.transform2d'}],
                id: 'sprite-node'
            } : null
        }],
        ['ngvge.transform2d-command', {
            capabilityId: 'ngvge.transform2d-command',
            executeCommand: executeTransformCommand,
            version: 1
        }]
    ]);
    const renderer = {
        canvas,
        draw: jest.fn(),
        extractDrawableScreenSpace: jest.fn(() => ({
            height: 20,
            imageData: {height: 20, width: 20},
            width: 20,
            x: 230,
            y: 170
        })),
        getNativeSize: () => [480, 360],
        pick: () => 9
    };
    const runtime = {
        getTargetById: id => id === target.id ? target : null,
        ngvgeFirstPartyModules: {
            getCapability: id => capabilities.get(id) || null
        },
        renderer
    };
    const vm = {
        attachV2BitmapAdapter: jest.fn(),
        getTargetIdForDrawableId: () => target.id,
        postSpriteInfo: jest.fn(),
        renderer,
        runtime,
        startDrag: jest.fn(),
        stopDrag: jest.fn()
    };
    const stage = new Stage({
        customStageSize: {height: 360, width: 480},
        onHighQualityPenChanged: jest.fn(),
        useEditorDragStyle: true,
        vm
    });
    stage.rect = {height: 360, width: 480};
    stage.dragCanvas = {
        getContext: () => ({putImageData: jest.fn()}),
        height: 0,
        style: {},
        width: 0
    };
    stage.setState = update => {
        const patch = typeof update === 'function' ? update(stage.state, stage.props) : update;
        stage.state = Object.assign({}, stage.state, patch);
    };
    return {executeTransformCommand, runtime, stage, target, vm};
};

describe('WS-10N6-HF7 Stage transient transform drag preview', () => {
    test('previews continuously and commits one semantic Transform2D write on release', () => {
        const {executeTransformCommand, runtime, stage, target, vm} = makeStage();
        stage.onStartDrag(240, 180);

        expect(getEditorTransformPreview(runtime).getSnapshot()).toMatchObject({
            active: true,
            authoredPosition: [10, -20],
            nodeId: 'sprite-node'
        });
        expect(target.setVisible).toHaveBeenLastCalledWith(false);

        stage.updateEditorDragPreview(300, 180);
        expect(getEditorTransformPreview(runtime).getSnapshot()).toMatchObject({
            active: true,
            delta: [60, 0],
            previewPosition: [70, -20]
        });
        expect(executeTransformCommand).not.toHaveBeenCalled();

        stage.onStopDrag(300, 180);
        expect(executeTransformCommand).toHaveBeenCalledTimes(1);
        expect(executeTransformCommand.mock.calls[0][0]).toMatchObject({
            payload: {
                componentId: 'transform-component',
                nodeId: 'sprite-node',
                patch: {position: [70, -20]}
            },
            type: 'PatchComponent'
        });
        expect(vm.postSpriteInfo).not.toHaveBeenCalledWith(expect.objectContaining({x: expect.any(Number)}));
        expect(target.setVisible).toHaveBeenLastCalledWith(true);
        expect(getEditorTransformPreview(runtime).getSnapshot().active).toBe(false);
        expect(getPropertyHistory(runtime).getState()).toMatchObject({undoDepth: 1, undoLabel: 'Move Sprite'});
    });

    test('Escape cancels the preview without committing position', () => {
        const {executeTransformCommand, runtime, stage, target, vm} = makeStage();
        stage.onStartDrag(240, 180);
        stage.updateEditorDragPreview(330, 200);
        stage.handleDragCancelKeyDown({key: 'Escape', preventDefault: jest.fn()});

        expect(executeTransformCommand).not.toHaveBeenCalled();
        expect(vm.stopDrag).toHaveBeenCalledWith(target.id);
        expect(getEditorTransformPreview(runtime).getSnapshot()).toMatchObject({active: false, reason: 'escape'});
        expect(target.setVisible).toHaveBeenLastCalledWith(true);
    });
});
