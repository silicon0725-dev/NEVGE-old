import VM from 'scratch-vm';

import {ExtensionLibrary} from '../../../src/containers/extension-library.jsx';

describe('ExtensionLibrary asynchronous lifecycle', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
    });

    test('does not apply CCW results after the library has unmounted', async () => {
        let resolveFetch;
        global.fetch = jest.fn(() => new Promise(resolve => {
            resolveFetch = resolve;
        }));
        const instance = new ExtensionLibrary({
            intl: {formatMessage: descriptor => descriptor.defaultMessage || descriptor.id},
            vm: new VM()
        });
        instance._isMounted = true;
        instance.setState = jest.fn(patch => {
            instance.state = Object.assign({}, instance.state, patch);
        });

        const pending = instance.fetchAndSetCCWItems('', 'likeCount', 1);
        expect(instance.setState).toHaveBeenCalledWith({ccwLoading: true});

        instance.componentWillUnmount();
        resolveFetch({
            json: async () => ({body: {data: [], page: 1, perPage: 30, total: 0}}),
            ok: true
        });
        await pending;

        expect(instance.setState).toHaveBeenCalledTimes(1);
    });
});
