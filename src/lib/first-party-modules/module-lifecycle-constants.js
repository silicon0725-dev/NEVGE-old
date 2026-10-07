/*
 * Leaf lifecycle constants for the first-party module framework.
 *
 * This module intentionally has no imports. Module bootstrap code imports the
 * lifecycle enums from this leaf directly so the manager cannot observe a
 * partially-updated aggregate constants module during incremental builds or
 * patch overlays.
 */

const MODULE_STATES = Object.freeze({
    REGISTERED: 'registered',
    INITIALIZED: 'initialized',
    ENABLING: 'enabling',
    ENABLED: 'enabled',
    DISABLED: 'disabled',
    ERROR: 'error'
});

const MODULE_ENABLE_COMPLETION = Object.freeze({
    IDLE: 'idle',
    PENDING: 'pending',
    COMPLETED: 'completed',
    FAILED: 'failed'
});

module.exports = Object.freeze({
    MODULE_ENABLE_COMPLETION,
    MODULE_STATES
});
