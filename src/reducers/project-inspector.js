const SET_PROJECT_INSPECTOR_VISIBLE = 'scratch-gui/project-inspector/SET_VISIBLE';
const SET_PROJECT_INSPECTOR_WIDTH = 'scratch-gui/project-inspector/SET_WIDTH';
const SET_PROJECT_INSPECTOR_SECTION_EXPANDED = 'scratch-gui/project-inspector/SET_SECTION_EXPANDED';
const RESET_PROJECT_INSPECTOR = 'scratch-gui/project-inspector/RESET';

const MIN_WIDTH = 240;
const MAX_WIDTH = 560;
const DEFAULT_WIDTH = 320;

const initialState = {
    visible: true,
    width: DEFAULT_WIDTH,
    expandedSectionIds: [
        'identity',
        'node:identity',
        'node:properties',
        'node:hierarchy',
        'transform',
        'layer',
        'runtime-node:identity',
        'runtime-node:transform',
        'runtime-node:scratch-appearance',
        'runtime-node:camera2d',
        'runtime-node:collider2d',
        'runtime-node:character-controller2d',
        'extension:camera',
        'extension:stretch'
    ]
};

const normalizeWidth = width => {
    if (!Number.isFinite(width)) return DEFAULT_WIDTH;
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;

    switch (action.type) {
    case SET_PROJECT_INSPECTOR_VISIBLE:
        return Object.assign({}, state, {
            visible: Boolean(action.visible)
        });
    case SET_PROJECT_INSPECTOR_WIDTH:
        return Object.assign({}, state, {
            width: normalizeWidth(action.width)
        });
    case SET_PROJECT_INSPECTOR_SECTION_EXPANDED: {
        if (typeof action.sectionId !== 'string' || !action.sectionId.length) {
            return state;
        }
        const expandedSectionIds = new Set(state.expandedSectionIds);
        if (action.expanded) {
            expandedSectionIds.add(action.sectionId);
        } else {
            expandedSectionIds.delete(action.sectionId);
        }
        return Object.assign({}, state, {
            expandedSectionIds: Array.from(expandedSectionIds)
        });
    }
    case RESET_PROJECT_INSPECTOR:
        return initialState;
    default:
        return state;
    }
};

const setProjectInspectorVisible = visible => ({
    type: SET_PROJECT_INSPECTOR_VISIBLE,
    visible
});

const setProjectInspectorWidth = width => ({
    type: SET_PROJECT_INSPECTOR_WIDTH,
    width
});

const setProjectInspectorSectionExpanded = (sectionId, expanded) => ({
    type: SET_PROJECT_INSPECTOR_SECTION_EXPANDED,
    sectionId,
    expanded
});

const resetProjectInspector = () => ({
    type: RESET_PROJECT_INSPECTOR
});

export {
    reducer as default,
    initialState as projectInspectorInitialState,
    MIN_WIDTH,
    MAX_WIDTH,
    DEFAULT_WIDTH,
    SET_PROJECT_INSPECTOR_VISIBLE,
    SET_PROJECT_INSPECTOR_WIDTH,
    SET_PROJECT_INSPECTOR_SECTION_EXPANDED,
    RESET_PROJECT_INSPECTOR,
    setProjectInspectorVisible,
    setProjectInspectorWidth,
    setProjectInspectorSectionExpanded,
    resetProjectInspector
};
