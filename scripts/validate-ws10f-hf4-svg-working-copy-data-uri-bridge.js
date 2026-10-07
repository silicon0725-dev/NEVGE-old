const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const checks = [];
const check = (name, pass) => {
    checks.push({name, pass: Boolean(pass)});
    if (!pass) process.exitCode = 1;
};

const transfer = read('src/lib/paint-backends/svg-edit-vector-transfer.js');
const contentProvider = read('src/lib/editor-shell/workspace-resource-content-capability.js');
const tests = read('test/unit/lib/paint-backends/svg-edit-vector-backend.test.js');

check('Resource Content Provider keeps portable data-uri source shape',
    contentProvider.includes("kind: 'data-uri'") && contentProvider.includes('dataUri'));
check('Vector transfer explicitly accepts Paint data-uri content',
    transfer.includes("workingCopy.content.kind === 'data-uri'"));
check('Vector transfer decodes image/svg+xml only',
    transfer.includes("data:image/svg+xml") && transfer.includes('decodeSvgDataUri'));
check('Vector transfer normalizes backend input to svg-text',
    transfer.includes("content: {kind: 'svg-text', text: svgText}"));
check('Vector transfer does not depend on scratch-paint compatibility adapter',
    !transfer.includes('scratch-paint-working-copy-adapter'));
check('Regression covers Resource Provider style base64 SVG data-uri',
    tests.includes('bridges the production Resource Content data-uri shape'));
check('Regression covers percent-encoded SVG data-uri',
    tests.includes('decodes percent-encoded SVG data URIs'));
check('Regression rejects non-SVG data-uri at Vector boundary',
    tests.includes('rejects non-SVG data URIs at the Vector transfer boundary'));

checks.forEach(({name, pass}, index) => {
    console.log(`${pass ? 'PASS' : 'FAIL'} ${index + 1}/${checks.length} ${name}`);
});

if (process.exitCode) {
    console.error(`WS-10F HF4 SVG working-copy data-uri bridge: ${checks.filter(item => item.pass).length}/${checks.length} PASS`);
} else {
    console.log(`WS-10F HF4 SVG working-copy data-uri bridge: ${checks.length}/${checks.length} PASS`);
}
