/* eslint-disable import/no-commonjs, strict */
'use strict';

module.exports = Object.assign(
    {},
    require('./constants'),
    require('./extension-containment-authority'),
    require('./extension-containment-host'),
    require('./extension-descriptor'),
    require('./legacy-addon-dom-bridge'),
    require('./legacy-addon-host'),
    require('./ngvge-module-host'),
    require('./scratch-extension-host')
);
