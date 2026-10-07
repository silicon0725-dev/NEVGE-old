/* eslint-disable global-require */
global.Element = global.Element || function Element () {};
global.HTMLImageElement = global.HTMLImageElement || function HTMLImageElement () {};

jest.mock('../../../src/lib/vendor/scratch-paint/src/modules/default-paint-module-registry', () => ({
    DEFAULT_PAINT_MODULE_REGISTRY: {id: 'mock.default', version: 1, slots: {}}
}));

const React = require('react');
const renderer = require('react-test-renderer');
const {PaintEditorComponent} = require('../../../src/lib/vendor/scratch-paint/src/components/paint-editor/paint-editor.jsx');
const {createPaintModuleRegistry} = require('../../../src/lib/vendor/scratch-paint/src/modules/paint-module-registry');

const moduleFor = slot => ({
    id: `test.${slot}@1`,
    version: 1,
    component: () => <div data-test-paint-slot={slot} />
});

const registry = createPaintModuleRegistry({
    fixedToolbar: moduleFor('fixedToolbar'),
    propertiesToolbar: moduleFor('propertiesToolbar'),
    toolRail: moduleFor('toolRail'),
    workspace: {
        id: 'test.workspace@1',
        version: 1,
        component: props => (
            <div data-test-paint-slot="workspace">
                <props.workspaceOverlay />
            </div>
        )
    },
    canvasControls: moduleFor('canvasControls'),
    workspaceOverlay: moduleFor('workspaceOverlay'),
    sidePanel: moduleFor('sidePanel'),
    bottomPanel: moduleFor('bottomPanel')
});

const noop = () => {};

describe('WS-10P0M modular Scratch Paint component composition', () => {
    test('renders admitted modules through stable UI slots', () => {
        const tree = renderer.create(
            <PaintEditorComponent
                canRedo={noop}
                canUndo={noop}
                canvas={new global.Element()}
                format="VECTOR"
                intl={{
                    formatDate: noop,
                    formatTime: noop,
                    formatRelative: noop,
                    formatNumber: noop,
                    formatPlural: noop,
                    formatMessage: message => message.defaultMessage,
                    formatHTMLMessage: noop,
                    now: noop
                }}
                moduleRegistry={registry}
                onChangeTheme={noop}
                onRedo={noop}
                onSwitchToBitmap={noop}
                onSwitchToVector={noop}
                onUndo={noop}
                onUpdateImage={noop}
                onUpdateName={noop}
                onZoomIn={noop}
                onZoomOut={noop}
                onZoomReset={noop}
                rtl={false}
                setCanvas={noop}
                setTextArea={noop}
                theme="dark"
            />
        );

        expect(tree.root.findByProps({'data-scratch-paint-module-registry': registry.id})).toBeTruthy();
        expect(tree.root.findAllByProps({'data-test-paint-slot': 'fixedToolbar'})).toHaveLength(1);
        expect(tree.root.findAllByProps({'data-test-paint-slot': 'propertiesToolbar'})).toHaveLength(1);
        expect(tree.root.findAllByProps({'data-test-paint-slot': 'toolRail'})).toHaveLength(1);
        expect(tree.root.findAllByProps({'data-test-paint-slot': 'workspace'})).toHaveLength(1);
        expect(tree.root.findAllByProps({'data-test-paint-slot': 'workspaceOverlay'})).toHaveLength(1);
        expect(tree.root.findAllByProps({'data-test-paint-slot': 'sidePanel'})).toHaveLength(1);
        expect(tree.root.findAllByProps({'data-test-paint-slot': 'bottomPanel'})).toHaveLength(1);
        expect(tree.root.findAllByProps({'data-test-paint-slot': 'canvasControls'})).toHaveLength(1);
    });
});
