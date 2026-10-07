const createObserverErrorRecorder = (onObserverError = null, options = {}) => {
    let count = 0;
    let lastError = null;
    const record = (error, context) => {
        count += 1;
        lastError = error;
        if (typeof onObserverError === 'function') {
            try {
                onObserverError(error, context);
            } catch {
                // Observer-error reporting is diagnostic only and cannot affect semantic operations.
            }
        }
    };
    const enterDispatch = typeof options.enterDispatch === 'function' ? options.enterDispatch : () => {};
    const leaveDispatch = typeof options.leaveDispatch === 'function' ? options.leaveDispatch : () => {};
    return Object.freeze({
        dispatch (listeners, payload, context = {}) {
            enterDispatch(context);
            try {
                listeners.forEach(listener => {
                    try {
                        listener(payload);
                    } catch (error) {
                        record(error, context);
                    }
                });
            } finally {
                leaveDispatch(context);
            }
        },
        recordError (error, context = {}) {
            record(error, context);
        },
        getSnapshot () {
            return Object.freeze({count, lastError});
        }
    });
};

module.exports = {createObserverErrorRecorder};
