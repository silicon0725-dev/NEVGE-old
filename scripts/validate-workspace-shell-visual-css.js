'use strict';

const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const postcssImport = require('postcss-import');
const postcssVars = require('postcss-simple-vars');
const autoprefixer = require('autoprefixer');

const ROOT = path.resolve(__dirname, '..');
const files = [
    'src/components/workspace-shell/workspace-shell.css',
    'src/components/workspace-dock/workspace-dock.css',
    'src/components/draggable-window/draggable-window.css',
    'src/components/menu-bar/menu-bar.css',
    'src/components/gui/gui.css'
];

const compile = relative => {
    const absolute = path.join(ROOT, relative);
    const css = fs.readFileSync(absolute, 'utf8');
    return postcss([postcssImport, postcssVars, autoprefixer])
        .process(css, {from: absolute})
        .then(() => relative);
};

Promise.all(files.map(compile)).then(compiled => {
    process.stdout.write('WS-0 CSS/PostCSS compilation gate PASS.\n');
    process.stdout.write(`${JSON.stringify({compiled}, null, 2)}\n`);
}).catch(error => {
    error.code = error.code || 'NGVGE_WS0_CSS_POSTCSS_FAILED';
    console.error(error);
    process.exitCode = 1;
});
