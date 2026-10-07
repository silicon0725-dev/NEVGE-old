const JSZip = require('@turbowarp/jszip');
const {createPortableProjectPayload} = require('../first-party-modules/portable-project-files');
const {createSceneSnapshot, isLegacySceneSnapshot} = require('./scene-snapshot');

const migrateLegacySceneSnapshot = async snapshot => {
    if (!isLegacySceneSnapshot(snapshot)) return snapshot;
    const zip = await JSZip.loadAsync(snapshot.archive, {base64: true});
    const files = [];
    const fileNames = Object.keys(zip.files || {}).filter(name => !zip.files[name].dir).sort();
    for (const name of fileNames) {
        files.push({
            data: await zip.files[name].async('base64'),
            name
        });
    }
    const payload = createPortableProjectPayload(files);
    return createSceneSnapshot({
        metadata: Object.assign({}, snapshot.metadata, {
            migratedFromSchemaVersion: snapshot.schemaVersion
        }),
        payload
    });
};

module.exports = {
    migrateLegacySceneSnapshot
};
