import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

import Modal from '../../containers/modal.jsx';

import styles from './extension-center.css';

const activateOnKeyboard = callback => event => {
    if (event.currentTarget !== event.target) return;
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        callback();
    }
};

class ExtensionCard extends React.PureComponent {
    constructor (props) {
        super(props);
        this.state = {imageFailed: false};
    }
    render () {
        const {
            actionLabel,
            favorite,
            item,
            onFavorite,
            onSelect,
            onSelectionToggle,
            selectable,
            selected
        } = this.props;
        const sourceId = item.ngvgeManifest?.source?.id || item.source || 'other';
        const kind = item.ngvgeManifest?.kind || 'legacy-extension';
        const fallbackText = typeof item.name === 'string' && item.name ? item.name.slice(0, 2).toUpperCase() : 'EX';
        const credits = Array.isArray(item.credits) ? item.credits.slice(0, 2) : [];
        const selectItem = () => {
            if (!item.disabled) onSelect(item);
        };
        const handleCardClick = event => {
            if (event.target.closest && event.target.closest('a')) return;
            selectItem();
        };

        return (
            <article
                aria-disabled={item.disabled}
                className={classNames(styles.extensionCard, {
                    [styles.extensionCardDisabled]: item.disabled,
                    [styles.extensionCardInstalled]: item.isInstalled,
                    [styles.extensionCardSelected]: selected
                })}
                role="button"
                tabIndex={item.disabled ? -1 : 0}
                onClick={handleCardClick}
                onKeyDown={activateOnKeyboard(selectItem)}
            >
                <div className={styles.cardVisual}>
                    <div className={styles.cardIconFallback}>{fallbackText}</div>
                    {!this.state.imageFailed && item.rawURL ? (
                        <img
                            alt=""
                            className={styles.cardIcon}
                            draggable={false}
                            src={item.rawURL}
                            onError={() => this.setState({imageFailed: true})}
                        />
                    ) : null}
                    <div className={styles.cardSourceBadge} data-source={sourceId}>
                        {item.sourceLabel}
                    </div>
                    <button
                        aria-label="Favorite extension"
                        className={classNames(styles.favoriteButton, {
                            [styles.favoriteButtonActive]: favorite
                        })}
                        type="button"
                        onClick={event => {
                            event.stopPropagation();
                            onFavorite(item);
                        }}
                    >
                        {favorite ? '★' : '☆'}
                    </button>
                </div>
                <div className={styles.cardBody}>
                    <div className={styles.cardTitleRow}>
                        <h3 className={styles.cardTitle}>{item.name}</h3>
                        {item.isInstalled ? <span className={styles.installedMark}>✓</span> : null}
                    </div>
                    <div className={styles.cardDescription}>{item.description}</div>
                    <div className={styles.cardBadgeRow}>
                        {sourceId === 'ngvge' ? <span className={styles.officialBadge}>NGVGE Official</span> : null}
                        <span className={styles.kindBadge}>{kind === 'ngvge-native' ? 'Native' : 'Compatible'}</span>
                        {item.moduleAvailability === 'experimental' ? (
                            <span className={styles.warningBadge}>Experimental</span>
                        ) : null}
                        {item.sb3CompatibilityLevel === 'partial' ? (
                            <span className={styles.warningBadge}>Partial SB3</span>
                        ) : null}
                        {item.moduleError ? <span className={styles.warningBadge}>Module error</span> : null}
                        {!item.isCompatible ? <span className={styles.warningBadge}>NGVGE only</span> : null}
                    </div>
                    {credits.length ? (
                        <div className={styles.cardCredits}>
                            <span>By </span>
                            {credits.map((credit, index) => (
                                <React.Fragment key={index}>
                                    {credit}
                                    {index < credits.length - 1 ? ', ' : null}
                                </React.Fragment>
                            ))}
                        </div>
                    ) : null}
                </div>
                <div className={styles.cardFooter}>
                    <button
                        className={classNames(styles.cardActionButton, {
                            [styles.cardActionButtonInstalled]: item.isInstalled,
                            [styles.cardActionButtonModuleDisable]: item.isFirstPartyModule && item.isInstalled
                        })}
                        disabled={item.disabled}
                        type="button"
                        onClick={event => {
                            event.stopPropagation();
                            selectItem();
                        }}
                    >
                        {actionLabel}
                    </button>
                    {selectable ? (
                        <button
                            aria-label="Select extension for batch import"
                            className={classNames(styles.selectionButton, {
                                [styles.selectionButtonActive]: selected
                            })}
                            type="button"
                            onClick={event => {
                                event.stopPropagation();
                                onSelectionToggle(item);
                            }}
                        >
                            {selected ? '✓' : '+'}
                        </button>
                    ) : null}
                </div>
            </article>
        );
    }
}

ExtensionCard.propTypes = {
    actionLabel: PropTypes.node,
    favorite: PropTypes.bool,
    item: PropTypes.object.isRequired,
    onFavorite: PropTypes.func.isRequired,
    onSelect: PropTypes.func.isRequired,
    onSelectionToggle: PropTypes.func.isRequired,
    selectable: PropTypes.bool,
    selected: PropTypes.bool
};

const ExtensionCenter = props => {
    const selectItem = item => {
        props.onRequestClose();
        props.onItemSelected(item);
    };

    return (
        <Modal
            className={styles.extensionCenterModal}
            contentLabel={props.title}
            fullScreen
            id="extensionLibrary"
            onRequestClose={props.onRequestClose}
        >
            <div className={styles.extensionCenter}>
                <header className={styles.centerHeader}>
                    <div className={styles.headerIdentity}>
                        <div className={styles.headerMark}>N</div>
                        <div>
                            <h1 className={styles.headerTitle}>{props.title}</h1>
                            <div className={styles.headerSubtitle}>{props.subtitle}</div>
                        </div>
                    </div>
                    <div className={styles.headerTools}>
                        <label className={styles.searchBox}>
                            <span className={styles.searchIcon}>⌕</span>
                            <input
                                aria-label="Search extensions"
                                placeholder={props.searchPlaceholder}
                                type="search"
                                value={props.query}
                                onChange={event => props.onQueryChange(event.target.value)}
                            />
                            {props.query ? (
                                <button
                                    aria-label="Clear search"
                                    className={styles.searchClear}
                                    type="button"
                                    onClick={props.onQueryClear}
                                >
                                    ×
                                </button>
                            ) : null}
                        </label>
                        <label className={styles.sortControl}>
                            <span>{props.sortLabel}</span>
                            <select value={props.sortMode} onChange={props.onSortChange}>
                                {props.sortOptions.map(option => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </label>
                        {props.headerAction ? <div className={styles.headerActions}>{props.headerAction}</div> : null}
                    </div>
                </header>

                <div className={styles.centerBody}>
                    <aside className={styles.centerSidebar}>
                        {props.sidebarGroups.map(group => (
                            <section className={styles.sidebarGroup} key={group.key}>
                                <div className={styles.sidebarGroupTitle}>{group.title}</div>
                                <div className={styles.sidebarItems}>
                                    {group.items.map(item => (
                                        <button
                                            className={classNames(styles.sidebarItem, {
                                                [styles.sidebarItemActive]: item.active,
                                                [styles.sidebarItemDisabled]: item.disabled
                                            })}
                                            disabled={item.disabled}
                                            key={item.key}
                                            title={item.description || item.label}
                                            type="button"
                                            onClick={item.onClick}
                                        >
                                            <span className={styles.sidebarItemIcon}>{item.icon}</span>
                                            <span className={styles.sidebarItemLabel}>{item.label}</span>
                                            {typeof item.count === 'number' ? (
                                                <span className={styles.sidebarItemCount}>{item.count}</span>
                                            ) : null}
                                            {item.status ? <span className={styles.sidebarItemStatus}>{item.status}</span> : null}
                                        </button>
                                    ))}
                                </div>
                            </section>
                        ))}
                        {props.sidebarExtra ? <div className={styles.sidebarExtra}>{props.sidebarExtra}</div> : null}
                        <button
                            className={styles.customExtensionButton}
                            type="button"
                            onClick={props.onOpenCustomExtension}
                        >
                            <span>＋</span>
                            <span>{props.customExtensionLabel}</span>
                        </button>
                    </aside>

                    <main className={styles.centerMain}>
                        {props.showOverview ? (
                            <section className={styles.overviewPanel}>
                                <div className={styles.overviewCopy}>
                                    <div className={styles.overviewEyebrow}>NGVGE ECOSYSTEM</div>
                                    <h2>Build the editor and runtime you need.</h2>
                                    <p>
                                        Discover NGVGE-native modules while keeping access to the Scratch,
                                        TurboWarp and community extension ecosystems.
                                    </p>
                                </div>
                                <div className={styles.overviewStats}>
                                    {props.summary.map(stat => (
                                        <div className={styles.overviewStat} key={stat.key}>
                                            <strong>{stat.value}</strong>
                                            <span>{stat.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ) : null}

                        <div className={styles.filterStrip}>
                            <div className={styles.filterChips}>
                                {props.filterChips.map(chip => (
                                    <button
                                        className={classNames(styles.filterChip, {
                                            [styles.filterChipActive]: chip.active
                                        })}
                                        key={chip.key}
                                        type="button"
                                        onClick={chip.onClick}
                                    >
                                        {chip.label}
                                    </button>
                                ))}
                            </div>
                            <div className={styles.resultCount}>{props.resultLabel}</div>
                        </div>

                        <div className={styles.extensionScrollArea}>
                            {props.sections.length ? props.sections.map(section => (
                                <section className={styles.extensionSection} key={section.key}>
                                    <div className={styles.sectionHeading}>
                                        <div>
                                            <h2>{section.title}</h2>
                                            {section.description ? <p>{section.description}</p> : null}
                                        </div>
                                        <span>{section.items.length}</span>
                                    </div>
                                    <div className={styles.extensionGrid}>
                                        {section.items.map(item => (
                                            <ExtensionCard
                                                actionLabel={props.getActionLabel(item)}
                                                favorite={props.isFavorite(item)}
                                                item={item}
                                                key={item.favoriteKey || item.extensionId || item.rawURL}
                                                selectable={props.isItemSelectable(item)}
                                                selected={props.isItemSelected(item)}
                                                onFavorite={props.onFavorite}
                                                onSelect={selectItem}
                                                onSelectionToggle={props.onSelectionToggle}
                                            />
                                        ))}
                                    </div>
                                </section>
                            )) : props.emptyState}
                        </div>
                    </main>
                </div>
            </div>
        </Modal>
    );
};

ExtensionCenter.propTypes = {
    customExtensionLabel: PropTypes.node,
    emptyState: PropTypes.node,
    filterChips: PropTypes.arrayOf(PropTypes.object).isRequired,
    getActionLabel: PropTypes.func.isRequired,
    headerAction: PropTypes.node,
    isFavorite: PropTypes.func.isRequired,
    isItemSelectable: PropTypes.func.isRequired,
    isItemSelected: PropTypes.func.isRequired,
    onFavorite: PropTypes.func.isRequired,
    onItemSelected: PropTypes.func.isRequired,
    onOpenCustomExtension: PropTypes.func.isRequired,
    onQueryChange: PropTypes.func.isRequired,
    onQueryClear: PropTypes.func.isRequired,
    onRequestClose: PropTypes.func.isRequired,
    onSelectionToggle: PropTypes.func.isRequired,
    onSortChange: PropTypes.func.isRequired,
    query: PropTypes.string.isRequired,
    resultLabel: PropTypes.node,
    searchPlaceholder: PropTypes.string,
    sections: PropTypes.arrayOf(PropTypes.object).isRequired,
    showOverview: PropTypes.bool,
    sidebarExtra: PropTypes.node,
    sidebarGroups: PropTypes.arrayOf(PropTypes.object).isRequired,
    sortLabel: PropTypes.node,
    sortMode: PropTypes.string.isRequired,
    sortOptions: PropTypes.arrayOf(PropTypes.object).isRequired,
    subtitle: PropTypes.node,
    summary: PropTypes.arrayOf(PropTypes.object),
    title: PropTypes.string.isRequired
};

ExtensionCenter.defaultProps = {
    customExtensionLabel: 'Load custom extension',
    emptyState: null,
    headerAction: null,
    resultLabel: null,
    searchPlaceholder: 'Search extensions',
    showOverview: false,
    sidebarExtra: null,
    sortLabel: 'Sort',
    subtitle: null,
    summary: []
};

export default ExtensionCenter;
