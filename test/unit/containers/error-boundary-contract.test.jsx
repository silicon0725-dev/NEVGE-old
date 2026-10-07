import {ErrorBoundary} from '../../../src/containers/error-boundary.jsx';

describe('GUI ErrorBoundary contract', () => {
    test('derives renderable error state through getDerivedStateFromError', () => {
        const error = new Error('boom');
        expect(ErrorBoundary.getDerivedStateFromError(error)).toEqual({error});
    });
});
