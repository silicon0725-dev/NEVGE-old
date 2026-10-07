import {WORKSPACE_DOCK_RUNTIME_MODEL_ID} from './dock-runtime-model';
import {WORKSPACE_TOOL_REGISTRY_ID} from './tool-registry';
import {WORKSPACE_WINDOW_MANAGER_ID} from './window-manager';

const WORKSPACE_DOCK_INTERACTION_CONTROLLER_ID = 'ngvge.workspace-dock-interaction-controller@1';
const DOCK_INTERACTION_RESULT_SCHEMA_VERSION = 1;

const assertToolId = toolId => {
    if (typeof toolId !== 'string' || !/^ngvge\.tool\.[a-z0-9][a-z0-9.-]*$/.test(toolId)) {
        throw new TypeError('Dock interaction toolId must be a stable ngvge.tool.* identifier.');
    }
    return toolId;
};

const assertDependencies = ({toolRegistry, windowManager, dockRuntimeModel, launchTool}) => {
    if (!toolRegistry || toolRegistry.id !== WORKSPACE_TOOL_REGISTRY_ID || typeof toolRegistry.require !== 'function') {
        throw new TypeError('Dock Interaction Controller requires the Workspace Tool Registry.');
    }
    if (!windowManager || windowManager.id !== WORKSPACE_WINDOW_MANAGER_ID ||
        typeof windowManager.activate !== 'function' || typeof windowManager.restore !== 'function') {
        throw new TypeError('Dock Interaction Controller requires the Workspace Window Manager.');
    }
    if (!dockRuntimeModel || dockRuntimeModel.id !== WORKSPACE_DOCK_RUNTIME_MODEL_ID ||
        typeof dockRuntimeModel.getItem !== 'function') {
        throw new TypeError('Dock Interaction Controller requires the Dock Runtime Model.');
    }
    if (typeof launchTool !== 'function') {
        throw new TypeError('Dock Interaction Controller requires a launchTool callback.');
    }
};

const freezeResult = value => Object.freeze({
    schemaVersion: DOCK_INTERACTION_RESULT_SCHEMA_VERSION,
    controllerId: WORKSPACE_DOCK_INTERACTION_CONTROLLER_ID,
    ...value
});

class DockInteractionController {
    constructor ({toolRegistry, windowManager, dockRuntimeModel, launchTool} = {}) {
        assertDependencies({toolRegistry, windowManager, dockRuntimeModel, launchTool});
        this.id = WORKSPACE_DOCK_INTERACTION_CONTROLLER_ID;
        this._toolRegistry = toolRegistry;
        this._windowManager = windowManager;
        this._dockRuntimeModel = dockRuntimeModel;
        this._launchTool = launchTool;
    }

    _requireTool (toolId) {
        return this._toolRegistry.require(assertToolId(toolId));
    }

    _sortPreferredInstances (instances) {
        return instances.slice().sort((a, b) => {
            const aState = this._windowManager.requireState(a.windowId);
            const bState = this._windowManager.requireState(b.windowId);
            if (bState.lastFocusedAt !== aState.lastFocusedAt) {
                return bState.lastFocusedAt - aState.lastFocusedAt;
            }
            return a.windowId.localeCompare(b.windowId);
        });
    }

    activateTool (toolId) {
        const tool = this._requireTool(toolId);
        const item = this._dockRuntimeModel.getItem(tool.id);

        if (item.active && item.activeWindowId) {
            return freezeResult({
                action: 'already-active',
                toolId: tool.id,
                windowId: item.activeWindowId
            });
        }

        const runningInstances = this._sortPreferredInstances(item.instances.filter(instance => instance.running));
        const preferred = runningInstances[0] || null;

        if (preferred) {
            if (preferred.minimized) {
                this._windowManager.restore(preferred.windowId);
                return freezeResult({
                    action: 'restore',
                    toolId: tool.id,
                    windowId: preferred.windowId
                });
            }
            this._windowManager.activate(preferred.windowId);
            return freezeResult({
                action: 'focus',
                toolId: tool.id,
                windowId: preferred.windowId
            });
        }

        const launchResult = this._launchTool(tool.id, tool) || null;
        return freezeResult({
            action: 'launch',
            toolId: tool.id,
            windowId: launchResult && typeof launchResult.windowId === 'string' ? launchResult.windowId : null
        });
    }

    togglePin (toolId) {
        const id = this._requireTool(toolId).id;
        const pinned = this._dockRuntimeModel.isPinned(id);
        if (pinned) this._dockRuntimeModel.unpin(id);
        else this._dockRuntimeModel.pin(id);
        return freezeResult({
            action: pinned ? 'unpin' : 'pin',
            toolId: id,
            windowId: null
        });
    }

    setVisibleOrder (toolIds) {
        if (!Array.isArray(toolIds)) {
            throw new TypeError('Dock visible order must be an array of ToolIds.');
        }
        toolIds.forEach(toolId => this._requireTool(toolId));
        const changed = this._dockRuntimeModel.setOrder(toolIds);
        return freezeResult({
            action: changed ? 'reorder' : 'reorder-noop',
            toolId: null,
            windowId: null
        });
    }
}

export {
    WORKSPACE_DOCK_INTERACTION_CONTROLLER_ID,
    DOCK_INTERACTION_RESULT_SCHEMA_VERSION,
    DockInteractionController
};
