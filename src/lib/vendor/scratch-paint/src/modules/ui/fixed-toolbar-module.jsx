import React from 'react';
import PropTypes from 'prop-types';

import FixedToolsContainer from '../../containers/fixed-tools.jsx';
import styles from '../../components/paint-editor/paint-editor.css';

const FixedToolbarModule = props => (
    props.canvas !== null ? (
        <div className={styles.row}>
            <FixedToolsContainer
                    canRedo={props.canRedo}
                    canUndo={props.canUndo}
                    name={props.name}
                    onRedo={props.onRedo}
                    onUndo={props.onUndo}
                    onUpdateImage={props.onUpdateImage}
                    onUpdateName={props.onUpdateName}
                    width={props.width}
                />
        </div>
    ) : null
);

FixedToolbarModule.propTypes = {
    canRedo: PropTypes.func.isRequired,
    canUndo: PropTypes.func.isRequired,
    canvas: PropTypes.instanceOf(Element),
    name: PropTypes.string,
    onRedo: PropTypes.func.isRequired,
    onUndo: PropTypes.func.isRequired,
    onUpdateImage: PropTypes.func.isRequired,
    onUpdateName: PropTypes.func.isRequired,
    width: PropTypes.number
};

export default FixedToolbarModule;
