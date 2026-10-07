/* eslint-disable react/jsx-no-bind, react/jsx-no-literals */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

import {
    EXTENSION_MANAGER_CATEGORIES,
    EXTENSION_MANAGER_ITEM_STATUS,
    WORKSPACE_EXTENSION_MANAGER_MODEL_ID
} from '../../lib/editor-shell/extension-manager-model';

import styles from './workspace-extension-manager.css';

const NAV_ITEMS = Object.freeze([
    {id: 'all', label: 'All'},
    {id: 'installed', label: 'Installed'},
    {id: 'enabled', label: 'Enabled'},
    {id: 'disabled', label: 'Disabled'},
    {id: 'updates', label: 'Updates'}
]);

const CATEGORY_ITEMS = Object.freeze([
    {id: EXTENSION_MANAGER_CATEGORIES.NGVGE_MODULES, label: 'NGVGE Modules'},
    {id: EXTENSION_MANAGER_CATEGORIES.SCRATCH_EXTENSIONS, label: 'Scratch Extensions'},
    {id: EXTENSION_MANAGER_CATEGORIES.LEGACY_ADDONS, label: 'Legacy Addons'}
]);

const DETAIL_TABS = Object.freeze([
    'Overview',
    'Settings',
    'Permissions',
    'Compatibility',
    'About'
]);

const HOST_LABELS = Object.freeze({
    [EXTENSION_MANAGER_CATEGORIES.NGVGE_MODULES]: 'NGVGE Module',
    [EXTENSION_MANAGER_CATEGORIES.SCRATCH_EXTENSIONS]: 'Scratch Extension',
    [EXTENSION_MANAGER_CATEGORIES.LEGACY_ADDONS]: 'Legacy Addon'
});

const matchesNavigation = (item, navigation) => {
    if (navigation === 'all') return true;
    if (navigation === 'installed') return item.installed;
    if (navigation === 'enabled') return item.enabled;
    if (navigation === 'disabled') return !item.enabled;
    if (navigation === 'updates') return item.updateAvailable;
    return item.category === navigation;
};

const matchesQuery = (item, query) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;
    return [
        item.name,
        item.extensionId,
        item.description,
        item.hostKind,
        ...item.tags
    ].some(value => String(value || '').toLowerCase()
        .includes(normalized));
};

const CountBadge = ({children}) => <span className={styles.countBadge}>{children}</span>;
CountBadge.propTypes = {children: PropTypes.node};

const ExtensionGlyph = ({item}) => (item.iconURL ? (
    <img
        alt=""
        className={styles.itemImage}
        draggable={false}
        src={item.iconURL}
    />
) : (
    <svg
        aria-hidden="true"
        className={styles.itemGlyph}
        viewBox="0 0 24 24"
    >
        <rect
            x="4"
            y="4"
            width="7"
            height="7"
            rx="1.5"
        />
        <rect
            x="13"
            y="4"
            width="7"
            height="7"
            rx="1.5"
        />
        <rect
            x="4"
            y="13"
            width="7"
            height="7"
            rx="1.5"
        />
        <path d="M15 16.5h4M17 14.5v4" />
    </svg>
));
ExtensionGlyph.propTypes = {item: PropTypes.object.isRequired};

const TrustBadge = ({trust}) => (
    <span
        className={classNames(styles.trustBadge, {
            [styles.trustBadgePending]: !trust.evaluated
        })}
    >
        {trust.evaluated ? trust.level : 'Trust not evaluated'}
    </span>
);
TrustBadge.propTypes = {trust: PropTypes.object.isRequired};

const renderSettingControl = (item, setting, onChange) => {
    const id = `${item.itemId}:${setting.id}`;
    if (setting.type === 'boolean') {
        return (
            <label
                className={styles.settingRow}
                htmlFor={id}
                key={setting.id}
            >
                <span>
                    <strong>{setting.name}</strong>
                    <small>{setting.id}</small>
                </span>
                <input
                    checked={Boolean(setting.value)}
                    id={id}
                    type="checkbox"
                    onChange={event => onChange(setting.id, event.target.checked)}
                />
            </label>
        );
    }
    if (setting.type === 'select') {
        return (
            <label
                className={styles.settingColumn}
                htmlFor={id}
                key={setting.id}
            >
                <span>{setting.name}</span>
                <select
                    id={id}
                    value={setting.value}
                    onChange={event => onChange(setting.id, event.target.value)}
                >
                    {setting.potentialValues.map(value => (
                        <option
                            key={String(value.id)}
                            value={value.id}
                        >{value.name}</option>
                    ))}
                </select>
            </label>
        );
    }
    if (setting.type === 'color') {
        return (
            <label
                className={styles.settingColumn}
                htmlFor={id}
                key={setting.id}
            >
                <span>{setting.name}</span>
                <input
                    id={id}
                    type="color"
                    value={setting.value}
                    onChange={event => onChange(setting.id, event.target.value)}
                />
            </label>
        );
    }
    const numeric = setting.type === 'integer' || setting.type === 'positive_integer';
    return (
        <label
            className={styles.settingColumn}
            htmlFor={id}
            key={setting.id}
        >
            <span>{setting.name}</span>
            <input
                id={id}
                min={setting.type === 'positive_integer' ? 1 : null}
                type={numeric ? 'number' : 'text'}
                value={setting.value}
                onChange={event => onChange(
                    setting.id,
                    numeric ? Number(event.target.value) : event.target.value
                )}
            />
        </label>
    );
};

const EmptyDetail = () => (
    <div className={styles.emptyDetail}>
        <svg
            aria-hidden="true"
            viewBox="0 0 32 32"
        >
            <rect
                x="5"
                y="5"
                width="9"
                height="9"
                rx="2"
            />
            <rect
                x="18"
                y="5"
                width="9"
                height="9"
                rx="2"
            />
            <rect
                x="5"
                y="18"
                width="9"
                height="9"
                rx="2"
            />
            <path d="M20 22.5h5M22.5 20v5" />
        </svg>
        <strong>Select an extension</strong>
        <span>Inspect trust, permissions, compatibility and settings without expanding the main list.</span>
    </div>
);

const WorkspaceExtensionManager = ({model, onBrowseCatalog}) => {
    const [revision, setRevision] = React.useState(model.revision);
    const [navigation, setNavigation] = React.useState('all');
    const [query, setQuery] = React.useState('');
    const [selectedItemId, setSelectedItemId] = React.useState(null);
    const [detailTab, setDetailTab] = React.useState('Overview');
    const [busyItemId, setBusyItemId] = React.useState(null);
    const [error, setError] = React.useState(null);

    React.useEffect(() => model.subscribe(event => setRevision(event.revision)), [model]);
    const items = React.useMemo(() => model.listItems(), [model, revision]);
    const filteredItems = React.useMemo(() => items.filter(item => (
        matchesNavigation(item, navigation) && matchesQuery(item, query)
    )), [items, navigation, query]);
    const selectedItem = model.getItem(selectedItemId) || null;

    React.useEffect(() => {
        if (selectedItemId && model.getItem(selectedItemId)) return;
        if (filteredItems.length) setSelectedItemId(filteredItems[0].itemId);
    }, [filteredItems, model, selectedItemId]);

    const getCount = id => items.filter(item => matchesNavigation(item, id)).length;

    const toggleItem = async item => {
        setBusyItemId(item.itemId);
        setError(null);
        try {
            await model.setEnabled(item.itemId, !item.enabled);
        } catch (nextError) {
            setError(nextError && nextError.message ? nextError.message : String(nextError));
        } finally {
            setBusyItemId(null);
        }
    };

    const updateSetting = (item, settingId, value) => {
        setError(null);
        try {
            model.setSetting(item.itemId, settingId, value);
        } catch (nextError) {
            setError(nextError && nextError.message ? nextError.message : String(nextError));
        }
    };

    return (
        <section
            className={styles.manager}
            data-ngvge-extension-manager={WORKSPACE_EXTENSION_MANAGER_MODEL_ID}
            data-ngvge-extension-manager-revision={revision}
        >
            <header className={styles.header}>
                <div>
                    <span className={styles.eyebrow}>Workspace Tool</span>
                    <h2>Extension Manager</h2>
                    <p>One product surface, three isolated runtime hosts.</p>
                </div>
                <div className={styles.headerActions}>
                    <label className={styles.searchBox}>
                        <svg
                            aria-hidden="true"
                            viewBox="0 0 20 20"
                        >
                            <circle
                                cx="8.5"
                                cy="8.5"
                                r="5"
                            />
                            <path d="M12.3 12.3L17 17" />
                        </svg>
                        <input
                            aria-label="Search extensions"
                            placeholder="Search extensions"
                            type="search"
                            value={query}
                            onChange={event => setQuery(event.target.value)}
                        />
                    </label>
                    {onBrowseCatalog ? (
                        <button
                            className={styles.secondaryButton}
                            type="button"
                            onClick={onBrowseCatalog}
                        >
                            Browse catalog
                        </button>
                    ) : null}
                </div>
            </header>

            {error ? <div
                className={styles.errorBanner}
                role="alert"
            >{error}</div> : null}

            <div className={styles.body}>
                <nav
                    aria-label="Extension Manager filters"
                    className={styles.navigation}
                >
                    <div className={styles.navSectionTitle}>Library</div>
                    {NAV_ITEMS.map(item => (
                        <button
                            className={classNames(styles.navItem, {
                                [styles.navItemActive]: navigation === item.id
                            })}
                            key={item.id}
                            type="button"
                            onClick={() => setNavigation(item.id)}
                        >
                            <span>{item.label}</span>
                            <CountBadge>{getCount(item.id)}</CountBadge>
                        </button>
                    ))}
                    <div className={styles.navSectionTitle}>Categories</div>
                    {CATEGORY_ITEMS.map(item => (
                        <button
                            className={classNames(styles.navItem, {
                                [styles.navItemActive]: navigation === item.id
                            })}
                            key={item.id}
                            type="button"
                            onClick={() => setNavigation(item.id)}
                        >
                            <span>{item.label}</span>
                            <CountBadge>{getCount(item.id)}</CountBadge>
                        </button>
                    ))}
                </nav>

                <div className={styles.listPane}>
                    <div className={styles.listHeader}>
                        <strong>
                            {[...NAV_ITEMS, ...CATEGORY_ITEMS].find(item => item.id === navigation)?.label || 'All'}
                        </strong>
                        <span>{filteredItems.length} items</span>
                    </div>
                    <div className={styles.list}>
                        {filteredItems.length ? filteredItems.map(item => (
                            <article
                                className={classNames(styles.card, {
                                    [styles.cardSelected]: selectedItem && selectedItem.itemId === item.itemId
                                })}
                                data-extension-item-id={item.itemId}
                                key={item.itemId}
                                onClick={() => {
                                    setSelectedItemId(item.itemId);
                                    setDetailTab('Overview');
                                }}
                            >
                                <ExtensionGlyph item={item} />
                                <button
                                    className={styles.cardMain}
                                    type="button"
                                    onClick={() => {
                                        setSelectedItemId(item.itemId);
                                        setDetailTab('Overview');
                                    }}
                                >
                                    <span className={styles.cardTitleRow}>
                                        <strong>{item.name}</strong>
                                        {item.enabled ? <span
                                            className={styles.enabledDot}
                                            title="Enabled"
                                        /> : null}
                                    </span>
                                    <span className={styles.cardDescription}>
                                        {item.description || item.extensionId}
                                    </span>
                                    <span className={styles.cardMeta}>
                                        {HOST_LABELS[item.hostKind]}
                                        {item.installed ? ' · Installed' : ' · Available'}
                                    </span>
                                </button>
                                <button
                                    aria-label={`${item.enabled ? 'Disable' : 'Enable'} ${item.name}`}
                                    className={item.enabled ? styles.disableButton : styles.enableButton}
                                    disabled={busyItemId === item.itemId ||
                                        item.status === EXTENSION_MANAGER_ITEM_STATUS.UNAVAILABLE}
                                    type="button"
                                    onClick={event => {
                                        event.stopPropagation();
                                        toggleItem(item);
                                    }}
                                >
                                    {item.status === EXTENSION_MANAGER_ITEM_STATUS.UNAVAILABLE ? 'Planned' : (
                                        busyItemId === item.itemId ? 'Working…' : (item.enabled ? 'Disable' : 'Enable')
                                    )}
                                </button>
                            </article>
                        )) : (
                            <div className={styles.emptyList}>
                                <strong>No extensions in this view</strong>
                                <span>Try another filter or clear the search query.</span>
                            </div>
                        )}
                    </div>
                </div>

                <aside className={styles.detailPane}>
                    {selectedItem ? (
                        <React.Fragment>
                            <div className={styles.detailIdentity}>
                                <ExtensionGlyph item={selectedItem} />
                                <div>
                                    <span>{HOST_LABELS[selectedItem.hostKind]}</span>
                                    <h3>{selectedItem.name}</h3>
                                    <code>{selectedItem.extensionId}</code>
                                </div>
                            </div>
                            <div
                                className={styles.detailTabs}
                                role="tablist"
                                aria-label="Extension details"
                            >
                                {DETAIL_TABS.map(tab => (
                                    <button
                                        aria-selected={detailTab === tab}
                                        className={classNames(styles.detailTab, {
                                            [styles.detailTabActive]: detailTab === tab
                                        })}
                                        key={tab}
                                        role="tab"
                                        type="button"
                                        onClick={() => setDetailTab(tab)}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                            <div className={styles.detailContent}>
                                {detailTab === 'Overview' ? (
                                    <div className={styles.detailStack}>
                                        <p>{selectedItem.description || 'No description is available.'}</p>
                                        <div className={styles.statusGrid}>
                                            <div><span>State</span><strong>{selectedItem.status}</strong></div>
                                            <div>
                                                <span>Installed</span>
                                                <strong>{selectedItem.installed ? 'Yes' : 'No'}</strong>
                                            </div>
                                            <div>
                                                <span>Host</span>
                                                <strong>{HOST_LABELS[selectedItem.hostKind]}</strong>
                                            </div>
                                            <div>
                                                <span>Updates</span>
                                                <strong>{selectedItem.updateAvailable ? 'Available' : 'None'}</strong>
                                            </div>
                                        </div>
                                        <TrustBadge trust={selectedItem.trust} />
                                        {selectedItem.trust.evaluated ? null : (
                                            <p className={styles.mutedCopy}>
                                                {'Effective trust is evaluated by LEX when this extension enters its '}
                                                {'runtime host.'}
                                            </p>
                                        )}
                                    </div>
                                ) : null}
                                {detailTab === 'Settings' ? (
                                    <div className={styles.detailStack}>
                                        {selectedItem.settings.length ? selectedItem.settings.map(setting => (
                                            renderSettingControl(
                                                selectedItem,
                                                setting,
                                                (settingId, value) => updateSetting(selectedItem, settingId, value)
                                            )
                                        )) : (
                                            <p className={styles.mutedCopy}>
                                                No generic settings are declared for this extension host.
                                            </p>
                                        )}
                                    </div>
                                ) : null}
                                {detailTab === 'Permissions' ? (
                                    <div className={styles.detailStack}>
                                        <TrustBadge trust={selectedItem.trust} />
                                        <section className={styles.tokenSection}>
                                            <h4>Permissions</h4>
                                            <div className={styles.tokenList}>
                                                {selectedItem.permissions.length ? selectedItem.permissions.map(
                                                    permission => <code key={permission}>{permission}</code>
                                                ) : <span>None declared</span>}
                                            </div>
                                        </section>
                                        <section className={styles.tokenSection}>
                                            <h4>Capabilities</h4>
                                            <div className={styles.tokenList}>
                                                {selectedItem.capabilities.length ? selectedItem.capabilities.map(
                                                    capability => <code key={capability}>{capability}</code>
                                                ) : <span>None projected</span>}
                                            </div>
                                        </section>
                                    </div>
                                ) : null}
                                {detailTab === 'Compatibility' ? (
                                    <dl className={styles.definitionList}>
                                        <div>
                                            <dt>Legacy</dt>
                                            <dd>{selectedItem.compatibility.legacy ? 'Yes' : 'No'}</dd>
                                        </div>
                                        <div>
                                            <dt>Quarantine</dt>
                                            <dd>{selectedItem.compatibility.quarantine ? 'Yes' : 'No'}</dd>
                                        </div>
                                        {'scratch' in selectedItem.compatibility ? (
                                            <div>
                                                <dt>Scratch</dt>
                                                <dd>{String(selectedItem.compatibility.scratch)}</dd>
                                            </div>
                                        ) : null}
                                        {'ngvge' in selectedItem.compatibility ? (
                                            <div>
                                                <dt>NGVGE</dt>
                                                <dd>{String(selectedItem.compatibility.ngvge)}</dd>
                                            </div>
                                        ) : null}
                                    </dl>
                                ) : null}
                                {detailTab === 'About' ? (
                                    <dl className={styles.definitionList}>
                                        <div>
                                            <dt>Descriptor</dt>
                                            <dd>{selectedItem.descriptorId || 'Not created yet'}</dd>
                                        </div>
                                        <div>
                                            <dt>Source kind</dt>
                                            <dd>{selectedItem.source.kind}</dd>
                                        </div>
                                        <div>
                                            <dt>Source</dt>
                                            <dd>{selectedItem.source.value || 'Local / internal'}</dd>
                                        </div>
                                        <div>
                                            <dt>Version</dt>
                                            <dd>{selectedItem.version || 'Not declared'}</dd>
                                        </div>
                                        <div>
                                            <dt>Execution</dt>
                                            <dd>{selectedItem.trust.effectiveExecutionMode || 'Not evaluated'}</dd>
                                        </div>
                                    </dl>
                                ) : null}
                            </div>
                        </React.Fragment>
                    ) : <EmptyDetail />}
                </aside>
            </div>
        </section>
    );
};

WorkspaceExtensionManager.propTypes = {
    model: PropTypes.shape({
        getItem: PropTypes.func.isRequired,
        listItems: PropTypes.func.isRequired,
        revision: PropTypes.number.isRequired,
        setEnabled: PropTypes.func.isRequired,
        setSetting: PropTypes.func.isRequired,
        subscribe: PropTypes.func.isRequired
    }).isRequired,
    onBrowseCatalog: PropTypes.func
};

export default WorkspaceExtensionManager;
