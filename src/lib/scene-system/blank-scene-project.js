const BLANK_BACKDROP_ASSET_ID = 'cd21514d0531fdffb22204e0ec5ed84a';
const BLANK_BACKDROP_FILE_NAME = `${BLANK_BACKDROP_ASSET_ID}.svg`;
const BLANK_BACKDROP_SVG = [
    '<svg version="1.1" width="2" height="2" viewBox="-1 -1 2 2"',
    ' xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">',
    '\n  <!-- Exported by Scratch - http://scratch.mit.edu/ -->\n</svg>'
].join('');

const createBlankSceneProjectJSON = (options = {}) => ({
    projectVersion: 3,
    extensions: [],
    meta: {
        agent: 'NES Studio',
        semver: '3.0.0',
        vm: '0.1.0'
    },
    monitors: [],
    targets: [
        {
            blocks: {},
            broadcasts: {},
            comments: {},
            costumes: [
                {
                    assetId: BLANK_BACKDROP_ASSET_ID,
                    dataFormat: 'svg',
                    md5ext: BLANK_BACKDROP_FILE_NAME,
                    name: typeof options.backdropName === 'string' && options.backdropName.trim() ?
                        options.backdropName.trim() : 'Backdrop 1',
                    rotationCenterX: 240,
                    rotationCenterY: 180
                }
            ],
            currentCostume: 0,
            isStage: true,
            layerOrder: 0,
            lists: {},
            name: typeof options.stageName === 'string' && options.stageName.trim() ?
                options.stageName.trim() : 'Stage',
            sounds: [],
            tempo: 60,
            textToSpeechLanguage: null,
            variables: {},
            videoState: 'on',
            videoTransparency: 50,
            volume: 100
        }
    ]
});

const createBlankSceneFiles = options => ({
    [BLANK_BACKDROP_FILE_NAME]: BLANK_BACKDROP_SVG,
    'project.json': JSON.stringify(createBlankSceneProjectJSON(options))
});

module.exports = {
    BLANK_BACKDROP_ASSET_ID,
    BLANK_BACKDROP_FILE_NAME,
    BLANK_BACKDROP_SVG,
    createBlankSceneFiles,
    createBlankSceneProjectJSON
};
