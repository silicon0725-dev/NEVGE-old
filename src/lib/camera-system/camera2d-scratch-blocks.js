'use strict';

const {CAMERA2D_RUNTIME_CAPABILITY_ID} = require('./camera2d-runtime-service');

const CAMERA2D_SCRATCH_EXTENSION_ID = 'ngvgecamera2d';
const CAMERA2D_SCRATCH_BLOCKS_BRIDGE_ID = 'ngvge.camera2d.scratch-blocks';
const registrations = new WeakMap();

const getCameraCapability = vm => {
    const runtime = vm && vm.runtime;
    const manager = runtime && runtime.ngvgeFirstPartyModules;
    if (!manager || typeof manager.getCapability !== 'function') return null;
    try {
        return manager.getCapability(CAMERA2D_RUNTIME_CAPABILITY_ID);
    } catch {
        return null;
    }
};

const number = value => {
    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
};

class Camera2DScratchExtension {
    constructor (vm) {
        this.vm = vm;
    }

    getInfo () {
        return {
            id: CAMERA2D_SCRATCH_EXTENSION_ID,
            name: 'NGVGE Camera2D',
            color1: '#4c97ff',
            color2: '#3373cc',
            blocks: [
                {opcode: 'setPosition', blockType: 'command', text: 'set camera [CAMERA] position x [X] y [Y]', arguments: {
                    CAMERA: {type: 'string', menu: 'cameras'}, X: {type: 'number', defaultValue: 0}, Y: {type: 'number', defaultValue: 0}
                }},
                {opcode: 'setRotation', blockType: 'command', text: 'set camera [CAMERA] rotation [ROTATION]', arguments: {
                    CAMERA: {type: 'string', menu: 'cameras'}, ROTATION: {type: 'number', defaultValue: 0}
                }},
                {opcode: 'setZoom', blockType: 'command', text: 'set camera [CAMERA] zoom x [X] y [Y]', arguments: {
                    CAMERA: {type: 'string', menu: 'cameras'}, X: {type: 'number', defaultValue: 1}, Y: {type: 'number', defaultValue: 1}
                }},
                {opcode: 'setEnabled', blockType: 'command', text: 'set camera [CAMERA] enabled [ENABLED]', arguments: {
                    CAMERA: {type: 'string', menu: 'cameras'}, ENABLED: {type: 'string', menu: 'booleans'}
                }},
                '---',
                {opcode: 'cameraX', blockType: 'reporter', text: 'camera [CAMERA] x', arguments: {CAMERA: {type: 'string', menu: 'cameras'}}},
                {opcode: 'cameraY', blockType: 'reporter', text: 'camera [CAMERA] y', arguments: {CAMERA: {type: 'string', menu: 'cameras'}}},
                {opcode: 'cameraRotation', blockType: 'reporter', text: 'camera [CAMERA] rotation', arguments: {CAMERA: {type: 'string', menu: 'cameras'}}},
                {opcode: 'cameraZoomX', blockType: 'reporter', text: 'camera [CAMERA] zoom x', arguments: {CAMERA: {type: 'string', menu: 'cameras'}}},
                {opcode: 'cameraZoomY', blockType: 'reporter', text: 'camera [CAMERA] zoom y', arguments: {CAMERA: {type: 'string', menu: 'cameras'}}},
                '---',
                {opcode: 'mouseWorldX', blockType: 'reporter', text: 'mouse world x'},
                {opcode: 'mouseWorldY', blockType: 'reporter', text: 'mouse world y'}
            ],
            menus: {
                booleans: {acceptReporters: true, items: [{text: 'true', value: 'true'}, {text: 'false', value: 'false'}]},
                cameras: {acceptReporters: true, items: '_cameraMenu'}
            }
        };
    }

    _capability () {
        return getCameraCapability(this.vm);
    }

    _cameraMenu () {
        const capability = this._capability();
        const cameras = capability && typeof capability.listCameras === 'function' ? capability.listCameras() : [];
        if (!cameras.length) return [{text: 'Camera2D', value: ''}];
        return cameras.map(camera => ({text: camera.name || camera.nodeId, value: camera.nodeId}));
    }

    _camera (nodeId) {
        const capability = this._capability();
        if (!capability || !nodeId) return null;
        return capability.getCamera(nodeId);
    }

    setPosition (args) {
        const capability = this._capability();
        if (!capability || !args.CAMERA) return;
        capability.patchRuntimeTransform(args.CAMERA, {position: [number(args.X), number(args.Y)]});
    }

    setRotation (args) {
        const capability = this._capability();
        if (!capability || !args.CAMERA) return;
        capability.patchRuntimeTransform(args.CAMERA, {rotation: number(args.ROTATION)});
    }

    setZoom (args) {
        const capability = this._capability();
        if (!capability || !args.CAMERA) return;
        capability.patchRuntimeCamera(args.CAMERA, {zoom: [number(args.X), number(args.Y)]});
    }

    setEnabled (args) {
        const capability = this._capability();
        if (!capability || !args.CAMERA) return;
        capability.patchRuntimeCamera(args.CAMERA, {enabled: String(args.ENABLED) !== 'false'});
    }

    cameraX (args) {
        const camera = this._camera(args.CAMERA);
        return camera ? camera.transform.position[0] : 0;
    }

    cameraY (args) {
        const camera = this._camera(args.CAMERA);
        return camera ? camera.transform.position[1] : 0;
    }

    cameraRotation (args) {
        const camera = this._camera(args.CAMERA);
        return camera ? camera.transform.rotation : 0;
    }

    cameraZoomX (args) {
        const camera = this._camera(args.CAMERA);
        return camera ? camera.config.zoom[0] : 1;
    }

    cameraZoomY (args) {
        const camera = this._camera(args.CAMERA);
        return camera ? camera.config.zoom[1] : 1;
    }

    _mouseWorld () {
        const capability = this._capability();
        const mouse = this.vm && this.vm.runtime && this.vm.runtime.ioDevices && this.vm.runtime.ioDevices.mouse;
        if (!capability || !mouse) return [0, 0];
        return capability.screenToWorld([mouse.getScratchX(), mouse.getScratchY()]);
    }

    mouseWorldX () {
        return this._mouseWorld()[0];
    }

    mouseWorldY () {
        return this._mouseWorld()[1];
    }
}

const installCamera2DScratchBlocks = vm => {
    if (!vm || !vm.extensionManager) return null;
    if (registrations.has(vm)) return registrations.get(vm);
    if (typeof vm.extensionManager._registerInternalExtension !== 'function') return null;
    const extension = new Camera2DScratchExtension(vm);
    const serviceName = vm.extensionManager._registerInternalExtension(extension);
    const registration = Object.freeze({
        bridgeId: CAMERA2D_SCRATCH_BLOCKS_BRIDGE_ID,
        extensionId: CAMERA2D_SCRATCH_EXTENSION_ID,
        serviceName
    });
    registrations.set(vm, registration);
    return registration;
};

module.exports = {
    CAMERA2D_SCRATCH_BLOCKS_BRIDGE_ID,
    CAMERA2D_SCRATCH_EXTENSION_ID,
    Camera2DScratchExtension,
    installCamera2DScratchBlocks
};
