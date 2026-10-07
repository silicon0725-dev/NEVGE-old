import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';

import FillColorIndicatorComponent from '../../containers/fill-color-indicator.jsx';
import ModeToolsContainer from '../../containers/mode-tools.jsx';
import StrokeColorIndicatorComponent from '../../containers/stroke-color-indicator.jsx';
import StrokeWidthIndicatorComponent from '../../containers/stroke-width-indicator.jsx';
import InputGroup from '../../components/input-group/input-group.jsx';
import Formats, {isBitmap, isVector} from '../../lib/format';
import styles from '../../components/paint-editor/paint-editor.css';

const PropertiesToolbarModule = props => {
    if (props.canvas === null) return null;
    if (isVector(props.format)) {
        return (
            <div className={styles.row}>
                    <InputGroup
                        className={classNames(styles.row, styles.modDashedBorder, styles.modLabeledIconHeight)}
                    >
                        <FillColorIndicatorComponent
                            className={styles.modMarginAfter}
                            onUpdateImage={props.onUpdateImage}
                        />
                        <StrokeColorIndicatorComponent onUpdateImage={props.onUpdateImage} />
                        <StrokeWidthIndicatorComponent onUpdateImage={props.onUpdateImage} />
                    </InputGroup>
                    <InputGroup className={styles.modModeTools}>
                        <ModeToolsContainer
                            onUpdateImage={props.onUpdateImage}
                            onManageFonts={props.onManageFonts}
                        />
                    </InputGroup>
            </div>
        );
    }
    if (isBitmap(props.format)) {
        return (
            <div className={styles.row}>
                    <InputGroup
                        className={classNames(styles.row, styles.modDashedBorder, styles.modLabeledIconHeight)}
                    >
                        <FillColorIndicatorComponent
                            className={styles.modMarginAfter}
                            onUpdateImage={props.onUpdateImage}
                        />
                    </InputGroup>
                    <InputGroup className={styles.modModeTools}>
                        <ModeToolsContainer
                            onUpdateImage={props.onUpdateImage}
                            onManageFonts={props.onManageFonts}
                        />
                    </InputGroup>
            </div>
        );
    }
    return null;
};

PropertiesToolbarModule.propTypes = {
    canvas: PropTypes.instanceOf(Element),
    format: PropTypes.oneOf(Object.keys(Formats)),
    onManageFonts: PropTypes.func,
    onUpdateImage: PropTypes.func.isRequired
};

export default PropertiesToolbarModule;
