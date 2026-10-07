import {getProjectLifecycleHost} from '../project-lifecycle';
import {
    WORKSPACE_CONTEXT_DOMAINS,
    WORKSPACE_CONTEXT_SOURCE_IDS,
    WorkspaceContextService,
    bindWindowManagerToWorkspaceContext
} from './workspace-context';

const WORKSPACE_CONTEXT_RUNTIME_BINDING_ID = 'ngvge.workspace-context-runtime-binding@1';
const SCENE_SYSTEM_MODULE_ID = 'ngvge.scene-system';

const createProjectContextId = projectGeneration => (
    Number.isInteger(projectGeneration) && projectGeneration > 0 ?
        `ngvge.project-context.g${projectGeneration}` : null
);

const getSceneModuleProject = moduleManager => {
    if (!moduleManager || typeof moduleManager.getModuleData !== 'function') return null;
    try {
        const moduleState = typeof moduleManager.getModuleState === 'function' ?
            moduleManager.getModuleState(SCENE_SYSTEM_MODULE_ID) : null;
        if (moduleState && moduleState.enabled === false) return null;
        return moduleManager.getModuleData(SCENE_SYSTEM_MODULE_ID, null);
    } catch {
        return null;
    }
};

class WorkspaceContextRuntimeBinding {
    constructor ({contextService, vm, windowManager, projectLifecycleHost, moduleManager} = {}) {
        if (!(contextService instanceof WorkspaceContextService)) {
            throw new TypeError('Workspace Context runtime binding requires WorkspaceContextService.');
        }
        if (!windowManager || typeof windowManager.subscribe !== 'function') {
            throw new TypeError('Workspace Context runtime binding requires WindowManager.');
        }
        this.id = WORKSPACE_CONTEXT_RUNTIME_BINDING_ID;
        this.contextService = contextService;
        this._disposed = false;
        this._projectBoundaryActive = false;
        this._projectLifecycleHost = projectLifecycleHost || getProjectLifecycleHost(vm);
        this._moduleManager = moduleManager || (vm && vm.runtime ? vm.runtime.ngvgeFirstPartyModules : null);
        this._unsubscribers = [];

        this._projectWriter = contextService.claimWriter(
            WORKSPACE_CONTEXT_DOMAINS.PROJECT,
            WORKSPACE_CONTEXT_SOURCE_IDS.PROJECT_LIFECYCLE
        );
        this._sceneWriter = contextService.claimWriter(
            WORKSPACE_CONTEXT_DOMAINS.SCENE,
            WORKSPACE_CONTEXT_SOURCE_IDS.SCENE_SYSTEM
        );
        this._nodeSelectionWriter = contextService.claimWriter(
            WORKSPACE_CONTEXT_DOMAINS.NODE_SELECTION,
            WORKSPACE_CONTEXT_SOURCE_IDS.NODE_SELECTION
        );
        this._resourceWriter = contextService.claimWriter(
            WORKSPACE_CONTEXT_DOMAINS.RESOURCE,
            WORKSPACE_CONTEXT_SOURCE_IDS.RESOURCE_SELECTION
        );
        this._windowBinding = bindWindowManagerToWorkspaceContext({contextService, windowManager});

        this._syncProject();
        this._syncScene();
        this._bindProjectLifecycle();
        this._bindSceneModule();
    }

    _assertActive () {
        if (this._disposed) {
            const error = new Error('Workspace Context runtime binding has been disposed.');
            error.code = 'NGVGE_WORKSPACE_CONTEXT_RUNTIME_BINDING_DISPOSED';
            throw error;
        }
    }

    _syncProject (state = null) {
        if (this._disposed || !this._projectWriter.isActive()) return null;
        const lifecycleState = state || (
            this._projectLifecycleHost && typeof this._projectLifecycleHost.getState === 'function' ?
                this._projectLifecycleHost.getState() : null
        );
        const projectId = createProjectContextId(lifecycleState && lifecycleState.projectGeneration);
        return this._projectWriter.update({projectId});
    }

    _syncScene () {
        if (this._disposed || !this._sceneWriter.isActive()) return null;
        if (this._projectBoundaryActive) return this._sceneWriter.clear();
        const project = getSceneModuleProject(this._moduleManager);
        const sceneId = project && typeof project.activeSceneId === 'string' && project.activeSceneId.trim() ?
            project.activeSceneId.trim() : null;
        return this._sceneWriter.update({sceneId});
    }

    _clearProjectDependents () {
        if (this._sceneWriter.isActive()) this._sceneWriter.clear();
        if (this._nodeSelectionWriter.isActive()) this._nodeSelectionWriter.clear();
        if (this._resourceWriter.isActive()) this._resourceWriter.clear();
    }

    _bindProjectLifecycle () {
        if (!this._projectLifecycleHost || typeof this._projectLifecycleHost.subscribe !== 'function') return;
        const unsubscribe = this._projectLifecycleHost.subscribe(event => {
            if (this._disposed || !event || !event.state) return;
            const active = event.state.activeOperation;
            const rootLoadStarting = event.type === 'operation:start' && active &&
                active.rootKind === 'load' && !active.nested;
            if (rootLoadStarting) {
                this._projectBoundaryActive = true;
                this._projectWriter.clear();
                this._clearProjectDependents();
                return;
            }
            const completedLoad = event.type === 'operation:complete' && event.state.lastCompletedOperation &&
                event.state.lastCompletedOperation.rootKind === 'load';
            const failedLoad = event.type === 'operation:error' && event.state.lastFailedOperation &&
                event.state.lastFailedOperation.rootKind === 'load';
            const loadSettled = completedLoad || failedLoad;
            if (loadSettled) {
                this._projectBoundaryActive = false;
                this._syncProject(event.state);
                this._syncScene();
            }
        });
        this._unsubscribers.push(unsubscribe);
    }

    _bindSceneModule () {
        if (!this._moduleManager || typeof this._moduleManager.subscribe !== 'function') return;
        const unsubscribe = this._moduleManager.subscribe(() => {
            if (this._disposed) return;
            this._syncScene();
        });
        this._unsubscribers.push(unsubscribe);
    }

    setNodeSelection (selectedNodeIds, primaryNodeId = null) {
        this._assertActive();
        if (this._projectBoundaryActive) return this._nodeSelectionWriter.clear();
        return this._nodeSelectionWriter.update({
            selectedNodeIds: Array.isArray(selectedNodeIds) ? selectedNodeIds : [],
            primaryNodeId
        });
    }

    clearNodeSelection () {
        this._assertActive();
        return this._nodeSelectionWriter.clear();
    }

    setResourceSelection (resourceId) {
        this._assertActive();
        if (this._projectBoundaryActive) return this._resourceWriter.clear();
        return this._resourceWriter.update({resourceId: resourceId || null});
    }

    clearResourceSelection () {
        this._assertActive();
        return this._resourceWriter.clear();
    }

    syncScene () {
        this._assertActive();
        return this._syncScene();
    }

    dispose () {
        if (this._disposed) return false;
        this._disposed = true;
        this._unsubscribers.splice(0).forEach(unsubscribe => {
            try {
                unsubscribe();
            } catch {
                // Source observers must never become semantic authority or block teardown.
            }
        });
        if (this._windowBinding) this._windowBinding.dispose();
        [this._resourceWriter, this._nodeSelectionWriter, this._sceneWriter, this._projectWriter].forEach(writer => {
            if (writer && writer.isActive()) writer.release({clear: true});
        });
        return true;
    }
}

const createWorkspaceContextRuntimeBinding = options => new WorkspaceContextRuntimeBinding(options);

export {
    WORKSPACE_CONTEXT_RUNTIME_BINDING_ID,
    SCENE_SYSTEM_MODULE_ID,
    createProjectContextId,
    WorkspaceContextRuntimeBinding,
    createWorkspaceContextRuntimeBinding
};
