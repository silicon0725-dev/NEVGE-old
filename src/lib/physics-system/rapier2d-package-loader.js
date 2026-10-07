'use strict';

// Kept isolated so the semantic Physics2D runtime never depends on a concrete backend package.
// Webpack resolves this optional first-party provider when @dimforge/rapier2d-compat is installed.
const loadRapier2DCompat = () => import('@dimforge/rapier2d-compat').then(namespace => {
    const moduleValue = namespace && namespace.default && namespace.default.World ? namespace.default : namespace;
    if (!moduleValue) throw new Error('Rapier2D compatibility module did not export a module value.');
    if (typeof moduleValue.init === 'function') {
        return Promise.resolve(moduleValue.init()).then(() => moduleValue);
    }
    return moduleValue;
});

module.exports = {loadRapier2DCompat};
