/* eslint-disable import/no-commonjs, strict */
'use strict';

module.exports = Object.assign(
    {},
    require('./constants'),
    require('./presenter-capability'),
    require('./presenter-capability-registry'),
    require('./compatibility-project-scan'),
    require('./compatibility-backend-scan'),
    require('./compatibility-analyzer'),
    require('./compatibility-runtime-integration'),
    require('./runtime-policy-contract'),
    require('./runtime-policy-schema'),
    require('./runtime-policy-authority'),
    require('./profile-registry'),
    require('./runtime-policy-resolver'),
    require('./runtime-policy-command-capability'),
    require('./runtime-policy-command-executor'),
    require('./scratch-runtime-policy-adapter'),
    require('./runtime-policy-runtime-integration'),
    require('./legacy-advanced-settings-bridge'),
    require('./legacy-runtime-settings-compatibility')
);
