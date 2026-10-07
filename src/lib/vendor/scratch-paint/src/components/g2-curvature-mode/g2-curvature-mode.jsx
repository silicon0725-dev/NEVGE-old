import React from 'react';
import PropTypes from 'prop-types';
import ToolSelectComponent from '../tool-select-base/tool-select-base.jsx';
import messages from '../../lib/messages.js';
import g2CurvatureIcon from './g2-curvature.svg';

const G2CurvatureModeComponent = props => (
    <ToolSelectComponent
        imgDescriptor={messages.g2Curvature}
        imgSrc={g2CurvatureIcon}
        isSelected={props.isSelected}
        onMouseDown={props.onMouseDown}
        keybinding="G"
    />
);

G2CurvatureModeComponent.propTypes = {
    isSelected: PropTypes.bool.isRequired,
    onMouseDown: PropTypes.func.isRequired
};

export default G2CurvatureModeComponent;
