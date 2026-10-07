'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const JSZip = require('@turbowarp/jszip');
const sb3Serialization = require('scratch-vm/src/serialization/sb3');
const {DOMParser: XMLDOMParser} = require('@xmldom/xmldom');
const loadBabelModule = require('../helpers/load-babel-module');

const repositoryRoot = path.resolve(__dirname, '../../..');
const reconstructionPath = path.join(repositoryRoot, 'src/lib/git/reconstruct-sb3.js');
const reconstruction = loadBabelModule(reconstructionPath);

class StrictDOMParser {
    parseFromString (source, type) {
        const errors = [];
        const parser = new XMLDOMParser({
            errorHandler: {
                warning: message => errors.push(String(message)),
                error: message => errors.push(String(message)),
                fatalError: message => errors.push(String(message))
            }
        });
        const doc = parser.parseFromString(source, type);
        if (errors.length > 0) {
            const originalGetElementsByTagName = typeof doc.getElementsByTagName === 'function' ?
                doc.getElementsByTagName.bind(doc) : null;
            doc.getElementsByTagName = name => {
                if (String(name).toLowerCase() === 'parsererror') {
                    return [{textContent: errors.join('; ')}];
                }
                return originalGetElementsByTagName ? originalGetElementsByTagName(name) : [];
            };
        }
        return doc;
    }
}

const withDOMParser = async callback => {
    const previous = global.DOMParser;
    global.DOMParser = StrictDOMParser;
    try {
        return await callback();
    } finally {
        if (previous === undefined) delete global.DOMParser;
        else global.DOMParser = previous;
    }
};

const assertBlockGraph = () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xml xmlns="http://www.w3.org/1999/xhtml">
  <block id="top" type="control_if" x="12" y="-5">
    <mutation proccode="do %s" argumentids="[&quot;arg1&quot;]" warp="true">
      <arg name="value" />
    </mutation>
    <field name="VARIABLE" id="var-1" variabletype="">score</field>
    <value name="CONDITION">
      <block id="real" type="operator_equals" />
      <shadow id="shadow" type="text"><field name="TEXT">fallback</field></shadow>
    </value>
    <statement name="SUBSTACK">
      <block id="child" type="looks_say" />
    </statement>
    <next><block id="next" type="motion_movesteps" /></next>
  </block>
</xml>`;

    const blocks = reconstruction.parseBlocksFromXML(xml);
    assert.deepStrictEqual(Object.keys(blocks).sort(), ['child', 'next', 'real', 'shadow', 'top']);

    assert.strictEqual(blocks.top.topLevel, true, 'Top-level block lost topLevel=true.');
    assert.strictEqual(blocks.top.parent, null, 'Top-level block unexpectedly gained a parent.');
    assert.strictEqual(blocks.top.x, 12);
    assert.strictEqual(blocks.top.y, -5);
    assert.strictEqual(blocks.top.fields.VARIABLE.value, 'score');
    assert.strictEqual(blocks.top.fields.VARIABLE.id, 'var-1');

    assert.deepStrictEqual(blocks.top.inputs.CONDITION, {
        name: 'CONDITION',
        block: 'real',
        shadow: 'shadow'
    });
    assert.strictEqual(blocks.real.parent, 'top');
    assert.strictEqual(blocks.real.shadow, false);
    assert.strictEqual(blocks.shadow.parent, 'top', 'Obscured shadow must be parented to the owning input block.');
    assert.strictEqual(blocks.shadow.shadow, true);
    assert.notStrictEqual(blocks.shadow.parent, blocks.shadow.id, 'Shadow block must never self-parent.');
    assert.strictEqual(blocks.shadow.fields.TEXT.value, 'fallback');

    assert.deepStrictEqual(blocks.top.inputs.SUBSTACK, {
        name: 'SUBSTACK',
        block: 'child',
        shadow: null
    });
    assert.strictEqual(blocks.child.parent, 'top');
    assert.strictEqual(blocks.top.next, 'next');
    assert.strictEqual(blocks.next.parent, 'top');

    assert(blocks.top.mutation, 'Mutation was lost.');
    assert.strictEqual(blocks.top.mutation.tagName, 'mutation');
    assert.strictEqual(blocks.top.mutation.proccode, 'do %s');
    assert.strictEqual(blocks.top.mutation.argumentids, '["arg1"]');
    assert.strictEqual(blocks.top.mutation.warp, 'true');
    assert.deepStrictEqual(blocks.top.mutation.children, [{
        tagName: 'arg',
        children: [],
        name: 'value'
    }]);

    const shadowOnly = reconstruction.parseBlocksFromXML(
        '<xml><block type="looks_say"><value name="MESSAGE"><shadow type="text">' +
        '<field name="TEXT">hello</field></shadow></value></block></xml>'
    );
    const topId = Object.keys(shadowOnly).find(id => shadowOnly[id].topLevel);
    assert(topId, 'Generated top-level ID missing.');
    const input = shadowOnly[topId].inputs.MESSAGE;
    assert(input && input.block, 'Generated input block ID missing.');
    assert.strictEqual(input.block, input.shadow, 'Unobscured shadow must use the same block/shadow ID.');
    assert(shadowOnly[input.block], 'Generated input ID does not reference a stored block.');
    assert.strictEqual(shadowOnly[input.block].parent, topId);

    const dynamicMutation = reconstruction.parseBlocksFromXML(
        '<xml><block id="dynamic" type="extension_dynamic">' +
        '<mutation blockInfo="{&quot;opcode&quot;:&quot;dynamic&quot;,&quot;text&quot;:&quot;Hello&quot;}" />' +
        '</block></xml>'
    );
    assert.deepStrictEqual(dynamicMutation.dynamic.mutation.blockInfo, {
        opcode: 'dynamic',
        text: 'Hello'
    }, 'Dynamic blockInfo mutation was not restored as an object.');

    const multipleTopLevels = reconstruction.parseBlocksFromXML(
        '<xml><block id="first" type="event_whenflagclicked" />' +
        '<block id="second" type="event_whenkeypressed" /></xml>'
    );
    assert.strictEqual(multipleTopLevels.first.topLevel, true);
    assert.strictEqual(multipleTopLevels.second.topLevel, true);

    assert.throws(
        () => reconstruction.parseBlocksFromXML(
            '<xml><block id="duplicate-local" type="event_whenflagclicked" />' +
            '<block id="duplicate-local" type="event_whenkeypressed" /></xml>'
        ),
        /Duplicate block id duplicate-local within XML/,
        'Duplicate block IDs inside one XML document must fail closed.'
    );
};

const assertMalformedXMLFailsClosed = () => {
    assert.throws(
        () => reconstruction.parseBlocksFromXML('<xml><block id="broken"></xml>'),
        /Failed to parse XML: Malformed XML:/,
        'Malformed XML must fail closed instead of becoming an empty block map.'
    );
};

const writeFile = async (filename, data) => {
    await fs.promises.mkdir(path.dirname(filename), {recursive: true});
    await fs.promises.writeFile(filename, data);
};

const makeWav = rate => {
    const bytes = Buffer.alloc(44);
    bytes.write('RIFF', 0, 'ascii');
    bytes.writeUInt32LE(36, 4);
    bytes.write('WAVE', 8, 'ascii');
    bytes.write('fmt ', 12, 'ascii');
    bytes.writeUInt32LE(16, 16);
    bytes.writeUInt16LE(1, 20);
    bytes.writeUInt16LE(1, 22);
    bytes.writeUInt32LE(rate, 24);
    bytes.writeUInt32LE(rate * 2, 28);
    bytes.writeUInt16LE(2, 32);
    bytes.writeUInt16LE(16, 34);
    bytes.write('data', 36, 'ascii');
    bytes.writeUInt32LE(0, 40);
    return bytes;
};

const createWorkingTree = async root => {
    const stage = path.join(root, 'Stage');
    const index = {
        name: 'Stage',
        isStage: true,
        variables: {},
        lists: {},
        broadcasts: {},
        currentCostume: 0,
        volume: 77,
        tempo: 123,
        videoState: 'off',
        videoTransparency: 0,
        textToSpeechLanguage: 'ja',
        costumes: [
            {
                name: 'Second in filesystem, first in index',
                file: 'costumes/z-last.svg',
                md5ext: 'old-z.svg',
                dataFormat: 'svg',
                rotationCenterX: 0,
                rotationCenterY: 0
            },
            {
                name: 'First in filesystem, second in index',
                file: 'costumes/a-first.png',
                md5ext: 'old-a.png',
                dataFormat: 'png',
                rotationCenterX: 4,
                rotationCenterY: 5
            }
        ],
        sounds: [
            {
                name: 'Z sound',
                file: 'sounds/z-last.wav',
                md5ext: 'old-z.wav',
                dataFormat: 'wav',
                rate: 22050,
                sampleCount: 10
            },
            {
                name: 'A sound',
                file: 'sounds/a-first.mp3',
                md5ext: 'old-a.mp3',
                dataFormat: 'mp3',
                rate: 44100,
                sampleCount: 20
            }
        ]
    };

    await writeFile(path.join(stage, 'index.json'), JSON.stringify(index, null, 2));
    await writeFile(path.join(stage, 'scripts', 'main.xml'),
        '<xml><block id="top" type="event_whenflagclicked">' +
        '<comment id="comment-1" x="3" y="4" w="120" h="80" pinned="true" minimized="false">' +
        'Pinned comment</comment>' +
        '<mutation test="preserved"><arg name="nested" /></mutation><next>' +
        '<block id="say" type="looks_say"><value name="MESSAGE">' +
        '<shadow id="message" type="text"><field name="TEXT">hello</field></shadow>' +
        '</value><next><block id="pen" type="pen_penDown" /></next></block></next></block></xml>');
    await writeFile(path.join(stage, 'costumes', 'z-last.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    await writeFile(path.join(stage, 'costumes', 'a-first.png'), Buffer.from([137, 80, 78, 71, 1, 2, 3]));
    await writeFile(path.join(stage, 'sounds', 'z-last.wav'), makeWav(22050));
    await writeFile(path.join(stage, 'sounds', 'a-first.mp3'), Buffer.from([0x49, 0x44, 0x33, 1, 2, 3]));
    return stage;
};

const assertDuplicateIdsFailClosed = async root => {
    const sprite = path.join(root, 'DuplicateSprite');
    await writeFile(path.join(sprite, 'scripts', 'a.xml'),
        '<xml><block id="duplicate" type="event_whenflagclicked" /></xml>');
    await writeFile(path.join(sprite, 'scripts', 'b.xml'),
        '<xml><block id="duplicate" type="event_whenkeypressed" /></xml>');

    await assert.rejects(
        reconstruction.readSpriteScripts(fs.promises, sprite),
        /Duplicate block id duplicate/,
        'Duplicate block IDs across script files must not be silently discarded.'
    );
};

const assertEndToEndReconstruction = async root => {
    const stage = await createWorkingTree(root);
    const target = await reconstruction.buildTargetFromWorkingTree(fs.promises, stage);

    assert.strictEqual(target.costumes.length, 2);
    assert.strictEqual(target.costumes[0].name, 'Second in filesystem, first in index',
        'Costume order must follow index.json, not filesystem readdir order.');
    assert.strictEqual(target.costumes[1].name, 'First in filesystem, second in index');
    assert.strictEqual(target.costumes[0].rotationCenterX, 0, 'rotationCenterX=0 must not be replaced by a fallback.');
    assert.strictEqual(target.costumes[0].rotationCenterY, 0, 'rotationCenterY=0 must not be replaced by a fallback.');
    assert.strictEqual(target.sounds[0].name, 'Z sound');
    assert.strictEqual(target.sounds[0].rate, 22050);
    assert.strictEqual(target.sounds[0].sampleCount, 10);
    assert.strictEqual(target.tempo, 123);
    assert.strictEqual(target.videoState, 'off');
    assert.strictEqual(target.videoTransparency, 0);
    assert.strictEqual(target.textToSpeechLanguage, 'ja');
    assert.strictEqual(target.blocks.top.comment, 'comment-1');
    assert.deepStrictEqual(target.comments['comment-1'], {
        blockId: 'top',
        x: 3,
        y: 4,
        width: 120,
        height: 80,
        minimized: false,
        text: 'Pinned comment'
    });

    const arrayBuffer = await reconstruction.reconstructSb3FromWorkingTree({fs, dir: root});
    assert(arrayBuffer instanceof ArrayBuffer, 'Reconstruction did not return an ArrayBuffer.');

    const zip = await JSZip.loadAsync(arrayBuffer);
    assert(zip.file('project.json'), 'Reconstructed SB3 is missing project.json.');
    const projectJson = JSON.parse(await zip.file('project.json').async('string'));
    assert.strictEqual(projectJson.targets.length, 1);
    assert.deepStrictEqual(projectJson.extensions, ['pen'],
        'Extension IDs used by reconstructed blocks were not declared in project.json.');
    const reconstructedStage = projectJson.targets[0];

    assert(reconstructedStage.blocks.top, 'Top-level block disappeared from final SB3.');
    assert.strictEqual(reconstructedStage.blocks.top.next, 'say');
    assert.strictEqual(reconstructedStage.blocks.top.mutation.test, 'preserved',
        'Mutation attributes disappeared from serialized project.json.');
    assert.strictEqual(reconstructedStage.blocks.top.mutation.children[0].name, 'nested',
        'Nested mutation children disappeared from serialized project.json.');
    assert.strictEqual(reconstructedStage.blocks.top.comment, 'comment-1',
        'Block-to-comment link disappeared from serialized project.json.');
    assert.deepStrictEqual(reconstructedStage.comments['comment-1'], {
        blockId: 'top',
        x: 3,
        y: 4,
        width: 120,
        height: 80,
        minimized: false,
        text: 'Pinned comment'
    });
    assert(Array.isArray(reconstructedStage.blocks.say.inputs.MESSAGE),
        'Final project.json did not use the serialized SB3 input schema.');

    assert.strictEqual(reconstructedStage.costumes.length, 2);
    assert.strictEqual(reconstructedStage.costumes[0].name, 'Second in filesystem, first in index');
    assert.strictEqual(reconstructedStage.costumes[0].rotationCenterX, 0);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(reconstructedStage.costumes[0], 'file'), false,
        'Working-tree file path leaked into project.json costume metadata.');
    assert.strictEqual(reconstructedStage.sounds.length, 2);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(reconstructedStage.sounds[0], 'file'), false,
        'Working-tree file path leaked into project.json sound metadata.');

    const assetNames = [
        ...reconstructedStage.costumes.map(costume => costume.md5ext),
        ...reconstructedStage.sounds.map(sound => sound.md5ext)
    ];
    assert.strictEqual(assetNames.every(Boolean), true, 'One or more reconstructed assets have no md5ext.');
    assetNames.forEach(assetName => {
        assert(zip.file(assetName), `Referenced asset ${assetName} is missing from the SB3 zip.`);
    });

    assert.strictEqual(reconstructedStage.tempo, 123);
    assert.strictEqual(reconstructedStage.videoState, 'off');
    assert.strictEqual(reconstructedStage.videoTransparency, 0);
    assert.strictEqual(reconstructedStage.textToSpeechLanguage, 'ja');

    const rehydrated = sb3Serialization.deserializeBlocks(
        JSON.parse(JSON.stringify(reconstructedStage.blocks))
    );
    assert(rehydrated.top, 'scratch-vm SB3 deserializer lost the top-level block.');
    assert(rehydrated.say, 'scratch-vm SB3 deserializer lost the next block.');
    assert.strictEqual(rehydrated.top.next, 'say');
    assert.strictEqual(rehydrated.say.next, 'pen');
    assert(rehydrated.pen, 'scratch-vm SB3 deserializer lost the extension block.');
    assert.strictEqual(rehydrated.top.mutation.test, 'preserved');
    assert.strictEqual(rehydrated.top.mutation.children[0].name, 'nested');
    assert(rehydrated.say.inputs.MESSAGE && rehydrated.say.inputs.MESSAGE.block,
        'scratch-vm SB3 deserializer lost the message input.');
    const messageId = rehydrated.say.inputs.MESSAGE.block;
    assert(rehydrated[messageId], 'scratch-vm SB3 deserializer lost the message shadow block.');
    assert.strictEqual(rehydrated[messageId].fields.TEXT.value, 'hello',
        'scratch-vm SB3 deserializer lost the message field value.');

    return {arrayBuffer, assetCount: assetNames.length};
};

const assertMissingAssetFailsClosed = async root => {
    const missingRoot = path.join(root, 'missing-asset-project');
    const stage = await createWorkingTree(missingRoot);
    await fs.promises.unlink(path.join(stage, 'costumes', 'z-last.svg'));

    await assert.rejects(
        reconstruction.reconstructSb3FromWorkingTree({fs, dir: missingRoot}),
        /Failed to reconstruct SB3: Failed to process sprite directory.*Failed to read file.*z-last\.svg/,
        'Missing indexed assets must fail reconstruction rather than silently deleting costumes.'
    );
};

const assertMalformedScriptFailsClosed = async root => {
    const malformedRoot = path.join(root, 'malformed-script-project');
    const stage = await createWorkingTree(malformedRoot);
    await writeFile(path.join(stage, 'scripts', 'main.xml'), '<xml><block id="broken"></xml>');

    await assert.rejects(
        reconstruction.reconstructSb3FromWorkingTree({fs, dir: malformedRoot}),
        /Failed to reconstruct SB3: Failed to process sprite directory.*Failed to parse script.*Malformed XML/,
        'Malformed script XML must fail reconstruction rather than silently producing an empty script.'
    );
};

const assertAssetPathEscapeFailsClosed = async root => {
    const escapedRoot = path.join(root, 'escaped-asset-project');
    const stage = await createWorkingTree(escapedRoot);
    const indexPath = path.join(stage, 'index.json');
    const index = JSON.parse(await fs.promises.readFile(indexPath, 'utf8'));
    index.costumes[0].file = '../index.json';
    await writeFile(indexPath, JSON.stringify(index, null, 2));

    await assert.rejects(
        reconstruction.reconstructSb3FromWorkingTree({fs, dir: escapedRoot}),
        /Asset path escapes costumes directory/,
        'Indexed asset paths must not escape the sprite asset directory.'
    );
};

const assertInvalidIndexFailsClosed = async root => {
    const invalidRoot = path.join(root, 'invalid-index-project');
    const stage = await createWorkingTree(invalidRoot);
    await writeFile(path.join(stage, 'index.json'), '{ this is not JSON }');

    await assert.rejects(
        reconstruction.reconstructSb3FromWorkingTree({fs, dir: invalidRoot}),
        /Failed to reconstruct SB3: Failed to process sprite directory.*Failed to read sprite index/,
        'Invalid index.json must fail reconstruction rather than defaulting to an empty target.'
    );
};

const assertGitSb3ReconstructionContract = async () => withDOMParser(async () => {
    assertBlockGraph();
    assertMalformedXMLFailsClosed();

    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ngvge-r3-'));
    try {
        await assertDuplicateIdsFailClosed(root);
        const endToEnd = await assertEndToEndReconstruction(path.join(root, 'valid-project'));
        await assertMissingAssetFailsClosed(root);
        await assertMalformedScriptFailsClosed(root);
        await assertAssetPathEscapeFailsClosed(root);
        await assertInvalidIndexFailsClosed(root);

        return {
            xmlRootTraversal: true,
            nestedInputsAndNext: true,
            shadowParentIntegrity: true,
            recursiveMutation: true,
            generatedIdLinkIntegrity: true,
            malformedXmlFailsClosed: true,
            duplicateBlockIdsFailClosed: true,
            indexedAssetOrdering: true,
            missingAssetsFailClosed: true,
            assetPathEscapeRejected: true,
            invalidIndexFailsClosed: true,
            endToEndSb3: true,
            scratchVmSerializationRoundTrip: true,
            pinnedCommentPreservation: true,
            extensionIdRecovery: true,
            reconstructedAssetCount: endToEnd.assetCount
        };
    } finally {
        await fs.promises.rm(root, {recursive: true, force: true});
    }
});

module.exports = {assertGitSb3ReconstructionContract};
