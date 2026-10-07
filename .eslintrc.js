module.exports = {
    extends: ['scratch', 'scratch/node', 'scratch/es6'],
    rules: {
        // R7: eslint-plugin-import 2.29.1 is incompatible with the resolved
        // eslint-module-utils 2.14.0 declaredScope shim on ESLint 8.55.0.
        // Keep the legacy lint executable; namespace semantics are not part of
        // the correctness gate while this dependency set remains frozen.
        'import/namespace': 'off'
    }
};
