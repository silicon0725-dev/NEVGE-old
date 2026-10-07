import paper from '@turbowarp/paper';
import {CROSSHAIR_SIZE, getBackgroundGuideLayer, getDragCrosshairLayer, getRaster} from './layer';
import {getAllRootItems, getSelectedRootItems} from './selection';
import {getHitBounds} from './bitmap';
import log from '../log/log';

// Vectors are imported and exported at SVG_ART_BOARD size.
// Once they are imported however, both SVGs and bitmaps are on
// canvases of ART_BOARD size.

/* eslint-disable import/no-mutable-exports */
let SVG_ART_BOARD_WIDTH;
let SVG_ART_BOARD_HEIGHT;
let ART_BOARD_WIDTH;
let ART_BOARD_HEIGHT;
let CENTER;
const PADDING_PERCENT = 25; // Padding as a percent of the max of width/height of the sprite
const BUFFER = 50; // Number of pixels of allowance around objects at the edges of the workspace
const MIN_RATIO = .125; // Zoom in to at least 1/8 of the screen. This way you don't end up incredibly
//                         zoomed in for tiny costumes.
const OUTERMOST_ZOOM_LEVEL = 0.333;
let ART_BOARD_BOUNDS;
/* eslint-enable import/no-mutable-exports */

// 工作区可视范围的大小（比艺术板大一些）
const WORKSPACE_VIEW_SIZE = 2000; // 工作区可视范围的大小

const resizeView = (width, height) => {
    SVG_ART_BOARD_WIDTH = width;
    SVG_ART_BOARD_HEIGHT = height;
    ART_BOARD_WIDTH = SVG_ART_BOARD_WIDTH * 2;
    ART_BOARD_HEIGHT = SVG_ART_BOARD_HEIGHT * 2;
    CENTER = new paper.Point(ART_BOARD_WIDTH / 2, ART_BOARD_HEIGHT / 2);
    ART_BOARD_BOUNDS = new paper.Rectangle(0, 0, ART_BOARD_WIDTH, ART_BOARD_HEIGHT);
};
resizeView(480, 360);

// 工作区中心点，用于计算工作区边界
let _workspaceCenter = CENTER.clone();

// 获取当前工作区边界（以 _workspaceCenter 为中心）
const getWorkspaceBounds = () => {
    const halfSize = WORKSPACE_VIEW_SIZE / 2;
    return new paper.Rectangle(
        _workspaceCenter.x - halfSize,
        _workspaceCenter.y - halfSize,
        WORKSPACE_VIEW_SIZE,
        WORKSPACE_VIEW_SIZE
    );
};

/**
 * 更新工作区中心点，使其跟随视图中心移动
 * 这是实现无限滑动的关键：当视图中心偏离工作区中心一定距离时，
 * 更新工作区中心为视图中心
 *
 * @param {number} viewCenterX - 当前视图中心的 X 坐标（在项目坐标系中）
 * @param {number} viewCenterY - 当前视图中心的 Y 坐标（在项目坐标系中）
 * @returns {boolean} 是否更新了工作区中心
 */
const updateWorkspaceCenter = (viewCenterX, viewCenterY) => {
    // 计算视图中心与当前工作区中心的距离
    const distance = Math.sqrt(
        Math.pow(viewCenterX - _workspaceCenter.x, 2) +
        Math.pow(viewCenterY - _workspaceCenter.y, 2)
    );

    // 如果距离超过阈值，更新工作区中心
    const threshold = WORKSPACE_VIEW_SIZE / 4; // 当距离超过可视范围的1/4时更新
    if (distance > threshold) {
        _workspaceCenter = new paper.Point(viewCenterX, viewCenterY);
        return true;
    }
    return false;
};

/**
* The workspace bounds define the areas that the scroll bars can access.
* They include at minimum the artboard, and extend to a bit beyond the
* farthest item off tne edge in any given direction (so items can't be
* "lost" off the edge)
*
* @param {boolean} clipEmpty Clip empty space from bounds, even if it
* means discontinuously jumping the viewport. This should probably be
* false unless the viewport is going to move discontinuously anyway
* (such as in a zoom button click)
*/
const setWorkspaceBounds = clipEmpty => {
    void clipEmpty;
    // 不再主动更新工作区边界，它由 updateWorkspaceCenter 管理
    // 但为了兼容性，保持空函数
};

const clampViewBounds = () => {
    const viewBounds = paper.project.view.bounds;
    const workspaceBounds = getWorkspaceBounds();

    // 只有当视图完全超出工作区边界时才限制
    // 允许视图的一部分在工作区外，但中心必须在可视范围内
    const viewCenterX = viewBounds.x + (viewBounds.width / 2);
    const viewCenterY = viewBounds.y + (viewBounds.height / 2);

    let dx = 0;
    let dy = 0;

    if (viewCenterX < workspaceBounds.left) {
        dx = workspaceBounds.left - viewCenterX;
    } else if (viewCenterX > workspaceBounds.right) {
        dx = workspaceBounds.right - viewCenterX;
    }

    if (viewCenterY < workspaceBounds.top) {
        dy = workspaceBounds.top - viewCenterY;
    } else if (viewCenterY > workspaceBounds.bottom) {
        dy = workspaceBounds.bottom - viewCenterY;
    }

    if (dx !== 0 || dy !== 0) {
        paper.project.view.scrollBy(new paper.Point(dx, dy));
    }
};

const resizeCrosshair = () => {
    if (getDragCrosshairLayer() && getDragCrosshairLayer().dragCrosshair) {
        getDragCrosshairLayer().dragCrosshair.scale(
            CROSSHAIR_SIZE / getDragCrosshairLayer().dragCrosshair.bounds.width / paper.view.zoom);
    }
    if (getBackgroundGuideLayer() && getBackgroundGuideLayer().dragCrosshair) {
        getBackgroundGuideLayer().dragCrosshair.scale(
            CROSSHAIR_SIZE / getBackgroundGuideLayer().dragCrosshair.bounds.width / paper.view.zoom);
    }
};

// Zoom keeping a project-space point fixed.
// This article was helpful http://matthiasberth.com/tech/stable-zoom-and-pan-in-paperjs
const zoomOnFixedPoint = (deltaZoom, fixedPoint) => {
    const view = paper.view;
    const preZoomCenter = view.center;
    const newZoom = Math.max(OUTERMOST_ZOOM_LEVEL, view.zoom + deltaZoom);
    const scaling = view.zoom / newZoom;
    const preZoomOffset = fixedPoint.subtract(preZoomCenter);
    const postZoomOffset = fixedPoint.subtract(preZoomOffset.multiply(scaling))
        .subtract(preZoomCenter);
    view.zoom = newZoom;
    view.translate(postZoomOffset.multiply(-1));

    setWorkspaceBounds(true /* clipEmpty */);
    clampViewBounds();
    resizeCrosshair();
};

// Zoom keeping the selection center (if any) fixed.
const zoomOnSelection = deltaZoom => {
    let fixedPoint;
    const items = getSelectedRootItems();
    if (items.length > 0) {
        let rect = null;
        for (const item of items) {
            if (rect) {
                rect = rect.unite(item.bounds);
            } else {
                rect = item.bounds;
            }
        }
        fixedPoint = rect.center;
    } else {
        fixedPoint = paper.project.view.center;
    }
    zoomOnFixedPoint(deltaZoom, fixedPoint);
};

const resetZoom = () => {
    paper.project.view.zoom = .5;
    // 重置工作区中心到艺术板中心
    _workspaceCenter = CENTER.clone();
    setWorkspaceBounds(true /* clipEmpty */);
    resizeCrosshair();
    clampViewBounds();
};

const pan = (dx, dy) => {
    paper.project.view.scrollBy(new paper.Point(dx, dy));
    clampViewBounds();
};

/**
 * Mouse actions are clamped to action bounds
 * @param {boolean} isBitmap True if the editor is in bitmap mode, false if it is in vector mode
 * @returns {paper.Rectangle} the bounds within which mouse events should work in the paint editor
 */
const getActionBounds = isBitmap => {
    // The stage rectangle is a guide only. Bitmap tools may operate anywhere in
    // the current view or authored raster bounds, just like vector tools.
    if (isBitmap) {
        return paper.view.bounds
            .unite(ART_BOARD_BOUNDS)
            .unite(getRaster().bounds)
            .unite(getWorkspaceBounds());
    }
    // 使用当前工作区边界作为操作边界
    return paper.view.bounds.unite(ART_BOARD_BOUNDS).unite(getWorkspaceBounds());
};

const zoomToFit = isBitmap => {
    resetZoom();
    let bounds;
    if (isBitmap) {
        bounds = getHitBounds(getRaster()).expand(BUFFER);
    } else {
        const items = getAllRootItems();
        for (const item of items) {
            if (bounds) {
                bounds = bounds.unite(item.bounds);
            } else {
                bounds = item.bounds;
            }
        }
    }
    if (bounds && bounds.width && bounds.height) {
        const canvas = paper.view.element;
        // Ratio of (sprite length plus padding on all sides) to viewport length.
        let ratio = paper.view.zoom *
            Math.max(
                bounds.width * (1 + (2 * PADDING_PERCENT / 100)) / canvas.clientWidth,
                bounds.height * (1 + (2 * PADDING_PERCENT / 100)) / canvas.clientHeight);
        // Clamp ratio
        ratio = Math.max(Math.min(1, ratio), MIN_RATIO);
        if (ratio < 1) {
            paper.view.center = bounds.center;
            paper.view.zoom = paper.view.zoom / ratio;
            resizeCrosshair();
            clampViewBounds();
        }
    } else {
        log.warn('No bounds!');
    }
};

// 为了兼容性，定义 MAX_WORKSPACE_BOUNDS（不再用于限制，仅供其他模块引用）
const MAX_WORKSPACE_BOUNDS = new paper.Rectangle(
    -10000,
    -10000,
    20000,
    20000
);

export {
    ART_BOARD_BOUNDS,
    ART_BOARD_HEIGHT,
    ART_BOARD_WIDTH,
    CENTER,
    OUTERMOST_ZOOM_LEVEL,
    SVG_ART_BOARD_WIDTH,
    SVG_ART_BOARD_HEIGHT,
    MAX_WORKSPACE_BOUNDS,
    WORKSPACE_VIEW_SIZE,
    resizeView,
    clampViewBounds,
    getActionBounds,
    pan,
    resetZoom,
    setWorkspaceBounds,
    getWorkspaceBounds,
    updateWorkspaceCenter,
    resizeCrosshair,
    zoomOnSelection,
    zoomOnFixedPoint,
    zoomToFit
};
