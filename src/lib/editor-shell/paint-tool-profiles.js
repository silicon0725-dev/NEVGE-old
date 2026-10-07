const PAINT_MODE_IDS = Object.freeze({
    VECTOR: 'vector',
    BITMAP: 'bitmap',
    PIXEL: 'pixel'
});

const PAINT_TOOL_IDS = Object.freeze({
    SELECT: 'select',
    DIRECT_SELECT: 'direct-select',
    FREEHAND: 'freehand',
    BRUSH: 'brush',
    PENCIL: 'pencil',
    ERASER: 'eraser',
    FILL: 'fill',
    EYEDROPPER: 'eyedropper',
    LINE: 'line',
    RECT: 'rect',
    ELLIPSE: 'ellipse',
    PATH: 'path',
    TEXT: 'text',
    HAND: 'hand',
    ZOOM: 'zoom'
});

const PAINT_TOOL_DESCRIPTORS = Object.freeze({
    [PAINT_TOOL_IDS.SELECT]: Object.freeze({
        id: PAINT_TOOL_IDS.SELECT,
        label: 'Selection',
        glyph: 'select',
        semantic: 'selection',
        shortcut: 'V'
    }),
    [PAINT_TOOL_IDS.DIRECT_SELECT]: Object.freeze({
        id: PAINT_TOOL_IDS.DIRECT_SELECT,
        label: 'Direct Selection',
        glyph: 'direct-select',
        semantic: 'direct-selection',
        shortcut: 'A'
    }),
    [PAINT_TOOL_IDS.FREEHAND]: Object.freeze({
        id: PAINT_TOOL_IDS.FREEHAND,
        label: 'Pencil',
        glyph: 'pencil',
        semantic: 'freehand',
        shortcut: null
    }),
    [PAINT_TOOL_IDS.BRUSH]: Object.freeze({
        id: PAINT_TOOL_IDS.BRUSH,
        label: 'Brush',
        glyph: 'brush',
        semantic: 'freehand',
        shortcut: 'B'
    }),
    [PAINT_TOOL_IDS.PENCIL]: Object.freeze({
        id: PAINT_TOOL_IDS.PENCIL,
        label: 'Pencil',
        glyph: 'pencil',
        semantic: 'pixel-pencil',
        shortcut: 'B'
    }),
    [PAINT_TOOL_IDS.ERASER]: Object.freeze({
        id: PAINT_TOOL_IDS.ERASER,
        label: 'Eraser',
        glyph: 'eraser',
        semantic: 'erase',
        shortcut: 'E'
    }),
    [PAINT_TOOL_IDS.FILL]: Object.freeze({
        id: PAINT_TOOL_IDS.FILL,
        label: 'Fill',
        glyph: 'fill',
        semantic: 'flood-fill',
        shortcut: 'F'
    }),
    [PAINT_TOOL_IDS.EYEDROPPER]: Object.freeze({
        id: PAINT_TOOL_IDS.EYEDROPPER,
        label: 'Eyedropper',
        glyph: 'eyedropper',
        semantic: 'color-sample',
        shortcut: 'I'
    }),
    [PAINT_TOOL_IDS.LINE]: Object.freeze({
        id: PAINT_TOOL_IDS.LINE,
        label: 'Line',
        glyph: 'line',
        semantic: 'line',
        shortcut: null
    }),
    [PAINT_TOOL_IDS.RECT]: Object.freeze({
        id: PAINT_TOOL_IDS.RECT,
        label: 'Rectangle',
        glyph: 'rect',
        semantic: 'rectangle',
        shortcut: 'M'
    }),
    [PAINT_TOOL_IDS.ELLIPSE]: Object.freeze({
        id: PAINT_TOOL_IDS.ELLIPSE,
        label: 'Ellipse',
        glyph: 'ellipse',
        semantic: 'ellipse',
        shortcut: 'L'
    }),
    [PAINT_TOOL_IDS.PATH]: Object.freeze({
        id: PAINT_TOOL_IDS.PATH,
        label: 'Pen / Path',
        glyph: 'path',
        semantic: 'path',
        shortcut: 'P'
    }),
    [PAINT_TOOL_IDS.TEXT]: Object.freeze({
        id: PAINT_TOOL_IDS.TEXT,
        label: 'Type',
        glyph: 'text',
        semantic: 'text',
        shortcut: 'T'
    }),
    [PAINT_TOOL_IDS.HAND]: Object.freeze({
        id: PAINT_TOOL_IDS.HAND,
        label: 'Hand',
        glyph: 'hand',
        semantic: 'viewport-pan',
        shortcut: 'H'
    }),
    [PAINT_TOOL_IDS.ZOOM]: Object.freeze({
        id: PAINT_TOOL_IDS.ZOOM,
        label: 'Zoom',
        glyph: 'zoom',
        semantic: 'viewport-zoom',
        shortcut: 'Z'
    })
});

const PAINT_TOOL_PROFILES = Object.freeze({
    [PAINT_MODE_IDS.VECTOR]: Object.freeze({
        mode: PAINT_MODE_IDS.VECTOR,
        label: 'Vector',
        tools: Object.freeze([
            PAINT_TOOL_IDS.SELECT,
            PAINT_TOOL_IDS.DIRECT_SELECT,
            PAINT_TOOL_IDS.FREEHAND,
            PAINT_TOOL_IDS.LINE,
            PAINT_TOOL_IDS.RECT,
            PAINT_TOOL_IDS.ELLIPSE,
            PAINT_TOOL_IDS.PATH,
            PAINT_TOOL_IDS.TEXT,
            PAINT_TOOL_IDS.HAND,
            PAINT_TOOL_IDS.ZOOM
        ])
    }),
    [PAINT_MODE_IDS.BITMAP]: Object.freeze({
        mode: PAINT_MODE_IDS.BITMAP,
        label: 'Bitmap',
        tools: Object.freeze([
            PAINT_TOOL_IDS.SELECT,
            PAINT_TOOL_IDS.BRUSH,
            PAINT_TOOL_IDS.ERASER,
            PAINT_TOOL_IDS.FILL,
            PAINT_TOOL_IDS.LINE,
            PAINT_TOOL_IDS.RECT,
            PAINT_TOOL_IDS.ELLIPSE,
            PAINT_TOOL_IDS.TEXT,
            PAINT_TOOL_IDS.EYEDROPPER,
            PAINT_TOOL_IDS.HAND,
            PAINT_TOOL_IDS.ZOOM
        ])
    }),
    [PAINT_MODE_IDS.PIXEL]: Object.freeze({
        mode: PAINT_MODE_IDS.PIXEL,
        label: 'Pixel',
        tools: Object.freeze([
            PAINT_TOOL_IDS.SELECT,
            PAINT_TOOL_IDS.PENCIL,
            PAINT_TOOL_IDS.ERASER,
            PAINT_TOOL_IDS.FILL,
            PAINT_TOOL_IDS.LINE,
            PAINT_TOOL_IDS.RECT,
            PAINT_TOOL_IDS.ELLIPSE,
            PAINT_TOOL_IDS.EYEDROPPER,
            PAINT_TOOL_IDS.HAND,
            PAINT_TOOL_IDS.ZOOM
        ])
    })
});

const getPaintToolDescriptor = toolId => PAINT_TOOL_DESCRIPTORS[toolId] || null;
const getPaintToolProfile = mode => PAINT_TOOL_PROFILES[mode] || null;
const getPaintToolsForMode = mode => {
    const profile = getPaintToolProfile(mode);
    return profile ? profile.tools : Object.freeze([]);
};
const getPaintModeLabel = mode => {
    const profile = getPaintToolProfile(mode);
    return profile ? profile.label : mode;
};
const getPaintToolLabel = toolId => {
    const descriptor = getPaintToolDescriptor(toolId);
    return descriptor ? descriptor.label : toolId;
};

export {
    PAINT_MODE_IDS,
    PAINT_TOOL_IDS,
    PAINT_TOOL_DESCRIPTORS,
    PAINT_TOOL_PROFILES,
    getPaintToolDescriptor,
    getPaintToolProfile,
    getPaintToolsForMode,
    getPaintModeLabel,
    getPaintToolLabel
};
