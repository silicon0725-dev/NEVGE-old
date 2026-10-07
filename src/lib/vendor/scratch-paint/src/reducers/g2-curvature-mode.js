import log from '../log/log';

const CHANGE_G2_CORNER_RADIUS = 'scratch-paint/g2-curvature-mode/CHANGE_G2_CORNER_RADIUS';
const CHANGE_G2_SMOOTHING = 'scratch-paint/g2-curvature-mode/CHANGE_G2_SMOOTHING';

const initialState = {
    cornerRadius: 20,
    smoothing: 0.75
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case CHANGE_G2_CORNER_RADIUS:
        if (isNaN(action.cornerRadius)) {
            log.warn(`Invalid corner radius: ${action.cornerRadius}`);
            return state;
        }
        return {
            ...state,
            cornerRadius: Math.max(0, action.cornerRadius)
        };
    case CHANGE_G2_SMOOTHING:
        if (isNaN(action.smoothing)) {
            log.warn(`Invalid smoothing: ${action.smoothing}`);
            return state;
        }
        const smoothingValue = Math.max(0, Math.min(1, action.smoothing));
        return {
            ...state,
            smoothing: smoothingValue
        };
    default:
        return state;
    }
};

// Action creators ==================================
const changeG2CornerRadius = function (cornerRadius) {
    return {
        type: CHANGE_G2_CORNER_RADIUS,
        cornerRadius: cornerRadius
    };
};

const changeG2Smoothing = function (smoothing) {
    return {
        type: CHANGE_G2_SMOOTHING,
        smoothing: smoothing
    };
};

export {
    reducer as default,
    changeG2CornerRadius,
    changeG2Smoothing
};
