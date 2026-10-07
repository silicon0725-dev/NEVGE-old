import {
    WORKSPACE_SHELL_ACCENT_POLICY,
    WORKSPACE_SHELL_ICON_POLICY,
    WORKSPACE_SHELL_VISUAL_FOUNDATION_ID,
    WORKSPACE_SHELL_VISUAL_MODE,
    WORKSPACE_SHELL_WINDOW_CHROME,
    getWorkspaceShellVisualContract
} from '../../../../src/lib/editor-shell/workspace-visual-foundation';

describe('workspace shell visual foundation', () => {
    test('freezes the WS-0 visual identity', () => {
        expect(WORKSPACE_SHELL_VISUAL_FOUNDATION_ID).toBe('ngvge.workspace-shell.visual@1');
        expect(WORKSPACE_SHELL_VISUAL_MODE).toBe('neutral-dark');
        expect(WORKSPACE_SHELL_ACCENT_POLICY).toBe('neutral');
        expect(WORKSPACE_SHELL_ICON_POLICY).toBe('svg-only');
        expect(WORKSPACE_SHELL_WINDOW_CHROME).toBe('quiet-titlebar');
    });

    test('returns a frozen portable contract', () => {
        const contract = getWorkspaceShellVisualContract();
        expect(Object.isFrozen(contract)).toBe(true);
        expect(contract).toEqual({
            accentPolicy: 'neutral',
            iconPolicy: 'svg-only',
            id: 'ngvge.workspace-shell.visual@1',
            mode: 'neutral-dark',
            windowChrome: 'quiet-titlebar'
        });
    });
});
