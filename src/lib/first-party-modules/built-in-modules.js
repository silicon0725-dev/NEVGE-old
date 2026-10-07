const {
    CORE_MODULE_ID,
    MODULE_AVAILABILITY,
    MODULE_KINDS,
    MODULE_PERMISSIONS,
    SB3_COMPATIBILITY_LEVELS
} = require('./constants');
const {getSceneSystemModuleDefinition} = require('../scene-system/module-definition');

const common = {
    apiVersion: '1',
    author: 'NGVGE Team',
    kind: MODULE_KINDS.FIRST_PARTY,
    version: '0.1.0'
};

const plannedModule = manifest => ({
    manifest: Object.assign({}, common, {
        availability: MODULE_AVAILABILITY.PLANNED,
        defaultEnabled: false,
        dependencies: [CORE_MODULE_ID]
    }, manifest)
});

const getBuiltInModuleDefinitions = () => [
    {
        manifest: Object.assign({}, common, {
            availability: MODULE_AVAILABILITY.AVAILABLE,
            capabilities: [
                'modules.registry',
                'modules.data',
                'modules.capabilities',
                'modules.sb3-compatibility'
            ],
            compatibility: {
                sb3: {
                    description: 'Stores NGVGE module metadata without changing Scratch runtime behavior.',
                    level: SB3_COMPATIBILITY_LEVELS.FULL,
                    strategy: 'preserve-metadata'
                }
            },
            defaultEnabled: true,
            dependencies: [],
            description: 'Core lifecycle, capability, project data and compatibility services for official NGVGE modules.',
            id: CORE_MODULE_ID,
            name: 'NGVGE Module Core',
            permissions: [
                MODULE_PERMISSIONS.EDITOR,
                MODULE_PERMISSIONS.RUNTIME,
                MODULE_PERMISSIONS.SERIALIZATION
            ],
            required: true
        }),
        hooks: {
            enable: context => {
                context.capabilities.provide('ngvge.module-manager', context.manager, {version: '1'});
                context.capabilities.provide('ngvge.module-data', context.manager.moduleData, {version: '1'});
            }
        }
    },
    getSceneSystemModuleDefinition(),
    plannedModule({
        capabilities: ['entities', 'components', 'components.inspector'],
        compatibility: {
            sb3: {
                description: 'Scratch sprites can be adapted, while NGVGE-only components require degradation.',
                level: SB3_COMPATIBILITY_LEVELS.PARTIAL,
                strategy: 'adapt-supported-components'
            }
        },
        description: 'Entity, component, renderer and Scratch sprite adapter architecture.',
        id: 'ngvge.entity-component',
        name: 'Entity Component System',
        permissions: [
            MODULE_PERMISSIONS.ASSETS,
            MODULE_PERMISSIONS.COMMANDS,
            MODULE_PERMISSIONS.EDITOR,
            MODULE_PERMISSIONS.INSPECTOR,
            MODULE_PERMISSIONS.NODES,
            MODULE_PERMISSIONS.RUNTIME,
            MODULE_PERMISSIONS.SERIALIZATION
        ]
    }),
    plannedModule({
        capabilities: ['camera2d'],
        compatibility: {
            sb3: {
                description: 'Camera transforms must be baked or emulated when exporting to SB3.',
                level: SB3_COMPATIBILITY_LEVELS.PARTIAL,
                strategy: 'bake-or-runtime-adapter'
            }
        },
        dependencies: [CORE_MODULE_ID, 'ngvge.entity-component'],
        description: 'World-space 2D cameras, limits, following and viewport behavior.',
        id: 'ngvge.camera2d',
        name: 'Camera 2D',
        permissions: [
            MODULE_PERMISSIONS.COMMANDS,
            MODULE_PERMISSIONS.EDITOR,
            MODULE_PERMISSIONS.RENDERER,
            MODULE_PERMISSIONS.RUNTIME,
            MODULE_PERMISSIONS.SERIALIZATION
        ]
    }),
    plannedModule({
        capabilities: ['physics2d', 'collision2d'],
        compatibility: {
            sb3: {
                description: 'Physics behavior requires an NGVGE runtime adapter or a generated Scratch approximation.',
                level: SB3_COMPATIBILITY_LEVELS.PARTIAL,
                strategy: 'runtime-adapter-or-generate-blocks'
            }
        },
        dependencies: [CORE_MODULE_ID, 'ngvge.entity-component'],
        description: 'Rigid bodies, collision shapes, queries and physics runtime integration.',
        id: 'ngvge.physics2d',
        name: 'Physics 2D',
        permissions: [
            MODULE_PERMISSIONS.COMMANDS,
            MODULE_PERMISSIONS.EDITOR,
            MODULE_PERMISSIONS.NODES,
            MODULE_PERMISSIONS.RUNTIME,
            MODULE_PERMISSIONS.SERIALIZATION
        ]
    }),
    plannedModule({
        capabilities: ['ui', 'ui-layout'],
        compatibility: {
            sb3: {
                description: 'Supported UI elements can be flattened to sprites; advanced layout remains NGVGE-only.',
                level: SB3_COMPATIBILITY_LEVELS.PARTIAL,
                strategy: 'flatten-supported-ui'
            }
        },
        dependencies: [CORE_MODULE_ID, 'ngvge.entity-component'],
        description: 'Screen-space layout, controls, themes and UI event routing.',
        id: 'ngvge.ui-system',
        name: 'UI System',
        permissions: [
            MODULE_PERMISSIONS.ASSETS,
            MODULE_PERMISSIONS.COMMANDS,
            MODULE_PERMISSIONS.EDITOR,
            MODULE_PERMISSIONS.RENDERER,
            MODULE_PERMISSIONS.RUNTIME,
            MODULE_PERMISSIONS.SERIALIZATION
        ]
    }),
    plannedModule({
        capabilities: ['gpu-canvas', 'gpu-brushes'],
        compatibility: {
            sb3: {
                description: 'GPU drawings can be baked to costumes, but editable brush data is NGVGE-only.',
                level: SB3_COMPATIBILITY_LEVELS.PARTIAL,
                strategy: 'bake-to-costume'
            }
        },
        description: 'GPU-accelerated high-definition drawing layers and programmable brushes.',
        id: 'ngvge.gpu-canvas',
        name: 'GPU Canvas',
        permissions: [
            MODULE_PERMISSIONS.ASSETS,
            MODULE_PERMISSIONS.EDITOR,
            MODULE_PERMISSIONS.RENDERER,
            MODULE_PERMISSIONS.RUNTIME,
            MODULE_PERMISSIONS.SERIALIZATION
        ]
    })
];

const registerBuiltInModules = (manager, definitions = getBuiltInModuleDefinitions()) => {
    definitions.forEach(definition => manager.registerModule(definition));
    return manager;
};

module.exports = {
    getBuiltInModuleDefinitions,
    registerBuiltInModules
};
