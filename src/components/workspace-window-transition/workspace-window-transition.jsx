import PropTypes from 'prop-types';
import React from 'react';

import {
    WORKSPACE_DOCK_TRANSITION_MODEL_ID,
    DOCK_TRANSITION_KINDS
} from '../../lib/editor-shell/dock-transition-model';

import styles from './workspace-window-transition.css';

const rectStyle = rect => ({
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`
});

const prefersReducedMotion = () => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

const setRestoreWindowHidden = (windowId, hidden) => {
    if (typeof document === 'undefined') return;
    const elements = document.querySelectorAll('[data-ngvge-window-id]');
    for (const element of elements) {
        if (element.getAttribute('data-ngvge-window-id') !== windowId) continue;
        if (hidden) element.setAttribute('data-ngvge-presentation-hidden', 'true');
        else element.removeAttribute('data-ngvge-presentation-hidden');
    }
};

const TransitionGhost = ({transition, transitionModel}) => {
    const [arrived, setArrived] = React.useState(false);
    const completedRef = React.useRef(false);
    const frameRef = React.useRef(null);
    const timeoutRef = React.useRef(null);

    const complete = React.useCallback(() => {
        if (completedRef.current) return;
        completedRef.current = true;
        setRestoreWindowHidden(transition.windowId, false);
        transitionModel.completeTransition(transition.transitionId);
    }, [transition.transitionId, transition.windowId, transitionModel]);

    React.useEffect(() => {
        if (prefersReducedMotion() || transition.durationMs === 0) {
            complete();
            return () => {};
        }
        if (transition.kind === DOCK_TRANSITION_KINDS.RESTORE) {
            setRestoreWindowHidden(transition.windowId, true);
        }
        frameRef.current = requestAnimationFrame(() => {
            frameRef.current = requestAnimationFrame(() => setArrived(true));
        });
        timeoutRef.current = setTimeout(complete, transition.durationMs + 120);
        return () => {
            if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
            if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
            setRestoreWindowHidden(transition.windowId, false);
        };
    }, [complete, transition.durationMs, transition.kind, transition.windowId]);

    const geometry = arrived ? transition.to : transition.from;
    return (
        <div
            aria-hidden="true"
            className={styles.ghost}
            data-kind={transition.kind}
            data-ngvge-dock-transition-id={transition.transitionId}
            data-ngvge-dock-transition-window-id={transition.windowId}
            style={{
                ...rectStyle(geometry),
                '--ngvge-dock-transition-duration': `${transition.durationMs}ms`
            }}
            onTransitionEnd={complete}
        >
            <div className={styles.ghostHeader} />
            <div className={styles.ghostBody} />
        </div>
    );
};

TransitionGhost.propTypes = {
    transition: PropTypes.shape({
        durationMs: PropTypes.number.isRequired,
        from: PropTypes.object.isRequired,
        kind: PropTypes.string.isRequired,
        to: PropTypes.object.isRequired,
        transitionId: PropTypes.string.isRequired,
        windowId: PropTypes.string.isRequired
    }).isRequired,
    transitionModel: PropTypes.shape({
        completeTransition: PropTypes.func.isRequired
    }).isRequired
};

const WorkspaceWindowTransitionLayer = ({transitionModel}) => {
    const [revision, setRevision] = React.useState(transitionModel.revision);
    React.useEffect(() => transitionModel.subscribe(event => {
        setRevision(event.revision);
    }), [transitionModel]);
    const transitions = React.useMemo(
        () => transitionModel.listTransitions(),
        [revision, transitionModel]
    );
    if (transitions.length === 0) return null;
    return (
        <div
            aria-hidden="true"
            className={styles.layer}
            data-ngvge-dock-transition-model={WORKSPACE_DOCK_TRANSITION_MODEL_ID}
            data-ngvge-dock-transition-revision={revision}
        >
            {transitions.map(transition => (
                <TransitionGhost
                    key={transition.transitionId}
                    transition={transition}
                    transitionModel={transitionModel}
                />
            ))}
        </div>
    );
};

WorkspaceWindowTransitionLayer.propTypes = {
    transitionModel: PropTypes.shape({
        id: PropTypes.string.isRequired,
        listTransitions: PropTypes.func.isRequired,
        revision: PropTypes.number.isRequired,
        subscribe: PropTypes.func.isRequired
    }).isRequired
};

export default WorkspaceWindowTransitionLayer;
