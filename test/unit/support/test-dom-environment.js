/* eslint-env node */
const document = require('min-document');
const DOMElement = require('min-document/dom-element');

const matchesAttributeSelector = (element, selector) => {
    const match = /^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/.exec(selector.trim());
    if (!match) return false;
    const actual = element.getAttribute(match[1]);
    return typeof match[2] === 'undefined' ? actual !== null : actual === match[2];
};

if (typeof DOMElement.prototype.closest !== 'function') {
    DOMElement.prototype.closest = function closest(selectorList) {
        const selectors = String(selectorList || '').split(',').map(selector => selector.trim()).filter(Boolean);
        let current = this;
        while (current && current.nodeType === 1) {
            if (selectors.some(selector => matchesAttributeSelector(current, selector))) return current;
            current = current.parentNode;
        }
        return null;
    };
}

const originalFocus = DOMElement.prototype.focus;
DOMElement.prototype.focus = function focus() {
    if (this.ownerDocument) this.ownerDocument.activeElement = this;
    return originalFocus ? originalFocus.call(this) : undefined;
};

if (!Object.getOwnPropertyDescriptor(DOMElement.prototype, 'innerHTML')) {
    Object.defineProperty(DOMElement.prototype, 'innerHTML', {
        configurable: true,
        get() {
            return this.childNodes.map(child => String(child)).join('');
        },
        set(value) {
            while (this.childNodes.length) this.removeChild(this.childNodes[this.childNodes.length - 1]);
            if (value) this.appendChild(this.ownerDocument.createTextNode(String(value)));
        }
    });
}

if (!Object.getOwnPropertyDescriptor(DOMElement.prototype, 'parentElement')) {
    Object.defineProperty(DOMElement.prototype, 'parentElement', {
        configurable: true,
        get() {
            return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null;
        }
    });
}

class TestEvent {
    constructor(type, options = {}) {
        this.type = type;
        this.bubbles = Boolean(options.bubbles);
        this.cancelable = Boolean(options.cancelable);
        this.defaultPrevented = false;
        this.isComposing = Boolean(options.isComposing);
        Object.assign(this, options);
    }

    preventDefault() {
        if (this.cancelable) this.defaultPrevented = true;
    }

    stopPropagation() {
        this.cancelBubble = true;
    }
}

class TestMouseEvent extends TestEvent {}
class TestKeyboardEvent extends TestEvent {}

document.documentElement.parentNode = document;

const windowTarget = document.createElement('window');
windowTarget.document = document;
windowTarget.setTimeout = setTimeout;
windowTarget.clearTimeout = clearTimeout;
windowTarget.setInterval = setInterval;
windowTarget.clearInterval = clearInterval;
windowTarget.requestAnimationFrame = callback => setTimeout(() => callback(Date.now()), 0);
windowTarget.cancelAnimationFrame = clearTimeout;
windowTarget.innerWidth = 1280;
windowTarget.innerHeight = 720;
windowTarget.alert = () => {};
windowTarget.confirm = () => true;
windowTarget.Event = TestEvent;
windowTarget.MouseEvent = TestMouseEvent;
windowTarget.KeyboardEvent = TestKeyboardEvent;
windowTarget.HTMLElement = DOMElement;
windowTarget.Node = {ELEMENT_NODE: 1, DOCUMENT_NODE: 9};
windowTarget.navigator = {userAgent: 'node.js'};
windowTarget.performance = global.performance || {now: () => Date.now()};
windowTarget.Element = DOMElement;
windowTarget.SVGElement = DOMElement;
windowTarget.HTMLIFrameElement = DOMElement;
windowTarget.HTMLTemplateElement = DOMElement;

document.defaultView = windowTarget;
document.activeElement = document.body;

global.MessageChannel = undefined;
global.document = document;
global.window = windowTarget;
global.navigator = windowTarget.navigator;
global.Event = TestEvent;
global.MouseEvent = TestMouseEvent;
global.KeyboardEvent = TestKeyboardEvent;
global.HTMLElement = DOMElement;
global.Element = DOMElement;
global.SVGElement = DOMElement;
global.Node = windowTarget.Node;
global.requestAnimationFrame = windowTarget.requestAnimationFrame;
global.cancelAnimationFrame = windowTarget.cancelAnimationFrame;
