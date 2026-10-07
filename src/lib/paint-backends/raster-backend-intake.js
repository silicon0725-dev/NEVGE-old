import {
    MINIPAINT_BACKEND_ID,
    PISKEL_BACKEND_ID,
    SCRATCH_PAINT_COMPAT_BACKEND_ID
} from './paint-backend-candidates';

const RASTER_BACKEND_INTAKE_ID = 'ngvge.raster-backend-intake@1';
const RASTER_BACKEND_RESEARCH_DATE = '2026-08-15';

const REJECTED_RASTER_AUTHORITIES = Object.freeze([
    'semantic-identity',
    'project',
    'resource',
    'transaction',
    'persistence',
    'timeline',
    'frame-id',
    'layer-id',
    'cel-id',
    'workspace-window'
]);

const RASTER_BACKEND_INTAKE = Object.freeze({
    [MINIPAINT_BACKEND_ID]: Object.freeze({
        intakeId: RASTER_BACKEND_INTAKE_ID,
        backendId: MINIPAINT_BACKEND_ID,
        project: 'viliusle/miniPaint',
        sourceRef: 'master',
        observedCommit: 'a79733eb803fc97084ef0ee4faa96b031e69e1c0',
        license: 'MIT',
        licenseFile: 'MIT-LICENSE.txt',
        researchDate: RASTER_BACKEND_RESEARCH_DATE,
        strategy: 'controlled-extraction',
        reusableSurfaces: Object.freeze([
            'raster-layer-implementation',
            'raster-selection-implementation',
            'brush-algorithms',
            'pencil-algorithms',
            'eraser-algorithms',
            'flood-fill-algorithms',
            'color-sampling',
            'raster-transform-implementation'
        ]),
        verifiedSourcePaths: Object.freeze([
            'src/js/core/base-layers.js',
            'src/js/core/base-selection.js',
            'src/js/core/base-tools.js',
            'src/js/tools/brush.js',
            'src/js/tools/pencil.js',
            'src/js/tools/erase.js',
            'src/js/tools/fill.js',
            'src/js/tools/pick_color.js',
            'src/js/tools/select.js'
        ]),
        rejectedSurfaces: Object.freeze([
            'app-shell',
            'file-open-save',
            'local-persistence',
            'history-authority',
            ...REJECTED_RASTER_AUTHORITIES
        ])
    }),
    [PISKEL_BACKEND_ID]: Object.freeze({
        intakeId: RASTER_BACKEND_INTAKE_ID,
        backendId: PISKEL_BACKEND_ID,
        project: 'piskelapp/piskel',
        sourceRef: 'master',
        observedCommit: 'a6b9c02daefceb10093f71e92d52d16920ccb16e',
        license: 'Apache-2.0',
        licenseFile: 'LICENSE',
        researchDate: RASTER_BACKEND_RESEARCH_DATE,
        strategy: 'controlled-extraction',
        reusableSurfaces: Object.freeze([
            'pixel-drawing-tools',
            'integer-grid-shape-tools',
            'pixel-eraser',
            'pixel-flood-fill',
            'color-sampling',
            'dithering-implementation',
            'mirror-pen-implementation',
            'palette-operations',
            'onion-skin-rendering-support'
        ]),
        verifiedSourcePaths: Object.freeze([
            'src/js/tools/drawing/BaseTool.js',
            'src/js/tools/drawing/SimplePen.js',
            'src/js/tools/drawing/Eraser.js',
            'src/js/tools/drawing/PaintBucket.js',
            'src/js/tools/drawing/Rectangle.js',
            'src/js/tools/drawing/Circle.js',
            'src/js/tools/drawing/ColorPicker.js',
            'src/js/tools/drawing/DitheringTool.js',
            'src/js/tools/drawing/VerticalMirrorPen.js',
            'src/js/service/palette/PaletteService.js',
            'src/js/rendering/OnionSkinRenderer.js'
        ]),
        rejectedSurfaces: Object.freeze([
            'app-shell',
            'file-manager',
            'backup-service',
            'saved-status-authority',
            'history-authority',
            ...REJECTED_RASTER_AUTHORITIES
        ])
    }),
    [SCRATCH_PAINT_COMPAT_BACKEND_ID]: Object.freeze({
        intakeId: RASTER_BACKEND_INTAKE_ID,
        backendId: SCRATCH_PAINT_COMPAT_BACKEND_ID,
        project: 'scratchfoundation/scratch-paint',
        sourceRef: 'develop',
        observedCommit: 'f8966f09df9a994c207db10b4ab52f530a1172d8',
        license: 'AGPL-3.0',
        licenseFile: 'LICENSE',
        researchDate: RASTER_BACKEND_RESEARCH_DATE,
        strategy: 'compatibility-reference',
        reusableSurfaces: Object.freeze([
            'viewport-artboard-separation-reference',
            'guide-layer-reference',
            'rotation-center-normalization-reference',
            'pointer-view-recalibration-reference',
            'selection-interaction-reference'
        ]),
        verifiedSourcePaths: Object.freeze([
            'src/helper/view.js',
            'src/helper/layer.js',
            'src/containers/paper-canvas.jsx',
            'src/containers/scrollable-canvas.jsx'
        ]),
        rejectedSurfaces: Object.freeze([
            'authoritative-semantic-model',
            'authoritative-persistence-model',
            ...REJECTED_RASTER_AUTHORITIES
        ])
    })
});

const getRasterBackendIntake = backendId => RASTER_BACKEND_INTAKE[backendId] || null;

export {
    RASTER_BACKEND_INTAKE_ID,
    RASTER_BACKEND_RESEARCH_DATE,
    REJECTED_RASTER_AUTHORITIES,
    RASTER_BACKEND_INTAKE,
    getRasterBackendIntake
};
