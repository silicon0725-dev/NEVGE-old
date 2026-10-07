import sharedMessages from '../shared-messages';

// Use the default message if a translation function is not passed.
const defaultTranslator = msgObj => msgObj.defaultMessage;

/**
 * Generate a localized blank project.
 * Scratch VM still requires a Stage target and one backdrop asset, but NES Studio
 * intentionally starts without sprites, scripts, variables, or demo content.
 * @param {function} translateFunction a function to use for translating default names
 * @return {object} the project data JSON for the blank project
 */
const projectData = translateFunction => {
    const translator = translateFunction || defaultTranslator;
    return ({
        targets: [
            {
                isStage: true,
                name: 'Stage',
                variables: {},
                lists: {},
                broadcasts: {},
                blocks: {},
                comments: {},
                currentCostume: 0,
                costumes: [
                    {
                        assetId: 'cd21514d0531fdffb22204e0ec5ed84a',
                        name: translator(sharedMessages.backdrop, {index: 1}),
                        md5ext: 'cd21514d0531fdffb22204e0ec5ed84a.svg',
                        dataFormat: 'svg',
                        rotationCenterX: 240,
                        rotationCenterY: 180
                    }
                ],
                sounds: [],
                volume: 100
            }
        ],
        meta: {
            semver: '3.0.0',
            vm: '0.1.0',
            agent: 'NES Studio'
        }
    });
};

export default projectData;
