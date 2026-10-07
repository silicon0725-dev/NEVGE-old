import * as bitmap from '../../helper/bitmap';
import * as group from '../../helper/group';
import * as guides from '../../helper/guides';
import * as layer from '../../helper/layer';
import * as order from '../../helper/order';
import * as selection from '../../helper/selection';
import * as snapping from '../../helper/snapping';
import * as undo from '../../helper/undo';
import * as view from '../../helper/view';
import Formats from '../../lib/format';
import Modes from '../../lib/modes';

const ScratchPaintRuntimeModules = Object.freeze({
    workspace: Object.freeze({view, layer, guides}),
    document: Object.freeze({bitmap, Formats}),
    interaction: Object.freeze({selection, group, order, snapping}),
    history: Object.freeze({undo}),
    tools: Object.freeze({Modes})
});

export {
    Formats,
    Modes,
    ScratchPaintRuntimeModules,
    bitmap,
    group,
    guides,
    layer,
    order,
    selection,
    snapping,
    undo,
    view
};
