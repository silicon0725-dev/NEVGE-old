import paper from '@turbowarp/paper';
import PropTypes from 'prop-types';

import React from 'react';
import {connect} from 'react-redux';
import ScrollableCanvasComponent from '../components/scrollable-canvas/scrollable-canvas.jsx';

import {clampViewBounds, pan, zoomOnFixedPoint, getWorkspaceBounds, updateWorkspaceCenter} from '../helper/view';
import {getAllRootItems} from '../helper/selection';
import {updateViewBounds} from '../reducers/view-bounds';
import {redrawSelectionBox} from '../reducers/selected-items';

import {getEventXY} from '../lib/touch-utils';
import bindAll from 'lodash.bindall';

const MIN_SCROLLBAR_LENGTH_PERCENT = 8;
const clampScrollbarPercent = value => Math.max(0, Math.min(100, value));
const getScrollbarLengthPercent = (visibleSize, totalSize) => {
    if (!totalSize || totalSize <= 0) return 100;
    return Math.min(100, Math.max(MIN_SCROLLBAR_LENGTH_PERCENT, 100 * visibleSize / totalSize));
};

class ScrollableCanvas extends React.Component {
    static get ZOOM_INCREMENT () {
        return 0.5;
    }
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleMouseDown',
            'handleDragMove',
            'handleDragEnd',
            'handleHorizontalScrollbarMouseDown',
            'handleHorizontalScrollbarMouseMove',
            'handleHorizontalScrollbarMouseUp',
            'handleVerticalScrollbarMouseDown',
            'handleVerticalScrollbarMouseMove',
            'handleVerticalScrollbarMouseUp',
            'handleWheel',
            'updateWorkspaceToFollowView'
        ]);
    }
    componentDidMount () {
        if (this.props.canvas) {
            this.props.canvas.addEventListener('wheel', this.handleWheel);
            this.props.canvas.addEventListener('mousedown', this.handleMouseDown);
        }
    }
    componentWillReceiveProps (nextProps) {
        if (nextProps.canvas) {
            if (this.props.canvas) {
                this.props.canvas.removeEventListener('wheel', this.handleWheel);
                this.props.canvas.removeEventListener('mousedown', this.handleMouseDown);
            }
            nextProps.canvas.addEventListener('wheel', this.handleWheel);
            nextProps.canvas.addEventListener('mousedown', this.handleMouseDown);
        }
    }
    updateWorkspaceToFollowView () {
        if (!paper.view) return;

        const viewCenter = paper.view.center;
        const updated = updateWorkspaceCenter(viewCenter.x, viewCenter.y);

        if (updated) {
            this.props.updateViewBounds(paper.view.matrix);
        }
    }
    handleMouseDown (event) {
        if (event.button === 1) {
            event.preventDefault();
            const {x, y} = getEventXY(event);
            this.initialMouseX = x;
            this.initialMouseY = y;
            this.initialScreenX = paper.view.matrix.tx;
            this.initialScreenY = paper.view.matrix.ty;
            this.initialCursor = this.props.canvas.style.cursor;
            this.props.canvas.style.cursor = 'move';
            window.addEventListener('mousemove', this.handleDragMove);
            window.addEventListener('mouseup', this.handleDragEnd);
        }
    }
    handleDragMove (event) {
        event.preventDefault();
        const {x, y} = getEventXY(event);
        paper.view.matrix.ty = this.initialScreenY - (this.initialMouseY - y);
        paper.view.matrix.tx = this.initialScreenX - (this.initialMouseX - x);
        clampViewBounds();
        this.updateWorkspaceToFollowView();
        this.props.updateViewBounds(paper.view.matrix);
        if (this.props.canvas) {
            this.props.canvas.style.cursor = 'move';
        }
    }
    handleDragEnd (event) {
        event.preventDefault();
        window.removeEventListener('mousemove', this.handleDragMove);
        window.removeEventListener('mouseup', this.handleDragEnd);
        if (this.props.canvas) {
            this.props.canvas.style.cursor = this.initialCursor;
        }
    }
    handleHorizontalScrollbarMouseDown (event) {
        this.initialMouseX = getEventXY(event).x;
        this.initialScreenX = paper.view.matrix.tx;
        window.addEventListener('mousemove', this.handleHorizontalScrollbarMouseMove);
        window.addEventListener('touchmove', this.handleHorizontalScrollbarMouseMove, {passive: false});
        window.addEventListener('mouseup', this.handleHorizontalScrollbarMouseUp);
        window.addEventListener('touchend', this.handleHorizontalScrollbarMouseUp);
        event.preventDefault();
    }
    handleHorizontalScrollbarMouseMove (event) {
        const dx = this.initialMouseX - getEventXY(event).x;
        paper.view.matrix.tx = this.initialScreenX + (dx * paper.view.zoom * 2);
        clampViewBounds();
        this.updateWorkspaceToFollowView();
        this.props.updateViewBounds(paper.view.matrix);
        event.preventDefault();
    }
    handleHorizontalScrollbarMouseUp (event) {
        window.removeEventListener('mousemove', this.handleHorizontalScrollbarMouseMove);
        window.removeEventListener('touchmove', this.handleHorizontalScrollbarMouseMove, {passive: false});
        window.removeEventListener('mouseup', this.handleHorizontalScrollbarMouseUp);
        window.removeEventListener('touchend', this.handleHorizontalScrollbarMouseUp);
        this.initialMouseX = null;
        this.initialScreenX = null;
        if (event) event.preventDefault();
    }
    handleVerticalScrollbarMouseDown (event) {
        this.initialMouseY = getEventXY(event).y;
        this.initialScreenY = paper.view.matrix.ty;
        window.addEventListener('mousemove', this.handleVerticalScrollbarMouseMove);
        window.addEventListener('touchmove', this.handleVerticalScrollbarMouseMove, {passive: false});
        window.addEventListener('mouseup', this.handleVerticalScrollbarMouseUp);
        window.addEventListener('touchend', this.handleVerticalScrollbarMouseUp);
        event.preventDefault();
    }
    handleVerticalScrollbarMouseMove (event) {
        const dy = this.initialMouseY - getEventXY(event).y;
        paper.view.matrix.ty = this.initialScreenY + (dy * paper.view.zoom * 2);
        clampViewBounds();
        this.updateWorkspaceToFollowView();
        this.props.updateViewBounds(paper.view.matrix);
        event.preventDefault();
    }
    handleVerticalScrollbarMouseUp (event) {
        window.removeEventListener('mousemove', this.handleVerticalScrollbarMouseMove);
        window.removeEventListener('touchmove', this.handleVerticalScrollbarMouseMove, {passive: false});
        window.removeEventListener('mouseup', this.handleVerticalScrollbarMouseUp);
        window.removeEventListener('touchend', this.handleVerticalScrollbarMouseUp);
        this.initialMouseY = null;
        this.initialScreenY = null;
        event.preventDefault();
    }
    handleWheel (event) {
        const multiplier = event.deltaMode === 0x1 ? 15 : 1;
        const deltaX = event.deltaX * multiplier;
        const deltaY = event.deltaY * multiplier;
        const canvasRect = this.props.canvas.getBoundingClientRect();
        const offsetX = event.clientX - canvasRect.left;
        const offsetY = event.clientY - canvasRect.top;
        const fixedPoint = paper.view.viewToProject(
            new paper.Point(offsetX, offsetY)
        );
        if (event.metaKey || event.ctrlKey) {
            zoomOnFixedPoint(-deltaY / 500, fixedPoint);
            this.props.updateViewBounds(paper.view.matrix);
            this.props.redrawSelectionBox();
        } else if (event.shiftKey && event.deltaX === 0) {
            const dx = deltaY / paper.view.zoom;
            pan(dx, 0);
            this.updateWorkspaceToFollowView();
            this.props.updateViewBounds(paper.view.matrix);
        } else {
            const dx = deltaX / paper.view.zoom;
            const dy = deltaY / paper.view.zoom;
            pan(dx, dy);
            this.updateWorkspaceToFollowView();
            this.props.updateViewBounds(paper.view.matrix);
            if (paper.tool) {
                paper.tool.view._handleMouseEvent('mousemove', event, fixedPoint);
            }
        }
        event.preventDefault();
    }
    render () {
        let widthPercent = 0;
        let heightPercent = 0;
        let topPercent = 0;
        let leftPercent = 0;
        if (paper.project) {
            const viewBounds = paper.view.bounds;
            const {x, y, width, height} = viewBounds;

            let scrollBounds = getWorkspaceBounds().unite(viewBounds);
            const allItems = getAllRootItems();
            for (const item of allItems) {
                if (item.guide || (item.data && item.data.isHelperItem)) continue;
                if (item.bounds && item.bounds.width && item.bounds.height) {
                    scrollBounds = scrollBounds.unite(item.bounds);
                }
            }

            widthPercent = getScrollbarLengthPercent(width, scrollBounds.width);
            heightPercent = getScrollbarLengthPercent(height, scrollBounds.height);
            const centerX = (x + (width / 2) - scrollBounds.x) / scrollBounds.width;
            const centerY = (y + (height / 2) - scrollBounds.y) / scrollBounds.height;
            topPercent = clampScrollbarPercent((100 * centerY) - (heightPercent / 2));
            leftPercent = clampScrollbarPercent((100 * centerX) - (widthPercent / 2));
        }
        return (
            <ScrollableCanvasComponent
                hideScrollbars={this.props.hideScrollbars}
                horizontalScrollLengthPercent={widthPercent}
                horizontalScrollStartPercent={leftPercent}
                style={this.props.style}
                verticalScrollLengthPercent={heightPercent}
                verticalScrollStartPercent={topPercent}
                onHorizontalScrollbarMouseDown={this.handleHorizontalScrollbarMouseDown}
                onVerticalScrollbarMouseDown={this.handleVerticalScrollbarMouseDown}
            >
                {this.props.children}
            </ScrollableCanvasComponent>
        );
    }
}

ScrollableCanvas.propTypes = {
    canvas: PropTypes.instanceOf(Element),
    children: PropTypes.node.isRequired,
    hideScrollbars: PropTypes.bool,
    redrawSelectionBox: PropTypes.func.isRequired,
    style: PropTypes.string,
    updateViewBounds: PropTypes.func.isRequired
};

const mapStateToProps = state => ({
    viewBounds: state.scratchPaint.viewBounds
});
const mapDispatchToProps = dispatch => ({
    redrawSelectionBox: () => {
        dispatch(redrawSelectionBox());
    },
    updateViewBounds: matrix => {
        dispatch(updateViewBounds(matrix));
    }
});


export default connect(
    mapStateToProps,
    mapDispatchToProps
)(ScrollableCanvas);
