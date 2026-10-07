import paper from '@turbowarp/paper';
import React from 'react';
import PropTypes from 'prop-types';

import Box from '../../components/box/box.jsx';
import Loupe from '../../components/loupe/loupe.jsx';
import PaperCanvas from '../../containers/paper-canvas.jsx';
import ScrollableCanvas from '../../containers/scrollable-canvas.jsx';
import styles from '../../components/paint-editor/paint-editor.css';

const WorkspaceModule = props => {
    const WorkspaceOverlay = props.workspaceOverlay;
    return (
        <ScrollableCanvas
            canvas={props.canvas}
            hideScrollbars={props.isEyeDropping}
            style={styles.canvasContainer}
        >
            <PaperCanvas
                canvasRef={props.setCanvas}
                image={props.image}
                imageFormat={props.imageFormat}
                imageId={props.imageId}
                rotationCenterX={props.rotationCenterX}
                rotationCenterY={props.rotationCenterY}
                theme={props.theme}
                zoomLevelId={props.zoomLevelId}
                onUpdateImage={props.onUpdateImage}
            />
            <textarea
                className={styles.textArea}
                ref={props.setTextArea}
                spellCheck={false}
            />
            {WorkspaceOverlay ? <WorkspaceOverlay {...props} /> : null}
            {props.isEyeDropping && props.colorInfo !== null && !props.colorInfo.hideLoupe ? (
                <Box className={styles.colorPickerWrapper}>
                    <Loupe
                        colorInfo={props.colorInfo}
                        pixelRatio={paper.project.view.pixelRatio}
                        theme={props.theme}
                    />
                </Box>
            ) : null}
        </ScrollableCanvas>
    );
};

WorkspaceModule.propTypes = {
    canvas: PropTypes.instanceOf(Element),
    colorInfo: Loupe.propTypes.colorInfo,
    image: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(HTMLImageElement)]),
    imageFormat: PropTypes.string,
    imageId: PropTypes.string,
    isEyeDropping: PropTypes.bool,
    onUpdateImage: PropTypes.func.isRequired,
    rotationCenterX: PropTypes.number,
    rotationCenterY: PropTypes.number,
    setCanvas: PropTypes.func.isRequired,
    setTextArea: PropTypes.func.isRequired,
    theme: PropTypes.string,
    workspaceOverlay: PropTypes.func,
    zoomLevelId: PropTypes.string
};

export default WorkspaceModule;
