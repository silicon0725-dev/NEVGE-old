import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import {defineMessages, injectIntl, intlShape} from 'react-intl';
import VM from 'scratch-vm';
import {
    LEGACY_RUNTIME_SOURCE_IDS,
    installLegacyRuntimeSettingsCompatibilityService
} from '../lib/runtime-policy';

const messages = defineMessages({
    newFramerate: {
        defaultMessage: 'New framerate:',
        description: 'Prompt shown to choose a new framerate',
        id: 'tw.menuBar.newFramerate'
    }
});

class FramerateChanger extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'changeFramerate'
        ]);
        this.legacyRuntimeSettings = installLegacyRuntimeSettingsCompatibilityService(this.props.vm);
    }
    async changeFramerate (e) {
        if (e && (e.ctrlKey || e.shiftKey)) {
            // prompt() returns Promise in desktop app
            // eslint-disable-next-line no-alert
            const newFPS = await prompt(this.props.intl.formatMessage(messages.newFramerate), this.props.framerate);
            if (newFPS === null) {
                return;
            }
            const fps = +newFPS;
            if (isFinite(fps) && fps > 0) {
                this.legacyRuntimeSettings.setFramerate(
                    fps,
                    LEGACY_RUNTIME_SOURCE_IDS.FRAMERATE_CHANGER
                );
            }
        } else if (this.props.framerate === 60) {
            this.legacyRuntimeSettings.setFramerate(
                30,
                LEGACY_RUNTIME_SOURCE_IDS.FRAMERATE_CHANGER
            );
        } else {
            this.legacyRuntimeSettings.setFramerate(
                60,
                LEGACY_RUNTIME_SOURCE_IDS.FRAMERATE_CHANGER
            );
        }
    }
    render () {
        const {
            /* eslint-disable no-unused-vars */
            intl,
            children,
            vm,
            /* eslint-enable no-unused-vars */
            ...props
        } = this.props;
        return this.props.children(this.changeFramerate, props);
    }
}

FramerateChanger.propTypes = {
    intl: intlShape,
    children: PropTypes.func,
    framerate: PropTypes.number,
    vm: PropTypes.instanceOf(VM)
};

const mapStateToProps = state => ({
    framerate: state.scratchGui.tw.framerate,
    vm: state.scratchGui.vm
});

export default injectIntl(connect(
    mapStateToProps,
    () => ({}) // omit dispatch prop
)(FramerateChanger));
