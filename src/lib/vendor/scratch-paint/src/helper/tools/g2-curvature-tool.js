import paper from '@turbowarp/paper';
import Modes from '../../lib/modes';
import {styleShape} from '../style-path';
import {clearSelection} from '../selection';
import {getSquareDimensions} from '../math';
import BoundingBoxTool from '../selection-tools/bounding-box-tool';
import NudgeTool from '../selection-tools/nudge-tool';

/**
 * Tool for drawing G2 curvature rectangles with continuous curvature
 */
class G2CurvatureTool extends paper.Tool {
    static get TOLERANCE () {
        return 2;
    }

    /**
     * @param {function} setSelectedItems Callback to set the set of selected items in the Redux state
     * @param {function} clearSelectedItems Callback to clear the set of selected items in the Redux state
     * @param {function} setCursor Callback to set the visible mouse cursor
     * @param {!function} onUpdateImage A callback to call when the image visibly changes
     */
    constructor (setSelectedItems, clearSelectedItems, setCursor, onUpdateImage) {
        super();
        this.setSelectedItems = setSelectedItems;
        this.clearSelectedItems = clearSelectedItems;
        this.onUpdateImage = onUpdateImage;
        this.boundingBoxTool = new BoundingBoxTool(
            Modes.G2_CURVATURE,
            setSelectedItems,
            clearSelectedItems,
            setCursor,
            onUpdateImage
        );
        const nudgeTool = new NudgeTool(Modes.G2_CURVATURE, this.boundingBoxTool, onUpdateImage);

        this.onMouseDown = this.handleMouseDown;
        this.onMouseMove = this.handleMouseMove;
        this.onMouseDrag = this.handleMouseDrag;
        this.onMouseUp = this.handleMouseUp;
        this.onKeyUp = nudgeTool.onKeyUp;
        this.onKeyDown = nudgeTool.onKeyDown;

        this.rect = null;
        this.colorState = null;
        this.isBoundingBoxMode = null;
        this.active = false;
        this.cornerRadius = 20;
        this.smoothing = 0.75;
    }

    getHitOptions () {
        return {
            segments: true,
            stroke: true,
            curves: true,
            fill: true,
            guide: false,
            match: hitResult =>
                (hitResult.item.data && (hitResult.item.data.isScaleHandle || hitResult.item.data.isRotHandle)) ||
                hitResult.item.selected,
            tolerance: G2CurvatureTool.TOLERANCE / paper.view.zoom
        };
    }

    onSelectionChanged (selectedItems) {
        this.boundingBoxTool.onSelectionChanged(selectedItems);
    }

    setColorState (colorState) {
        this.colorState = colorState;
    }

    setCornerRadius (radius) {
        this.cornerRadius = radius;
    }

    setSmoothing (smoothing) {
        this.smoothing = smoothing;
    }

    /**
     * Create G2 smooth rectangle path
     * @param {paper.Rectangle} rect The bounding rectangle
     * @param {number} radius Base corner radius
     * @param {number} smoothing G2 smoothing factor (0-1)
     * @returns {paper.Path} The G2 smooth rectangle path
     */
    createG2SmoothRect (rect, radius, smoothing) {
        if (rect.width === 0 || rect.height === 0) return new paper.Path();

        const minDim = Math.min(rect.width, rect.height);
        const r = Math.min(radius, minDim / 2);

        // G2 核心逻辑 1: 曲线起点后推
        // smoothing = 0 时，起点就是普通的 r
        // smoothing = 1 时，起点会向后退 1.5 倍的 r，让曲线有空间变得平滑
        let offset = r * (1 + smoothing * 0.5);
        offset = Math.min(offset, minDim / 2);

        // G2 核心逻辑 2: 调整贝塞尔控制柄长度
        // 0.55228 是完美正圆的贝塞尔常数 (G1连续)
        // 随着 smoothing 增加，拉长控制柄比例，迫使曲线在连接处贴合直线（曲率趋向0，实现G2）
        const handleRatio = 0.55228 + (smoothing * 0.15);
        const handleLength = offset * handleRatio;

        const path = new paper.Path({
            closed: true,
            strokeColor: '#3b82f6',
            strokeWidth: 3,
            fillColor: 'rgba(59, 130, 246, 0.1)'
        });

        const top = rect.top, bottom = rect.bottom;
        const left = rect.left, right = rect.right;

        // 按照顺时针方向，手动锚定 8 个点（每个角 2 个点）
        // new paper.Segment(Point, handleIn, handleOut)

        // 1. 顶部边缘，左侧起始点
        path.add(new paper.Segment(
            new paper.Point(left + offset, top),
            new paper.Point(-handleLength, 0),
            null
        ));

        // 2. 顶部边缘，右侧结束点
        path.add(new paper.Segment(
            new paper.Point(right - offset, top),
            null,
            new paper.Point(handleLength, 0)
        ));

        // 3. 右侧边缘，顶部起始点
        path.add(new paper.Segment(
            new paper.Point(right, top + offset),
            new paper.Point(0, -handleLength),
            null
        ));

        // 4. 右侧边缘，底部结束点
        path.add(new paper.Segment(
            new paper.Point(right, bottom - offset),
            null,
            new paper.Point(0, handleLength)
        ));

        // 5. 底部边缘，右侧起始点
        path.add(new paper.Segment(
            new paper.Point(right - offset, bottom),
            new paper.Point(handleLength, 0),
            null
        ));

        // 6. 底部边缘，左侧结束点
        path.add(new paper.Segment(
            new paper.Point(left + offset, bottom),
            null,
            new paper.Point(-handleLength, 0)
        ));

        // 7. 左侧边缘，底部起始点
        path.add(new paper.Segment(
            new paper.Point(left, bottom - offset),
            new paper.Point(0, handleLength),
            null
        ));

        // 8. 左侧边缘，顶部结束点
        path.add(new paper.Segment(
            new paper.Point(left, top + offset),
            null,
            new paper.Point(0, -handleLength)
        ));

        return path;
    }

    handleMouseDown (event) {
        if (event.event.button > 0) return;
        this.active = true;

        if (this.boundingBoxTool.onMouseDown(
            event, false, false, false, this.getHitOptions())) {
            this.isBoundingBoxMode = true;
        } else {
            this.isBoundingBoxMode = false;
            clearSelection(this.clearSelectedItems);
        }
    }

    handleMouseDrag (event) {
        if (event.event.button > 0 || !this.active) return;

        if (this.isBoundingBoxMode) {
            this.boundingBoxTool.onMouseDrag(event);
            return;
        }

        if (this.rect) {
            this.rect.remove();
        }

        const rect = new paper.Rectangle(event.downPoint, event.point);
        const squareDimensions = getSquareDimensions(event.downPoint, event.point);
        if (event.modifiers.shift) {
            rect.size = squareDimensions.size.abs();
        }

        this.rect = this.createG2SmoothRect(rect, this.cornerRadius, this.smoothing);
        if (event.modifiers.alt) {
            this.rect.position = event.downPoint;
        } else if (event.modifiers.shift) {
            this.rect.position = squareDimensions.position;
        } else {
            const dimensions = event.point.subtract(event.downPoint);
            this.rect.position = event.downPoint.add(dimensions.multiply(0.5));
        }

        styleShape(this.rect, this.colorState);
    }

    handleMouseUp (event) {
        if (event.event.button > 0 || !this.active) return;

        if (this.isBoundingBoxMode) {
            this.boundingBoxTool.onMouseUp(event);
            this.isBoundingBoxMode = null;
            return;
        }

        if (this.rect) {
            if (this.rect.area < G2CurvatureTool.TOLERANCE / paper.view.zoom) {
                this.rect.remove();
                this.rect = null;
            } else {
                this.rect.selected = true;
                this.setSelectedItems();
                this.onUpdateImage();
                this.rect = null;
            }
        }
        this.active = false;
    }

    handleMouseMove (event) {
        this.boundingBoxTool.onMouseMove(event, this.getHitOptions());
    }

    deactivateTool () {
        this.boundingBoxTool.deactivateTool();
    }
}

export default G2CurvatureTool;
