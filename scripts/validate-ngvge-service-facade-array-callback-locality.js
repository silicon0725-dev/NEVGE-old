/* eslint-disable no-console */
const React = require('react');
const {createModuleManager} = require('../src/lib/first-party-modules/module-manager');
const {
    MODULE_AVAILABILITY,
    MODULE_KINDS
} = require('../src/lib/first-party-modules/constants');

const assert = (condition, message) => {
    if (!condition) throw new Error(message);
};

const createManifest = id => ({
    apiVersion: '1',
    availability: MODULE_AVAILABILITY.AVAILABLE,
    capabilities: [],
    defaultEnabled: false,
    dependencies: [],
    description: `${id} validation module.`,
    id,
    kind: MODULE_KINDS.FIRST_PARTY,
    name: id,
    permissions: [],
    version: '1'
});

const manager = createModuleManager();
let list = null;
let savedMap = null;
let reactElements = null;

manager.registerModule({
    manifest: createManifest('provider'),
    hooks: {
        enable: context => context.capabilities.provide('scene-list', {
            list: () => [{id: 'scene-a'}, {id: 'scene-b'}]
        })
    }
});
manager.registerModule({
    manifest: createManifest('consumer'),
    hooks: {
        enable: context => {
            list = context.capabilities.require('scene-list').list();
            savedMap = list.map;
            reactElements = list.map(scene => React.createElement('div', {key: scene.id}, scene.id));
            const filtered = list.filter(() => ({truthy: true}));
            assert(filtered.length === 2, 'Array.filter callback result must remain consumer-local.');
        }
    }
});
manager.enableModule('provider');
manager.enableModule('consumer');

assert(Array.isArray(list) === false, 'Host Array must remain a revocable facade.');
assert(Array.isArray(reactElements), 'Array.map must return a consumer-local Array.');
assert(reactElements.length === 2, 'Array.map must preserve element count.');
assert(reactElements[0].type === 'div', 'React element callback result must remain consumer-local.');
assert(reactElements[0].props.children === 'scene-a', 'React callback result must preserve local content.');

manager.disableModule('provider', {force: true});
let revoked = null;
try {
    savedMap(scene => scene.id);
} catch (error) {
    revoked = error;
}
assert(
    revoked && revoked.code === 'MODULE_CAPABILITY_AUTHORITY_REVOKED',
    'Saved local Array callback method must remain provider-generation revocable.'
);

console.log('NGVGE Service Facade Array Callback Locality PASS');
