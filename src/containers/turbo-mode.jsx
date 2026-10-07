import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import {
    LEGACY_RUNTIME_SOURCE_IDS,
    installLegacyRuntimeSettingsCompatibilityService
} from '../lib/runtime-policy';

/**
 * Turbo Mode component passes toggleTurboMode function to its child.
 * It also includes `turboMode` in the props passed to the children.
 * It expects this child to be a function with the signature
 *     function (toggleTurboMode, {turboMode, ...props}) {}
 * The component can then be used to attach turbo mode setting functionality
 * to any other component:
 *
 * <TurboMode>{(toggleTurboMode, props) => (
 *     <MyCoolComponent
 *         turboEnabled={props.turboMode}
 *         onClick={toggleTurboMode}
 *         {...props}
 *     />
 * )}</TurboMode>
 */
class TurboMode extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'toggleTurboMode'
        ]);
        this.legacyRuntimeSettings = installLegacyRuntimeSettingsCompatibilityService(this.props.vm);
    }
    toggleTurboMode () {
        this.legacyRuntimeSettings.setTurbo(
            !this.props.turboMode,
            LEGACY_RUNTIME_SOURCE_IDS.TURBO_CONTROL
        );
    }
    render () {
        const {
            /* eslint-disable no-unused-vars */
            children,
            vm,
            /* eslint-enable no-unused-vars */
            ...props
        } = this.props;
        return this.props.children(this.toggleTurboMode, props);
    }
}

TurboMode.propTypes = {
    children: PropTypes.func,
    turboMode: PropTypes.bool,
    vm: PropTypes.shape({
        runtime: PropTypes.object
    })
};

const mapStateToProps = state => ({
    vm: state.scratchGui.vm,
    turboMode: state.scratchGui.vmStatus.turbo
});

export default connect(
    mapStateToProps,
    () => ({}) // omit dispatch prop
)(TurboMode);
