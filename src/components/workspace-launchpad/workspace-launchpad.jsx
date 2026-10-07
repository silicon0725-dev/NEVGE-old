import PropTypes from 'prop-types';
import React from 'react';

import {
    LAUNCHPAD_SECTIONS,
    WORKSPACE_LAUNCHPAD_MODEL_ID
} from '../../lib/editor-shell/launchpad-model';

import styles from './workspace-launchpad.css';

const SECTION_LABELS = Object.freeze({
    [LAUNCHPAD_SECTIONS.ALL]: 'All Tools',
    [LAUNCHPAD_SECTIONS.PINNED]: 'Pinned',
    [LAUNCHPAD_SECTIONS.RECENT]: 'Recent',
    [LAUNCHPAD_SECTIONS.FIRST_PARTY]: 'First-party',
    [LAUNCHPAD_SECTIONS.EXTENSIONS]: 'Extensions',
    [LAUNCHPAD_SECTIONS.DEVELOPER]: 'Developer',
    [LAUNCHPAD_SECTIONS.COMPATIBILITY]: 'Compatibility'
});

const SECTION_ORDER = Object.freeze([
    LAUNCHPAD_SECTIONS.ALL,
    LAUNCHPAD_SECTIONS.PINNED,
    LAUNCHPAD_SECTIONS.RECENT,
    LAUNCHPAD_SECTIONS.FIRST_PARTY,
    LAUNCHPAD_SECTIONS.EXTENSIONS,
    LAUNCHPAD_SECTIONS.DEVELOPER,
    LAUNCHPAD_SECTIONS.COMPATIBILITY
]);

const ToolGlyph = ({iconKey}) => {
    const paths = {
        'node-explorer': <path d="M5 5h10M6 6l3 8m5-8l-3 8M7 15h6" />,
        'inspector': <path d="M4 5h12M4 10h12M4 15h12M8 3v4m5 1v4m-6 1v4" />,
        'assets': <path d="M3.5 5.5h5l1.5 2h6.5v8.5h-13zM3.5 7.5h13" />,
        'stage': <path d="M3.2 3.2h13.6v13.6H3.2zM7 7h6v6H7z" />,
        'legacy-sprites': <path d="M3 4h14v12H3zM6 9h4M12 8h3m-3 3h3" />,
        'agent': <path d="M5 7.5a5 5 0 0110 0v3a5 5 0 01-10 0zM7 15.5h6M10 13v2.5M8 8.5h.01M12 8.5h.01M8 11h4" />,
        'todo': <path d="M3.5 3.5h13v13h-13zM6.5 7.5l1.2 1.2 2.1-2.3M11.5 7.5h2M6.5 12h.01M9 12h4.5" />,
        'paint': <path d="M4 15.5l3.2-.7 7.7-7.7-2-2-7.7 7.7zM11.9 6.1l2 2M14.5 4.5l1-1 1.9 1.9-1 1" />,
        'editor': <path d="M3 3.5h14v13H3zM6 7h8M6 10h5M6 13h7" />
    };
    return (
        <svg
            aria-hidden="true"
            className={styles.toolGlyph}
            viewBox="0 0 20 20"
        >
            <g
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.45"
            >
                {paths[iconKey] || <React.Fragment>
                    <rect
                        x="4"
                        y="4"
                        width="12"
                        height="12"
                        rx="2"
                    />
                    <path d="M7 7h6M7 10h6M7 13h4" />
                </React.Fragment>}
            </g>
        </svg>
    );
};

ToolGlyph.propTypes = {
    iconKey: PropTypes.string
};

const PinGlyph = () => (
    <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
    >
        <path d="M5.2 2.7h5.6l-.8 3 1.7 1.7v1H8.7v4.9L8 14l-.7-.7V8.4H4.3v-1L6 5.7z" />
    </svg>
);

const CloseGlyph = () => (
    <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
    >
        <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
);

const LaunchpadCard = ({entry, interactionController}) => {
    const statusText = entry.running ?
        (entry.minimized ? 'Minimized' : (entry.active ? 'Active' : 'Running')) :
        'Ready';
    const handleActivate = React.useCallback(() => {
        interactionController.activateTool(entry.toolId);
    }, [entry.toolId, interactionController]);
    const handlePin = React.useCallback(event => {
        event.stopPropagation();
        interactionController.togglePin(entry.toolId);
    }, [entry.toolId, interactionController]);
    return (
        <div
            className={styles.card}
            data-active={entry.active ? 'true' : 'false'}
            data-minimized={entry.minimized ? 'true' : 'false'}
            data-pinned={entry.pinned ? 'true' : 'false'}
            data-running={entry.running ? 'true' : 'false'}
            data-tool-id={entry.toolId}
        >
            <button
                aria-label={`Open ${entry.title}`}
                className={styles.cardMain}
                title={entry.title}
                type="button"
                onClick={handleActivate}
            >
                <span className={styles.glyphShell}>
                    <ToolGlyph iconKey={entry.iconKey} />
                    <span
                        aria-hidden="true"
                        className={styles.statusDot}
                    />
                </span>
                <span className={styles.cardCopy}>
                    <span className={styles.cardTitle}>{entry.title}</span>
                    <span className={styles.cardMeta}>
                        {statusText}
                    </span>
                </span>
            </button>
            <button
                aria-label={entry.pinned ? `Unpin ${entry.title}` : `Pin ${entry.title}`}
                aria-pressed={entry.pinned}
                className={styles.cardPin}
                title={entry.pinned ? `Unpin ${entry.title}` : `Pin ${entry.title}`}
                type="button"
                onClick={handlePin}
            >
                <PinGlyph />
            </button>
        </div>
    );
};

LaunchpadCard.propTypes = {
    entry: PropTypes.shape({
        active: PropTypes.bool.isRequired,
        iconKey: PropTypes.string,
        minimized: PropTypes.bool.isRequired,
        pinned: PropTypes.bool.isRequired,
        running: PropTypes.bool.isRequired,
        title: PropTypes.string.isRequired,
        toolId: PropTypes.string.isRequired
    }).isRequired,
    interactionController: PropTypes.shape({
        activateTool: PropTypes.func.isRequired,
        togglePin: PropTypes.func.isRequired
    }).isRequired
};

const LaunchpadSectionButton = ({count, label, onSelect, sectionId, selected}) => {
    const handleClick = React.useCallback(() => {
        onSelect(sectionId);
    }, [onSelect, sectionId]);
    return (
        <button
            aria-selected={selected}
            className={styles.sectionButton}
            data-selected={selected ? 'true' : 'false'}
            role="tab"
            type="button"
            onClick={handleClick}
        >
            <span>{label}</span>
            <span className={styles.sectionCount}>{count}</span>
        </button>
    );
};

LaunchpadSectionButton.propTypes = {
    count: PropTypes.number.isRequired,
    label: PropTypes.string.isRequired,
    onSelect: PropTypes.func.isRequired,
    sectionId: PropTypes.string.isRequired,
    selected: PropTypes.bool.isRequired
};

const WorkspaceLaunchpad = ({interactionController, launchpadModel, onClose, placement}) => {
    const [revision, setRevision] = React.useState(launchpadModel.revision);
    const [section, setSection] = React.useState(LAUNCHPAD_SECTIONS.ALL);
    const [query, setQuery] = React.useState('');
    const searchRef = React.useRef(null);

    React.useEffect(() => launchpadModel.subscribe(event => setRevision(event.revision)), [launchpadModel]);
    React.useEffect(() => {
        if (searchRef.current) searchRef.current.focus();
    }, []);
    React.useEffect(() => {
        const handleKeyDown = event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            }
        };
        if (typeof document === 'undefined') return () => {};
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleQueryChange = React.useCallback(event => {
        setQuery(event.target.value);
    }, []);
    const handleSectionSelect = React.useCallback(sectionId => {
        setSection(sectionId);
    }, []);

    const snapshot = React.useMemo(
        () => launchpadModel.getSnapshot({section, query}),
        [launchpadModel, query, revision, section]
    );

    return (
        <section
            aria-label="Workspace Launchpad"
            aria-modal="false"
            className={styles.launchpad}
            data-ngvge-launchpad-model={WORKSPACE_LAUNCHPAD_MODEL_ID}
            data-ngvge-launchpad-revision={revision}
            data-placement={placement.placement}
            role="dialog"
        >
            <header className={styles.header}>
                <div>
                    <div className={styles.eyebrow}>{'Workspace'}</div>
                    <h2 className={styles.title}>{'Launchpad'}</h2>
                </div>
                <button
                    aria-label="Close Launchpad"
                    className={styles.closeButton}
                    type="button"
                    onClick={onClose}
                >
                    <CloseGlyph />
                </button>
            </header>
            <label className={styles.searchShell}>
                <span
                    aria-hidden="true"
                    className={styles.searchIcon}
                >
                    <svg viewBox="0 0 16 16">
                        <circle
                            cx="7"
                            cy="7"
                            r="4"
                        />
                        <path d="M10.2 10.2L14 14" />
                    </svg>
                </span>
                <span className={styles.srOnly}>{'Search tools'}</span>
                <input
                    ref={searchRef}
                    className={styles.searchInput}
                    placeholder="Search tools"
                    type="search"
                    value={query}
                    onChange={handleQueryChange}
                />
            </label>
            <div
                aria-label="Launchpad categories"
                className={styles.sections}
                role="tablist"
            >
                {SECTION_ORDER.map(sectionId => (
                    <LaunchpadSectionButton
                        count={snapshot.counts[sectionId]}
                        key={sectionId}
                        label={SECTION_LABELS[sectionId]}
                        sectionId={sectionId}
                        selected={section === sectionId}
                        onSelect={handleSectionSelect}
                    />
                ))}
            </div>
            <div className={styles.resultsHeader}>
                <span>{SECTION_LABELS[section]}</span>
                <span>{snapshot.entries.length}{' tools'}</span>
            </div>
            {snapshot.entries.length > 0 ? (
                <div className={styles.grid}>
                    {snapshot.entries.map(entry => (
                        <LaunchpadCard
                            entry={entry}
                            interactionController={interactionController}
                            key={entry.toolId}
                        />
                    ))}
                </div>
            ) : (
                <div className={styles.emptyState}>
                    <strong>{'No tools here'}</strong>
                    <span>{query ? 'Try a different search.' : 'This category is currently empty.'}</span>
                </div>
            )}
        </section>
    );
};

WorkspaceLaunchpad.propTypes = {
    interactionController: PropTypes.shape({
        activateTool: PropTypes.func.isRequired,
        togglePin: PropTypes.func.isRequired
    }).isRequired,
    launchpadModel: PropTypes.shape({
        getSnapshot: PropTypes.func.isRequired,
        id: PropTypes.string.isRequired,
        revision: PropTypes.number.isRequired,
        subscribe: PropTypes.func.isRequired
    }).isRequired,
    onClose: PropTypes.func.isRequired,
    placement: PropTypes.shape({
        placement: PropTypes.string.isRequired
    }).isRequired
};

export default WorkspaceLaunchpad;
