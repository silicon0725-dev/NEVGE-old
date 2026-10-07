const {createRuntimeId} = require('../runtime-nodes/id');

const createScratchBindingId = () => createRuntimeId('scratch-binding');
const createScratchSpriteNodeId = () => createRuntimeId('runtime-node:sprite');
const createScratchBindingComponentId = () => createRuntimeId('runtime-component:scratch-target-binding');

module.exports = {
    createScratchBindingComponentId,
    createScratchBindingId,
    createScratchSpriteNodeId
};
