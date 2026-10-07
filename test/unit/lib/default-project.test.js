import projectData from '../../../src/lib/default-project/project-data';

describe('NES Studio blank default project', () => {
    test('contains only the Stage and no demo sprites or scripts', () => {
        const project = projectData(message => message.defaultMessage);

        expect(project.targets).toHaveLength(1);
        expect(project.targets[0].isStage).toBe(true);
        expect(project.targets[0].blocks).toEqual({});
        expect(project.targets[0].variables).toEqual({});
        expect(project.targets.filter(target => !target.isStage)).toHaveLength(0);
        expect(project.meta.agent).toBe('NES Studio');
    });
});
