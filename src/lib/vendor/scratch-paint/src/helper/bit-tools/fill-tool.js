import paper from '@turbowarp/paper';
import {floodFill, floodFillAll, getHitBounds} from '../bitmap';
import {createGradientObject} from '../style-path';
import {createCanvasLikeRaster, getRaster, projectToRasterPoint} from '../layer';
import GradientTypes from '../../lib/gradient-types';

const TRANSPARENT = 'rgba(0,0,0,0)';
/**
 * Tool for drawing fills.
 */
class FillTool extends paper.Tool {
    /**
     * @param {!function} onUpdateImage A callback to call when the image visibly changes
     */
    constructor (onUpdateImage) {
        super();
        this.onUpdateImage = onUpdateImage;

        // We have to set these functions instead of just declaring them because
        // paper.js tools hook up the listeners in the setter functions.
        this.onMouseDown = this.handleMouseDown;
        this.onMouseDrag = this.handleMouseDrag;

        this.color = null;
        this.color2 = null;
        this.gradientType = null;
        this.active = false;
    }
    setColor (color) {
        this.color = color;
    }
    setColor2 (color2) {
        this.color2 = color2;
    }
    setGradientType (gradientType) {
        this.gradientType = gradientType;
    }
    handleMouseDown (event) {
        this.paint(event);
    }
    handleMouseDrag (event) {
        this.paint(event);
    }
    paint (event) {
        const sourceContext = getRaster().getContext('2d');
        let destContext = sourceContext;
        let color = this.color;
        // Paint to a mask instead of the original canvas when drawing
        if (this.gradientType !== GradientTypes.SOLID) {
            const tmpCanvas = createCanvasLikeRaster();
            destContext = tmpCanvas.getContext('2d');
            color = 'black';
        } else if (!color) {
            // Null color means transparent because that is the standard in vector
            color = TRANSPARENT;
        }
        const raster = getRaster();
        if (!raster.bounds.contains(event.point)) return;
        const rasterPoint = projectToRasterPoint(event.point, raster);
        let changed = false;
        if (event.event.shiftKey) {
            changed = floodFillAll(rasterPoint.x, rasterPoint.y, color, sourceContext, destContext);
        } else {
            changed = floodFill(rasterPoint.x, rasterPoint.y, color, sourceContext, destContext);
        }
        if (changed && this.gradientType !== GradientTypes.SOLID) {
            const maskRaster = new paper.Raster({insert: false});
            maskRaster.canvas = destContext.canvas;
            maskRaster.onLoad = () => {
                maskRaster.position = getRaster().position;
                // Erase what's already there
                getRaster().getContext().globalCompositeOperation = 'destination-out';
                getRaster().drawImage(maskRaster.canvas, maskRaster.bounds.topLeft);
                getRaster().getContext().globalCompositeOperation = 'source-over';

                // Create the gradient to be masked
                const hitBounds = getHitBounds(maskRaster);
                if (!hitBounds.area) return;
                const gradient = new paper.Shape.Rectangle({
                    insert: false,
                    rectangle: {
                        topLeft: hitBounds.topLeft,
                        bottomRight: hitBounds.bottomRight
                    }
                });
                gradient.fillColor = createGradientObject(
                    this.color,
                    this.color2,
                    this.gradientType,
                    gradient.bounds,
                    event.point);
                const rasterGradient = gradient.rasterize(getRaster().resolution.width, false /* insert */);

                // Mask gradient
                maskRaster.getContext().globalCompositeOperation = 'source-in';
                maskRaster.drawImage(rasterGradient.canvas, rasterGradient.bounds.topLeft);

                // Draw masked gradient into raster layer
                getRaster().drawImage(maskRaster.canvas, maskRaster.bounds.topLeft);
                this.onUpdateImage();
            };
        } else if (changed) {
            this.onUpdateImage();
        }
    }
    deactivateTool () {
    }
}

export default FillTool;
