'use strict';

const {CHARACTER_CONTROLLER2D_RUNTIME_CAPABILITY_ID} = require('./character-controller2d-runtime-service');

const CHARACTER_CONTROLLER2D_SCRATCH_EXTENSION_ID = 'ngvgecharacter2d';
const CHARACTER_CONTROLLER2D_SCRATCH_BLOCKS_BRIDGE_ID = 'ngvge.character-controller2d.scratch-blocks';
const registrations = new WeakMap();

const getCharacterCapability = vm => {
    const runtime = vm && vm.runtime;
    const manager = runtime && runtime.ngvgeFirstPartyModules;
    if (!manager || typeof manager.getCapability !== 'function') return null;
    try {
        return manager.getCapability(CHARACTER_CONTROLLER2D_RUNTIME_CAPABILITY_ID);
    } catch {
        return null;
    }
};

const number = value => {
    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
};

class CharacterController2DScratchExtension {
    constructor (vm) {
        this.vm = vm;
    }

    getInfo () {
        return {
            id: CHARACTER_CONTROLLER2D_SCRATCH_EXTENSION_ID,
            name: 'NGVGE Character2D',
            color1: '#4c97ff',
            color2: '#3373cc',
            blocks: [
                {
                    opcode: 'setVelocity',
                    blockType: 'command',
                    text: 'set velocity of [CHARACTER] x [X] y [Y]',
                    arguments: {
                        CHARACTER: {type: 'string', menu: 'characters'},
                        X: {type: 'number', defaultValue: 0},
                        Y: {type: 'number', defaultValue: 0}
                    }
                },
                {
                    opcode: 'moveAndCollide',
                    blockType: 'command',
                    text: 'move [CHARACTER] and collide x [X] y [Y]',
                    arguments: {
                        CHARACTER: {type: 'string', menu: 'characters'},
                        X: {type: 'number', defaultValue: 10},
                        Y: {type: 'number', defaultValue: 0}
                    }
                },
                {
                    opcode: 'moveAndSlide',
                    blockType: 'command',
                    text: 'move [CHARACTER] and slide x [X] y [Y]',
                    arguments: {
                        CHARACTER: {type: 'string', menu: 'characters'},
                        X: {type: 'number', defaultValue: 10},
                        Y: {type: 'number', defaultValue: 0}
                    }
                },
                {
                    opcode: 'moveUsingVelocity',
                    blockType: 'command',
                    text: 'move [CHARACTER] using velocity for [DELTA] seconds',
                    arguments: {
                        CHARACTER: {type: 'string', menu: 'characters'},
                        DELTA: {type: 'number', defaultValue: 0.0166667}
                    }
                },
                {
                    opcode: 'velocityX',
                    blockType: 'reporter',
                    text: 'velocity x of [CHARACTER]',
                    arguments: {CHARACTER: {type: 'string', menu: 'characters'}}
                },
                {
                    opcode: 'velocityY',
                    blockType: 'reporter',
                    text: 'velocity y of [CHARACTER]',
                    arguments: {CHARACTER: {type: 'string', menu: 'characters'}}
                },
                {
                    opcode: 'isOnFloor',
                    blockType: 'Boolean',
                    text: '[CHARACTER] is on floor?',
                    arguments: {CHARACTER: {type: 'string', menu: 'characters'}}
                },
                {
                    opcode: 'isOnWall',
                    blockType: 'Boolean',
                    text: '[CHARACTER] is on wall?',
                    arguments: {CHARACTER: {type: 'string', menu: 'characters'}}
                },
                {
                    opcode: 'floorNormalX',
                    blockType: 'reporter',
                    text: 'floor normal x of [CHARACTER]',
                    arguments: {CHARACTER: {type: 'string', menu: 'characters'}}
                },
                {
                    opcode: 'floorNormalY',
                    blockType: 'reporter',
                    text: 'floor normal y of [CHARACTER]',
                    arguments: {CHARACTER: {type: 'string', menu: 'characters'}}
                },
                {
                    opcode: 'wallNormalX',
                    blockType: 'reporter',
                    text: 'wall normal x of [CHARACTER]',
                    arguments: {CHARACTER: {type: 'string', menu: 'characters'}}
                },
                {
                    opcode: 'wallNormalY',
                    blockType: 'reporter',
                    text: 'wall normal y of [CHARACTER]',
                    arguments: {CHARACTER: {type: 'string', menu: 'characters'}}
                },
                {
                    opcode: 'lastCollisionNode',
                    blockType: 'reporter',
                    text: 'last collision node of [CHARACTER]',
                    arguments: {CHARACTER: {type: 'string', menu: 'characters'}}
                },
                {
                    opcode: 'floorNode',
                    blockType: 'reporter',
                    text: 'floor node of [CHARACTER]',
                    arguments: {CHARACTER: {type: 'string', menu: 'characters'}}
                }
            ],
            menus: {
                characters: {acceptReporters: true, items: '_characterMenu'}
            }
        };
    }

    _capability () {
        return getCharacterCapability(this.vm);
    }

    _controllers () {
        const capability = this._capability();
        return capability && typeof capability.listControllers === 'function' ? capability.listControllers() : [];
    }

    _characterMenu () {
        const controllers = this._controllers();
        if (!controllers.length) return [{text: 'CharacterBody2D', value: ''}];
        return controllers.map(controller => ({text: controller.name || controller.nodeId, value: controller.nodeId}));
    }

    _controller (nodeId) {
        const capability = this._capability();
        if (!capability || !nodeId || typeof capability.getController !== 'function') return null;
        return capability.getController(nodeId);
    }

    setVelocity (args) {
        const capability = this._capability();
        if (!capability || !args.CHARACTER) return;
        capability.setVelocity(args.CHARACTER, [number(args.X), number(args.Y)]);
    }

    moveAndCollide (args) {
        const capability = this._capability();
        if (!capability || !args.CHARACTER) return;
        capability.moveAndCollide(args.CHARACTER, [number(args.X), number(args.Y)]);
    }

    moveAndSlide (args) {
        const capability = this._capability();
        if (!capability || !args.CHARACTER) return;
        capability.moveAndSlide(args.CHARACTER, [number(args.X), number(args.Y)]);
    }

    moveUsingVelocity (args) {
        const capability = this._capability();
        if (!capability || !args.CHARACTER) return;
        capability.moveUsingVelocity(args.CHARACTER, Math.max(0, number(args.DELTA)));
    }

    velocityX (args) {
        const controller = this._controller(args.CHARACTER);
        return controller ? controller.state.velocity[0] : 0;
    }

    velocityY (args) {
        const controller = this._controller(args.CHARACTER);
        return controller ? controller.state.velocity[1] : 0;
    }

    isOnFloor (args) {
        const controller = this._controller(args.CHARACTER);
        return Boolean(controller && controller.state.onFloor);
    }

    isOnWall (args) {
        const controller = this._controller(args.CHARACTER);
        return Boolean(controller && controller.state.onWall);
    }

    floorNormalX (args) {
        const controller = this._controller(args.CHARACTER);
        return controller ? controller.state.floorNormal[0] : 0;
    }

    floorNormalY (args) {
        const controller = this._controller(args.CHARACTER);
        return controller ? controller.state.floorNormal[1] : 0;
    }

    wallNormalX (args) {
        const controller = this._controller(args.CHARACTER);
        return controller ? controller.state.wallNormal[0] : 0;
    }

    wallNormalY (args) {
        const controller = this._controller(args.CHARACTER);
        return controller ? controller.state.wallNormal[1] : 0;
    }

    lastCollisionNode (args) {
        const controller = this._controller(args.CHARACTER);
        const collisions = controller && controller.state.collisions;
        return collisions && collisions.length ? collisions[collisions.length - 1].nodeId : '';
    }

    floorNode (args) {
        const controller = this._controller(args.CHARACTER);
        return controller && controller.state.floorNodeId ? controller.state.floorNodeId : '';
    }
}

const installCharacterController2DScratchBlocks = vm => {
    if (!vm || !vm.extensionManager) return null;
    if (registrations.has(vm)) return registrations.get(vm);
    if (typeof vm.extensionManager._registerInternalExtension !== 'function') return null;
    const extension = new CharacterController2DScratchExtension(vm);
    const serviceName = vm.extensionManager._registerInternalExtension(extension);
    const registration = Object.freeze({
        bridgeId: CHARACTER_CONTROLLER2D_SCRATCH_BLOCKS_BRIDGE_ID,
        extensionId: CHARACTER_CONTROLLER2D_SCRATCH_EXTENSION_ID,
        serviceName
    });
    registrations.set(vm, registration);
    return registration;
};

module.exports = {
    CHARACTER_CONTROLLER2D_SCRATCH_BLOCKS_BRIDGE_ID,
    CHARACTER_CONTROLLER2D_SCRATCH_EXTENSION_ID,
    CharacterController2DScratchExtension,
    installCharacterController2DScratchBlocks
};
