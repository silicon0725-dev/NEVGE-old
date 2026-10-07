const {RuntimeNode2D} = require('./runtime-node');

/**
 * Backend-independent semantic Sprite node.
 *
 * Rendering, Scratch Target ownership and future native sprite execution are
 * provided by components/adapters. This class intentionally carries no
 * Scratch, renderer or backend handle.
 */
class SpriteRuntimeNode extends RuntimeNode2D {}

module.exports = {
    SpriteRuntimeNode
};