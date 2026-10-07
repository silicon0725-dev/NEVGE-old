import {TOOL_IDS, createCoreToolRegistry} from '../../../../src/lib/editor-shell/tool-registry';
import {createWindowDescriptor} from '../../../../src/lib/editor-shell/window-model';
import {WindowManager} from '../../../../src/lib/editor-shell/window-manager';
import {
    WORKSPACE_DOCK_TRANSITION_MODEL_ID,
    DOCK_TRANSITION_KINDS,
    DockTransitionModel
} from '../../../../src/lib/editor-shell/dock-transition-model';

const createFoundation = ({dockGeometry = {left: 900, top: 700, width: 44, height: 44}} = {}) => {
    const registry = createCoreToolRegistry();
    const manager = new WindowManager();
    const descriptor = createWindowDescriptor(registry.require(TOOL_IDS.NODE_EXPLORER));
    manager.registerWindow(descriptor, {
        visible: true,
        position: {x: 120, y: 80},
        size: {width: 420, height: 360}
    });
    const model = new DockTransitionModel({
        windowManager: manager,
        getWorkspaceViewportGeometry: () => ({left: 10, top: 20, width: 1200, height: 800}),
        getDockTargetGeometry: () => dockGeometry,
        durationMs: 240
    });
    return {descriptor, manager, model};
};

describe('WS-3F DockTransitionModel', () => {
    test('records minimize only after WindowManager has committed minimized semantics', () => {
        const {descriptor, manager, model} = createFoundation();
        manager.minimize(descriptor.windowId);
        const transition = model.getTransitionForWindow(descriptor.windowId);
        expect(model.id).toBe(WORKSPACE_DOCK_TRANSITION_MODEL_ID);
        expect(transition).toMatchObject({
            kind: DOCK_TRANSITION_KINDS.MINIMIZE,
            windowId: descriptor.windowId,
            toolId: TOOL_IDS.NODE_EXPLORER,
            durationMs: 240,
            semanticState: {
                visible: true,
                minimized: true,
                active: false
            },
            from: {left: 130, top: 100, width: 420, height: 360},
            to: {left: 900, top: 700, width: 44, height: 44}
        });
        expect(manager.requireState(descriptor.windowId).minimized).toBe(true);
        expect(Object.isFrozen(transition)).toBe(true);
        expect(Object.isFrozen(transition.from)).toBe(true);
        model.dispose();
    });

    test('records restore from Dock target to WindowManager geometry after semantic restore commit', () => {
        const {descriptor, manager, model} = createFoundation();
        manager.minimize(descriptor.windowId);
        model.completeTransition(model.getTransitionForWindow(descriptor.windowId).transitionId);
        manager.restore(descriptor.windowId, {activate: false});
        const transition = model.getTransitionForWindow(descriptor.windowId);
        expect(transition).toMatchObject({
            kind: DOCK_TRANSITION_KINDS.RESTORE,
            semanticState: {
                visible: true,
                minimized: false
            },
            from: {left: 900, top: 700, width: 44, height: 44},
            to: {left: 130, top: 100, width: 420, height: 360}
        });
        expect(manager.requireState(descriptor.windowId).minimized).toBe(false);
        model.dispose();
    });


    test('does not replay a Dock restore transition for idempotent restore after move or resize', () => {
        const {descriptor, manager, model} = createFoundation();
        manager.move(descriptor.windowId, {x: 180, y: 140});
        manager.resize(descriptor.windowId, {width: 500, height: 410});

        manager.restore(descriptor.windowId, {activate: false});

        expect(manager.requireState(descriptor.windowId)).toMatchObject({
            visible: true,
            minimized: false,
            position: {x: 180, y: 140},
            size: {width: 500, height: 410}
        });
        expect(model.listTransitions()).toEqual([]);
        model.dispose();
    });

    test('skips animation when Dock target geometry is unavailable without blocking semantic state', () => {
        const {descriptor, manager, model} = createFoundation({dockGeometry: null});
        manager.minimize(descriptor.windowId);
        expect(manager.requireState(descriptor.windowId).minimized).toBe(true);
        expect(model.listTransitions()).toEqual([]);
        expect(model.getDiagnostics().skippedMissingDockTargetGeometry).toBe(1);
        model.dispose();
    });

    test('presentation completion never mutates WindowManager semantic state', () => {
        const {descriptor, manager, model} = createFoundation();
        manager.minimize(descriptor.windowId);
        const revision = manager.revision;
        const transition = model.getTransitionForWindow(descriptor.windowId);
        expect(model.completeTransition(transition.transitionId)).toBe(true);
        expect(model.listTransitions()).toEqual([]);
        expect(manager.revision).toBe(revision);
        expect(manager.requireState(descriptor.windowId).minimized).toBe(true);
        model.dispose();
    });

    test('rapid opposite transitions supersede presentation records but keep latest semantic truth', () => {
        const {descriptor, manager, model} = createFoundation();
        manager.minimize(descriptor.windowId);
        manager.restore(descriptor.windowId, {activate: false});
        expect(model.listTransitions()).toHaveLength(1);
        expect(model.getTransitionForWindow(descriptor.windowId).kind).toBe(DOCK_TRANSITION_KINDS.RESTORE);
        expect(model.getDiagnostics().supersededTransitions).toBe(1);
        expect(manager.requireState(descriptor.windowId).minimized).toBe(false);
        model.dispose();
    });

    test('dispose removes the WindowManager subscription', () => {
        const {descriptor, manager, model} = createFoundation();
        expect(model.dispose()).toBe(true);
        manager.minimize(descriptor.windowId);
        expect(model.listTransitions()).toEqual([]);
        expect(model.dispose()).toBe(false);
    });
});
