import React from 'react';
import PropTypes from 'prop-types';

import BitBrushMode from '../../containers/bit-brush-mode.jsx';
import BitEraserMode from '../../containers/bit-eraser-mode.jsx';
import BitFillMode from '../../containers/bit-fill-mode.jsx';
import BitLineMode from '../../containers/bit-line-mode.jsx';
import BitOvalMode from '../../containers/bit-oval-mode.jsx';
import BitRectMode from '../../containers/bit-rect-mode.jsx';
import BitSelectMode from '../../containers/bit-select-mode.jsx';
import BrushMode from '../../containers/brush-mode.jsx';
import EraserMode from '../../containers/eraser-mode.jsx';
import FillMode from '../../containers/fill-mode.jsx';
import G2CurvatureMode from '../../containers/g2-curvature-mode.jsx';
import LineMode from '../../containers/line-mode.jsx';
import OvalMode from '../../containers/oval-mode.jsx';
import RectMode from '../../containers/rect-mode.jsx';
import ReshapeMode from '../../containers/reshape-mode.jsx';
import RoundedRectMode from '../../containers/rounded-rect-mode.jsx';
import SelectMode from '../../containers/select-mode.jsx';
import TextMode from '../../containers/text-mode.jsx';
import Formats, {isBitmap, isVector} from '../../lib/format';
import styles from '../../components/paint-editor/paint-editor.css';

const toolModule = (id, component, text = false) => Object.freeze({id, component, text});

const VECTOR_TOOL_MODULES = Object.freeze([
    toolModule('select', SelectMode),
    toolModule('reshape', ReshapeMode),
    toolModule('brush', BrushMode),
    toolModule('eraser', EraserMode),
    toolModule('fill', FillMode),
    toolModule('text', TextMode, true),
    toolModule('line', LineMode),
    toolModule('oval', OvalMode),
    toolModule('rect', RectMode),
    toolModule('rounded-rect', RoundedRectMode),
    toolModule('curvature', G2CurvatureMode)
]);

const BITMAP_TOOL_MODULES = Object.freeze([
    toolModule('bit-brush', BitBrushMode),
    toolModule('bit-line', BitLineMode),
    toolModule('bit-oval', BitOvalMode),
    toolModule('bit-rect', BitRectMode),
    toolModule('bit-text', TextMode, true),
    toolModule('bit-fill', BitFillMode),
    toolModule('bit-eraser', BitEraserMode),
    toolModule('bit-select', BitSelectMode)
]);

const ToolRailModule = props => {
    if (props.canvas === null) return null;
    const tools = isVector(props.format) ? VECTOR_TOOL_MODULES :
        (isBitmap(props.format) ? BITMAP_TOOL_MODULES : []);
    if (!tools.length) return null;
    return (
        <div className={styles.modeSelector} data-scratch-paint-module="tool-rail">
            {tools.map(tool => {
                const ToolComponent = tool.component;
                const toolProps = {onUpdateImage: props.onUpdateImage};
                if (tool.text) {
                    toolProps.textArea = props.textArea;
                    if (isBitmap(props.format)) toolProps.isBitmap = true;
                }
                return <ToolComponent key={tool.id} {...toolProps} />;
            })}
        </div>
    );
};

ToolRailModule.propTypes = {
    canvas: PropTypes.instanceOf(Element),
    format: PropTypes.oneOf(Object.keys(Formats)),
    onUpdateImage: PropTypes.func.isRequired,
    textArea: PropTypes.instanceOf(Element)
};

export {
    BITMAP_TOOL_MODULES,
    VECTOR_TOOL_MODULES
};

export default ToolRailModule;
