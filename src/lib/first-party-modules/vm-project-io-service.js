const {installProjectLifecycleHost} = require('../project-lifecycle');
const JSZip = require('@turbowarp/jszip');
const {
    PORTABLE_PROJECT_FILES_FORMAT,
    PORTABLE_PROJECT_FILES_VERSION,
    createPortableProjectPayload,
    decodeBase64Bytes,
    readPortableTextFile,
    parsePortableProjectPayload,
    toUint8Array,
    encodeBase64Bytes
} = require('./portable-project-files');

const createVMProjectIOError = (code, message, ErrorClass = Error) => {
    const error = new ErrorClass(message);
    error.code = code;
    return error;
};

const getLifecycle = vm => vm && vm.runtime ? installProjectLifecycleHost(vm) : null;

const capturePortableProject = async vm => {
    const lifecycle = getLifecycle(vm);
    if (!lifecycle && (!vm || typeof vm.saveProjectSb3DontZip !== 'function')) {
        throw createVMProjectIOError(
            'VM_PROJECT_IO_RAW_SERIALIZE_UNAVAILABLE',
            'Scratch VM does not expose saveProjectSb3DontZip().'
        );
    }
    const files = await Promise.resolve(
        lifecycle ? lifecycle.saveProjectSb3DontZip() : vm.saveProjectSb3DontZip()
    );
    if (!files || typeof files !== 'object' || !files['project.json']) {
        throw createVMProjectIOError(
            'VM_PROJECT_IO_SERIALIZE_EMPTY',
            'Scratch VM did not return project files for serialization.'
        );
    }

    const portableFiles = [];
    for (const fileName of Object.keys(files).sort()) {
        const bytes = await toUint8Array(files[fileName], fileName);
        portableFiles.push({data: encodeBase64Bytes(bytes), name: fileName});
    }
    return createPortableProjectPayload(portableFiles);
};

const restorePortableProject = async (vm, payload, options = {}) => {
    const lifecycle = getLifecycle(vm);
    if (!lifecycle && (!vm || typeof vm.deserializeProject !== 'function')) {
        throw createVMProjectIOError(
            'VM_PROJECT_IO_DESERIALIZE_UNAVAILABLE',
            'Scratch VM does not expose deserializeProject().'
        );
    }
    const parsed = parsePortableProjectPayload(payload);
    const projectJSONText = readPortableTextFile(parsed, 'project.json');
    if (!projectJSONText) {
        throw createVMProjectIOError(
            'VM_PROJECT_IO_PROJECT_JSON_MISSING',
            'Portable project payload does not contain project.json.'
        );
    }
    const projectJSON = JSON.parse(projectJSONText);
    // saveProjectSb3DontZip()/toJSON() emits standard SB3 JSON without the
    // transient projectVersion discriminator expected by deserializeProject().
    // This transport is explicitly SB3, so restore the host-only discriminator
    // before handing the portable payload back to Scratch VM.
    projectJSON.projectVersion = 3;
    const zip = new JSZip();
    parsed.files.forEach(file => {
        // Only portable base64 strings enter JSZip. Scratch VM-owned binary values
        // never leave Host memory and never participate in JSZip brand checks.
        zip.file(file.name, file.data, {base64: true});
    });
    if (options.stopRuntime !== false && typeof vm.stopAll === 'function') vm.stopAll();
    if (lifecycle) {
        await lifecycle.deserializeProject(projectJSON, zip);
    } else {
        await vm.deserializeProject(projectJSON, zip);
    }
    if (options.emitProjectLoaded !== false && vm.runtime && typeof vm.runtime.handleProjectLoaded === 'function') {
        vm.runtime.handleProjectLoaded();
    }
    return true;
};

const createVMProjectIOService = vm => Object.freeze({
    capturePortableProject: () => capturePortableProject(vm),
    restorePortableProject: (payload, options = {}) => restorePortableProject(vm, payload, options),

    // Compatibility aliases for older callers. The Scene V2 kernel does not use
    // archive serialization for capture; these remain available for migration.
    deserializeProjectArchive: async (projectJSON, archive, options = {}) => {
        if (typeof archive !== 'string' || !archive) {
            throw createVMProjectIOError(
                'VM_PROJECT_IO_ARCHIVE_INVALID',
                'Scene project archive must be a non-empty base64 string.',
                TypeError
            );
        }
        const zip = await JSZip.loadAsync(archive, {base64: true});
        if (options.stopRuntime !== false && typeof vm.stopAll === 'function') vm.stopAll();
        const lifecycle = getLifecycle(vm);
        if (lifecycle) {
            await lifecycle.deserializeProject(projectJSON, zip);
        } else {
            await vm.deserializeProject(projectJSON, zip);
        }
        if (options.emitProjectLoaded !== false && vm.runtime && typeof vm.runtime.handleProjectLoaded === 'function') {
            vm.runtime.handleProjectLoaded();
        }
        return true;
    },
    serializeProjectArchive: async () => {
        const payload = await capturePortableProject(vm);
        const parsed = parsePortableProjectPayload(payload);
        const zip = new JSZip();
        parsed.files.forEach(file => zip.file(file.name, file.data, {base64: true}));
        return zip.generateAsync({
            compression: 'DEFLATE',
            compressionOptions: {level: 6},
            type: 'base64'
        });
    },
    serializeProjectFilesPortable: () => capturePortableProject(vm)
});

module.exports = {
    PORTABLE_PROJECT_FILES_FORMAT,
    PORTABLE_PROJECT_FILES_VERSION,
    createVMProjectIOService
};
