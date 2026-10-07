'use strict';

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const postcssImport = require('postcss-import');
const postcssVars = require('postcss-simple-vars');
const autoprefixer = require('autoprefixer');

const ROOT = path.resolve(__dirname, '..');
const files = [
    'src/components/target-pane/target-pane.css',
    'src/components/gui/gui.css',
    'src/components/project-explorer/project-explorer.css'
];

const compile = relative => {
    const absolute = path.join(ROOT, relative);
    const css = fs.readFileSync(absolute, 'utf8');
    return postcss([postcssImport, postcssVars, autoprefixer])
        .process(css, {from: absolute})
        .then(() => relative);
};

Promise.all(files.map(compile)).then(compiled => {
    process.stdout.write('RE-5 CSS/PostCSS compilation gate PASS.\n');
    process.stdout.write(`${JSON.stringify({compiled}, null, 2)}\n`);
}).catch(error => {
    error.code = error.code || 'NGVGE_RE5_CSS_POSTCSS_FAILED';
    console.error(error);
    process.exitCode = 1;
});
