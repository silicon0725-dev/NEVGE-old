import React from 'react';

const WORKSPACE_PAINT_BACKEND_ACTIVATE = 'ngvge/workspace-paint/ACTIVATE_BACKEND';
const activateWorkspacePaintBackend = () => ({type: WORKSPACE_PAINT_BACKEND_ACTIVATE});

let realScratchPaint;
const getRealScratchPaint = () => {
    if (!realScratchPaint) {
        realScratchPaint = require('./vendor/scratch-paint/src');
    }
    return realScratchPaint;
};

const PaintEditor = props => React.createElement(getRealScratchPaint().default, props);

const createScratchPaintModuleRegistry = overrides =>
    getRealScratchPaint().createDefaultPaintModuleRegistry(overrides);

const getScratchPaintRuntimeModules = () => getRealScratchPaint().ScratchPaintRuntimeModules;

let hasSetupReducer = false;
const ScratchPaintReducer = (state, action) => {
    if (!hasSetupReducer && (
        (action.type === 'scratch-gui/navigation/ACTIVATE_TAB' && action.activeTabIndex === 1) ||
        action.type === WORKSPACE_PAINT_BACKEND_ACTIVATE
    )) {
        hasSetupReducer = true;
    }
    if (hasSetupReducer) {
        return getRealScratchPaint().ScratchPaintReducer(state, action);
    }
    return {};
};

export {
    PaintEditor as default,
    ScratchPaintReducer,
    WORKSPACE_PAINT_BACKEND_ACTIVATE,
    activateWorkspacePaintBackend,
    createScratchPaintModuleRegistry,
    getScratchPaintRuntimeModules
};
