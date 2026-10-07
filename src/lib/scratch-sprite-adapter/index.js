const constants = require('./constants');
const id = require('./id');
const {ScratchSpriteRuntimeNode} = require('./scratch-sprite-node');
const projection = require('./scratch-sprite-tree-projection');
const service = require('./scratch-sprite-node-adapter-service');
const transformProjection = require('./scratch-transform-projection-service');
const transformCommandBridge = require('./scratch-transform-command-bridge');
const spriteLifecycleCommandBridge = require('./scratch-sprite-lifecycle-command-bridge');
const roleManagerParity = require('./scratch-role-manager-parity');

module.exports = {
    ScratchSpriteRuntimeNode,
    ...constants,
    ...id,
    ...projection,
    ...service,
    ...transformProjection,
    ...transformCommandBridge,
    ...spriteLifecycleCommandBridge,
    ...roleManagerParity
};
