import {
    createInspectorRegistry,
    getInspectorRegistry
} from '../../../src/lib/project-inspector/inspector-registry';

describe('project inspector registry', () => {
    const createSection = overrides => Object.assign({
        id: 'test',
        label: 'Test',
        getFields: () => [],
        setValue: () => {}
    }, overrides);

    test('creates one registry per runtime', () => {
        const runtime = {};
        expect(getInspectorRegistry(runtime)).toBe(getInspectorRegistry(runtime));
    });

    test('registers, sorts and filters sections', () => {
        const registry = createInspectorRegistry();
        registry.register(createSection({id: 'late', label: 'Late', order: 20}));
        registry.register(createSection({
            id: 'early',
            label: 'Early',
            order: 10,
            appliesTo: target => target.kind === 'sprite'
        }));

        expect(registry.getSections({kind: 'sprite'}).map(section => section.id)).toEqual([
            'early',
            'late'
        ]);
        expect(registry.getSections({kind: 'stage'}).map(section => section.id)).toEqual([
            'late'
        ]);
        expect(registry.getSection('early').id).toBe('early');
        expect(registry.listSections()).toHaveLength(2);
    });

    test('notifies subscribers when a section changes', () => {
        const registry = createInspectorRegistry();
        const listener = jest.fn();
        const unsubscribe = registry.subscribe(listener);
        registry.register(createSection());
        registry.notify({sectionId: 'test'});
        unsubscribe();
        registry.notify({sectionId: 'test'});

        expect(listener).toHaveBeenCalledTimes(2);
    });
});
