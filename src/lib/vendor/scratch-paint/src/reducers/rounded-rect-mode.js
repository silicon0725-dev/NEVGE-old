import log from '../log/log';

const CHANGE_ROUNDED_RECT_RADIUS = 'scratch-paint/rounded-rect-mode/CHANGE_ROUNDED_RECT_RADIUS';
const initialState = {cornerRadius: 20};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case CHANGE_ROUNDED_RECT_RADIUS:
        if (isNaN(action.cornerRadius)) {
            log.warn(`Invalid corner radius: ${action.cornerRadius}`);
            return state;
        }
        return {cornerRadius: Math.max(0, action.cornerRadius)};
    default:
        return state;
    }
};

// Action creators ==================================
const changeCornerRadius = function (cornerRadius) {
    return {
        type: CHANGE_ROUNDED_RECT_RADIUS,
        cornerRadius: cornerRadius
    };
};

export {
    reducer as default,
    changeCornerRadius
};
