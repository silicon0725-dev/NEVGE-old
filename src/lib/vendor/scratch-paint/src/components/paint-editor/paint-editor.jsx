import {injectIntl, intlShape} from 'react-intl';
import React from 'react';
import PropTypes from 'prop-types';

import Formats from '../../lib/format';
import {
    DEFAULT_PAINT_MODULE_REGISTRY
} from '../../modules/default-paint-module-registry';
import {getPaintModuleComponent} from '../../modules/paint-module-registry';
import styles from './paint-editor.css';

const PaintEditorComponent = props => {
    const registry = props.moduleRegistry || DEFAULT_PAINT_MODULE_REGISTRY;
    const FixedToolbar = getPaintModuleComponent(registry, 'fixedToolbar');
    const PropertiesToolbar = getPaintModuleComponent(registry, 'propertiesToolbar');
    const ToolRail = getPaintModuleComponent(registry, 'toolRail');
    const Workspace = getPaintModuleComponent(registry, 'workspace');
    const CanvasControls = getPaintModuleComponent(registry, 'canvasControls');
    const WorkspaceOverlay = getPaintModuleComponent(registry, 'workspaceOverlay');
    const SidePanel = getPaintModuleComponent(registry, 'sidePanel');
    const BottomPanel = getPaintModuleComponent(registry, 'bottomPanel');

    return (
        <div
            className={styles.editorContainer}
            dir={props.rtl ? 'rtl' : 'ltr'}
            data-paint-theme={props.theme}
            data-scratch-paint-module-registry={registry.id}
        >
            {props.canvas !== null ? (
                <div className={styles.editorContainerTop} data-scratch-paint-module-zone="toolbar">
                    <FixedToolbar {...props} />
                    <PropertiesToolbar {...props} />
                </div>
            ) : null}

            <div className={styles.topAlignRow}>
                <ToolRail {...props} />
                <div className={styles.controlsContainer} data-scratch-paint-module-zone="workspace">
                    <Workspace
                        {...props}
                        workspaceOverlay={WorkspaceOverlay}
                    />
                    <CanvasControls {...props} />
                </div>
                <SidePanel {...props} />
            </div>
            <BottomPanel {...props} />
        </div>
    );
};

PaintEditorComponent.propTypes = {
    canRedo: PropTypes.func.isRequired,
    canUndo: PropTypes.func.isRequired,
    canvas: PropTypes.instanceOf(Element),
    colorInfo: PropTypes.object,
    format: PropTypes.oneOf(Object.keys(Formats)),
    image: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.instanceOf(HTMLImageElement)
    ]),
    imageFormat: PropTypes.string,
    imageId: PropTypes.string,
    intl: intlShape,
    isEyeDropping: PropTypes.bool,
    moduleRegistry: PropTypes.shape({
        id: PropTypes.string.isRequired,
        version: PropTypes.number.isRequired,
        slots: PropTypes.object.isRequired
    }),
    name: PropTypes.string,
    onChangeTheme: PropTypes.func.isRequired,
    onManageFonts: PropTypes.func,
    onRedo: PropTypes.func.isRequired,
    onSwitchToBitmap: PropTypes.func.isRequired,
    onSwitchToVector: PropTypes.func.isRequired,
    onUndo: PropTypes.func.isRequired,
    onUpdateImage: PropTypes.func.isRequired,
    onUpdateName: PropTypes.func.isRequired,
    onZoomIn: PropTypes.func.isRequired,
    onZoomOut: PropTypes.func.isRequired,
    onZoomReset: PropTypes.func.isRequired,
    rotationCenterX: PropTypes.number,
    rotationCenterY: PropTypes.number,
    rtl: PropTypes.bool,
    setCanvas: PropTypes.func.isRequired,
    setTextArea: PropTypes.func.isRequired,
    textArea: PropTypes.instanceOf(Element),
    theme: PropTypes.string,
    width: PropTypes.number,
    zoomLevelId: PropTypes.string
};

export {PaintEditorComponent};

export default injectIntl(PaintEditorComponent);
