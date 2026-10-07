import paper from '@turbowarp/paper';
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import bindAll from 'lodash.bindall';
import Modes from '../lib/modes';
import {MIXED} from '../helper/style-path';
import ColorStyleProptype from '../lib/color-style-proptype';
import GradientTypes from '../lib/gradient-types';

import {changeFillColor, clearFillGradient, DEFAULT_COLOR} from '../reducers/fill-style';
import {changeStrokeColor, clearStrokeGradient} from '../reducers/stroke-style';
import {changeMode} from '../reducers/modes';
import {clearSelectedItems, setSelectedItems} from '../reducers/selected-items';
import {setCursor} from '../reducers/cursor';

import {clearSelection, getSelectedLeafItems} from '../helper/selection';
import G2CurvatureTool from '../helper/tools/g2-curvature-tool';
import G2CurvatureModeComponent from '../components/g2-curvature-mode/g2-curvature-mode.jsx';

class G2CurvatureMode extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'activateTool',
            'deactivateTool',
            'validateColorState'
        ]);
    }
    componentDidMount () {
        if (this.props.isG2CurvatureModeActive) {
            this.activateTool(this.props);
        }
    }
    componentWillReceiveProps (nextProps) {
        if (this.tool && nextProps.colorState !== this.props.colorState) {
            this.tool.setColorState(nextProps.colorState);
        }
        if (this.tool && nextProps.selectedItems !== this.props.selectedItems) {
            this.tool.onSelectionChanged(nextProps.selectedItems);
        }

        if (this.tool && nextProps.cornerRadius !== this.props.cornerRadius) {
            this.tool.setCornerRadius(nextProps.cornerRadius);
        }

        if (this.tool && nextProps.smoothing !== this.props.smoothing) {
            this.tool.setSmoothing(nextProps.smoothing);
        }

        if (nextProps.isG2CurvatureModeActive && !this.props.isG2CurvatureModeActive) {
            this.activateTool();
        } else if (!nextProps.isG2CurvatureModeActive && this.props.isG2CurvatureModeActive) {
            this.deactivateTool();
        }
    }
    shouldComponentUpdate (nextProps) {
        return nextProps.isG2CurvatureModeActive !== this.props.isG2CurvatureModeActive;
    }
    componentWillUnmount () {
        if (this.tool) {
            this.deactivateTool();
        }
    }
    activateTool () {
        clearSelection(this.props.clearSelectedItems);
        this.validateColorState();

        this.tool = new G2CurvatureTool(
            this.props.setSelectedItems,
            this.props.clearSelectedItems,
            this.props.setCursor,
            this.props.onUpdateImage
        );
        this.tool.setColorState(this.props.colorState);
        this.tool.setCornerRadius(this.props.cornerRadius);
        this.tool.setSmoothing(this.props.smoothing);
        this.tool.activate();
    }
    validateColorState () {
        const {strokeWidth} = this.props.colorState;
        const fillColor1 = this.props.colorState.fillColor.primary;
        let fillColor2 = this.props.colorState.fillColor.secondary;
        let fillGradient = this.props.colorState.fillColor.gradientType;
        const strokeColor1 = this.props.colorState.strokeColor.primary;
        let strokeColor2 = this.props.colorState.strokeColor.secondary;
        let strokeGradient = this.props.colorState.strokeColor.gradientType;

        if (fillColor2 === MIXED) {
            this.props.clearFillGradient();
            fillColor2 = null;
            fillGradient = GradientTypes.SOLID;
        }
        if (strokeColor2 === MIXED) {
            this.props.clearStrokeGradient();
            strokeColor2 = null;
            strokeGradient = GradientTypes.SOLID;
        }

        const fillColorMissing = fillColor1 === MIXED ||
            (fillGradient === GradientTypes.SOLID && fillColor1 === null) ||
            (fillGradient !== GradientTypes.SOLID && fillColor1 === null && fillColor2 === null);
        const strokeColorMissing = strokeColor1 === MIXED ||
            strokeWidth === null ||
            strokeWidth === 0 ||
            (strokeGradient === GradientTypes.SOLID && strokeColor1 === null) ||
            (strokeGradient !== GradientTypes.SOLID && strokeColor1 === null && strokeColor2 === null);

        if (fillColorMissing && strokeColorMissing) {
            this.props.onChangeFillColor(DEFAULT_COLOR);
            this.props.clearFillGradient();
            this.props.onChangeStrokeColor(null);
            this.props.clearStrokeGradient();
        } else if (fillColorMissing && !strokeColorMissing) {
            this.props.onChangeFillColor(null);
            this.props.clearFillGradient();
        } else if (!fillColorMissing && strokeColorMissing) {
            this.props.onChangeStrokeColor(null);
            this.props.clearStrokeGradient();
        }
    }
    deactivateTool () {
        this.tool.deactivateTool();
        this.tool.remove();
        this.tool = null;
    }
    render () {
        return (
            <G2CurvatureModeComponent
                isSelected={this.props.isG2CurvatureModeActive}
                onMouseDown={this.props.handleMouseDown}
            />
        );
    }
}

G2CurvatureMode.propTypes = {
    clearFillGradient: PropTypes.func.isRequired,
    clearStrokeGradient: PropTypes.func.isRequired,
    clearSelectedItems: PropTypes.func.isRequired,
    colorState: PropTypes.shape({
        fillColor: ColorStyleProptype,
        strokeColor: ColorStyleProptype,
        strokeWidth: PropTypes.number
    }).isRequired,
    cornerRadius: PropTypes.number.isRequired,
    smoothing: PropTypes.number.isRequired,
    handleMouseDown: PropTypes.func.isRequired,
    isG2CurvatureModeActive: PropTypes.bool.isRequired,
    onChangeFillColor: PropTypes.func.isRequired,
    onChangeStrokeColor: PropTypes.func.isRequired,
    onUpdateImage: PropTypes.func.isRequired,
    selectedItems: PropTypes.arrayOf(PropTypes.instanceOf(paper.Item)),
    setCursor: PropTypes.func.isRequired,
    setSelectedItems: PropTypes.func.isRequired
};

const mapStateToProps = state => ({
    colorState: state.scratchPaint.color,
    isG2CurvatureModeActive: state.scratchPaint.mode === Modes.G2_CURVATURE,
    selectedItems: state.scratchPaint.selectedItems,
    cornerRadius: state.scratchPaint.g2CurvatureMode.cornerRadius,
    smoothing: state.scratchPaint.g2CurvatureMode.smoothing
});
const mapDispatchToProps = dispatch => ({
    clearSelectedItems: () => {
        dispatch(clearSelectedItems());
    },
    clearFillGradient: () => {
        dispatch(clearFillGradient());
    },
    clearStrokeGradient: () => {
        dispatch(clearStrokeGradient());
    },
    setSelectedItems: () => {
        dispatch(setSelectedItems(getSelectedLeafItems(), false));
    },
    setCursor: cursorString => {
        dispatch(setCursor(cursorString));
    },
    handleMouseDown: () => {
        dispatch(changeMode(Modes.G2_CURVATURE));
    },
    onChangeFillColor: fillColor => {
        dispatch(changeFillColor(fillColor));
    },
    onChangeStrokeColor: strokeColor => {
        dispatch(changeStrokeColor(strokeColor));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(G2CurvatureMode);
