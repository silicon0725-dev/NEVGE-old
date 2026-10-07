const {runInNewContext} = require('vm');

const {createVMProjectIOService} = require('../../../../src/lib/first-party-modules/vm-project-io-service');
const {
    createPortableProjectPayload,
    encodeBase64Bytes,
    parsePortableProjectPayload,
    readPortableTextFile
} = require('../../../../src/lib/first-party-modules/portable-project-files');

describe('VM Project I/O portable transport', () => {
    test('capture normalizes cross-realm binary values into base64 strings', async () => {
        const crossRealmBytes = runInNewContext('new Uint8Array([1, 2, 3, 4])');
        expect(crossRealmBytes instanceof Uint8Array).toBe(false);
        expect(ArrayBuffer.isView(crossRealmBytes)).toBe(true);

        const vm = {
            saveProjectSb3DontZip: () => ({
                'asset.svg': crossRealmBytes,
                'project.json': new TextEncoder().encode(JSON.stringify({targets: []}))
            })
        };
        const service = createVMProjectIOService(vm);
        const payload = await service.capturePortableProject();
        const parsed = parsePortableProjectPayload(payload);

        expect(typeof payload).toBe('string');
        expect(parsed.files).toHaveLength(2);
        expect(parsed.files.every(file => typeof file.data === 'string')).toBe(true);
        expect(JSON.parse(readPortableTextFile(parsed, 'project.json')).targets).toEqual([]);
    });

    test('restore supplies the SB3 projectVersion discriminator required by deserializeProject', async () => {
        let receivedProject = null;
        const vm = {
            deserializeProject: project => {
                receivedProject = project;
                return Promise.resolve();
            },
            runtime: {handleProjectLoaded: jest.fn()},
            stopAll: jest.fn()
        };
        const projectWithoutVersion = JSON.stringify({
            extensions: [],
            meta: {semver: '3.0.0'},
            monitors: [],
            targets: []
        });
        const payload = createPortableProjectPayload([{
            data: encodeBase64Bytes(new TextEncoder().encode(projectWithoutVersion)),
            name: 'project.json'
        }]);

        await createVMProjectIOService(vm).restorePortableProject(payload);

        expect(receivedProject.projectVersion).toBe(3);
        expect(vm.stopAll).toHaveBeenCalledTimes(1);
        expect(vm.runtime.handleProjectLoaded).toHaveBeenCalledTimes(1);
    });
});
