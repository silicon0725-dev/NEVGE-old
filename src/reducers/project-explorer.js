const SET_PROJECT_EXPLORER_VISIBLE = 'scratch-gui/project-explorer/SET_VISIBLE';
const SET_PROJECT_EXPLORER_WIDTH = 'scratch-gui/project-explorer/SET_WIDTH';
const SET_PROJECT_EXPLORER_NODE_EXPANDED = 'scratch-gui/project-explorer/SET_NODE_EXPANDED';
const SET_PROJECT_EXPLORER_SELECTED_NODE = 'scratch-gui/project-explorer/SET_SELECTED_NODE';
const RESET_PROJECT_EXPLORER = 'scratch-gui/project-explorer/RESET';

const MIN_WIDTH = 180;
const MAX_WIDTH = 560;
const DEFAULT_WIDTH = 280;

const initialState = {
    visible: true,
    width: DEFAULT_WIDTH,
    selectedNodeId: null,
    expandedNodeIds: [
        'project:root',
        'provider:entities',
        'provider:assets'
    ]
};

const normalizeWidth = width => {
    if (!Number.isFinite(width)) return DEFAULT_WIDTH;
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;

    switch (action.type) {
    case SET_PROJECT_EXPLORER_VISIBLE:
        return Object.assign({}, state, {
            visible: Boolean(action.visible)
        });
    case SET_PROJECT_EXPLORER_WIDTH:
        return Object.assign({}, state, {
            width: normalizeWidth(action.width)
        });
    case SET_PROJECT_EXPLORER_SELECTED_NODE:
        return Object.assign({}, state, {
            selectedNodeId: typeof action.nodeId === 'string' && action.nodeId.length ? action.nodeId : null
        });
    case SET_PROJECT_EXPLORER_NODE_EXPANDED: {
        if (typeof action.nodeId !== 'string' || action.nodeId.length === 0) {
            return state;
        }

        const expandedNodeIds = new Set(state.expandedNodeIds);

        if (action.expanded) {
            expandedNodeIds.add(action.nodeId);
        } else {
            expandedNodeIds.delete(action.nodeId);
        }

        return Object.assign({}, state, {
            expandedNodeIds: Array.from(expandedNodeIds)
        });
    }
    case RESET_PROJECT_EXPLORER:
        return initialState;
    default:
        return state;
    }
};

const setProjectExplorerVisible = visible => ({
    type: SET_PROJECT_EXPLORER_VISIBLE,
    visible
});

const setProjectExplorerWidth = width => ({
    type: SET_PROJECT_EXPLORER_WIDTH,
    width
});

const setProjectExplorerSelectedNode = nodeId => ({
    type: SET_PROJECT_EXPLORER_SELECTED_NODE,
    nodeId
});

const setProjectExplorerNodeExpanded = (nodeId, expanded) => ({
    type: SET_PROJECT_EXPLORER_NODE_EXPANDED,
    nodeId,
    expanded
});

const resetProjectExplorer = () => ({
    type: RESET_PROJECT_EXPLORER
});

export {
    reducer as default,
    initialState as projectExplorerInitialState,
    MIN_WIDTH,
    MAX_WIDTH,
    DEFAULT_WIDTH,
    SET_PROJECT_EXPLORER_VISIBLE,
    SET_PROJECT_EXPLORER_WIDTH,
    SET_PROJECT_EXPLORER_NODE_EXPANDED,
    SET_PROJECT_EXPLORER_SELECTED_NODE,
    RESET_PROJECT_EXPLORER,
    setProjectExplorerVisible,
    setProjectExplorerWidth,
    setProjectExplorerNodeExpanded,
    setProjectExplorerSelectedNode,
    resetProjectExplorer
};
