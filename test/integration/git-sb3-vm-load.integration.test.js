import fs from 'fs';
import os from 'os';
import path from 'path';
import VM from 'scratch-vm';
import {DOMParser as XMLDOMParser} from '@xmldom/xmldom';

import {reconstructSb3FromWorkingTree} from '../../src/lib/git/reconstruct-sb3';

class StrictDOMParser {
    parseFromString (source, type) {
        return new XMLDOMParser().parseFromString(source, type);
    }
}

const write = async (filename, data) => {
    await fs.promises.mkdir(path.dirname(filename), {recursive: true});
    await fs.promises.writeFile(filename, data);
};

describe('R8 integration: Git working tree -> SB3 -> Scratch VM', () => {
    let root;
    let previousDOMParser;

    beforeEach(async () => {
        root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ngvge-r8-integration-'));
        previousDOMParser = global.DOMParser;
        global.DOMParser = StrictDOMParser;
    });

    afterEach(async () => {
        if (previousDOMParser === undefined) delete global.DOMParser;
        else global.DOMParser = previousDOMParser;
        await fs.promises.rm(root, {recursive: true, force: true});
    });

    test('reconstructed archive is accepted by scratch-vm with its block graph intact', async () => {
        const stage = path.join(root, 'Stage');
        await write(path.join(stage, 'index.json'), JSON.stringify({
            name: 'Stage',
            isStage: true,
            variables: {},
            lists: {},
            broadcasts: {},
            currentCostume: 0,
            costumes: [],
            sounds: [],
            volume: 100,
            tempo: 60,
            videoState: 'on',
            videoTransparency: 50,
            textToSpeechLanguage: null
        }));
        await write(path.join(stage, 'scripts', 'main.xml'),
            '<xml><block id="r8-flag" type="event_whenflagclicked" x="10" y="20">' +
            '<next><block id="r8-say" type="looks_say"><value name="MESSAGE">' +
            '<shadow id="r8-message" type="text"><field name="TEXT">R8 integration</field></shadow>' +
            '</value></block></next></block></xml>');

        const archive = await reconstructSb3FromWorkingTree({fs, dir: root});
        expect(archive.byteLength || archive.length).toBeGreaterThan(100);

        const vm = new VM();
        await expect(vm.loadProject(archive)).resolves.toBeUndefined();
        expect(vm.runtime.targets).toHaveLength(1);

        const target = vm.runtime.targets[0];
        expect(target.blocks.getBlock('r8-flag')).toBeTruthy();
        expect(target.blocks.getBlock('r8-say')).toBeTruthy();
        const say = target.blocks.getBlock('r8-say');
        expect(say.inputs.MESSAGE).toBeTruthy();
        const messageBlock = target.blocks.getBlock(say.inputs.MESSAGE.block || say.inputs.MESSAGE.shadow);
        expect(messageBlock).toBeTruthy();
        expect(messageBlock.fields.TEXT.value).toBe('R8 integration');
    });
});
