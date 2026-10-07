import React from 'react';
import renderer from 'react-test-renderer';

import ExtensionCenter from '../../../src/components/extension-center/extension-center.jsx';

jest.mock('../../../src/containers/modal.jsx', () => props => <div>{props.children}</div>);

const item = {
    description: 'Native camera module',
    extensionId: 'ngvge.camera',
    favoriteKey: 'ngvge.camera',
    isCompatible: true,
    isInstalled: false,
    name: 'Camera 2D',
    ngvgeManifest: {
        kind: 'ngvge-native',
        source: {id: 'ngvge'}
    },
    sourceLabel: 'NGVGE Official'
};

const renderCenter = ({extension = item, onItemSelected = jest.fn()} = {}) => renderer.create(
    <ExtensionCenter
        filterChips={[]}
        getActionLabel={() => 'Install'}
        isFavorite={() => false}
        isItemSelectable={() => false}
        isItemSelected={() => false}
        query=""
        sections={[{key: 'official', title: 'NGVGE Official', items: [extension]}]}
        sidebarGroups={[{
            key: 'ecosystems',
            title: 'NGVGE Ecosystem',
            items: [{key: 'ngvge', label: 'Official', icon: 'N', count: 1, onClick: jest.fn()}]
        }, {
            key: 'online',
            title: 'Online Markets',
            items: [{key: 'tw', label: 'TurboWarp', icon: 'TW', count: 0, onClick: jest.fn()}]
        }]}
        sortMode="recommended"
        sortOptions={[{value: 'recommended', label: 'Recommended'}]}
        summary={[]}
        title="Extension Center"
        onFavorite={jest.fn()}
        onItemSelected={onItemSelected}
        onOpenCustomExtension={jest.fn()}
        onQueryChange={jest.fn()}
        onQueryClear={jest.fn()}
        onRequestClose={jest.fn()}
        onSelectionToggle={jest.fn()}
        onSortChange={jest.fn()}
    />
);

describe('ExtensionCenter', () => {
    test('renders separated ecosystems and extension metadata', () => {
        const component = renderCenter();
        const text = JSON.stringify(component.toJSON());

        expect(text).toContain('Extension Center');
        expect(text).toContain('NGVGE Ecosystem');
        expect(text).toContain('Online Markets');
        expect(text).toContain('Camera 2D');
        expect(text).toContain('NGVGE Official');
        expect(text).toContain('Install');
    });

    test('does not activate disabled extensions', () => {
        const onItemSelected = jest.fn();
        const component = renderCenter({
            extension: {...item, disabled: true},
            onItemSelected
        });
        const card = component.root.findByType('article');

        card.props.onClick({target: {closest: () => null}});

        expect(card.props['aria-disabled']).toBe(true);
        expect(card.props.tabIndex).toBe(-1);
        expect(onItemSelected).not.toHaveBeenCalled();
    });

    test('does not activate the card when an author link is clicked', () => {
        const onItemSelected = jest.fn();
        const component = renderCenter({
            extension: {
                ...item,
                credits: [<a href="https://example.com" key="author">Author</a>]
            },
            onItemSelected
        });
        const card = component.root.findByType('article');

        card.props.onClick({target: {closest: selector => selector === 'a' ? {} : null}});

        expect(onItemSelected).not.toHaveBeenCalled();
    });
});
