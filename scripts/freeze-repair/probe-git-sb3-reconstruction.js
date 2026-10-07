#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const loadBabelModule = require('./load-babel-module');

class FakeElement {
    constructor (tagName, attributes = {}, children = []) {
        this.tagName = tagName;
        this._attributes = attributes;
        this.children = children;
        this.textContent = '';
        this.attributes = Object.entries(attributes).map(([name, value]) => ({name, value}));
    }

    getAttribute (name) {
        return Object.prototype.hasOwnProperty.call(this._attributes, name) ? this._attributes[name] : null;
    }
}

const block = new FakeElement('block', {
    id: 'block-1',
    type: 'event_whenflagclicked',
    x: '0',
    y: '0'
});
const xmlRoot = new FakeElement('xml', {}, [block]);

class FakeDOMParser {
    parseFromString () {
        return {children: [xmlRoot]};
    }
}

global.DOMParser = FakeDOMParser;

const originalConsoleError = console.error;
let capturedError = '';
console.error = (...args) => {
    capturedError += args.map(value => value && value.message ? value.message : String(value)).join(' ');
};

try {
    const moduleExports = loadBabelModule(path.resolve(__dirname, '../../src/lib/git/reconstruct-sb3.js'));
    const blocks = moduleExports.parseBlocksFromXML('<xml><block id="block-1" type="event_whenflagclicked"/></xml>');

    assert(blocks['block-1'],
        `Valid XML root lost block-1 during reconstruction.${capturedError ? ` Parser diagnostic: ${capturedError}` : ''}`);
    assert.strictEqual(blocks['block-1'].opcode, 'event_whenflagclicked');
    console.log('PASS: Git SB3 reconstruction preserves a top-level block under <xml>.');
} finally {
    console.error = originalConsoleError;
    delete global.DOMParser;
}
