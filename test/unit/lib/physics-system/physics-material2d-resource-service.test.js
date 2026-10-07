'use strict';

const {createPhysicsMaterial2DResourceService} = require('../../../../src/lib/physics-system');

describe('WS-10N8 PhysicsMaterial2D resource service', () => {
    test('owns stable ResourceId records independently from backend material identity and restores them', () => {
        const runtime = {emitProjectChanged: jest.fn()};
        const service = createPhysicsMaterial2DResourceService({runtime});
        const material = service.createMaterial({
            data: {friction: 0.25, restitution: 0.6},
            name: 'Bouncy'
        });
        expect(material.resourceId).toMatch(/^ngvge:resource:/);
        expect(material).not.toHaveProperty('backendMaterialHandle');
        service.patchMaterial(material.resourceId, {friction: 0.75});
        expect(service.getMaterial(material.resourceId).data).toEqual({friction: 0.75, restitution: 0.6});

        const snapshot = service.serializeProject();
        const restored = createPhysicsMaterial2DResourceService({runtime: {emitProjectChanged: jest.fn()}});
        restored.deserializeProject(snapshot);
        expect(restored.getMaterial(material.resourceId)).toMatchObject({
            name: 'Bouncy',
            resourceId: material.resourceId,
            typeId: 'ngvge.physics-material2d-resource'
        });
        expect(restored.getMaterial(material.resourceId)).not.toHaveProperty('backendMaterialHandle');
        expect(runtime.emitProjectChanged).toHaveBeenCalled();
    });
});
