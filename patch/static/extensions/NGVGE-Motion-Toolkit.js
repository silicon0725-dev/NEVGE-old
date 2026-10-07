// Name: NGVGE Motion Toolkit
// ID: ngvgeMotion
// Description: Deterministic easing, interpolation, cubic Bezier and spring utilities.
// By: NGVGE Team
// License: MIT
// Clean-room implementation inspired by common motion/easing extension patterns.

(function (Scratch) {
    'use strict';

    const Cast = Scratch.Cast;
    const BlockType = Scratch.BlockType;
    const ArgumentType = Scratch.ArgumentType;

    const finite = (value, fallback = 0) => {
        const number = Cast.toNumber(value);
        return Number.isFinite(number) ? number : fallback;
    };

    const clamp = (value, min, max) => {
        let lower = finite(min);
        let upper = finite(max);
        if (lower > upper) [lower, upper] = [upper, lower];
        return Math.min(upper, Math.max(lower, finite(value)));
    };

    const clamp01 = value => clamp(value, 0, 1);

    const bounceOut = t => {
        const n1 = 7.5625;
        const d1 = 2.75;
        if (t < 1 / d1) return n1 * t * t;
        if (t < 2 / d1) {
            const x = t - 1.5 / d1;
            return n1 * x * x + 0.75;
        }
        if (t < 2.5 / d1) {
            const x = t - 2.25 / d1;
            return n1 * x * x + 0.9375;
        }
        const x = t - 2.625 / d1;
        return n1 * x * x + 0.984375;
    };

    const easingFunctions = Object.freeze({
        linear: t => t,
        smoothstep: t => t * t * (3 - 2 * t),
        smootherstep: t => t * t * t * (t * (t * 6 - 15) + 10),
        inQuad: t => t * t,
        outQuad: t => 1 - (1 - t) * (1 - t),
        inOutQuad: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
        inCubic: t => t * t * t,
        outCubic: t => 1 - Math.pow(1 - t, 3),
        inOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
        inQuart: t => t * t * t * t,
        outQuart: t => 1 - Math.pow(1 - t, 4),
        inOutQuart: t => t < 0.5 ? 8 * Math.pow(t, 4) : 1 - Math.pow(-2 * t + 2, 4) / 2,
        inSine: t => 1 - Math.cos((t * Math.PI) / 2),
        outSine: t => Math.sin((t * Math.PI) / 2),
        inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
        inExpo: t => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
        outExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
        inOutExpo: t => {
            if (t === 0 || t === 1) return t;
            return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
        },
        inCirc: t => 1 - Math.sqrt(1 - t * t),
        outCirc: t => Math.sqrt(1 - Math.pow(t - 1, 2)),
        inOutCirc: t => t < 0.5 ?
            (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2 :
            (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2,
        inBack: t => {
            const c1 = 1.70158;
            const c3 = c1 + 1;
            return c3 * t * t * t - c1 * t * t;
        },
        outBack: t => {
            const c1 = 1.70158;
            const c3 = c1 + 1;
            return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
        },
        inOutBack: t => {
            const c1 = 1.70158;
            const c2 = c1 * 1.525;
            return t < 0.5 ?
                (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2 :
                (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (2 * t - 2) + c2) + 2) / 2;
        },
        inElastic: t => {
            if (t === 0 || t === 1) return t;
            const c4 = (2 * Math.PI) / 3;
            return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
        },
        outElastic: t => {
            if (t === 0 || t === 1) return t;
            const c4 = (2 * Math.PI) / 3;
            return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
        },
        inBounce: t => 1 - bounceOut(1 - t),
        outBounce: bounceOut,
        inOutBounce: t => t < 0.5 ?
            (1 - bounceOut(1 - 2 * t)) / 2 :
            (1 + bounceOut(2 * t - 1)) / 2
    });

    const easingMenu = [
        ['linear', 'linear'],
        ['smoothstep', 'smoothstep'],
        ['smootherstep', 'smootherstep'],
        ['ease in quad', 'inQuad'],
        ['ease out quad', 'outQuad'],
        ['ease in-out quad', 'inOutQuad'],
        ['ease in cubic', 'inCubic'],
        ['ease out cubic', 'outCubic'],
        ['ease in-out cubic', 'inOutCubic'],
        ['ease in quart', 'inQuart'],
        ['ease out quart', 'outQuart'],
        ['ease in-out quart', 'inOutQuart'],
        ['ease in sine', 'inSine'],
        ['ease out sine', 'outSine'],
        ['ease in-out sine', 'inOutSine'],
        ['ease in expo', 'inExpo'],
        ['ease out expo', 'outExpo'],
        ['ease in-out expo', 'inOutExpo'],
        ['ease in circ', 'inCirc'],
        ['ease out circ', 'outCirc'],
        ['ease in-out circ', 'inOutCirc'],
        ['ease in back', 'inBack'],
        ['ease out back', 'outBack'],
        ['ease in-out back', 'inOutBack'],
        ['ease in elastic', 'inElastic'],
        ['ease out elastic', 'outElastic'],
        ['ease in bounce', 'inBounce'],
        ['ease out bounce', 'outBounce'],
        ['ease in-out bounce', 'inOutBounce']
    ].map(([text, value]) => ({text, value}));

    const cubicCoordinate = (t, p1, p2) => {
        const omt = 1 - t;
        return 3 * omt * omt * t * p1 + 3 * omt * t * t * p2 + t * t * t;
    };

    const cubicDerivative = (t, p1, p2) => {
        const omt = 1 - t;
        return 3 * omt * omt * p1 + 6 * omt * t * (p2 - p1) + 3 * t * t * (1 - p2);
    };

    const cubicBezierEasing = (progress, x1, y1, x2, y2) => {
        const x = clamp01(progress);
        const cx1 = clamp01(x1);
        const cx2 = clamp01(x2);
        const cy1 = finite(y1);
        const cy2 = finite(y2);
        if (x === 0 || x === 1) return x;

        let t = x;
        for (let i = 0; i < 8; i++) {
            const error = cubicCoordinate(t, cx1, cx2) - x;
            if (Math.abs(error) < 1e-7) break;
            const derivative = cubicDerivative(t, cx1, cx2);
            if (Math.abs(derivative) < 1e-7) break;
            const next = t - error / derivative;
            if (next < 0 || next > 1) break;
            t = next;
        }

        let low = 0;
        let high = 1;
        for (let i = 0; i < 24; i++) {
            const coordinate = cubicCoordinate(t, cx1, cx2);
            if (Math.abs(coordinate - x) < 1e-7) break;
            if (coordinate < x) low = t;
            else high = t;
            t = (low + high) / 2;
        }
        return cubicCoordinate(t, cy1, cy2);
    };

    const springProgress = (time, stiffness, damping, mass) => {
        const t = Math.max(0, finite(time));
        const k = Math.max(1e-6, finite(stiffness, 170));
        const c = Math.max(0, finite(damping, 26));
        const m = Math.max(1e-6, finite(mass, 1));
        const omega0 = Math.sqrt(k / m);
        const zeta = c / (2 * Math.sqrt(k * m));

        let displacement;
        if (zeta < 1 - 1e-6) {
            const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
            displacement = -Math.exp(-zeta * omega0 * t) *
                (Math.cos(omegaD * t) + (zeta * omega0 / omegaD) * Math.sin(omegaD * t));
        } else if (zeta > 1 + 1e-6) {
            const root = Math.sqrt(zeta * zeta - 1);
            const r1 = -omega0 * (zeta - root);
            const r2 = -omega0 * (zeta + root);
            const denominator = r1 - r2;
            displacement = (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / denominator;
        } else {
            displacement = -Math.exp(-omega0 * t) * (1 + omega0 * t);
        }
        return 1 + displacement;
    };

    class NGVGEMotionToolkit {
        getInfo () {
            return {
                id: 'ngvgeMotion',
                name: 'NGVGE Motion Toolkit',
                color1: '#8B5CF6',
                color2: '#7045D1',
                color3: '#5531A7',
                blocks: [
                    {
                        opcode: 'clampValue',
                        blockType: BlockType.REPORTER,
                        text: 'clamp [VALUE] between [MIN] and [MAX]',
                        arguments: {
                            VALUE: {type: ArgumentType.NUMBER, defaultValue: 1.5},
                            MIN: {type: ArgumentType.NUMBER, defaultValue: 0},
                            MAX: {type: ArgumentType.NUMBER, defaultValue: 1}
                        }
                    },
                    {
                        opcode: 'normalizeValue',
                        blockType: BlockType.REPORTER,
                        text: 'normalize [VALUE] from [MIN] to [MAX]',
                        arguments: {
                            VALUE: {type: ArgumentType.NUMBER, defaultValue: 50},
                            MIN: {type: ArgumentType.NUMBER, defaultValue: 0},
                            MAX: {type: ArgumentType.NUMBER, defaultValue: 100}
                        }
                    },
                    {
                        opcode: 'wrapValue',
                        blockType: BlockType.REPORTER,
                        text: 'wrap [VALUE] between [MIN] and [MAX]',
                        arguments: {
                            VALUE: {type: ArgumentType.NUMBER, defaultValue: 370},
                            MIN: {type: ArgumentType.NUMBER, defaultValue: 0},
                            MAX: {type: ArgumentType.NUMBER, defaultValue: 360}
                        }
                    },
                    {
                        opcode: 'pingPong',
                        blockType: BlockType.REPORTER,
                        text: 'ping pong [VALUE]',
                        arguments: {
                            VALUE: {type: ArgumentType.NUMBER, defaultValue: 1.25}
                        }
                    },
                    '---',
                    {
                        opcode: 'lerpValue',
                        blockType: BlockType.REPORTER,
                        text: 'lerp [FROM] to [TO] at [T]',
                        arguments: {
                            FROM: {type: ArgumentType.NUMBER, defaultValue: 0},
                            TO: {type: ArgumentType.NUMBER, defaultValue: 100},
                            T: {type: ArgumentType.NUMBER, defaultValue: 0.5}
                        }
                    },
                    {
                        opcode: 'lerpAngle',
                        blockType: BlockType.REPORTER,
                        text: 'lerp angle [FROM] to [TO] at [T]',
                        arguments: {
                            FROM: {type: ArgumentType.ANGLE, defaultValue: 350},
                            TO: {type: ArgumentType.ANGLE, defaultValue: 10},
                            T: {type: ArgumentType.NUMBER, defaultValue: 0.5}
                        }
                    },
                    {
                        opcode: 'easeValue',
                        blockType: BlockType.REPORTER,
                        text: 'ease [T] using [EASING]',
                        arguments: {
                            T: {type: ArgumentType.NUMBER, defaultValue: 0.5},
                            EASING: {type: ArgumentType.STRING, menu: 'easingMenu', defaultValue: 'inOutCubic'}
                        }
                    },
                    {
                        opcode: 'interpolateValue',
                        blockType: BlockType.REPORTER,
                        text: 'interpolate [FROM] to [TO] at [T] using [EASING]',
                        arguments: {
                            FROM: {type: ArgumentType.NUMBER, defaultValue: 0},
                            TO: {type: ArgumentType.NUMBER, defaultValue: 100},
                            T: {type: ArgumentType.NUMBER, defaultValue: 0.5},
                            EASING: {type: ArgumentType.STRING, menu: 'easingMenu', defaultValue: 'inOutCubic'}
                        }
                    },
                    '---',
                    {
                        opcode: 'cubicBezier',
                        blockType: BlockType.REPORTER,
                        text: 'cubic Bezier x1 [X1] y1 [Y1] x2 [X2] y2 [Y2] at [T]',
                        arguments: {
                            X1: {type: ArgumentType.NUMBER, defaultValue: 0.42},
                            Y1: {type: ArgumentType.NUMBER, defaultValue: 0},
                            X2: {type: ArgumentType.NUMBER, defaultValue: 0.58},
                            Y2: {type: ArgumentType.NUMBER, defaultValue: 1},
                            T: {type: ArgumentType.NUMBER, defaultValue: 0.5}
                        }
                    },
                    {
                        opcode: 'spring',
                        blockType: BlockType.REPORTER,
                        text: 'spring progress at time [TIME] stiffness [STIFFNESS] damping [DAMPING] mass [MASS]',
                        arguments: {
                            TIME: {type: ArgumentType.NUMBER, defaultValue: 0.5},
                            STIFFNESS: {type: ArgumentType.NUMBER, defaultValue: 170},
                            DAMPING: {type: ArgumentType.NUMBER, defaultValue: 26},
                            MASS: {type: ArgumentType.NUMBER, defaultValue: 1}
                        }
                    }
                ],
                menus: {
                    easingMenu: {
                        acceptReporters: true,
                        items: easingMenu
                    }
                }
            };
        }

        clampValue (args) {
            return clamp(args.VALUE, args.MIN, args.MAX);
        }

        normalizeValue (args) {
            const value = finite(args.VALUE);
            const min = finite(args.MIN);
            const max = finite(args.MAX);
            if (min === max) return 0;
            return (value - min) / (max - min);
        }

        wrapValue (args) {
            let min = finite(args.MIN);
            let max = finite(args.MAX);
            if (min > max) [min, max] = [max, min];
            const range = max - min;
            if (range === 0) return min;
            return ((finite(args.VALUE) - min) % range + range) % range + min;
        }

        pingPong (args) {
            const value = ((finite(args.VALUE) % 2) + 2) % 2;
            return value <= 1 ? value : 2 - value;
        }

        lerpValue (args) {
            const from = finite(args.FROM);
            const to = finite(args.TO);
            return from + (to - from) * finite(args.T);
        }

        lerpAngle (args) {
            const from = finite(args.FROM);
            const to = finite(args.TO);
            const delta = ((to - from + 180) % 360 + 360) % 360 - 180;
            return from + delta * finite(args.T);
        }

        easeValue (args) {
            const t = clamp01(args.T);
            const easing = easingFunctions[Cast.toString(args.EASING)] || easingFunctions.linear;
            return easing(t);
        }

        interpolateValue (args) {
            const from = finite(args.FROM);
            const to = finite(args.TO);
            const eased = this.easeValue(args);
            return from + (to - from) * eased;
        }

        cubicBezier (args) {
            return cubicBezierEasing(args.T, args.X1, args.Y1, args.X2, args.Y2);
        }

        spring (args) {
            return springProgress(args.TIME, args.STIFFNESS, args.DAMPING, args.MASS);
        }
    }

    Scratch.extensions.register(new NGVGEMotionToolkit());
})(Scratch);
