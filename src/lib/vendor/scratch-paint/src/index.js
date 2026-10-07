import PaintEditor from './containers/tw-paint-editor-wrapper.jsx';
import ScratchPaintReducer from './reducers/scratch-paint-reducer';

export {
    DEFAULT_PAINT_MODULES,
    DEFAULT_PAINT_MODULE_REGISTRY,
    PAINT_MODULE_REGISTRY_ID,
    PAINT_MODULE_REGISTRY_VERSION,
    PAINT_MODULE_SLOTS,
    ScratchPaintRuntimeModules,
    createDefaultPaintModuleRegistry,
    createPaintModuleRegistry,
    getPaintModuleComponent
} from './modules';

export {
    PaintEditor as default,
    ScratchPaintReducer
};
