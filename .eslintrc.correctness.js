/**
 * R7 correctness-only ESLint profile.
 *
 * This profile deliberately avoids style and maintainability rules. Its job is
 * to catch JavaScript errors that can change execution semantics or crash at
 * runtime while the legacy Scratch style debt is paid down separately.
 */
module.exports = {
    root: true,
    parser: require.resolve('@babel/eslint-parser'),
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: {
            jsx: true
        },
        requireConfigFile: false
    },
    noInlineConfig: true,
    env: {
        browser: true,
        es2021: true,
        commonjs: true
    },
    globals: {
        process: 'readonly'
    },
    rules: {
        'constructor-super': 'error',
        'for-direction': 'error',
        'getter-return': 'error',
        'no-class-assign': 'error',
        'no-compare-neg-zero': 'error',
        'no-const-assign': 'error',
        'no-control-regex': 'error',
        'no-dupe-args': 'error',
        'no-dupe-class-members': 'error',
        'no-dupe-else-if': 'error',
        'no-dupe-keys': 'error',
        'no-duplicate-case': 'error',
        'no-empty-character-class': 'error',
        'no-ex-assign': 'error',
        'no-func-assign': 'error',
        'no-import-assign': 'error',
        'no-invalid-regexp': 'error',
        'no-loss-of-precision': 'error',
        'no-new-native-nonconstructor': 'error',
        'no-obj-calls': 'error',
        'no-self-assign': 'error',
        'no-setter-return': 'error',
        'no-this-before-super': 'error',
        'no-undef': ['error', {typeof: false}],
        'no-unreachable': 'error',
        'no-unreachable-loop': 'error',
        'no-unsafe-finally': 'error',
        'no-unsafe-negation': 'error',
        'no-unsafe-optional-chaining': 'error',
        'use-isnan': 'error',
        'valid-typeof': 'error'
    },
    overrides: [
        {
            files: [
                'scripts/**/*.js',
                'tools/**/*.js',
                '.eslintrc.js',
                '.eslintrc.correctness.js',
                'commitlint.config.js',
                'generate-changelog.js',
                'jest.unit-dom.config.js',
                'release.config.js',
                'webpack.config.js',
                'src/.eslintrc.js',
                'src/addons/pull.js'
            ],
            env: {
                browser: false,
                node: true,
                es2021: true,
                commonjs: true
            }
        },
        {
            files: ['test/**/*.js', 'test/**/*.jsx'],
            env: {
                browser: true,
                node: true,
                jest: true,
                es2021: true,
                commonjs: true
            }
        },
        {
            files: ['static/extensions/**/*.js'],
            env: {
                browser: true,
                node: false,
                es2021: true
            },
            globals: {
                Scratch: 'readonly',
                ScratchBlocks: 'readonly'
            }
        },
        {
            files: ['src/lib/scene-system/scene-snapshot-serializer.js'],
            globals: {
                Buffer: 'readonly'
            }
        },
        {
            files: ['src/playground/public-path.js'],
            globals: {
                __webpack_public_path__: 'writable'
            }
        },
        {
            files: ['src/components/tw-fonts-modal/font-name.jsx'],
            globals: {
                queryLocalFonts: 'readonly'
            }
        }
    ]
};
