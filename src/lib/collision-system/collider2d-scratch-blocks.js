'use strict';

const {COLLIDER2D_RUNTIME_CAPABILITY_ID} = require('./collider2d-runtime-service');

const COLLIDER2D_SCRATCH_EXTENSION_ID = 'ngvgecollider2d';
const COLLIDER2D_SCRATCH_BLOCKS_BRIDGE_ID = 'ngvge.collider2d.scratch-blocks';
const registrations = new WeakMap();

const getColliderCapability = vm => {
    const runtime = vm && vm.runtime;
    const manager = runtime && runtime.ngvgeFirstPartyModules;
    if (!manager || typeof manager.getCapability !== 'function') return null;
    try {
        return manager.getCapability(COLLIDER2D_RUNTIME_CAPABILITY_ID);
    } catch {
        return null;
    }
};

const number = value => {
    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
};

class Collider2DScratchExtension {
    constructor (vm) {
        this.vm = vm;
    }

    getInfo () {
        return {
            id: COLLIDER2D_SCRATCH_EXTENSION_ID,
            name: 'NGVGE Collision2D',
            color1: '#59c059',
            color2: '#389438',
            blocks: [
                {
                    opcode: 'whenAreaOverlaps',
                    blockType: 'hat',
                    isEdgeActivated: true,
                    text: 'when area [AREA] starts overlapping [OTHER]',
                    arguments: {
                        AREA: {type: 'string', menu: 'areas'},
                        OTHER: {type: 'string', menu: 'colliders'}
                    }
                },
                {
                    opcode: 'collidersOverlap',
                    blockType: 'Boolean',
                    text: 'collider [A] overlaps [B]?',
                    arguments: {
                        A: {type: 'string', menu: 'colliders'},
                        B: {type: 'string', menu: 'colliders'}
                    }
                },
                {
                    opcode: 'pointInside',
                    blockType: 'Boolean',
                    text: 'point x [X] y [Y] inside collider [COLLIDER]?',
                    arguments: {
                        X: {type: 'number', defaultValue: 0},
                        Y: {type: 'number', defaultValue: 0},
                        COLLIDER: {type: 'string', menu: 'colliders'}
                    }
                },
                {
                    opcode: 'overlapCount',
                    blockType: 'reporter',
                    text: 'overlap count of [COLLIDER]',
                    arguments: {COLLIDER: {type: 'string', menu: 'colliders'}}
                },
                {
                    opcode: 'rayHitNode',
                    blockType: 'reporter',
                    text: 'ray x [X1] y [Y1] to x [X2] y [Y2] hit node',
                    arguments: {
                        X1: {type: 'number', defaultValue: 0},
                        Y1: {type: 'number', defaultValue: 0},
                        X2: {type: 'number', defaultValue: 100},
                        Y2: {type: 'number', defaultValue: 0}
                    }
                },
                {
                    opcode: 'rayHitX',
                    blockType: 'reporter',
                    text: 'ray x [X1] y [Y1] to x [X2] y [Y2] hit x',
                    arguments: {
                        X1: {type: 'number', defaultValue: 0},
                        Y1: {type: 'number', defaultValue: 0},
                        X2: {type: 'number', defaultValue: 100},
                        Y2: {type: 'number', defaultValue: 0}
                    }
                },
                {
                    opcode: 'rayHitY',
                    blockType: 'reporter',
                    text: 'ray x [X1] y [Y1] to x [X2] y [Y2] hit y',
                    arguments: {
                        X1: {type: 'number', defaultValue: 0},
                        Y1: {type: 'number', defaultValue: 0},
                        X2: {type: 'number', defaultValue: 100},
                        Y2: {type: 'number', defaultValue: 0}
                    }
                }
            ],
            menus: {
                areas: {acceptReporters: true, items: '_areaMenu'},
                colliders: {acceptReporters: true, items: '_colliderMenu'}
            }
        };
    }

    _capability () {
        return getColliderCapability(this.vm);
    }

    _colliders () {
        const capability = this._capability();
        return capability && typeof capability.listColliders === 'function' ? capability.listColliders() : [];
    }

    _colliderMenu () {
        const colliders = this._colliders();
        if (!colliders.length) return [{text: 'Collider2D', value: ''}];
        return colliders.map(collider => ({text: collider.name || collider.nodeId, value: collider.nodeId}));
    }

    _areaMenu () {
        const areas = this._colliders().filter(collider => collider.config && collider.config.sensor);
        if (!areas.length) return [{text: 'Area2D', value: ''}];
        return areas.map(collider => ({text: collider.name || collider.nodeId, value: collider.nodeId}));
    }

    whenAreaOverlaps (args) {
        const capability = this._capability();
        if (!capability || !args.AREA || !args.OTHER) return false;
        const area = capability.getCollider(args.AREA);
        if (!area || !area.config.sensor) return false;
        return capability.overlaps(args.AREA, args.OTHER);
    }

    collidersOverlap (args) {
        const capability = this._capability();
        if (!capability || !args.A || !args.B) return false;
        return capability.overlaps(args.A, args.B);
    }

    pointInside (args) {
        const capability = this._capability();
        if (!capability || !args.COLLIDER) return false;
        return capability.queryPoint([number(args.X), number(args.Y)]).some(hit => hit.nodeId === args.COLLIDER);
    }

    overlapCount (args) {
        const capability = this._capability();
        if (!capability || !args.COLLIDER) return 0;
        return capability.getOverlaps(args.COLLIDER).length;
    }

    _rayHit (args) {
        const capability = this._capability();
        if (!capability) return null;
        return capability.raycast(
            [number(args.X1), number(args.Y1)],
            [number(args.X2), number(args.Y2)]
        );
    }

    rayHitNode (args) {
        const hit = this._rayHit(args);
        return hit ? hit.nodeId : '';
    }

    rayHitX (args) {
        const hit = this._rayHit(args);
        return hit ? hit.point[0] : 0;
    }

    rayHitY (args) {
        const hit = this._rayHit(args);
        return hit ? hit.point[1] : 0;
    }
}

const installCollider2DScratchBlocks = vm => {
    if (!vm || !vm.extensionManager) return null;
    if (registrations.has(vm)) return registrations.get(vm);
    if (typeof vm.extensionManager._registerInternalExtension !== 'function') return null;
    const extension = new Collider2DScratchExtension(vm);
    const serviceName = vm.extensionManager._registerInternalExtension(extension);
    const registration = Object.freeze({
        bridgeId: COLLIDER2D_SCRATCH_BLOCKS_BRIDGE_ID,
        extensionId: COLLIDER2D_SCRATCH_EXTENSION_ID,
        serviceName
    });
    registrations.set(vm, registration);
    return registration;
};

module.exports = {
    COLLIDER2D_SCRATCH_BLOCKS_BRIDGE_ID,
    COLLIDER2D_SCRATCH_EXTENSION_ID,
    Collider2DScratchExtension,
    installCollider2DScratchBlocks
};
