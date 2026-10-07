import {sanitizeSvg} from '@turbowarp/scratch-svg-renderer';
import PropTypes from 'prop-types';
import React from 'react';

import PaintEditor from '../../lib/tw-scratch-paint';
import {
    fromScratchPaintUpdate,
    toScratchPaintDocument
} from '../../lib/editor-shell/scratch-paint-working-copy-adapter';

const WorkspaceScratchPaintEditor = ({
    moduleRegistry,
    name,
    onApplyEdit,
    onError,
    onUpdateName,
    stageSize,
    theme,
    workingCopy
}) => {
    const document = React.useMemo(() => {
        try {
            return toScratchPaintDocument(workingCopy, {
                sanitizeSvgText: sanitizeSvg.sanitizeSvgText
            });
        } catch (error) {
            if (typeof onError === 'function') onError(error);
            return null;
        }
    }, [onError, workingCopy]);

    const handleUpdateImage = React.useCallback((isVector, image, rotationCenterX, rotationCenterY) => {
        try {
            onApplyEdit(fromScratchPaintUpdate({
                isVector,
                image,
                rotationCenterX,
                rotationCenterY
            }));
        } catch (error) {
            if (typeof onError === 'function') onError(error);
        }
    }, [onApplyEdit, onError]);

    const handleManageFonts = React.useCallback(() => {}, []);

    if (!document) return null;

    return (
        <div
            data-ngvge-scratch-paint-modular="true"
            data-ngvge-working-copy-id={workingCopy.workingCopyId}
        >
            <PaintEditor
                image={document.image}
                imageFormat={document.imageFormat}
                imageId={document.imageId}
                moduleRegistry={moduleRegistry}
                name={name}
                rotationCenterX={document.rotationCenterX}
                rotationCenterY={document.rotationCenterY}
                rtl={false}
                theme={theme}
                width={stageSize.width}
                height={stageSize.height}
                onManageFonts={handleManageFonts}
                onUpdateImage={handleUpdateImage}
                onUpdateName={onUpdateName}
            />
        </div>
    );
};

WorkspaceScratchPaintEditor.propTypes = {
    moduleRegistry: PropTypes.object,
    name: PropTypes.string,
    onApplyEdit: PropTypes.func.isRequired,
    onError: PropTypes.func,
    onUpdateName: PropTypes.func.isRequired,
    stageSize: PropTypes.shape({
        width: PropTypes.number.isRequired,
        height: PropTypes.number.isRequired
    }).isRequired,
    theme: PropTypes.oneOf(['light', 'dark']),
    workingCopy: PropTypes.shape({
        workingCopyId: PropTypes.string.isRequired,
        dataFormat: PropTypes.string.isRequired,
        rotationCenterX: PropTypes.number,
        rotationCenterY: PropTypes.number,
        content: PropTypes.object.isRequired
    }).isRequired
};

WorkspaceScratchPaintEditor.defaultProps = {
    theme: 'dark'
};

export default WorkspaceScratchPaintEditor;
