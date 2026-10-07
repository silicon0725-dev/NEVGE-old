'use strict';
module.exports = Object.assign(
    {},
    require('./physics2d-runtime-service'),
    require('./rigidbody2d-command-capability'),
    require('./rapier2d-backend-adapter'),
    require('./rapier2d-shape-query-backend'),
    require('./physics-material2d-resource-service')
);
