import {defineMessages} from 'react-intl';
import React from 'react';
import PropTypes from 'prop-types';

import Button from '../../components/button/button.jsx';
import ButtonGroup from '../../components/button-group/button-group.jsx';
import InputGroup from '../../components/input-group/input-group.jsx';
import Formats, {isBitmap, isVector} from '../../lib/format';
import styles from '../../components/paint-editor/paint-editor.css';

import bitmapIcon from '../../components/paint-editor/icons/bitmap.svg';
import zoomInIcon from '../../components/paint-editor/icons/zoom-in.svg';
import zoomOutIcon from '../../components/paint-editor/icons/zoom-out.svg';
import zoomResetIcon from '../../components/paint-editor/icons/zoom-reset.svg';
import themeIcon from '../../components/paint-editor/icons/theme.svg';

const messages = defineMessages({
    bitmap: {
        defaultMessage: 'Convert to Bitmap',
        description: 'Label for button that converts the paint editor to bitmap mode',
        id: 'paint.paintEditor.bitmap'
    },
    vector: {
        defaultMessage: 'Convert to Vector',
        description: 'Label for button that converts the paint editor to vector mode',
        id: 'paint.paintEditor.vector'
    }
});

const CanvasControlsModule = props => (
    <div className={styles.canvasControls} data-scratch-paint-module="canvas-controls">
        {isVector(props.format) ? (
            <Button className={styles.bitmapButton} onClick={props.onSwitchToBitmap}>
                <img className={styles.bitmapButtonIcon} draggable={false} src={bitmapIcon} />
                <span className={styles.buttonText}>{props.intl.formatMessage(messages.bitmap)}</span>
            </Button>
        ) : isBitmap(props.format) ? (
            <Button className={styles.bitmapButton} onClick={props.onSwitchToVector}>
                <img className={styles.bitmapButtonIcon} draggable={false} src={bitmapIcon} />
                <span className={styles.buttonText}>{props.intl.formatMessage(messages.vector)}</span>
            </Button>
        ) : null}
        <InputGroup className={styles.zoomControls}>
            <ButtonGroup>
                <Button className={styles.buttonGroupButton} onClick={props.onZoomOut}>
                    <img alt="Zoom Out" className={styles.buttonGroupButtonIcon} draggable={false} src={zoomOutIcon} />
                </Button>
                <Button className={styles.buttonGroupButton} onClick={props.onZoomReset}>
                    <img alt="Zoom Reset" className={styles.buttonGroupButtonIcon} draggable={false} src={zoomResetIcon} />
                </Button>
                <Button className={styles.buttonGroupButton} onClick={props.onZoomIn}>
                    <img alt="Zoom In" className={styles.buttonGroupButtonIcon} draggable={false} src={zoomInIcon} />
                </Button>
            </ButtonGroup>
            <ButtonGroup>
                <Button className={styles.buttonGroupButton} onClick={props.onChangeTheme}>
                    <img alt="Change theme" className={styles.buttonGroupButtonIcon} draggable={false} src={themeIcon} />
                </Button>
            </ButtonGroup>
        </InputGroup>
    </div>
);

CanvasControlsModule.propTypes = {
    format: PropTypes.oneOf(Object.keys(Formats)),
    intl: PropTypes.shape({formatMessage: PropTypes.func.isRequired}).isRequired,
    onChangeTheme: PropTypes.func.isRequired,
    onSwitchToBitmap: PropTypes.func.isRequired,
    onSwitchToVector: PropTypes.func.isRequired,
    onZoomIn: PropTypes.func.isRequired,
    onZoomOut: PropTypes.func.isRequired,
    onZoomReset: PropTypes.func.isRequired
};

export default CanvasControlsModule;
