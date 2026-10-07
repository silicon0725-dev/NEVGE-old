import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import Renderer from 'scratch-render';
import VM from 'scratch-vm';
import {connect} from 'react-redux';

import {STAGE_DISPLAY_SIZES} from '../lib/layout-constants';
import {getEditorTransformPreview} from '../lib/editor-visualization';
import {materializePortableCapabilityValue} from '../lib/first-party-modules/materialize-portable-capability-value';
import {getPropertyHistory} from '../lib/project-inspector/property-history';
import {CAMERA2D_RUNTIME_CAPABILITY_ID} from '../lib/camera-system';
import {SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID} from '../lib/scratch-sprite-adapter/constants';
import {
    TRANSFORM2D_COMMAND_CAPABILITY_ID,
    createTransform2DEditorClient
} from '../lib/transform-system';
import {getEventXY} from '../lib/touch-utils';
import {FRAME_PROFILER_CATEGORY, getFrameTimeProfiler} from '../lib/frame-profiler/frame-time-profiler';
import {SCRATCH_STAGE_RECT_CACHE_MAX_AGE_MS} from '../lib/scratch-sprite-adapter/scratch-runtime-update-policy';
import VideoProvider from '../lib/video/video-provider';
import {refreshLegacyAddonDomAfterRemount} from '../lib/extension-containment';
import {BitmapAdapter as V2BitmapAdapter} from '@turbowarp/scratch-svg-renderer';

import StageComponent from '../components/stage/stage.jsx';

import {
    activateColorPicker,
    deactivateColorPicker
} from '../reducers/color-picker';

import {setHighQualityPenState} from '../reducers/tw';

const colorPickerRadius = 20;
const dragThreshold = 3; // Same as the block drag threshold

class Stage extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'attachMouseEvents',
            'cancelMouseDownTimeout',
            'detachMouseEvents',
            'handleDoubleClick',
            'handleQuestionAnswered',
            'handleDragCancelKeyDown',
            'handleDragWindowBlur',
            'onMouseUp',
            'onMouseMove',
            'onMouseDown',
            'onStartDrag',
            'onStopDrag',
            'cancelEditorDrag',
            'onWheel',
            'onContextMenu',
            'updateRect',
            'refreshRectIfStale',
            'questionListener',
            'setDragCanvas',
            'clearDragCanvas',
            'drawDragCanvas',
            'positionDragCanvas'
        ]);
        this.state = {
            mouseDownTimeoutId: null,
            mouseDownPosition: null,
            isDragging: false,
            dragOffset: null,
            dragId: null,
            colorInfo: null,
            question: null
        };
        this.rect = null;
        this.lastRectReadAt = 0;
        if (this.props.vm.renderer) {
            this.renderer = this.props.vm.renderer;
            this.canvas = this.renderer.canvas;
        } else {
            this.canvas = document.createElement('canvas');
            this.renderer = new Renderer(
                this.canvas,
                -this.props.customStageSize.width / 2,
                this.props.customStageSize.width / 2,
                -this.props.customStageSize.height / 2,
                this.props.customStageSize.height / 2
            );
            this.props.vm.setStageSize(
                this.props.customStageSize.width,
                this.props.customStageSize.height
            );
            this.props.vm.attachRenderer(this.renderer);

            // Only attach a video provider once because it is stateful
            this.props.vm.setVideoProvider(new VideoProvider());

            // Calling draw a single time before any project is loaded just makes
            // the canvas white instead of solid black–needed because it is not
            // possible to use CSS to style the canvas to have a different
            // default color
            this.props.vm.renderer.draw();

            // tw: handle changes to high quality pen
            this.props.vm.renderer.on('UseHighQualityRenderChanged', this.props.onHighQualityPenChanged);
        }
        this.props.vm.attachV2BitmapAdapter(new V2BitmapAdapter());
    }
    componentDidMount () {
        this.attachRectEvents();
        this.attachMouseEvents(this.canvas);
        this.updateRect();
        this.props.vm.runtime.addListener('QUESTION', this.questionListener);
        document.addEventListener('keydown', this.handleDragCancelKeyDown);
        window.addEventListener('blur', this.handleDragWindowBlur);
        refreshLegacyAddonDomAfterRemount();
    }
    shouldComponentUpdate (nextProps, nextState) {
        return this.props.stageSize !== nextProps.stageSize ||
            this.props.isColorPicking !== nextProps.isColorPicking ||
            this.state.colorInfo !== nextState.colorInfo ||
            this.props.isFullScreen !== nextProps.isFullScreen ||
            this.props.isWindowFullScreen !== nextProps.isWindowFullScreen ||
            this.props.dimensions !== nextProps.dimensions ||
            this.state.question !== nextState.question ||
            this.props.micIndicator !== nextProps.micIndicator ||
            this.props.isStarted !== nextProps.isStarted ||
            this.props.customStageSize !== nextProps.customStageSize ||
            this.props.selectedNodeId !== nextProps.selectedNodeId ||
            this.props.stageDimensionsOverride !== nextProps.stageDimensionsOverride;
    }
    componentDidUpdate (prevProps) {
        if (this.props.isColorPicking && !prevProps.isColorPicking) {
            this.startColorPickingLoop();
        } else if (!this.props.isColorPicking && prevProps.isColorPicking) {
            this.stopColorPickingLoop();
        }
        this.updateRect();
        this.renderer.resize(this.rect.width, this.rect.height);
    }
    componentWillUnmount () {
        if (this.state.isDragging) this.cancelEditorDrag('stage-unmount');
        this.detachMouseEvents(this.canvas);
        this.detachRectEvents();
        this.stopColorPickingLoop();
        this.props.vm.runtime.removeListener('QUESTION', this.questionListener);
        document.removeEventListener('keydown', this.handleDragCancelKeyDown);
        window.removeEventListener('blur', this.handleDragWindowBlur);
    }
    questionListener (question) {
        this.setState({question: question});
    }
    handleQuestionAnswered (answer) {
        this.setState({question: null}, () => {
            this.props.vm.runtime.emit('ANSWER', answer);
        });
    }
    startColorPickingLoop () {
        const callback = () => {
            this.animationFrameId = requestAnimationFrame(callback);
            if (typeof this.pickX === 'number') {
                this.setState({colorInfo: this.getColorInfo(this.pickX, this.pickY)});
            }
        };
        this.animationFrameId = requestAnimationFrame(callback);
    }
    stopColorPickingLoop () {
        cancelAnimationFrame(this.animationFrameId);
    }
    attachMouseEvents (canvas) {
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);
        document.addEventListener('touchmove', this.onMouseMove);
        document.addEventListener('touchend', this.onMouseUp);
        canvas.addEventListener('mousedown', this.onMouseDown);
        canvas.addEventListener('touchstart', this.onMouseDown);
        canvas.addEventListener('wheel', this.onWheel);
        canvas.addEventListener('contextmenu', this.onContextMenu);
    }
    detachMouseEvents (canvas) {
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
        document.removeEventListener('touchmove', this.onMouseMove);
        document.removeEventListener('touchend', this.onMouseUp);
        canvas.removeEventListener('mousedown', this.onMouseDown);
        canvas.removeEventListener('touchstart', this.onMouseDown);
        canvas.removeEventListener('wheel', this.onWheel);
        canvas.removeEventListener('contextmenu', this.onContextMenu);
    }
    attachRectEvents () {
        window.addEventListener('resize', this.updateRect);
        window.addEventListener('scroll', this.updateRect);
    }
    detachRectEvents () {
        window.removeEventListener('resize', this.updateRect);
        window.removeEventListener('scroll', this.updateRect);
    }
    updateRect () {
        const readLayout = () => this.canvas.getBoundingClientRect();
        const runtime = this.props.vm && this.props.vm.runtime;
        if (runtime) {
            const profiler = getFrameTimeProfiler(runtime);
            profiler.count('scratchMouseRectReads');
            this.rect = profiler.measure(FRAME_PROFILER_CATEGORY.SCRATCH_MOUSE_INPUT_LAYOUT, readLayout);
        } else {
            this.rect = readLayout();
        }
        this.lastRectReadAt = typeof performance !== 'undefined' && typeof performance.now === 'function' ?
            performance.now() : Date.now();
        return this.rect;
    }
    refreshRectIfStale () {
        const now = typeof performance !== 'undefined' && typeof performance.now === 'function' ?
            performance.now() : Date.now();
        if (this.rect && (now - this.lastRectReadAt) < SCRATCH_STAGE_RECT_CACHE_MAX_AGE_MS) {
            const runtime = this.props.vm && this.props.vm.runtime;
            if (runtime) getFrameTimeProfiler(runtime).count('scratchMouseRectCacheHits');
            return this.rect;
        }
        return this.updateRect();
    }
    getScratchCoords (x, y) {
        const nativeSize = this.renderer.getNativeSize();
        return [
            (nativeSize[0] / this.rect.width) * (x - (this.rect.width / 2)),
            (nativeSize[1] / this.rect.height) * (y - (this.rect.height / 2))
        ];
    }
    getColorInfo (x, y) {
        return {
            x: x,
            y: y,
            ...this.renderer.extractColor(x, y, colorPickerRadius)
        };
    }
    getEditorTransformPreviewStore () {
        const runtime = this.props.vm && this.props.vm.runtime;
        return runtime ? getEditorTransformPreview(runtime) : null;
    }
    getModuleCapability (capabilityId) {
        const manager = this.props.vm && this.props.vm.runtime && this.props.vm.runtime.ngvgeFirstPartyModules;
        if (!manager || typeof manager.getCapability !== 'function') return null;
        try {
            return manager.getCapability(capabilityId);
        } catch {
            return null;
        }
    }
    getEditorWorldPosition (mouseX, mouseY) {
        const scratchPosition = this.getScratchCoords(mouseX, mouseY);
        const screenPoint = [scratchPosition[0], -scratchPosition[1]];
        const cameraRuntime = this.getModuleCapability(CAMERA2D_RUNTIME_CAPABILITY_ID);
        if (cameraRuntime && typeof cameraRuntime.screenToWorld === 'function') {
            try {
                const worldPoint = materializePortableCapabilityValue(cameraRuntime.screenToWorld(screenPoint));
                if (Array.isArray(worldPoint) && worldPoint.length >= 2 &&
                    Number.isFinite(Number(worldPoint[0])) && Number.isFinite(Number(worldPoint[1]))) {
                    return [Number(worldPoint[0]), Number(worldPoint[1])];
                }
            } catch { /* baseline viewport below */ }
        }
        return screenPoint;
    }
    resolveSemanticDragContext (targetId, target) {
        const scratchAdapter = this.getModuleCapability(SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID);
        const runtimeNodeModel = this.getModuleCapability('ngvge.runtime-node-model');
        const transformCommand = this.getModuleCapability(TRANSFORM2D_COMMAND_CAPABILITY_ID);
        if (!scratchAdapter || !runtimeNodeModel || !transformCommand ||
            typeof scratchAdapter.getBindingByTargetRuntimeId !== 'function' ||
            typeof runtimeNodeModel.getNodeSnapshot !== 'function') return null;
        try {
            const binding = materializePortableCapabilityValue(scratchAdapter.getBindingByTargetRuntimeId(targetId));
            if (!binding || !binding.nodeId) return null;
            const node = materializePortableCapabilityValue(runtimeNodeModel.getNodeSnapshot(binding.nodeId));
            const components = node && Array.isArray(node.components) ? node.components : [];
            const transformComponent = components.find(component => (
                component && component.typeId === 'ngvge.transform2d'
            ));
            if (!transformComponent) return null;
            return {
                authoredPosition: [Number(target.x) || 0, Number(target.y) || 0],
                componentId: transformComponent.id,
                editorClient: createTransform2DEditorClient(transformCommand),
                nodeId: binding.nodeId,
                targetRuntimeId: targetId
            };
        } catch {
            return null;
        }
    }
    setDraggedTargetPreviewVisible (target, visible) {
        if (target && typeof target.setVisible === 'function') {
            try {
                target.setVisible(Boolean(visible));
                return true;
            } catch { /* fallback below */ }
        }
        try {
            this.props.vm.postSpriteInfo({visible: Boolean(visible)});
            return true;
        } catch {
            return false;
        }
    }
    updateEditorDragPreview (mouseX, mouseY) {
        const context = this.dragSemanticContext;
        if (!context || !this.state.dragOffset) return null;
        const mouseWorld = this.getEditorWorldPosition(mouseX, mouseY);
        const previewPosition = [
            mouseWorld[0] + this.state.dragOffset[0],
            mouseWorld[1] + this.state.dragOffset[1]
        ];
        const store = this.getEditorTransformPreviewStore();
        if (store) store.updatePosition(previewPosition);
        return previewPosition;
    }
    commitEditorDragPreview (position) {
        const context = this.dragSemanticContext;
        if (!context || !position) return false;
        try {
            const result = context.editorClient.patchComponent({
                componentId: context.componentId,
                nodeId: context.nodeId,
                patch: {position: [position[0], position[1]]}
            });
            if (result && result.kind === 'error') return false;
            const history = getPropertyHistory(this.props.vm.runtime);
            if (history) {
                history.recordValue({
                    after: [position[0], position[1]],
                    apply: nextPosition => context.editorClient.patchComponent({
                        componentId: context.componentId,
                        nodeId: context.nodeId,
                        patch: {position: nextPosition}
                    }),
                    before: context.authoredPosition,
                    label: 'Move Sprite',
                    metadata: {
                        nodeId: context.nodeId,
                        targetRuntimeId: context.targetRuntimeId,
                        type: 'stage-transform-drag'
                    }
                });
            }
            return true;
        } catch {
            return false;
        }
    }
    handleDragCancelKeyDown (event) {
        if (!event || event.key !== 'Escape' || !this.state.isDragging) return;
        event.preventDefault();
        this.cancelEditorDrag('escape');
    }
    handleDragWindowBlur () {
        if (this.state.isDragging) this.cancelEditorDrag('window-blur');
    }
    cancelEditorDrag (reason = 'cancelled') {
        if (!this.state.isDragging) return false;
        const dragId = this.state.dragId;
        const target = dragId && this.props.vm.runtime && typeof this.props.vm.runtime.getTargetById === 'function' ?
            this.props.vm.runtime.getTargetById(dragId) : null;
        if (this.props.useEditorDragStyle) {
            this.setDraggedTargetPreviewVisible(target, true);
            if (this.dragCanvas) this.clearDragCanvas();
        }
        const previewStore = this.getEditorTransformPreviewStore();
        if (previewStore) previewStore.cancel(reason);
        this.dragSemanticContext = null;
        if (dragId) this.props.vm.stopDrag(dragId);
        this.setState({
            isDragging: false,
            dragOffset: null,
            dragId: null,
            mouseDown: false,
            mouseDownPosition: null
        });
        if (this.props.vm.renderer && typeof this.props.vm.renderer.draw === 'function') this.props.vm.renderer.draw();
        return true;
    }
    handleDoubleClick (e) {
        // tw: Disable editing target changing in certain circumstances to avoid lag
        if (this.props.disableEditingTargetChange) {
            return;
        }
        const {x, y} = getEventXY(e);
        // Set editing target from cursor position, if clicking on a sprite.
        const mousePosition = [x - this.rect.left, y - this.rect.top];
        const drawableId = this.renderer.pick(mousePosition[0], mousePosition[1]);
        if (drawableId === -1) return;
        const targetId = this.props.vm.getTargetIdForDrawableId(drawableId);
        if (targetId === null) return;
        if (this.props.onRequestSelectTarget) {
            this.props.onRequestSelectTarget(targetId);
        } else {
            this.props.vm.setEditingTarget(targetId);
        }
    }
    onMouseMove (e) {
        this.refreshRectIfStale();
        const {x, y} = getEventXY(e);
        const mousePosition = [x - this.rect.left, y - this.rect.top];

        if (this.props.isColorPicking) {
            // Set the pickX/Y for the color picker loop to pick up
            this.pickX = mousePosition[0];
            this.pickY = mousePosition[1];
        }

        if (this.state.mouseDown && !this.state.isDragging) {
            const distanceFromMouseDown = Math.sqrt(
                Math.pow(mousePosition[0] - this.state.mouseDownPosition[0], 2) +
                Math.pow(mousePosition[1] - this.state.mouseDownPosition[1], 2)
            );
            if (distanceFromMouseDown > dragThreshold) {
                this.cancelMouseDownTimeout();
                this.onStartDrag(...this.state.mouseDownPosition);
            }
        }
        if (this.state.mouseDown && this.state.isDragging) {
            // Editor drag style only updates the drag canvas, does full update at the end of drag
            // Non-editor drag style just updates the sprite continuously.
            if (this.props.useEditorDragStyle) {
                this.positionDragCanvas(mousePosition[0], mousePosition[1]);
                this.updateEditorDragPreview(mousePosition[0], mousePosition[1]);
            } else {
                const spritePosition = this.getScratchCoords(mousePosition[0], mousePosition[1]);
                this.props.vm.postSpriteInfo({
                    x: spritePosition[0] + this.state.dragOffset[0],
                    y: -(spritePosition[1] + this.state.dragOffset[1]),
                    force: true
                });
            }
        }
        const coordinates = {
            x: mousePosition[0],
            y: mousePosition[1],
            canvasWidth: this.rect.width,
            canvasHeight: this.rect.height
        };
        this.props.vm.postIOData('mouse', coordinates);
    }
    onMouseUp (e) {
        this.updateRect();
        const {x, y} = getEventXY(e);
        const mousePosition = [x - this.rect.left, y - this.rect.top];
        this.cancelMouseDownTimeout();
        this.setState({
            mouseDown: false,
            mouseDownPosition: null
        });
        const data = {
            isDown: false,
            button: e.button,
            x: x - this.rect.left,
            y: y - this.rect.top,
            canvasWidth: this.rect.width,
            canvasHeight: this.rect.height,
            wasDragged: this.state.isDragging
        };
        if (this.state.isDragging) {
            this.onStopDrag(mousePosition[0], mousePosition[1]);
        }
        this.props.vm.postIOData('mouse', data);

        if (this.props.isColorPicking &&
            mousePosition[0] > 0 && mousePosition[0] < this.rect.width &&
            mousePosition[1] > 0 && mousePosition[1] < this.rect.height
        ) {
            const {r, g, b} = this.state.colorInfo.color;
            const componentToString = c => {
                const hex = c.toString(16);
                return hex.length === 1 ? `0${hex}` : hex;
            };
            const colorString = `#${componentToString(r)}${componentToString(g)}${componentToString(b)}`;
            this.props.onDeactivateColorPicker(colorString);
            this.setState({colorInfo: null});
            this.pickX = null;
            this.pickY = null;
        }
    }
    onMouseDown (e) {
        this.updateRect();
        const {x, y} = getEventXY(e);
        const mousePosition = [x - this.rect.left, y - this.rect.top];
        if (this.props.isColorPicking) {
            // Set the pickX/Y for the color picker loop to pick up
            this.pickX = mousePosition[0];
            this.pickY = mousePosition[1];
            // Immediately update the color picker info
            this.setState({colorInfo: this.getColorInfo(this.pickX, this.pickY)});
        } else {
            const isTouchEvent = window.TouchEvent && e instanceof TouchEvent;
            if (e.button === 0 || isTouchEvent) {
                this.setState({
                    mouseDown: true,
                    mouseDownPosition: mousePosition,
                    mouseDownTimeoutId: setTimeout(
                        this.onStartDrag.bind(this, mousePosition[0], mousePosition[1]),
                        400
                    )
                });
            }
            const data = {
                isDown: true,
                button: e.button,
                x: mousePosition[0],
                y: mousePosition[1],
                canvasWidth: this.rect.width,
                canvasHeight: this.rect.height
            };
            this.props.vm.postIOData('mouse', data);
            if (isTouchEvent && e.preventDefault) {
                // Prevent default to prevent touch from dragging page
                e.preventDefault();
                // But we do want any active input to be blurred
                if (document.activeElement && document.activeElement.blur) {
                    document.activeElement.blur();
                }
            }
        }
    }
    onWheel (e) {
        const data = {
            deltaX: e.deltaX,
            deltaY: e.deltaY
        };
        this.props.vm.postIOData('mouseWheel', data);
    }
    onContextMenu (e) {
        if (this.props.vm.runtime.ioDevices.mouse.usesRightClickDown) {
            e.preventDefault();
        }
    }
    cancelMouseDownTimeout () {
        if (this.state.mouseDownTimeoutId !== null) {
            clearTimeout(this.state.mouseDownTimeoutId);
        }
        this.setState({mouseDownTimeoutId: null});
    }
    /**
     * Initialize the position of the "dragged sprite" canvas
     * @param {DrawableExtraction} drawableData The data returned from renderer.extractDrawableScreenSpace
     * @param {number} x The x position of the initial drag event
     * @param {number} y The y position of the initial drag event
     */
    drawDragCanvas (drawableData, x, y) {
        const {
            imageData,
            x: boundsX,
            y: boundsY,
            width: boundsWidth,
            height: boundsHeight
        } = drawableData;
        this.dragCanvas.width = imageData.width;
        this.dragCanvas.height = imageData.height;
        // On high-DPI devices, the canvas size in layout-pixels is not equal to the size of the extracted data.
        this.dragCanvas.style.width = `${boundsWidth}px`;
        this.dragCanvas.style.height = `${boundsHeight}px`;

        this.dragCanvas.getContext('2d').putImageData(imageData, 0, 0);
        // Position so that pick location is at (0, 0) so that  positionDragCanvas()
        // can use translation to move to mouse position smoothly.
        this.dragCanvas.style.left = `${boundsX - x}px`;
        this.dragCanvas.style.top = `${boundsY - y}px`;
        this.dragCanvas.style.display = 'block';
    }
    clearDragCanvas () {
        this.dragCanvas.width = this.dragCanvas.height = 0;
        this.dragCanvas.style.display = 'none';
    }
    positionDragCanvas (mouseX, mouseY) {
        // mouseX/Y are relative to stage top/left, and dragCanvas is already
        // positioned so that the pick location is at (0,0).
        this.dragCanvas.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
    }
    onStartDrag (x, y) {
        if (this.state.dragId) return;
        const drawableId = this.renderer.pick(x, y);
        if (drawableId === -1) return;
        const targetId = this.props.vm.getTargetIdForDrawableId(drawableId);
        if (targetId === null) return;

        const target = this.props.vm.runtime.getTargetById(targetId);

        // Do not start drag unless in editor drag mode or target is draggable
        if (!(this.props.useEditorDragStyle || target.draggable)) return;

        // Dragging always brings the target to the front
        target.goToFront();

        const mouseWorld = this.getEditorWorldPosition(x, y);
        const offsetX = target.x - mouseWorld[0];
        const offsetY = target.y - mouseWorld[1];
        this.dragSemanticContext = this.resolveSemanticDragContext(targetId, target);
        const previewStore = this.getEditorTransformPreviewStore();
        if (previewStore && this.dragSemanticContext) {
            previewStore.begin({
                authoredPosition: this.dragSemanticContext.authoredPosition,
                nodeId: this.dragSemanticContext.nodeId,
                previewPosition: this.dragSemanticContext.authoredPosition,
                reason: 'stage-drag',
                targetRuntimeId: targetId
            });
        } else if (previewStore) {
            previewStore.cancel('unbound-scratch-target');
        }

        this.props.vm.startDrag(targetId);
        this.setState({
            isDragging: true,
            dragId: targetId,
            dragOffset: [offsetX, offsetY]
        });
        if (this.props.useEditorDragStyle) {
            // Extract the drawable art
            const drawableData = this.renderer.extractDrawableScreenSpace(drawableId);
            this.drawDragCanvas(drawableData, x, y);
            this.positionDragCanvas(x, y);
            this.setDraggedTargetPreviewVisible(target, false);
            this.props.vm.renderer.draw();
        }
    }
    onStopDrag (mouseX, mouseY) {
        const dragId = this.state.dragId;
        const target = dragId && this.props.vm.runtime && typeof this.props.vm.runtime.getTargetById === 'function' ?
            this.props.vm.runtime.getTargetById(dragId) : null;
        const previewStore = this.getEditorTransformPreviewStore();
        const commonStopDragActions = () => {
            this.props.vm.stopDrag(dragId);
            this.dragSemanticContext = null;
            this.setState({
                isDragging: false,
                dragOffset: null,
                dragId: null
            });
        };
        if (this.props.useEditorDragStyle) {
            let finalPosition = null;
            if (mouseX > 0 && mouseX < this.rect.width &&
                mouseY > 0 && mouseY < this.rect.height) {
                finalPosition = this.updateEditorDragPreview(mouseX, mouseY);
            }
            let committed = false;
            if (finalPosition && this.dragSemanticContext) {
                committed = this.commitEditorDragPreview(finalPosition);
            } else if (finalPosition) {
                // Compatibility fallback for an unbound Scratch target. Functional Sprite2D
                // bindings always commit through the Transform2D Writer Router above.
                this.props.vm.postSpriteInfo({
                    force: true,
                    x: finalPosition[0],
                    y: finalPosition[1]
                });
                committed = true;
            }
            this.setDraggedTargetPreviewVisible(target, true);
            this.clearDragCanvas();
            if (previewStore) {
                if (committed) previewStore.commit('pointer-up');
                else previewStore.cancel('drop-outside-or-command-rejected');
            }
            commonStopDragActions();
            this.props.vm.renderer.draw();
        } else {
            if (previewStore) previewStore.cancel('runtime-drag-style');
            commonStopDragActions();
        }
    }
    setDragCanvas (canvas) {
        this.dragCanvas = canvas;
    }
    render () {
        const {
            vm, // eslint-disable-line no-unused-vars
            onActivateColorPicker, // eslint-disable-line no-unused-vars
            disableEditingTargetChange, // eslint-disable-line no-unused-vars
            ...props
        } = this.props;
        return (
            <StageComponent
                canvas={this.canvas}
                vm={this.props.vm}
                overlay={this.props.vm.runtime.renderer.overlayContainer}
                colorInfo={this.state.colorInfo}
                dragRef={this.setDragCanvas}
                question={this.state.question}
                isDragging={this.state.isDragging}
                onDoubleClick={this.handleDoubleClick}
                onQuestionAnswered={this.handleQuestionAnswered}
                {...props}
            />
        );
    }
}

Stage.propTypes = {
    onHighQualityPenChanged: PropTypes.func,
    onRequestSelectTarget: PropTypes.func,
    highQualityPen: PropTypes.bool,
    customStageSize: PropTypes.shape({
        width: PropTypes.number,
        height: PropTypes.number
    }),
    disableEditingTargetChange: PropTypes.bool,
    isColorPicking: PropTypes.bool,
    isFullScreen: PropTypes.bool.isRequired,
    isPlayerOnly: PropTypes.bool,
    isRtl: PropTypes.bool,
    isWindowFullScreen: PropTypes.bool,
    dimensions: PropTypes.arrayOf(PropTypes.number),
    isStarted: PropTypes.bool,
    micIndicator: PropTypes.bool,
    onActivateColorPicker: PropTypes.func,
    onDeactivateColorPicker: PropTypes.func,
    selectedNodeId: PropTypes.string,
    stageSize: PropTypes.oneOf(Object.keys(STAGE_DISPLAY_SIZES)).isRequired,
    stageDimensionsOverride: PropTypes.shape({
        width: PropTypes.number,
        height: PropTypes.number,
        widthDefault: PropTypes.number,
        heightDefault: PropTypes.number,
        scale: PropTypes.number
    }),
    useEditorDragStyle: PropTypes.bool,
    vm: PropTypes.instanceOf(VM).isRequired
};

Stage.defaultProps = {
    useEditorDragStyle: true
};

const mapStateToProps = state => ({
    highQualityPen: state.scratchGui.tw.highQualityPen,
    customStageSize: state.scratchGui.customStageSize,
    disableEditingTargetChange: (
        state.scratchGui.mode.isFullScreen ||
        state.scratchGui.mode.isEmbedded ||
        state.scratchGui.mode.isPlayerOnly
    ),
    isColorPicking: state.scratchGui.colorPicker.active,
    isFullScreen: state.scratchGui.mode.isFullScreen || state.scratchGui.mode.isEmbedded,
    isPlayerOnly: state.scratchGui.mode.isPlayerOnly,
    isRtl: state.locales.isRtl,
    isWindowFullScreen: state.scratchGui.tw.isWindowFullScreen,
    dimensions: state.scratchGui.tw.dimensions,
    isStarted: state.scratchGui.vmStatus.started,
    micIndicator: state.scratchGui.micIndicator,
    selectedNodeId: state.scratchGui.projectExplorer.selectedNodeId,
    // Do not use editor drag style in fullscreen or player mode.
    useEditorDragStyle: !(state.scratchGui.mode.isFullScreen || state.scratchGui.mode.isPlayerOnly)
});

const mapDispatchToProps = dispatch => ({
    // tw: handler for syncing high quality pen option changes
    onHighQualityPenChanged: enabled => dispatch(setHighQualityPenState(enabled)),
    onActivateColorPicker: () => dispatch(activateColorPicker()),
    onDeactivateColorPicker: color => dispatch(deactivateColorPicker(color))
});

export {Stage};

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(Stage);
