import React from 'react';
import renderer, {act} from 'react-test-renderer';

import Collider2DGizmo from '../../../src/components/stage/collider2d-gizmo.jsx';
import {CAMERA2D_RUNTIME_CAPABILITY_ID} from '../../../src/lib/camera-system';
import {
    COLLIDER2D_COMMAND_CAPABILITY_ID,
    COLLIDER2D_RUNTIME_CAPABILITY_ID
} from '../../../src/lib/collision-system';
import {
    COLLIDER_GIZMO_VISIBILITY,
    getColliderGizmoPreferences,
    getEditorTransformPreview
} from '../../../src/lib/editor-visualization';
import {createServiceFacadeFactory} from '../../../src/lib/first-party-modules/service-facade';

const makeVM = ({manyColliders = 0, useCapabilityFacades = false} = {}) => {
    const colliderListeners = new Set();
    const cameraListeners = new Set();
    const colliders = [
        {
            componentId: 'collider:area-a',
            config: {
                collisionLayer: 1,
                collisionMask: 1,
                offset: [0, 0],
                rotation: 0,
                sensor: true,
                shape: {size: [100, 100], type: 'rectangle'},
                transformInheritance: 'inherit-node'
            },
            name: 'Area A',
            nodeId: 'area-a',
            worldAABB: {maxX: 50, maxY: 50, minX: -50, minY: -50},
            worldPoints: [[-50, -50], [50, -50], [50, 50], [-50, 50]]
        },
        {
            componentId: 'collider:wall',
            config: {
                collisionLayer: 1,
                collisionMask: 1,
                offset: [0, 0],
                rotation: 0,
                sensor: false,
                shape: {size: [40, 40], type: 'rectangle'},
                transformInheritance: 'inherit-node'
            },
            name: 'Wall',
            nodeId: 'wall',
            worldAABB: {maxX: 140, maxY: 20, minX: 100, minY: -20},
            worldPoints: [[100, -20], [140, -20], [140, 20], [100, 20]]
        }
    ];
    for (let index = 0; index < manyColliders; index++) {
        const x = -210 + (index % 14) * 30;
        const y = -150 + Math.floor(index / 14) * 30;
        colliders.push({
            componentId: `collider:bulk-${index}`,
            config: {
                collisionLayer: 1,
                collisionMask: 1,
                offset: [0, 0],
                rotation: 0,
                sensor: false,
                shape: {size: [20, 20], type: 'rectangle'},
                transformInheritance: 'inherit-node'
            },
            name: `Bulk ${index}`,
            nodeId: `bulk-${index}`,
            worldAABB: {maxX: x + 10, maxY: y + 10, minX: x - 10, minY: y - 10},
            worldPoints: [[x - 10, y - 10], [x + 10, y - 10], [x + 10, y + 10], [x - 10, y + 10]]
        });
    }
    const authoringPreviewConfigs = new Map();
    const getColliderView = nodeId => {
        const collider = colliders.find(item => item.nodeId === nodeId) || null;
        if (!collider) return null;
        const preview = authoringPreviewConfigs.get(nodeId);
        return preview ? Object.assign({}, collider, {config: preview}) : collider;
    };
    const colliderRuntime = {
        beginAuthoringPreview: jest.fn(nodeId => {
            const collider = getColliderView(nodeId);
            if (!collider) return null;
            const config = JSON.parse(JSON.stringify(collider.config));
            authoringPreviewConfigs.set(nodeId, config);
            return config;
        }),
        cancelAuthoringPreview: jest.fn(nodeId => authoringPreviewConfigs.delete(nodeId)),
        getCollider: jest.fn(nodeId => getColliderView(nodeId)),
        getDebugSnapshot: jest.fn(() => ({
            colliders: colliders.map(collider => Object.assign({}, collider, {
                overlapping: collider.nodeId === 'area-a' || collider.nodeId === 'wall'
            })),
            geometryRevision: 1,
            sceneId: 'scene-a'
        })),
        getDebugViewportSnapshot: jest.fn((worldAABB, options = {}) => ({
            colliders: colliders.filter(collider => !(
                collider.worldAABB.maxX < worldAABB.minX || collider.worldAABB.minX > worldAABB.maxX ||
                collider.worldAABB.maxY < worldAABB.minY || collider.worldAABB.minY > worldAABB.maxY
            )).map(collider => Object.assign({}, collider, {
                overlapping: options.includeOverlapState === true &&
                    (collider.nodeId === 'area-a' || collider.nodeId === 'wall')
            })),
            geometryRevision: 1,
            sceneId: 'scene-a'
        })),
        getOverlaps: jest.fn(nodeId => nodeId === 'area-a' ? ['wall'] : (nodeId === 'wall' ? ['area-a'] : [])),
        listColliders: jest.fn(() => colliders),
        nodeLocalPointToWorld: jest.fn((nodeId, point) => point.slice()),
        patchAuthoringPreview: jest.fn((nodeId, patch) => {
            const collider = getColliderView(nodeId);
            if (!collider) return null;
            const next = Object.assign({}, collider.config, patch);
            authoringPreviewConfigs.set(nodeId, next);
            return next;
        }),
        shapeLocalPointToWorld: jest.fn((nodeId, point) => point.slice()),
        subscribe: jest.fn(listener => {
            colliderListeners.add(listener);
            return () => colliderListeners.delete(listener);
        }),
        worldPointToNodeLocal: jest.fn((nodeId, point) => point.slice()),
        worldPointToShapeLocal: jest.fn((nodeId, point) => point.slice())
    };
    const executeColliderCommand = jest.fn(command => {
        const collider = colliders.find(item => item.nodeId === command.payload.nodeId);
        collider.config = Object.assign({}, collider.config, command.payload.patch);
        authoringPreviewConfigs.delete(command.payload.nodeId);
        return {
            kind: 'event',
            payload: {},
            protocol: 'ngvge.engine-protocol',
            protocolVersion: 1,
            type: 'Collider2DPatchApplied'
        };
    });
    const colliderCommand = {
        capabilityId: COLLIDER2D_COMMAND_CAPABILITY_ID,
        executeCommand: executeColliderCommand,
        version: 1
    };
    const cameraRuntime = {
        screenToWorld: jest.fn(point => point),
        subscribe: jest.fn(listener => {
            cameraListeners.add(listener);
            return () => cameraListeners.delete(listener);
        }),
        worldToScreen: jest.fn(point => point)
    };
    const runtimeNodeModel = {
        getParent: jest.fn(nodeId => {
            if (nodeId === 'area-a') return {id: 'sprite-a'};
            if (nodeId === 'sprite-a' || nodeId === 'wall') return null;
            return null;
        })
    };
    const rawCapabilities = new Map([
        [COLLIDER2D_RUNTIME_CAPABILITY_ID, colliderRuntime],
        [COLLIDER2D_COMMAND_CAPABILITY_ID, colliderCommand],
        [CAMERA2D_RUNTIME_CAPABILITY_ID, cameraRuntime],
        ['ngvge.runtime-node-model', runtimeNodeModel]
    ]);
    const capabilities = new Map(Array.from(rawCapabilities, ([capabilityId, capability]) => [
        capabilityId,
        useCapabilityFacades ? createServiceFacadeFactory({
            assertActive: () => {},
            boundaryKind: 'capability',
            serviceId: `capability:${capabilityId}`
        }).wrap(capability) : capability
    ]));
    return {
        cameraListeners,
        colliderListeners,
        colliderRuntime,
        colliders,
        executeColliderCommand,
        runtimeNodeModel,
        vm: {
            renderer: {getNativeSize: () => [480, 360]},
            runtime: {
                ngvgeFirstPartyModules: {
                    getCapability: id => capabilities.get(id) || null
                }
            }
        }
    };
};

const mounted = [];

afterEach(() => {
    while (mounted.length) act(() => mounted.pop().unmount());
});

describe('WS-10N5-HF1 Collider2D stage debug overlay', () => {
    test('renders every active collider and marks the selected one', () => {
        const {vm} = makeVM();
        let component;
        act(() => {
            component = renderer.create(
                <Collider2DGizmo
                    nodeId="area-a"
                    stageDimensions={{height: 360, width: 480}}
                    vm={vm}
                />
            );
        });
        mounted.push(component);
        const polygons = component.root.findAll(node => node.type === 'polygon');
        expect(polygons).toHaveLength(1);
        expect(polygons[0].props['data-ngvge-collider-node-id']).toBe('area-a');
        expect(polygons[0].props['data-ngvge-collider-selected']).toBe('true');
        expect(component.root.findByProps({'data-ngvge-collider-debug-canvas': 'true'}).props[
            'data-ngvge-collider-debug-count'
        ]).toBe(1);
    });


    test('honors editor-only per-node visibility overrides', () => {
        const {vm} = makeVM();
        const preferences = getColliderGizmoPreferences(vm.runtime);
        preferences.setNodeVisibility('wall', COLLIDER_GIZMO_VISIBILITY.HIDDEN);
        let component;
        act(() => {
            component = renderer.create(
                <Collider2DGizmo
                    nodeId="area-a"
                    stageDimensions={{height: 360, width: 480}}
                    vm={vm}
                />
            );
        });
        mounted.push(component);
        expect(component.root.findAll(node => node.type === 'polygon').map(
            node => node.props['data-ngvge-collider-node-id']
        )).toEqual(['area-a']);

        act(() => {
            preferences.setNodeVisibility('wall', COLLIDER_GIZMO_VISIBILITY.ALWAYS);
        });
        expect(component.root.findAll(node => node.type === 'polygon').map(
            node => node.props['data-ngvge-collider-node-id']
        )).toEqual(['area-a']);
        expect(component.root.findByProps({'data-ngvge-collider-debug-canvas': 'true'}).props[
            'data-ngvge-collider-debug-count'
        ]).toBe(1);
    });

    test('refreshes geometry after collider runtime updates', () => {
        const {colliderListeners, colliders, vm} = makeVM();
        let component;
        act(() => {
            component = renderer.create(
                <Collider2DGizmo
                    nodeId="area-a"
                    stageDimensions={{height: 360, width: 480}}
                    vm={vm}
                />
            );
        });
        mounted.push(component);
        const before = component.root.findAll(node => node.type === 'polygon')[0].props.points;
        colliders[0].worldPoints = [[0, 0], [60, 0], [60, 60], [0, 60]];
        act(() => colliderListeners.forEach(listener => listener({type: 'collision:refresh'})));
        const after = component.root.findAll(node => node.type === 'polygon')[0].props.points;
        expect(after).not.toBe(before);
    });


    test('updates a physics-moved selected collider through passive DOM presentation without rebuilding the debug snapshot', () => {
        const originalWindow = global.window;
        const callbacks = new Map();
        let nextFrameId = 1;
        const polygonMock = {
            setAttribute: jest.fn()
        };
        const groupMock = {
            querySelector: jest.fn(selector => selector === '[data-ngvge-collider-selected="true"]' ? polygonMock : null)
        };
        global.window = {
            cancelAnimationFrame: jest.fn(id => callbacks.delete(id)),
            requestAnimationFrame: jest.fn(callback => {
                const id = nextFrameId++;
                callbacks.set(id, callback);
                return id;
            })
        };
        try {
            const {colliderListeners, colliderRuntime, colliders, vm} = makeVM();
            let component;
            act(() => {
                component = renderer.create(
                    <Collider2DGizmo
                        nodeId="area-a"
                        stageDimensions={{height: 360, width: 480}}
                        vm={vm}
                    />,
                    {
                        createNodeMock: element => {
                            if (element.type === 'g' && element.props['data-ngvge-collider-group'] === 'area-a') return groupMock;
                            if (element.type === 'polygon' && element.props['data-ngvge-collider-selected'] === 'true') return polygonMock;
                            return {};
                        }
                    }
                );
            });
            mounted.push(component);
            const snapshotCallsBefore = colliderRuntime.getDebugViewportSnapshot.mock.calls.length;
            colliders[0].worldPoints = [[10, 10], [70, 10], [70, 70], [10, 70]];
            act(() => colliderListeners.forEach(listener => listener({
                affectedColliderNodeIds: ['area-a'],
                changedNodeIds: ['rigidbody-parent'],
                type: 'collision:refresh'
            })));
            expect(global.window.requestAnimationFrame).toHaveBeenCalledTimes(1);
            expect(colliderRuntime.getDebugViewportSnapshot).toHaveBeenCalledTimes(snapshotCallsBefore);
            const pending = Array.from(callbacks.entries())[0];
            callbacks.delete(pending[0]);
            act(() => pending[1](16.7));
            expect(colliderRuntime.getCollider).toHaveBeenCalledWith('area-a');
            expect(polygonMock.setAttribute).toHaveBeenCalledWith('points', expect.any(String));
            expect(colliderRuntime.getDebugViewportSnapshot).toHaveBeenCalledTimes(snapshotCallsBefore);
        } finally {
            if (typeof originalWindow === 'undefined') delete global.window;
            else global.window = originalWindow;
        }
    });

    test('updates a scratch-driven non-selected collider through sampled dynamic canvas presentation without rebuilding the debug snapshot', () => {
        const originalWindow = global.window;
        const callbacks = new Map();
        let nextFrameId = 1;
        const context = {
            beginPath: jest.fn(),
            clearRect: jest.fn(),
            closePath: jest.fn(),
            fill: jest.fn(),
            lineTo: jest.fn(),
            moveTo: jest.fn(),
            setLineDash: jest.fn(),
            setTransform: jest.fn(),
            stroke: jest.fn()
        };
        const canvasMock = {
            getContext: jest.fn(() => context),
            height: 0,
            width: 0
        };
        global.window = {
            cancelAnimationFrame: jest.fn(id => callbacks.delete(id)),
            devicePixelRatio: 1,
            requestAnimationFrame: jest.fn(callback => {
                const id = nextFrameId++;
                callbacks.set(id, callback);
                return id;
            })
        };
        try {
            const {colliderListeners, colliderRuntime, colliders, vm} = makeVM();
            let component;
            act(() => {
                component = renderer.create(
                    <Collider2DGizmo
                        nodeId="sprite-a"
                        stageDimensions={{height: 360, width: 480}}
                        vm={vm}
                    />,
                    {
                        createNodeMock: element => (
                            element.type === 'canvas' ? canvasMock : {}
                        )
                    }
                );
            });
            mounted.push(component);
            const snapshotCallsBefore = colliderRuntime.getDebugViewportSnapshot.mock.calls.length;
            colliders[0].worldAABB = {maxX: 70, maxY: 70, minX: 10, minY: 10};
            colliders[0].worldPoints = [[10, 10], [70, 10], [70, 70], [10, 70]];
            act(() => colliderListeners.forEach(listener => listener({
                affectedColliderNodeIds: ['area-a'],
                changedNodeIds: ['sprite-a'],
                reason: 'transform-hierarchy-change',
                type: 'collision:refresh'
            })));
            expect(colliderRuntime.getDebugViewportSnapshot).toHaveBeenCalledTimes(snapshotCallsBefore);
            expect(callbacks.size).toBe(1);
            const pending = Array.from(callbacks.entries())[0];
            callbacks.delete(pending[0]);
            act(() => pending[1](16.7));
            expect(colliderRuntime.getCollider).toHaveBeenCalledWith('area-a');
            expect(context.clearRect).toHaveBeenCalled();
            expect(colliderRuntime.getDebugViewportSnapshot).toHaveBeenCalledTimes(snapshotCallsBefore);
        } finally {
            if (typeof originalWindow === 'undefined') delete global.window;
            else global.window = originalWindow;
        }
    });

    test('routes a mixed selected and non-selected affected set through DOM plus sampled canvas without full snapshot fallback', () => {
        const originalWindow = global.window;
        const callbacks = new Map();
        let nextFrameId = 1;
        const context = {
            beginPath: jest.fn(),
            clearRect: jest.fn(),
            closePath: jest.fn(),
            fill: jest.fn(),
            lineTo: jest.fn(),
            moveTo: jest.fn(),
            setLineDash: jest.fn(),
            setTransform: jest.fn(),
            stroke: jest.fn()
        };
        const canvasMock = {
            getContext: jest.fn(() => context),
            height: 0,
            width: 0
        };
        const polygonMock = {setAttribute: jest.fn()};
        const groupMock = {
            querySelector: jest.fn(selector => selector === '[data-ngvge-collider-selected="true"]' ? polygonMock : null)
        };
        global.window = {
            cancelAnimationFrame: jest.fn(id => callbacks.delete(id)),
            devicePixelRatio: 1,
            requestAnimationFrame: jest.fn(callback => {
                const id = nextFrameId++;
                callbacks.set(id, callback);
                return id;
            })
        };
        try {
            const {colliderListeners, colliderRuntime, colliders, vm} = makeVM();
            let component;
            act(() => {
                component = renderer.create(
                    <Collider2DGizmo
                        nodeId="area-a"
                        stageDimensions={{height: 360, width: 480}}
                        vm={vm}
                    />,
                    {
                        createNodeMock: element => {
                            if (element.type === 'canvas') return canvasMock;
                            if (element.type === 'g' && element.props['data-ngvge-collider-group'] === 'area-a') return groupMock;
                            if (element.type === 'polygon' && element.props['data-ngvge-collider-selected'] === 'true') return polygonMock;
                            return {};
                        }
                    }
                );
            });
            mounted.push(component);
            const snapshotCallsBefore = colliderRuntime.getDebugViewportSnapshot.mock.calls.length;
            colliders[0].worldPoints = [[10, 10], [70, 10], [70, 70], [10, 70]];
            colliders[1].worldAABB = {maxX: 150, maxY: 30, minX: 110, minY: -10};
            colliders[1].worldPoints = [[110, -10], [150, -10], [150, 30], [110, 30]];
            act(() => colliderListeners.forEach(listener => listener({
                affectedColliderNodeIds: ['area-a', 'wall'],
                changedNodeIds: ['sprite-a'],
                reason: 'transform-hierarchy-change',
                type: 'collision:refresh'
            })));
            expect(colliderRuntime.getDebugViewportSnapshot).toHaveBeenCalledTimes(snapshotCallsBefore);
            expect(callbacks.size).toBeGreaterThan(0);
            let guard = 0;
            while (callbacks.size && guard++ < 8) {
                const pending = Array.from(callbacks.entries())[0];
                callbacks.delete(pending[0]);
                act(() => pending[1](16.7 * guard));
            }
            expect(colliderRuntime.getCollider).toHaveBeenCalledWith('area-a');
            expect(colliderRuntime.getCollider).toHaveBeenCalledWith('wall');
            expect(polygonMock.setAttribute).toHaveBeenCalledWith('points', expect.any(String));
            expect(context.clearRect).toHaveBeenCalled();
            expect(colliderRuntime.getDebugViewportSnapshot).toHaveBeenCalledTimes(snapshotCallsBefore);
        } finally {
            if (typeof originalWindow === 'undefined') delete global.window;
            else global.window = originalWindow;
        }
    });

    test('marks overlap state only when the optional Contacts debug mode is enabled', () => {
        const {colliderRuntime, vm} = makeVM();
        getColliderGizmoPreferences(vm.runtime).setShowOverlapState(true);
        let component;
        act(() => {
            component = renderer.create(
                <Collider2DGizmo
                    nodeId="area-a"
                    stageDimensions={{height: 360, width: 480}}
                    vm={vm}
                />
            );
        });
        mounted.push(component);
        expect(component.root.findAllByProps({'data-ngvge-collider-overlapping': 'true'})).toHaveLength(1);
        expect(component.root.findByProps({'data-ngvge-collider-label': 'area-a'}).children.join('')).toContain('COLLISION');
        expect(component.root.findAllByProps({'data-ngvge-collider-handle': 'size-e'})).toHaveLength(1);
        expect(component.root.findByProps({'data-ngvge-collider-debug-canvas': 'true'}).props[
            'data-ngvge-collider-debug-overlap-count'
        ]).toBe(1);
        expect(colliderRuntime.getDebugViewportSnapshot).toHaveBeenCalledWith(expect.any(Object), {
            includeOverlapState: true,
            maxColliders: 1000
        });
    });

    test('drags selected rectangle handles through the Collider2D command path', () => {
        const {colliderRuntime, executeColliderCommand, vm} = makeVM();
        let component;
        act(() => {
            component = renderer.create(
                <Collider2DGizmo
                    nodeId="area-a"
                    stageDimensions={{height: 360, width: 480}}
                    vm={vm}
                />
            );
        });
        mounted.push(component);
        const handle = component.root.findByProps({'data-ngvge-collider-handle': 'size-e'});
        act(() => handle.props.onPointerDown({
            currentTarget: {setPointerCapture: jest.fn()},
            pointerId: 7,
            preventDefault: jest.fn(),
            stopPropagation: jest.fn()
        }));
        const svg = component.root.findByProps({'data-ngvge-collider-overlay': 'true'});
        act(() => svg.props.onPointerMove({
            clientX: 320,
            clientY: 180,
            currentTarget: {getBoundingClientRect: () => ({height: 360, left: 0, top: 0, width: 480})},
            pointerId: 7
        }));
        expect(executeColliderCommand).not.toHaveBeenCalled();
        act(() => svg.props.onPointerUp({pointerId: 7}));
        expect(colliderRuntime.patchAuthoringPreview).toHaveBeenCalledTimes(1);
        expect(executeColliderCommand).toHaveBeenCalledTimes(1);
        expect(executeColliderCommand).toHaveBeenCalledWith(expect.objectContaining({
            payload: expect.objectContaining({
                nodeId: 'area-a',
                patch: expect.objectContaining({shape: {size: [160, 100], type: 'rectangle'}})
            }),
            type: 'PatchCollider2D'
        }));
    });

    test('coalesces high-frequency handle motion into one transient preview per animation frame and one persistent commit', () => {
        const originalWindow = global.window;
        const callbacks = new Map();
        let nextFrameId = 1;
        global.window = {
            cancelAnimationFrame: jest.fn(id => callbacks.delete(id)),
            requestAnimationFrame: jest.fn(callback => {
                const id = nextFrameId++;
                callbacks.set(id, callback);
                return id;
            })
        };
        try {
            const {colliderRuntime, executeColliderCommand, vm} = makeVM();
            let component;
            act(() => {
                component = renderer.create(
                    <Collider2DGizmo
                        nodeId="area-a"
                        stageDimensions={{height: 360, width: 480}}
                        vm={vm}
                    />
                );
            });
            mounted.push(component);
            const handle = component.root.findByProps({'data-ngvge-collider-handle': 'size-e'});
            act(() => handle.props.onPointerDown({
                currentTarget: {setPointerCapture: jest.fn()},
                pointerId: 23,
                preventDefault: jest.fn(),
                stopPropagation: jest.fn()
            }));
            const svg = component.root.findByProps({'data-ngvge-collider-overlay': 'true'});
            act(() => {
                for (let index = 0; index < 120; index++) {
                    svg.props.onPointerMove({
                        clientX: 260 + index / 2,
                        clientY: 180,
                        currentTarget: {getBoundingClientRect: () => ({height: 360, left: 0, top: 0, width: 480})},
                        pointerId: 23
                    });
                }
            });
            expect(global.window.requestAnimationFrame).toHaveBeenCalledTimes(1);
            expect(colliderRuntime.patchAuthoringPreview).not.toHaveBeenCalled();
            expect(executeColliderCommand).not.toHaveBeenCalled();
            const pending = Array.from(callbacks.entries())[0];
            callbacks.delete(pending[0]);
            act(() => pending[1](16.7));
            expect(colliderRuntime.patchAuthoringPreview).toHaveBeenCalledTimes(1);
            expect(colliderRuntime.worldPointToNodeLocal).toHaveBeenCalledTimes(3);
            expect(colliderRuntime.getCollider).not.toHaveBeenCalled();
            act(() => svg.props.onPointerUp({pointerId: 23}));
            expect(executeColliderCommand).toHaveBeenCalledTimes(1);
        } finally {
            if (typeof originalWindow === 'undefined') delete global.window;
            else global.window = originalWindow;
        }
    });

    test('projects rectangle authoring handles with one affine sample instead of per-handle capability calls', () => {
        const {colliderRuntime, vm} = makeVM();
        let component;
        act(() => {
            component = renderer.create(
                <Collider2DGizmo
                    nodeId="area-a"
                    stageDimensions={{height: 360, width: 480}}
                    vm={vm}
                />
            );
        });
        mounted.push(component);
        expect(component.root.findAll(node => node.props && node.props['data-ngvge-collider-handle'])).toHaveLength(10);
        expect(colliderRuntime.nodeLocalPointToWorld).toHaveBeenCalledTimes(3);
        expect(colliderRuntime.shapeLocalPointToWorld).not.toHaveBeenCalled();
    });

    test('renders and authors collider arrays returned through real Module capability facades', () => {
        const {colliderRuntime, executeColliderCommand, vm} = makeVM({useCapabilityFacades: true});
        let component;
        act(() => {
            component = renderer.create(
                <Collider2DGizmo
                    nodeId="area-a"
                    stageDimensions={{height: 360, width: 480}}
                    vm={vm}
                />
            );
        });
        mounted.push(component);

        const polygons = component.root.findAll(node => node.type === 'polygon');
        expect(polygons).toHaveLength(1);
        expect(polygons.map(node => node.props['data-ngvge-collider-node-id'])).toEqual(['area-a']);
        expect(component.root.findByProps({'data-ngvge-collider-debug-canvas': 'true'}).props[
            'data-ngvge-collider-debug-count'
        ]).toBe(1);

        const handle = component.root.findByProps({'data-ngvge-collider-handle': 'size-e'});
        act(() => handle.props.onPointerDown({
            currentTarget: {setPointerCapture: jest.fn()},
            pointerId: 17,
            preventDefault: jest.fn(),
            stopPropagation: jest.fn()
        }));
        const svg = component.root.findByProps({'data-ngvge-collider-overlay': 'true'});
        act(() => svg.props.onPointerMove({
            clientX: 320,
            clientY: 180,
            currentTarget: {getBoundingClientRect: () => ({height: 360, left: 0, top: 0, width: 480})},
            pointerId: 17
        }));
        expect(executeColliderCommand).not.toHaveBeenCalled();
        expect(colliderRuntime.patchAuthoringPreview).toHaveBeenCalledTimes(1);
        act(() => svg.props.onPointerUp({pointerId: 17}));
        expect(executeColliderCommand).toHaveBeenCalledTimes(1);
        expect(executeColliderCommand).toHaveBeenCalledWith(expect.objectContaining({
            payload: expect.objectContaining({
                nodeId: 'area-a',
                patch: expect.objectContaining({shape: {size: [160, 100], type: 'rectangle'}})
            }),
            type: 'PatchCollider2D'
        }));
    });


    test('projects a dragged Scratch parent subtree and recomputes visible overlap without mutating Runtime Collider authority', () => {
        const {colliderRuntime, vm} = makeVM();
        getColliderGizmoPreferences(vm.runtime).setShowOverlapState(true);
        const preview = getEditorTransformPreview(vm.runtime);
        let component;
        act(() => {
            component = renderer.create(
                <Collider2DGizmo
                    nodeId="sprite-a"
                    stageDimensions={{height: 360, width: 480}}
                    vm={vm}
                />
            );
        });
        mounted.push(component);

        act(() => { preview.begin({authoredPosition: [0, 0], nodeId: 'sprite-a', targetRuntimeId: 'scratch-a'}); });
        act(() => { preview.updatePosition([60, 0]); });

        let canvas = component.root.findByProps({'data-ngvge-collider-debug-canvas': 'true'});
        expect(canvas.props['data-ngvge-collider-debug-preview-count']).toBe(1);
        expect(canvas.props['data-ngvge-collider-debug-overlap-count']).toBe(2);

        act(() => { preview.updatePosition([-200, 0]); });
        canvas = component.root.findByProps({'data-ngvge-collider-debug-canvas': 'true'});
        expect(canvas.props['data-ngvge-collider-debug-preview-count']).toBe(1);
        expect(canvas.props['data-ngvge-collider-debug-overlap-count']).toBe(0);
        // Editor preview must not patch the Runtime Collider component or ask the Runtime overlap cache to refresh.
        expect(colliderRuntime.getCollider).not.toHaveBeenCalledWith('sprite-a');

        act(() => { preview.cancel('test-finish'); });
    });


    test('batches dense collision debug geometry and avoids per-collider overlap queries', () => {
        const {colliderRuntime, vm} = makeVM({manyColliders: 80});
        let component;
        act(() => {
            component = renderer.create(
                <Collider2DGizmo
                    nodeId={null}
                    stageDimensions={{height: 360, width: 480}}
                    vm={vm}
                />
            );
        });
        mounted.push(component);
        expect(colliderRuntime.getDebugViewportSnapshot).toHaveBeenCalledTimes(1);
        expect(colliderRuntime.getDebugSnapshot).not.toHaveBeenCalled();
        expect(colliderRuntime.getOverlaps).not.toHaveBeenCalled();
        const canvas = component.root.findByProps({'data-ngvge-collider-debug-canvas': 'true'});
        expect(canvas.props['data-ngvge-collider-debug-count']).toBeGreaterThan(48);
        expect(component.root.findAll(node => node.type === 'path')).toHaveLength(0);
        expect(component.root.findAll(node => node.type === 'line')).toHaveLength(0);
    });

});
