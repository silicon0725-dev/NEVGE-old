import CanvasControlsModule from './ui/canvas-controls-module.jsx';
import EmptyPaintModule from './ui/empty-module.jsx';
import FixedToolbarModule from './ui/fixed-toolbar-module.jsx';
import PropertiesToolbarModule from './ui/properties-toolbar-module.jsx';
import ToolRailModule from './ui/tool-rail-module.jsx';
import WorkspaceModule from './ui/workspace-module.jsx';
import {createPaintModuleRegistry} from './paint-module-registry';

const moduleRecord = (id, component) => Object.freeze({id, version: 1, component});

const DEFAULT_PAINT_MODULES = Object.freeze({
    fixedToolbar: moduleRecord('scratch-paint.ui.fixed-toolbar@1', FixedToolbarModule),
    propertiesToolbar: moduleRecord('scratch-paint.ui.properties-toolbar@1', PropertiesToolbarModule),
    toolRail: moduleRecord('scratch-paint.ui.tool-rail@1', ToolRailModule),
    workspace: moduleRecord('scratch-paint.workspace.paper@1', WorkspaceModule),
    canvasControls: moduleRecord('scratch-paint.ui.canvas-controls@1', CanvasControlsModule),
    workspaceOverlay: moduleRecord('scratch-paint.extension.workspace-overlay.empty@1', EmptyPaintModule),
    sidePanel: moduleRecord('scratch-paint.extension.side-panel.empty@1', EmptyPaintModule),
    bottomPanel: moduleRecord('scratch-paint.extension.bottom-panel.empty@1', EmptyPaintModule)
});

const DEFAULT_PAINT_MODULE_REGISTRY = createPaintModuleRegistry(DEFAULT_PAINT_MODULES);

const createDefaultPaintModuleRegistry = overrides => createPaintModuleRegistry(DEFAULT_PAINT_MODULES, overrides);

export {
    DEFAULT_PAINT_MODULES,
    DEFAULT_PAINT_MODULE_REGISTRY,
    createDefaultPaintModuleRegistry
};
