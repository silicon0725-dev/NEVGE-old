/* eslint-disable react/jsx-no-literals */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import {FormattedMessage} from 'react-intl';

import {
    ENTITIES_ROOT_NODE_ID,
    createEntityProvider,
    getTargetNodeId
} from '../../lib/project-explorer/entity-provider';
import {
    getGlobalAssetDatabase,
    installGlobalAssetDatabase
} from '../../lib/project-assets/global-asset-database';
import {
    getNodeDatabase,
    installNodeDatabase
} from '../../lib/project-nodes/node-database';
import {
    GLOBAL_SCOPE_TREE_NODE_ID as GLOBAL_SCOPE_NODE_ID,
    getRuntimeRootTreeId,
    getSceneTreeNodeId,
    presentRuntimeNodeError
} from '../../lib/runtime-nodes';
import {
    WORKSPACE_NODE_DOMAINS,
    createWorkspaceNodeCommandClientForVM
} from '../../lib/editor-shell/node-workspace-command';
import {TOOL_IDS} from '../../lib/editor-shell/tool-registry';
import {
    SCRATCH_ROLE_MANAGER_PARITY_CAPABILITY_ID,
    createScratchSpriteTreeProjection
} from '../../lib/scratch-sprite-adapter';
import {FUNCTIONAL_NODE_CREATION_CAPABILITY_ID} from '../../lib/functional-node';
import {materializePortableCapabilityValue} from '../../lib/first-party-modules/materialize-portable-capability-value';
import {
    getSceneSnapshotNodeTreeId,
    getSceneSnapshotProjection,
    getSceneSnapshotTargetTreeId
} from '../../lib/project-explorer/scene-snapshot-projection';

import styles from './project-explorer.css';

const PROJECT_ROOT_NODE_ID = 'project:root';
const ASSETS_ROOT_NODE_ID = 'provider:assets';
const ASSET_NODE_PREFIX = 'global-asset:';
const SCENE_ROOT_DROP_ID = 'scene-root-drop';
const SCENE_SYSTEM_MODULE_ID = 'ngvge.scene-system';
const SCENE_CONTROLLER_CAPABILITY_ID = 'ngvge.scene-controller';
const RUNTIME_NODE_MODEL_CAPABILITY_ID = 'ngvge.runtime-node-model';
const SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID = 'ngvge.scratch-sprite-node-adapter';

const DisclosureIcon = ({expanded}) => (
    <svg
        aria-hidden="true"
        className={classNames(styles.disclosureIcon, {
            [styles.disclosureIconExpanded]: expanded
        })}
        viewBox="0 0 12 12"
    >
        <path d="M4 2.5L8 6 4 9.5z" fill="currentColor" />
    </svg>
);

const CloseIcon = () => (
    <svg aria-hidden="true" viewBox="0 0 16 16">
        <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
);

const SearchIcon = () => (
    <svg aria-hidden="true" viewBox="0 0 16 16">
        <circle cx="6.8" cy="6.8" r="3.8" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9.7 9.7L13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

const LegacySpritesIcon = () => (
    <svg aria-hidden="true" viewBox="0 0 16 16">
        <rect x="2.5" y="3" width="11" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="6" cy="7" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M4.2 11c.4-1.4 1.1-2.1 1.8-2.1s1.4.7 1.8 2.1M9.5 6.5h2.2M9.5 9h2.2" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
);

DisclosureIcon.propTypes = {
    expanded: PropTypes.bool.isRequired
};

const TreeNode = props => {
    const {
        children,
        depth,
        draggable,
        dragging,
        dropActive,
        expanded,
        icon,
        label,
        nodeId,
        onActivate,
        onContextMenu,
        onDragEnd,
        onDragEnter,
        onDragLeave,
        onDragOver,
        onDragStart,
        onDrop,
        onToggle,
        secondaryLabel,
        selected,
        targetId
    } = props;
    const normalizedChildren = React.Children.toArray(children);
    const hasChildren = normalizedChildren.length > 0;
    const nodeRef = React.useRef(null);
    const didDragRef = React.useRef(false);

    React.useEffect(() => {
        if (selected && nodeRef.current && typeof nodeRef.current.scrollIntoView === 'function') {
            nodeRef.current.scrollIntoView({block: 'nearest'});
        }
    }, [selected]);

    const handleKeyDown = event => {
        if (!onActivate) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onActivate(event);
        }
    };

    const handleDragStart = event => {
        didDragRef.current = true;
        if (onDragStart) onDragStart(event);
    };

    const handleDragEnd = event => {
        if (onDragEnd) onDragEnd(event);
        window.setTimeout(() => {
            didDragRef.current = false;
        }, 0);
    };

    return (
        <React.Fragment>
            <div
                aria-expanded={hasChildren ? expanded : undefined}
                aria-selected={onActivate ? selected : undefined}
                className={classNames(styles.node, {
                    [styles.nodeDragging]: dragging,
                    [styles.nodeDropActive]: dropActive,
                    [styles.nodeInteractive]: Boolean(onActivate),
                    [styles.nodeSelected]: selected
                })}
                data-node-id={nodeId}
                data-target-id={targetId || undefined}
                draggable={draggable}
                ref={nodeRef}
                role="treeitem"
                style={{paddingLeft: `${8 + (depth * 16)}px`}}
                tabIndex={onActivate ? (selected ? 0 : -1) : undefined}
                onClick={event => {
                    if (didDragRef.current || !onActivate) return;
                    onActivate(event);
                }}
                onContextMenu={onContextMenu}
                onDragEnd={draggable ? handleDragEnd : undefined}
                onDragEnter={onDragEnter}
                onDragLeave={onDragLeave}
                onDragOver={onDragOver}
                onDragStart={draggable ? handleDragStart : undefined}
                onDrop={onDrop}
                onKeyDown={handleKeyDown}
            >
                {hasChildren ? (
                    <button
                        aria-label={expanded ? 'Collapse' : 'Expand'}
                        className={styles.disclosureButton}
                        type="button"
                        onClick={event => {
                            event.stopPropagation();
                            onToggle(nodeId, !expanded);
                        }}
                    >
                        <DisclosureIcon expanded={expanded} />
                    </button>
                ) : (
                    <span className={styles.disclosurePlaceholder} />
                )}
                <span aria-hidden="true" className={styles.nodeIcon}>{icon}</span>
                <span className={styles.nodeLabel}>{label}</span>
                {secondaryLabel !== null && typeof secondaryLabel !== 'undefined' ? (
                    <span className={styles.nodeSecondaryLabel}>{secondaryLabel}</span>
                ) : null}
            </div>
            {hasChildren && expanded ? normalizedChildren : null}
        </React.Fragment>
    );
};

TreeNode.propTypes = {
    children: PropTypes.node,
    depth: PropTypes.number,
    draggable: PropTypes.bool,
    dragging: PropTypes.bool,
    dropActive: PropTypes.bool,
    expanded: PropTypes.bool,
    icon: PropTypes.node.isRequired,
    label: PropTypes.node.isRequired,
    nodeId: PropTypes.string.isRequired,
    onActivate: PropTypes.func,
    onContextMenu: PropTypes.func,
    onDragEnd: PropTypes.func,
    onDragEnter: PropTypes.func,
    onDragLeave: PropTypes.func,
    onDragOver: PropTypes.func,
    onDragStart: PropTypes.func,
    onDrop: PropTypes.func,
    onToggle: PropTypes.func.isRequired,
    secondaryLabel: PropTypes.node,
    selected: PropTypes.bool,
    targetId: PropTypes.string
};

TreeNode.defaultProps = {
    children: null,
    depth: 0,
    draggable: false,
    dragging: false,
    dropActive: false,
    expanded: false,
    onActivate: null,
    onContextMenu: null,
    onDragEnd: null,
    onDragEnter: null,
    onDragLeave: null,
    onDragOver: null,
    onDragStart: null,
    onDrop: null,
    secondaryLabel: null,
    selected: false,
    targetId: null
};

const NODE_FAMILY_LABELS = {
    '2d': '2D Nodes',
    node: 'Core Nodes',
    service: 'Service Nodes',
    ui: 'User Interface Nodes',
    '3d': '3D Nodes'
};

const Portal = ({children}) => (
    typeof document !== 'undefined' && document.body ?
        ReactDOM.createPortal(children, document.body) : children
);

Portal.propTypes = {
    children: PropTypes.node.isRequired
};

const CreateNodeDialog = props => {
    const {
        family,
        nodeDatabase,
        onCancel,
        onCreate,
        parentNode
    } = props;
    const [query, setQuery] = React.useState('');
    const [selectedTypeId, setSelectedTypeId] = React.useState('');
    const [name, setName] = React.useState('');
    const searchRef = React.useRef(null);
    const allTypes = nodeDatabase ? nodeDatabase.listNodeTypes() : [];
    const nodeTypes = family ?
        allTypes.filter(nodeType => (nodeType.family || '2d') === family) : allTypes;
    const normalizedQuery = query.trim().toLowerCase();
    const filteredTypes = nodeTypes.filter(nodeType => (
        !normalizedQuery ||
        nodeType.label.toLowerCase().includes(normalizedQuery) ||
        nodeType.category.toLowerCase().includes(normalizedQuery) ||
        nodeType.id.toLowerCase().includes(normalizedQuery) ||
        (nodeType.pluginId || '').toLowerCase().includes(normalizedQuery)
    ));
    const selectedType = filteredTypes.find(nodeType => nodeType.id === selectedTypeId) || filteredTypes[0] || null;
    const groupedTypes = filteredTypes.reduce((groups, nodeType) => {
        const groupId = `${nodeType.family || '2d'}:${nodeType.category}`;
        if (!groups.some(group => group.id === groupId)) {
            groups.push({
                category: nodeType.category,
                family: nodeType.family || '2d',
                id: groupId,
                nodeTypes: []
            });
        }
        groups.find(group => group.id === groupId).nodeTypes.push(nodeType);
        return groups;
    }, []);

    React.useEffect(() => {
        if (searchRef.current) searchRef.current.focus();
    }, []);

    React.useEffect(() => {
        if (!selectedType && filteredTypes.length) setSelectedTypeId(filteredTypes[0].id);
    }, [filteredTypes, selectedType]);

    React.useEffect(() => {
        const handleKeyDown = event => {
            if (event.key === 'Escape') onCancel();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onCancel]);

    const submit = () => {
        if (!selectedType) return;
        onCreate(selectedType.id, name);
    };

    return (
        <Portal>
            <div className={styles.nodeDialogBackdrop} role="presentation" onMouseDown={onCancel}>
                <section
                    aria-label="Create Node"
                    aria-modal="true"
                    className={styles.nodeDialog}
                    role="dialog"
                    onMouseDown={event => event.stopPropagation()}
                >
                    <header className={styles.nodeDialogHeader}>
                        <div>
                            <span>Create New Node</span>
                            <strong>{NODE_FAMILY_LABELS[family] || 'All Node Types'}</strong>
                        </div>
                        <button aria-label="Close" type="button" onClick={onCancel}><CloseIcon /></button>
                    </header>
                    <div className={styles.nodeDialogParent}>
                        {parentNode ? `Add as a child of: ${parentNode.name}` : 'Create as the scene root'}
                    </div>
                    <div className={styles.nodeDialogSearch}>
                        <input
                            aria-label="Search nodes"
                            placeholder="Search all nodes..."
                            ref={searchRef}
                            value={query}
                            onChange={event => setQuery(event.target.value)}
                        />
                    </div>
                    <div className={styles.nodeDialogBody}>
                        <nav className={styles.nodeTypeList}>
                            {groupedTypes.length ? groupedTypes.map(group => (
                                <section className={styles.nodeTypeGroup} key={group.id}>
                                    <div className={styles.nodeTypeGroupTitle}>
                                        <span>{NODE_FAMILY_LABELS[group.family] || group.family}</span>
                                        <strong>{group.category}</strong>
                                    </div>
                                    {group.nodeTypes.map(nodeType => (
                                        <button
                                            className={classNames(styles.nodeTypeItem, {
                                                [styles.nodeTypeItemSelected]: selectedType && selectedType.id === nodeType.id
                                            })}
                                            key={nodeType.id}
                                            type="button"
                                            onClick={() => setSelectedTypeId(nodeType.id)}
                                            onDoubleClick={() => {
                                                setSelectedTypeId(nodeType.id);
                                                onCreate(nodeType.id, name);
                                            }}
                                        >
                                            <span>{nodeType.icon}</span>
                                            <div>
                                                <strong>{nodeType.label}</strong>
                                                <small>{nodeType.pluginId || 'NES Studio'}</small>
                                            </div>
                                        </button>
                                    ))}
                                </section>
                            )) : (
                                <div className={styles.nodeTypeEmpty}>No matching nodes.</div>
                            )}
                        </nav>
                        <div className={styles.nodeTypeDetails}>
                            {selectedType ? (
                                <React.Fragment>
                                    <div className={styles.nodeTypeHero}>
                                        <span>{selectedType.icon}</span>
                                        <div>
                                            <strong>{selectedType.label}</strong>
                                            <small>{selectedType.id}</small>
                                        </div>
                                    </div>
                                    <div className={styles.nodeTypeBadges}>
                                        <span>{NODE_FAMILY_LABELS[selectedType.family || '2d'] || selectedType.family}</span>
                                        <span>{selectedType.category}</span>
                                    </div>
                                    <p>{selectedType.description || `${selectedType.label} node provided by ${selectedType.pluginId || 'NES Studio'}.`}</p>
                                    <label>
                                        Node name
                                        <input
                                            placeholder={selectedType.label}
                                            value={name}
                                            onChange={event => setName(event.target.value)}
                                            onKeyDown={event => {
                                                if (event.key === 'Enter') submit();
                                            }}
                                        />
                                    </label>
                                </React.Fragment>
                            ) : null}
                        </div>
                    </div>
                    <footer className={styles.nodeDialogFooter}>
                        <button type="button" onClick={onCancel}>Cancel</button>
                        <button
                            className={styles.nodeDialogCreateButton}
                            disabled={!selectedType}
                            type="button"
                            onClick={submit}
                        >
                            Create
                        </button>
                    </footer>
                </section>
            </div>
        </Portal>
    );
};

CreateNodeDialog.propTypes = {
    family: PropTypes.oneOf(['2d', 'ui', '3d']),
    nodeDatabase: PropTypes.shape({
        listNodeTypes: PropTypes.func.isRequired
    }),
    onCancel: PropTypes.func.isRequired,
    onCreate: PropTypes.func.isRequired,
    parentNode: PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired
    })
};

CreateNodeDialog.defaultProps = {
    family: null,
    nodeDatabase: null,
    parentNode: null
};

const RenameNodeDialog = ({node, onCancel, onRename}) => {
    const [name, setName] = React.useState(node.name);
    const inputRef = React.useRef(null);

    React.useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, []);

    React.useEffect(() => {
        const handleKeyDown = event => {
            if (event.key === 'Escape') onCancel();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onCancel]);

    const submit = () => {
        const nextName = name.trim();
        if (nextName) onRename(nextName);
    };

    return (
        <Portal>
            <div className={styles.nodeDialogBackdrop} role="presentation" onMouseDown={onCancel}>
                <section
                    aria-label="Rename Node"
                    aria-modal="true"
                    className={styles.renameNodeDialog}
                    role="dialog"
                    onMouseDown={event => event.stopPropagation()}
                >
                    <header className={styles.nodeDialogHeader}>
                        <div>
                            <span>Node</span>
                            <strong>Rename Node</strong>
                        </div>
                        <button aria-label="Close" type="button" onClick={onCancel}><CloseIcon /></button>
                    </header>
                    <div className={styles.renameNodeBody}>
                        <label>
                            Node name
                            <input
                                ref={inputRef}
                                value={name}
                                onChange={event => setName(event.target.value)}
                                onKeyDown={event => {
                                    if (event.key === 'Enter') submit();
                                }}
                            />
                        </label>
                    </div>
                    <footer className={styles.nodeDialogFooter}>
                        <button type="button" onClick={onCancel}>Cancel</button>
                        <button
                            className={styles.nodeDialogCreateButton}
                            disabled={!name.trim()}
                            type="button"
                            onClick={submit}
                        >
                            Rename
                        </button>
                    </footer>
                </section>
            </div>
        </Portal>
    );
};

RenameNodeDialog.propTypes = {
    node: PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired
    }).isRequired,
    onCancel: PropTypes.func.isRequired,
    onRename: PropTypes.func.isRequired
};

const EmptyNodeActions = ({onCreatePreset}) => (
    <div className={styles.emptyNodeActions}>
        <p>Create the first scene root.</p>
        <button type="button" onClick={() => onCreatePreset('ngvge.node2d')}>
            ◇ <span>2D Node</span>
        </button>
        <button type="button" onClick={() => onCreatePreset('ngvge.control')}>
            ▤ <span>User Interface Node</span>
        </button>
        <button disabled title="3D node support will be added with the 3D runtime." type="button">
            ◈ <span>3D Node</span><small>Coming later</small>
        </button>
    </div>
);

EmptyNodeActions.propTypes = {
    onCreatePreset: PropTypes.func.isRequired
};

const useDismissableContextMenu = onClose => {
    const menuRef = React.useRef(null);

    React.useEffect(() => {
        // React 16 delegates pointer events at document level. Closing on every
        // document pointerdown unmounts the portal before its button click runs.
        // Only dismiss when the native event target is outside the menu element.
        const handlePointerDown = event => {
            if (menuRef.current && menuRef.current.contains(event.target)) return;
            onClose();
        };
        const handleKeyDown = event => {
            if (event.key === 'Escape') onClose();
        };
        const close = () => onClose();

        window.addEventListener('blur', close);
        document.addEventListener('pointerdown', handlePointerDown, true);
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('scroll', close, true);
        return () => {
            window.removeEventListener('blur', close);
            document.removeEventListener('pointerdown', handlePointerDown, true);
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('scroll', close, true);
        };
    }, [onClose]);

    return menuRef;
};

const NodeContextMenu = props => {
    const {
        canCreateChild,
        canDelete,
        canDuplicate,
        canMakeRoot,
        canMoveDown,
        canMoveUp,
        canRename,
        canToggleEnabled,
        node,
        nodes,
        nodeType,
        onClose,
        onCollapseBranch,
        onCreateChild,
        onDelete,
        onDuplicate,
        onExpandBranch,
        makeRootLabel,
        onMakeRoot,
        onMoveDown,
        onMoveUp,
        onRename,
        onToggleEnabled,
        position
    } = props;
    const menuRef = useDismissableContextMenu(onClose);
    const selectedNodes = nodes && nodes.length ? nodes : [node];
    const customNodes = selectedNodes.filter(selectedNode => !selectedNode.targetId);
    const isMultiple = selectedNodes.length > 1;
    const canEditSingle = !isMultiple && !node.targetId;
    const allCustomNodesDisabled = customNodes.length > 0 &&
        customNodes.every(selectedNode => selectedNode.enabled === false);
    const hasRootCandidate = customNodes.some(selectedNode => selectedNode.parentId);
    const runAction = action => event => {
        event.preventDefault();
        event.stopPropagation();
        action();
        onClose();
    };

    return (
        <Portal>
            <div
                className={styles.nodeContextMenu}
                ref={menuRef}
                role="menu"
                style={{left: position.x, top: position.y}}
                onContextMenu={event => {
                    event.preventDefault();
                    event.stopPropagation();
                }}
            >
                <div className={styles.nodeContextTitle}>
                    {isMultiple ? `${selectedNodes.length} nodes selected` : node.name}
                </div>
                <button
                    disabled={!canCreateChild || isMultiple || (nodeType && nodeType.allowChildren === false)}
                    role="menuitem"
                    type="button"
                    onClick={runAction(onCreateChild)}
                >
                    + Add Child Node
                </button>
                <div className={styles.nodeContextSeparator} />
                <button disabled={!canRename || !canEditSingle} role="menuitem" type="button" onClick={runAction(onRename)}>
                    Rename
                </button>
                <button
                    disabled={!canDuplicate || !customNodes.length}
                    role="menuitem"
                    type="button"
                    onClick={runAction(onDuplicate)}
                >
                    {isMultiple ? 'Duplicate Selected' : 'Duplicate'}
                </button>
                {onMoveUp ? (
                    <button disabled={!canMoveUp || isMultiple} role="menuitem" type="button" onClick={runAction(onMoveUp)}>
                        Move Up
                    </button>
                ) : null}
                {onMoveDown ? (
                    <button
                        disabled={!canMoveDown || isMultiple}
                        role="menuitem"
                        type="button"
                        onClick={runAction(onMoveDown)}
                    >
                        Move Down
                    </button>
                ) : null}
                <button
                    disabled={!canToggleEnabled || !customNodes.length}
                    role="menuitem"
                    type="button"
                    onClick={runAction(() => onToggleEnabled(allCustomNodesDisabled))}
                >
                    {allCustomNodesDisabled ? 'Enable Selected' : 'Disable Selected'}
                </button>
                <button
                    disabled={!canMakeRoot || !hasRootCandidate}
                    role="menuitem"
                    type="button"
                    onClick={runAction(onMakeRoot)}
                >
                    {makeRootLabel}
                </button>
                <div className={styles.nodeContextSeparator} />
                <button role="menuitem" type="button" onClick={runAction(onExpandBranch)}>
                    {isMultiple ? 'Expand Selected Branches' : 'Expand Branch'}
                </button>
                <button role="menuitem" type="button" onClick={runAction(onCollapseBranch)}>
                    {isMultiple ? 'Collapse Selected Branches' : 'Collapse Branch'}
                </button>
                <div className={styles.nodeContextSeparator} />
                <button
                    className={styles.nodeContextDanger}
                    disabled={!canDelete || !customNodes.length}
                    role="menuitem"
                    type="button"
                    onClick={runAction(onDelete)}
                >
                    {isMultiple ? 'Delete Selected Nodes' : 'Delete Node'}
                </button>
            </div>
        </Portal>
    );
};

NodeContextMenu.propTypes = {
    canCreateChild: PropTypes.bool,
    canDelete: PropTypes.bool,
    canDuplicate: PropTypes.bool,
    canMakeRoot: PropTypes.bool,
    canMoveDown: PropTypes.bool,
    canMoveUp: PropTypes.bool,
    canRename: PropTypes.bool,
    canToggleEnabled: PropTypes.bool,
    node: PropTypes.shape({
        enabled: PropTypes.bool,
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        parentId: PropTypes.string,
        targetId: PropTypes.string
    }).isRequired,
    nodes: PropTypes.arrayOf(PropTypes.shape({
        enabled: PropTypes.bool,
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        parentId: PropTypes.string,
        targetId: PropTypes.string
    })),
    makeRootLabel: PropTypes.string,
    nodeType: PropTypes.shape({allowChildren: PropTypes.bool}),
    onClose: PropTypes.func.isRequired,
    onCollapseBranch: PropTypes.func.isRequired,
    onCreateChild: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired,
    onDuplicate: PropTypes.func.isRequired,
    onExpandBranch: PropTypes.func.isRequired,
    onMakeRoot: PropTypes.func.isRequired,
    onMoveDown: PropTypes.func,
    onMoveUp: PropTypes.func,
    onRename: PropTypes.func.isRequired,
    onToggleEnabled: PropTypes.func.isRequired,
    position: PropTypes.shape({x: PropTypes.number, y: PropTypes.number}).isRequired
};

NodeContextMenu.defaultProps = {
    canCreateChild: true,
    canDelete: true,
    canDuplicate: true,
    canMakeRoot: true,
    canMoveDown: false,
    canMoveUp: false,
    canRename: true,
    canToggleEnabled: true,
    makeRootLabel: 'Reparent to Scene Root',
    nodes: [],
    nodeType: null,
    onMoveDown: null,
    onMoveUp: null
};

const RootNodeContextMenu = props => {
    const {
        addLabel,
        enterSceneDisabled,
        enterSceneLabel,
        onClose,
        onCollapseAll,
        onCreateRoot,
        onEnterScene,
        onExpandAll,
        position,
        title
    } = props;
    const menuRef = useDismissableContextMenu(onClose);
    const runAction = action => event => {
        event.preventDefault();
        event.stopPropagation();
        action();
        onClose();
    };

    return (
        <Portal>
            <div
                className={styles.nodeContextMenu}
                ref={menuRef}
                role="menu"
                style={{left: position.x, top: position.y}}
                onContextMenu={event => {
                    event.preventDefault();
                    event.stopPropagation();
                }}
            >
                <div className={styles.nodeContextTitle}>{title}</div>
                {onEnterScene ? (
                    <React.Fragment>
                        <button
                            disabled={enterSceneDisabled}
                            role="menuitem"
                            type="button"
                            onClick={runAction(onEnterScene)}
                        >
                            {enterSceneLabel}
                        </button>
                        <div className={styles.nodeContextSeparator} />
                    </React.Fragment>
                ) : null}
                <button role="menuitem" type="button" onClick={runAction(onCreateRoot)}>
                    {addLabel}
                </button>
                <div className={styles.nodeContextSeparator} />
                <button role="menuitem" type="button" onClick={runAction(onExpandAll)}>
                    Expand All
                </button>
                <button role="menuitem" type="button" onClick={runAction(onCollapseAll)}>
                    Collapse All
                </button>
            </div>
        </Portal>
    );
};

RootNodeContextMenu.propTypes = {
    addLabel: PropTypes.string,
    enterSceneDisabled: PropTypes.bool,
    enterSceneLabel: PropTypes.string,
    onClose: PropTypes.func.isRequired,
    onCollapseAll: PropTypes.func.isRequired,
    onCreateRoot: PropTypes.func.isRequired,
    onEnterScene: PropTypes.func,
    onExpandAll: PropTypes.func.isRequired,
    position: PropTypes.shape({x: PropTypes.number, y: PropTypes.number}).isRequired,
    title: PropTypes.string
};

RootNodeContextMenu.defaultProps = {
    addLabel: '+ Add Node',
    enterSceneDisabled: false,
    enterSceneLabel: 'Enter Scene',
    onEnterScene: null,
    title: 'Entities'
};

const ProjectExplorer = props => {
    const {
        editingTargetId,
        expandedNodeIds,
        onClose,
        onOpenAssetManager,
        onOpenLegacySprites,
        nodeCommandClient,
        onSelectNode,
        onSelectionContextChange,
        onSelectTarget,
        onToggleNode,
        selectedNodeId,
        showHeader,
        sprites,
        stage,
        stageLabel,
        vm,
        width
    } = props;
    const rootExpanded = expandedNodeIds.indexOf(PROJECT_ROOT_NODE_ID) !== -1;
    const assetsExpanded = expandedNodeIds.indexOf(ASSETS_ROOT_NODE_ID) !== -1;
    const entityProvider = createEntityProvider({sprites, stage, stageLabel});
    const entityNodes = entityProvider.getChildren(ENTITIES_ROOT_NODE_ID);
    const [assetRevision, setAssetRevision] = React.useState(0);
    const [nodeRevision, setNodeRevision] = React.useState(0);
    const [sceneRevision, setSceneRevision] = React.useState(0);
    const [runtimeNodeRevision, setRuntimeNodeRevision] = React.useState(0);
    const [scratchBindingRevision, setScratchBindingRevision] = React.useState(0);
    const [runtimeEditorNotice, setRuntimeEditorNotice] = React.useState(null);
    const previousEditingTargetIdRef = React.useRef(editingTargetId);
    const previousActiveSceneIdRef = React.useRef(null);
    const compatibilitySelectionProjectionRef = React.useRef(null);
    const runtimeSelectionBySceneRef = React.useRef(new Map());
    const [createNodeRequest, setCreateNodeRequest] = React.useState(null);
    const [nodeContextMenu, setNodeContextMenu] = React.useState(null);
    const [renameNodeRequest, setRenameNodeRequest] = React.useState(null);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [selectedNodeIds, setSelectedNodeIds] = React.useState(selectedNodeId ? [selectedNodeId] : []);
    const [selectionAnchorId, setSelectionAnchorId] = React.useState(selectedNodeId || null);

    React.useEffect(() => {
        const primaryNodeId = selectionAnchorId && selectedNodeIds.indexOf(selectionAnchorId) !== -1 ?
            selectionAnchorId : (selectedNodeId && selectedNodeIds.indexOf(selectedNodeId) !== -1 ?
                selectedNodeId : (selectedNodeIds[selectedNodeIds.length - 1] || null));
        onSelectionContextChange(selectedNodeIds.slice(), primaryNodeId);
    }, [onSelectionContextChange, selectedNodeId, selectedNodeIds, selectionAnchorId]);
    const [dragState, setDragState] = React.useState({
        active: false,
        kind: null,
        nodeIds: [],
        targetId: null
    });
    const dragExpandTimerRef = React.useRef(null);
    const explorerRef = React.useRef(null);

    const assetDatabase = React.useMemo(() => {
        if (!vm || !vm.runtime) return null;
        return getGlobalAssetDatabase(vm.runtime) || installGlobalAssetDatabase(vm);
    }, [vm]);

    const nodeDatabase = React.useMemo(() => {
        if (!vm || !vm.runtime) return null;
        return getNodeDatabase(vm.runtime) || installNodeDatabase(vm);
    }, [vm]);

    const moduleManager = vm && vm.runtime ? vm.runtime.ngvgeFirstPartyModules : null;
    const sceneModuleState = moduleManager ? moduleManager.getModuleState(SCENE_SYSTEM_MODULE_ID) : null;
    const sceneSystemEnabled = Boolean(sceneModuleState && sceneModuleState.enabled);
    const runtimeNodeModel = sceneSystemEnabled ?
        moduleManager.getCapability(RUNTIME_NODE_MODEL_CAPABILITY_ID) : null;
    const workspaceNodeCommandClient = React.useMemo(() => (
        nodeCommandClient || createWorkspaceNodeCommandClientForVM({
            selectionWriter: onSelectNode,
            toolId: TOOL_IDS.NODE_EXPLORER,
            vm
        })
    ), [nodeCommandClient, onSelectNode, vm]);
    const scratchSpriteAdapter = sceneSystemEnabled ?
        moduleManager.getCapability(SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID) : null;
    const scratchRoleManagerParity = sceneSystemEnabled ?
        moduleManager.getCapability(SCRATCH_ROLE_MANAGER_PARITY_CAPABILITY_ID) : null;
    const functionalNodeCreation = sceneSystemEnabled ?
        moduleManager.getCapability(FUNCTIONAL_NODE_CREATION_CAPABILITY_ID) : null;
    const reportRuntimeNodeError = React.useCallback((error, context = {}) => {
        const presented = presentRuntimeNodeError(error, context);
        setRuntimeEditorNotice(Object.assign({kind: 'error'}, presented));
        return presented;
    }, []);
    const settleWorkspaceNodeCommand = (result, onSuccess, onError) => {
        if (result && typeof result.then === 'function') return result.then(onSuccess).catch(onError);
        try {
            return onSuccess(result);
        } catch (error) {
            return onError(error);
        }
    };
    const sceneProject = (() => {
        // sceneRevision intentionally participates in rendering through this closure.
        void sceneRevision;
        if (!sceneSystemEnabled || !moduleManager) return null;
        try {
            return moduleManager.getModuleData(SCENE_SYSTEM_MODULE_ID, null);
        } catch {
            return null;
        }
    })();
    const scenes = sceneProject && Array.isArray(sceneProject.scenes) ? sceneProject.scenes : [];
    const activeSceneId = sceneProject ? sceneProject.activeSceneId : null;
    const activeScene = scenes.find(scene => scene.id === activeSceneId) || scenes[0] || null;
    const sceneIdsKey = scenes.map(scene => scene.id).join('|');
    const activeSceneTreeNodeId = activeScene ? getSceneTreeNodeId(activeScene.id) : ENTITIES_ROOT_NODE_ID;
    const entitiesExpanded = expandedNodeIds.indexOf(activeSceneTreeNodeId) !== -1 ||
        (!sceneSystemEnabled && expandedNodeIds.indexOf(ENTITIES_ROOT_NODE_ID) !== -1);
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();
    const sceneSnapshotProjections = React.useMemo(() => {
        const projections = new Map();
        if (!sceneSystemEnabled) return projections;
        scenes.forEach(scene => {
            if (!scene || scene.id === activeSceneId) return;
            const treeNodeId = getSceneTreeNodeId(scene.id);
            if (!normalizedSearchQuery && expandedNodeIds.indexOf(treeNodeId) === -1) return;
            const projection = getSceneSnapshotProjection(scene);
            if (projection) projections.set(scene.id, projection);
        });
        return projections;
    }, [activeSceneId, expandedNodeIds, normalizedSearchQuery, sceneRevision, sceneSystemEnabled, scenes]);

    React.useEffect(() => {
        if (!moduleManager || typeof moduleManager.subscribe !== 'function') return () => {};
        return moduleManager.subscribe(change => {
            if (!change || change.moduleId === SCENE_SYSTEM_MODULE_ID || change.type === 'project:deserialize' ||
                change.type === 'project:reset' ||
                (change.type === 'module-data' && change.change?.moduleId === SCENE_SYSTEM_MODULE_ID)) {
                setSceneRevision(revision => revision + 1);
            }
        });
    }, [moduleManager]);

    React.useEffect(() => {
        if (!runtimeNodeModel || typeof runtimeNodeModel.subscribe !== 'function') return () => {};
        setRuntimeNodeRevision(revision => revision + 1);
        try {
            const importStatus = typeof runtimeNodeModel.getImportStatus === 'function' ?
                runtimeNodeModel.getImportStatus() : null;
            const missingCount = importStatus && importStatus.lastResult ? importStatus.lastResult.missingNodeCount : 0;
            if (missingCount) {
                setRuntimeEditorNotice({
                    code: 'RUNTIME_NODE_TYPE_MISSING',
                    kind: 'warning',
                    message: `${missingCount} runtime node${missingCount === 1 ? '' : 's'} recovered as opaque placeholders.`,
                    suggestion: 'Install the missing provider modules to restore their executable node types.',
                    title: 'Project recovered with missing node providers'
                });
            }
        } catch {
            // Runtime capability status is optional during module startup.
        }
        return runtimeNodeModel.subscribe(change => {
            setRuntimeNodeRevision(revision => revision + 1);
            if (change && change.type === 'state:import' && change.missingNodeCount > 0) {
                setRuntimeEditorNotice({
                    code: 'RUNTIME_NODE_TYPE_MISSING',
                    kind: 'warning',
                    message: `${change.missingNodeCount} runtime node${change.missingNodeCount === 1 ? '' : 's'} recovered as opaque placeholders.`,
                    suggestion: 'Install the missing provider modules to restore their executable node types.',
                    title: 'Project recovered with missing node providers'
                });
            }
            if (change && change.type === 'registry:reify-error') {
                reportRuntimeNodeError(new Error(change.error || 'Unable to restore missing runtime nodes.'), {
                    action: 'import',
                    typeId: change.typeId
                });
            }
        });
    }, [reportRuntimeNodeError, runtimeNodeModel]);

    React.useEffect(() => {
        if (!scratchSpriteAdapter || typeof scratchSpriteAdapter.subscribe !== 'function') return () => {};
        setScratchBindingRevision(revision => revision + 1);
        return scratchSpriteAdapter.subscribe(() => {
            setScratchBindingRevision(revision => revision + 1);
        });
    }, [scratchSpriteAdapter]);

    React.useEffect(() => {
        if (!sceneSystemEnabled || !activeScene) return;
        const sceneTreeNodeId = getSceneTreeNodeId(activeScene.id);
        if (expandedNodeIds.indexOf(sceneTreeNodeId) === -1) onToggleNode(sceneTreeNodeId, true);
    }, [activeScene, expandedNodeIds, onToggleNode, sceneSystemEnabled]);

    const handleToggleNode = React.useCallback((nodeId, expanded) => {
        onToggleNode(nodeId, expanded);
        if (nodeDatabase && nodeDatabase.getNode(nodeId) && typeof nodeDatabase.setNodeExpanded === 'function') {
            nodeDatabase.setNodeExpanded(nodeId, expanded);
        }
    }, [nodeDatabase, onToggleNode]);

    React.useEffect(() => {
        if (!assetDatabase) return () => {};
        return assetDatabase.subscribe(change => {
            setAssetRevision(change.revision || assetDatabase.getRevision());
        });
    }, [assetDatabase]);

    React.useEffect(() => {
        if (!nodeDatabase) return () => {};
        nodeDatabase.syncTargets({silent: true});
        return nodeDatabase.subscribe(change => {
            setNodeRevision(change.revision || nodeDatabase.getRevision());
        });
    }, [nodeDatabase]);

    const assetCount = React.useMemo(
        () => assetDatabase ? assetDatabase.listAssets().length : 0,
        [assetDatabase, assetRevision]
    );
    const assetSummary = React.useMemo(() => {
        const assets = assetDatabase ? assetDatabase.listAssets() : [];
        return {
            folders: assetDatabase ? assetDatabase.listFolders().length : 0,
            images: assets.filter(asset => asset.kind === 'costume').length,
            sounds: assets.filter(asset => asset.kind === 'sound').length
        };
    }, [assetDatabase, assetRevision]);

    const allNodes = React.useMemo(
        () => nodeDatabase ? nodeDatabase.listNodes() : [],
        [nodeDatabase, nodeRevision]
    );
    const nodeById = React.useMemo(() => {
        const map = new Map();
        allNodes.forEach(node => map.set(node.id, node));
        return map;
    }, [allNodes]);
    const runtimeNodes = React.useMemo(() => {
        void runtimeNodeRevision;
        if (!runtimeNodeModel || typeof runtimeNodeModel.listNodes !== 'function') return [];
        try {
            return runtimeNodeModel.listNodes({includeRoots: false});
        } catch {
            return [];
        }
    }, [runtimeNodeModel, runtimeNodeRevision]);
    const runtimeNodeById = React.useMemo(() => {
        const map = new Map();
        runtimeNodes.forEach(node => map.set(node.id, node));
        return map;
    }, [runtimeNodes]);
    const runtimeNodeTypeById = React.useMemo(() => {
        const map = new Map();
        if (!runtimeNodeModel || typeof runtimeNodeModel.getNodeType !== 'function') return map;
        const typeIds = new Set(runtimeNodes.map(node => node.typeId).filter(Boolean));
        typeIds.forEach(typeId => {
            try {
                const nodeType = runtimeNodeModel.getNodeType(typeId);
                if (nodeType) map.set(typeId, nodeType);
            } catch {
                // Node type metadata is optional while providers reconcile.
            }
        });
        return map;
    }, [runtimeNodeModel, runtimeNodeRevision, runtimeNodes]);
    const runtimeChildrenByParentId = React.useMemo(() => {
        const map = new Map();
        runtimeNodes.forEach(node => {
            if (!node || !node.parentId) return;
            if (!map.has(node.parentId)) map.set(node.parentId, []);
            map.get(node.parentId).push(node);
        });
        return map;
    }, [runtimeNodes]);
    const runtimeRoots = React.useMemo(() => {
        const roots = {global: null, scenes: new Map()};
        if (!runtimeNodeModel) return roots;
        try {
            roots.global = runtimeNodeModel.getGlobalRoot();
        } catch {
            roots.global = null;
        }
        scenes.forEach(scene => {
            try {
                const root = runtimeNodeModel.getSceneRoot(scene.id);
                if (root) roots.scenes.set(scene.id, root);
            } catch {
                // A scene root may be unavailable while the Runtime Node Model reconciles scene metadata.
            }
        });
        return roots;
    }, [runtimeNodeModel, runtimeNodeRevision, sceneIdsKey]);
    const scratchBindings = React.useMemo(() => {
        void scratchBindingRevision;
        if (!scratchSpriteAdapter || typeof scratchSpriteAdapter.listBindings !== 'function') return [];
        try {
            return scratchSpriteAdapter.listBindings();
        } catch {
            return [];
        }
    }, [scratchBindingRevision, scratchSpriteAdapter]);
    const scratchTreeProjection = React.useMemo(() => createScratchSpriteTreeProjection({
        bindings: scratchBindings,
        runtimeNodes
    }), [runtimeNodes, scratchBindings]);
    const scratchBindingByNodeId = scratchTreeProjection.bindingByNodeId;
    const scratchBindingByTargetRuntimeId = scratchTreeProjection.bindingByTargetRuntimeId;
    const scratchBindingsBySceneId = React.useMemo(() => {
        const map = new Map();
        scratchBindings.forEach(binding => {
            if (!binding || !binding.sceneId) return;
            if (!map.has(binding.sceneId)) map.set(binding.sceneId, []);
            map.get(binding.sceneId).push(binding);
        });
        return map;
    }, [scratchBindings]);

    const selectableNodeById = React.useMemo(() => {
        const map = new Map(nodeById);
        runtimeNodeById.forEach((node, nodeId) => map.set(nodeId, node));
        if (runtimeRoots.global) map.set(runtimeRoots.global.id, runtimeRoots.global);
        runtimeRoots.scenes.forEach(root => map.set(root.id, root));
        return map;
    }, [nodeById, runtimeNodeById, runtimeRoots]);
    const getRuntimeRoot = React.useCallback((scope, sceneId = null) => (
        scope === 'global' ? runtimeRoots.global : (runtimeRoots.scenes.get(sceneId) || null)
    ), [runtimeRoots]);
    const getRuntimeTreeId = React.useCallback(node => {
        if (!node) return null;
        return node.protected ? getRuntimeRootTreeId(node) : node.id;
    }, []);
    const getRuntimeChildren = React.useCallback(parentId => (
        parentId ? (runtimeChildrenByParentId.get(parentId) || []) : []
    ), [runtimeChildrenByParentId]);
    const globalRuntimeRoot = sceneSystemEnabled ? getRuntimeRoot('global') : null;
    const activeSceneRuntimeRoot = sceneSystemEnabled && activeScene ?
        getRuntimeRoot('scene', activeScene.id) : null;
    const customNodeCount = allNodes.filter(node => !node.targetId).length;
    const nativeRuntimeNodeCount = runtimeNodes.length;
    const visibleEntityNodeCount = entityNodes.filter(node => (
        node.kind === 'stage' || !scratchBindingByTargetRuntimeId.has(node.targetId)
    )).length;
    const nonStageEntityCount = entityNodes.filter(node => (
        node.kind !== 'stage' && !scratchBindingByTargetRuntimeId.has(node.targetId)
    )).length;
    const activeRuntimeNodeCount = runtimeNodes.filter(node => node.sceneId === activeSceneId).length;
    const sceneNodeTreeEmpty = customNodeCount === 0 && nonStageEntityCount === 0 && activeRuntimeNodeCount === 0;

    React.useEffect(() => {
        if (!nodeDatabase || typeof nodeDatabase.getExpandedNodeIds !== 'function') return;
        const persistedIds = new Set(nodeDatabase.getExpandedNodeIds());
        const realNodeIds = new Set(allNodes.map(node => node.id));
        expandedNodeIds.forEach(nodeId => {
            if (realNodeIds.has(nodeId) && !persistedIds.has(nodeId)) onToggleNode(nodeId, false);
        });
        persistedIds.forEach(nodeId => {
            if (expandedNodeIds.indexOf(nodeId) === -1) onToggleNode(nodeId, true);
        });
    }, [allNodes, expandedNodeIds, nodeDatabase, nodeRevision, onToggleNode]);

    React.useEffect(() => {
        if (!selectedNodeId || !selectableNodeById.has(selectedNodeId)) return;
        setSelectedNodeIds(previous => (
            previous.indexOf(selectedNodeId) !== -1 ? previous : [selectedNodeId]
        ));
        setSelectionAnchorId(selectedNodeId);
    }, [selectableNodeById, selectedNodeId]);

    React.useEffect(() => {
        setSelectedNodeIds(previous => previous.filter(nodeId => selectableNodeById.has(nodeId)));
    }, [selectableNodeById]);

    React.useEffect(() => {
        const editingTargetChanged = previousEditingTargetIdRef.current !== editingTargetId;
        previousEditingTargetIdRef.current = editingTargetId;
        if (!editingTargetId) {
            compatibilitySelectionProjectionRef.current = null;
            return;
        }

        const pendingProjection = compatibilitySelectionProjectionRef.current;
        if (pendingProjection) {
            if (pendingProjection.targetRuntimeId === editingTargetId) {
                compatibilitySelectionProjectionRef.current = null;
                return;
            }
            if (editingTargetChanged) compatibilitySelectionProjectionRef.current = null;
        }

        const hasSemanticSelection = selectedNodeIds.length > 0 || Boolean(
            selectedNodeId && selectableNodeById.has(selectedNodeId)
        );
        if (!editingTargetChanged && hasSemanticSelection) return;

        const roleManagerNodeId = scratchRoleManagerParity &&
            typeof scratchRoleManagerParity.resolveNodeIdForTarget === 'function' ?
            scratchRoleManagerParity.resolveNodeIdForTarget(editingTargetId, activeSceneId) : null;
        const adapterBinding = scratchBindingByTargetRuntimeId.get(editingTargetId);
        const projectedNodeId = roleManagerNodeId || (adapterBinding && adapterBinding.nodeId);
        if (projectedNodeId) {
            if (selectedNodeId !== projectedNodeId) {
                workspaceNodeCommandClient.selectNode({nodeId: projectedNodeId});
            }
            return;
        }

        if (!nodeDatabase) return;
        const selectedRuntimeNode = selectedNodeId ? runtimeNodeById.get(selectedNodeId) : null;
        if (selectedRuntimeNode && !editingTargetChanged) return;
        const selectedNode = selectedNodeId ? nodeDatabase.getNode(selectedNodeId) : null;
        if (selectedNode && !editingTargetChanged) return;
        const selectedTargetNode = selectedNode ? nodeDatabase.getNearestTargetNode(selectedNode.id) : null;
        if (selectedTargetNode && selectedTargetNode.targetId === editingTargetId) return;
        const targetNode = nodeDatabase.getNodeForTarget(editingTargetId);
        if (targetNode && targetNode.id !== selectedNodeId) {
            workspaceNodeCommandClient.selectNode({nodeId: targetNode.id});
        }
    }, [
        activeSceneId,
        editingTargetId,
        nodeDatabase,
        nodeRevision,
        runtimeNodeById,
        scratchBindingByTargetRuntimeId,
        scratchRoleManagerParity,
        selectableNodeById,
        selectedNodeId,
        selectedNodeIds,
        workspaceNodeCommandClient
    ]);

    React.useEffect(() => () => {
        if (dragExpandTimerRef.current) window.clearTimeout(dragExpandTimerRef.current);
    }, []);

    const searchResult = React.useMemo(() => {
        if (!normalizedSearchQuery) return null;
        const matchIds = new Set();
        const visibleIds = new Set();
        const searchNodes = allNodes.filter(node => (
            !node.targetId || !scratchBindingByTargetRuntimeId.has(node.targetId)
        )).concat(runtimeNodes);
        searchNodes.forEach(node => {
            const runtimeNode = runtimeNodeById.has(node.id);
            const nodeType = runtimeNode ?
                (runtimeNodeTypeById.get(node.typeId) || null) :
                (nodeDatabase ? nodeDatabase.getNodeType(node.typeId) : null);
            const haystack = [
                node.name,
                node.typeId,
                nodeType ? nodeType.label : '',
                nodeType ? nodeType.category : '',
                node.pluginId || '',
                node.scope || '',
                node.sceneId || ''
            ].join(' ').toLowerCase();
            if (haystack.indexOf(normalizedSearchQuery) === -1) return;
            matchIds.add(node.id);
            let current = node;
            const visited = new Set();
            while (current && !visited.has(current.id)) {
                visited.add(current.id);
                visibleIds.add(current.id);
                if (current.targetId) {
                    const binding = scratchBindingByTargetRuntimeId.get(current.targetId);
                    if (binding) {
                        let runtimeCurrent = selectableNodeById.get(binding.nodeId);
                        while (runtimeCurrent && !visited.has(runtimeCurrent.id)) {
                            visited.add(runtimeCurrent.id);
                            visibleIds.add(runtimeCurrent.id);
                            runtimeCurrent = runtimeCurrent.parentId ?
                                selectableNodeById.get(runtimeCurrent.parentId) : null;
                        }
                    }
                }
                current = current.parentId ? selectableNodeById.get(current.parentId) : null;
            }
        });
        sceneSnapshotProjections.forEach((projection, sceneId) => {
            const targetByNodeId = new Map(projection.targets
                .filter(target => target.nodeId)
                .map(target => [target.nodeId, target]));
            const bindingByTargetIndex = new Map((scratchBindingsBySceneId.get(sceneId) || [])
                .filter(binding => Number.isInteger(binding.serializedTargetIndex))
                .map(binding => [binding.serializedTargetIndex, binding]));
            projection.nodes.forEach(node => {
                const nodeType = nodeDatabase ? nodeDatabase.getNodeType(node.typeId) : null;
                const haystack = [
                    node.name,
                    node.typeId,
                    nodeType ? nodeType.label : '',
                    nodeType ? nodeType.category : '',
                    node.pluginId || '',
                    sceneId
                ].join(' ').toLowerCase();
                if (haystack.indexOf(normalizedSearchQuery) === -1) return;
                let current = node;
                const visited = new Set();
                while (current && !visited.has(current.id)) {
                    visited.add(current.id);
                    visibleIds.add(getSceneSnapshotNodeTreeId(sceneId, current.id));
                    const target = targetByNodeId.get(current.id);
                    if (target) {
                        const binding = bindingByTargetIndex.get(target.index);
                        if (binding) {
                            let runtimeCurrent = selectableNodeById.get(binding.nodeId);
                            while (runtimeCurrent && !visited.has(runtimeCurrent.id)) {
                                visited.add(runtimeCurrent.id);
                                visibleIds.add(runtimeCurrent.id);
                                runtimeCurrent = runtimeCurrent.parentId ?
                                    selectableNodeById.get(runtimeCurrent.parentId) : null;
                            }
                        }
                    }
                    current = current.parentId ? projection.getNode(current.parentId) : null;
                }
                matchIds.add(getSceneSnapshotNodeTreeId(sceneId, node.id));
            });
        });
        return {matchIds, visibleIds};
    }, [
        allNodes,
        nodeDatabase,
        normalizedSearchQuery,
        runtimeNodeById,
        runtimeNodeTypeById,
        runtimeNodes,
        sceneSnapshotProjections,
        scratchBindingByTargetRuntimeId,
        scratchBindingsBySceneId,
        selectableNodeById
    ]);
    const searchActive = Boolean(searchResult);
    const isVisibleForSearch = nodeId => !searchActive || searchResult.visibleIds.has(nodeId);
    const isExpandedForRender = nodeId => searchActive || expandedNodeIds.indexOf(nodeId) !== -1;

    const projectCompatibilityTarget = React.useCallback((targetRuntimeId, nodeId) => {
        if (!targetRuntimeId || targetRuntimeId === editingTargetId) return;
        compatibilitySelectionProjectionRef.current = {
            nodeId,
            targetRuntimeId
        };
        onSelectTarget(targetRuntimeId);
    }, [editingTargetId, onSelectTarget]);

    const activatePrimaryNode = React.useCallback(node => {
        if (!node) return;
        workspaceNodeCommandClient.selectNode({nodeId: node.id});
        const roleManagerTargetId = scratchRoleManagerParity &&
            typeof scratchRoleManagerParity.resolveTargetRuntimeIdForNode === 'function' ?
            scratchRoleManagerParity.resolveTargetRuntimeIdForNode(node.id) : null;
        const scratchBinding = scratchBindingByNodeId.get(node.id);
        const projectedTargetId = roleManagerTargetId || (scratchBinding && scratchBinding.targetRuntimeId);
        if (projectedTargetId) {
            projectCompatibilityTarget(projectedTargetId, node.id);
        }
        if (runtimeNodeById.has(node.id) || (node.protected && node.scope)) return;
        if (!nodeDatabase) return;
        const targetNode = node.targetId ? node : nodeDatabase.getNearestTargetNode(node.id);
        if (targetNode && targetNode.targetId) projectCompatibilityTarget(targetNode.targetId, node.id);
    }, [
        nodeDatabase,
        projectCompatibilityTarget,
        runtimeNodeById,
        scratchBindingByNodeId,
        scratchRoleManagerParity,
        workspaceNodeCommandClient
    ]);

    const setSelectionAndActivate = React.useCallback((nodeIds, primaryNodeId) => {
        const validIds = Array.from(new Set(nodeIds)).filter(nodeId => selectableNodeById.has(nodeId));
        setSelectedNodeIds(validIds);
        const resolvedPrimaryId = primaryNodeId && validIds.indexOf(primaryNodeId) !== -1 ?
            primaryNodeId : validIds[validIds.length - 1];
        if (resolvedPrimaryId) {
            activatePrimaryNode(selectableNodeById.get(resolvedPrimaryId));
            setSelectionAnchorId(resolvedPrimaryId);
        } else {
            workspaceNodeCommandClient.selectNode({nodeId: null});
            setSelectionAnchorId(null);
        }
    }, [activatePrimaryNode, selectableNodeById, workspaceNodeCommandClient]);

    React.useEffect(() => {
        const runtimeSelection = selectedNodeIds
            .map(nodeId => selectableNodeById.get(nodeId))
            .find(node => node && (node.scope === 'global' || node.sceneId));
        if (!runtimeSelection) return;
        const selectionKey = runtimeSelection.scope === 'global' ? 'global' : runtimeSelection.sceneId;
        runtimeSelectionBySceneRef.current.set(selectionKey, runtimeSelection.id);
    }, [selectableNodeById, selectedNodeIds]);

    React.useEffect(() => {
        const previousActiveSceneId = previousActiveSceneIdRef.current;
        previousActiveSceneIdRef.current = activeSceneId || null;
        if (!sceneSystemEnabled || !activeSceneId || previousActiveSceneId === null ||
            previousActiveSceneId === activeSceneId) return;
        const selectedRuntimeNode = selectedNodeIds
            .map(nodeId => selectableNodeById.get(nodeId))
            .find(node => node && (node.scope === 'global' || node.scope === 'scene'));
        if (selectedRuntimeNode && selectedRuntimeNode.scope === 'global') return;
        if (selectedRuntimeNode && selectedRuntimeNode.sceneId === activeSceneId) return;
        const rememberedNodeId = runtimeSelectionBySceneRef.current.get(activeSceneId);
        if (rememberedNodeId && selectableNodeById.has(rememberedNodeId)) {
            setSelectionAndActivate([rememberedNodeId], rememberedNodeId);
            return;
        }
        const sceneRoot = getRuntimeRoot('scene', activeSceneId);
        if (sceneRoot && selectableNodeById.has(sceneRoot.id)) {
            setSelectionAndActivate([sceneRoot.id], sceneRoot.id);
        }
    }, [
        activeSceneId,
        getRuntimeRoot,
        sceneSystemEnabled,
        selectableNodeById,
        selectedNodeIds,
        setSelectionAndActivate
    ]);

    const visibleNodeOrder = [];
    const visitProjectVisibleNode = node => {
        if (!nodeDatabase || !node || !isVisibleForSearch(node.id)) return;
        visibleNodeOrder.push(node.id);
        if (!isExpandedForRender(node.id)) return;
        nodeDatabase.getChildren(node.id).forEach(visitProjectVisibleNode);
    };
    if (nodeDatabase) {
        entityNodes.forEach(entityNode => {
            if (entityNode.kind === 'sprite' && scratchBindingByTargetRuntimeId.has(entityNode.targetId)) return;
            const targetNode = nodeDatabase.getNodeForTarget(entityNode.targetId);
            if (targetNode) visitProjectVisibleNode(targetNode);
        });
        nodeDatabase.getChildren(null)
            .filter(node => !node.targetId)
            .forEach(visitProjectVisibleNode);
    }
    if (runtimeNodeModel) {
        const visitRuntimeVisibleNode = node => {
            if (!node || !isVisibleForSearch(node.id)) return;
            visibleNodeOrder.push(node.id);
            if (!isExpandedForRender(node.id)) return;
            getRuntimeChildren(node.id).forEach(visitRuntimeVisibleNode);
            const binding = scratchBindingByNodeId.get(node.id);
            const targetNode = binding && binding.targetRuntimeId && nodeDatabase ?
                nodeDatabase.getNodeForTarget(binding.targetRuntimeId) : null;
            if (targetNode) nodeDatabase.getChildren(targetNode.id).forEach(visitProjectVisibleNode);
        };
        if (globalRuntimeRoot && (searchActive || expandedNodeIds.indexOf(GLOBAL_SCOPE_NODE_ID) !== -1)) {
            getRuntimeChildren(globalRuntimeRoot.id).forEach(visitRuntimeVisibleNode);
        }
        scenes.forEach(scene => {
            const root = getRuntimeRoot('scene', scene.id);
            if (!root) return;
            const treeId = getSceneTreeNodeId(scene.id);
            if (searchActive || expandedNodeIds.indexOf(treeId) !== -1) {
                getRuntimeChildren(root.id).forEach(visitRuntimeVisibleNode);
            }
        });
    }

    const handleNodeSelection = (node, event = {}) => {
        if (!node) return;
        if (event.currentTarget && typeof event.currentTarget.focus === 'function') event.currentTarget.focus();
        const additive = Boolean(event.ctrlKey || event.metaKey);
        const rangeSelection = Boolean(event.shiftKey && selectionAnchorId);
        let nextSelection;
        if (rangeSelection) {
            const anchorIndex = visibleNodeOrder.indexOf(selectionAnchorId);
            const nodeIndex = visibleNodeOrder.indexOf(node.id);
            if (anchorIndex !== -1 && nodeIndex !== -1) {
                const start = Math.min(anchorIndex, nodeIndex);
                const end = Math.max(anchorIndex, nodeIndex);
                const rangeIds = visibleNodeOrder.slice(start, end + 1);
                nextSelection = additive ? Array.from(new Set(selectedNodeIds.concat(rangeIds))) : rangeIds;
            }
        }
        if (!nextSelection) {
            if (additive) {
                nextSelection = selectedNodeIds.indexOf(node.id) === -1 ?
                    selectedNodeIds.concat(node.id) : selectedNodeIds.filter(nodeId => nodeId !== node.id);
            } else {
                nextSelection = [node.id];
            }
            setSelectionAnchorId(node.id);
        }
        const primaryId = nextSelection.indexOf(node.id) !== -1 ?
            node.id : nextSelection[nextSelection.length - 1];
        const previousAnchorId = selectionAnchorId;
        setSelectionAndActivate(nextSelection, primaryId);
        if (rangeSelection && previousAnchorId) setSelectionAnchorId(previousAnchorId);
    };

    const selectedNodes = selectedNodeIds.map(nodeId => selectableNodeById.get(nodeId)).filter(Boolean);
    const isRuntimeNodeView = node => Boolean(node && (
        runtimeNodeById.has(node.id) || (node.protected && node.scope)
    ));
    const selectedRuntimeNodes = selectedNodes.filter(isRuntimeNodeView);
    const selectedProjectNodes = selectedNodes.filter(node => !isRuntimeNodeView(node));

    const openCreateNodeDialog = (parentNode = null, family = null) => {
        setNodeContextMenu(null);
        setCreateNodeRequest({
            family,
            kind: 'project',
            parentNodeId: parentNode ? parentNode.id : null
        });
    };

    const openRuntimeCreateNodeDialog = ({parentId, sceneId = null, scope}) => {
        setNodeContextMenu(null);
        setCreateNodeRequest({
            family: null,
            kind: 'runtime',
            parentNodeId: parentId,
            sceneId,
            scope
        });
    };

    const openPrimarySceneNodeDialog = () => {
        setNodeContextMenu(null);
        if (!moduleManager) {
            setRuntimeEditorNotice({
                code: 'FUNCTIONAL_NODE_RUNTIME_UNAVAILABLE',
                kind: 'error',
                message: 'Functional Node runtime is unavailable.',
                suggestion: 'Reload the editor and verify the NGVGE first-party module framework is active.'
            });
            return false;
        }
        try {
            if (!sceneSystemEnabled) moduleManager.enableModule(SCENE_SYSTEM_MODULE_ID);
            const freshRuntimeNodeModel = moduleManager.getCapability(RUNTIME_NODE_MODEL_CAPABILITY_ID);
            const freshSceneProject = moduleManager.getModuleData(SCENE_SYSTEM_MODULE_ID, null);
            const freshScenes = freshSceneProject && Array.isArray(freshSceneProject.scenes) ?
                freshSceneProject.scenes : [];
            const freshActiveScene = freshScenes.find(scene => scene.id === freshSceneProject.activeSceneId) ||
                freshScenes[0] || null;
            const freshRoot = freshRuntimeNodeModel && freshActiveScene ?
                freshRuntimeNodeModel.getSceneRoot(freshActiveScene.id) : null;
            if (!freshRoot || !freshActiveScene) {
                const error = new Error('Functional Node runtime did not publish an active Scene root.');
                error.code = 'FUNCTIONAL_NODE_SCENE_ROOT_UNAVAILABLE';
                throw error;
            }
            openRuntimeCreateNodeDialog({
                parentId: freshRoot.id,
                sceneId: freshActiveScene.id,
                scope: 'scene'
            });
            return true;
        } catch (error) {
            reportRuntimeNodeError(error, {action: 'activate-functional-node-runtime'});
            return false;
        }
    };

    const openFunctionalChildDialogForCompatibilityNode = node => {
        if (!node || !nodeDatabase || !moduleManager || !sceneSystemEnabled) return false;
        const nearestTargetNode = nodeDatabase.getNearestTargetNode(node.id);
        if (!nearestTargetNode || !nearestTargetNode.targetId) return false;
        try {
            const sceneProject = moduleManager.getModuleData(SCENE_SYSTEM_MODULE_ID, null);
            const sceneList = sceneProject && Array.isArray(sceneProject.scenes) ? sceneProject.scenes : [];
            const scene = sceneList.find(candidate => candidate.id === sceneProject.activeSceneId) || sceneList[0] || null;
            if (!scene || !runtimeNodeModel) return false;
            const sceneRoot = runtimeNodeModel.getSceneRoot(scene.id);
            if (!sceneRoot) return false;
            const scratchRuntime = vm && vm.runtime;
            const scratchTarget = scratchRuntime && typeof scratchRuntime.getTargetById === 'function' ?
                scratchRuntime.getTargetById(nearestTargetNode.targetId) : null;
            let parentId = sceneRoot.id;
            if (scratchTarget && !scratchTarget.isStage) {
                const binding = scratchBindingByTargetRuntimeId.get(nearestTargetNode.targetId) || null;
                if (!binding || !binding.nodeId) {
                    setRuntimeEditorNotice({
                        code: 'FUNCTIONAL_NODE_SCRATCH_PARENT_UNAVAILABLE',
                        kind: 'error',
                        message: 'This Scratch target is not bound to a Functional Sprite2D node yet.',
                        suggestion: 'Reconcile the active scene or add the node from the Scene root.'
                    });
                    return true;
                }
                parentId = binding.nodeId;
            }
            openRuntimeCreateNodeDialog({
                parentId,
                sceneId: scene.id,
                scope: 'scene'
            });
            return true;
        } catch (error) {
            reportRuntimeNodeError(error, {action: 'add-functional-child-from-compatibility'});
            return true;
        }
    };

    const createPresetRoot = nodeTypeId => {
        const payload = workspaceNodeCommandClient.createNode({
            domain: WORKSPACE_NODE_DOMAINS.PROJECT_COMPATIBILITY,
            options: {},
            parentId: null,
            typeId: nodeTypeId
        });
        const finish = commandPayload => {
            const node = commandPayload.node;
            handleToggleNode(PROJECT_ROOT_NODE_ID, true);
            handleToggleNode(ENTITIES_ROOT_NODE_ID, true);
            setSelectionAndActivate([node.id], node.id);
            return node;
        };
        return settleWorkspaceNodeCommand(payload, finish, error => {
            if (typeof window !== 'undefined') window.alert(error.message || 'Unable to create the node.');
            return null;
        });
    };

    const createNodeFromDialog = (nodeTypeId, name) => {
        if (!createNodeRequest) return;
        const parentId = createNodeRequest.parentNodeId || null;
        if (createNodeRequest.kind === 'runtime') {
            if (!runtimeNodeModel || !workspaceNodeCommandClient || !parentId) return;
            const finish = commandPayload => {
                const node = commandPayload.node;
                const runtimeParent = runtimeNodeModel.getNodeSnapshot(parentId);
                handleToggleNode(getRuntimeTreeId(runtimeParent) || parentId, true);
                handleToggleNode(PROJECT_ROOT_NODE_ID, true);
                setSelectionAndActivate([node.id], node.id);
                setCreateNodeRequest(null);
                return node;
            };
            try {
                let runtimeTypeId = nodeTypeId;
                let createOptions = {
                    name,
                    sceneId: createNodeRequest.sceneId,
                    scope: createNodeRequest.scope
                };
                if (functionalNodeCreation && typeof functionalNodeCreation.isArchetype === 'function' &&
                    functionalNodeCreation.isArchetype(nodeTypeId)) {
                    const plan = materializePortableCapabilityValue(
                        functionalNodeCreation.createPlan(nodeTypeId, createOptions)
                    );
                    runtimeTypeId = plan.runtimeTypeId;
                    createOptions = plan.options;
                }
                return settleWorkspaceNodeCommand(
                    workspaceNodeCommandClient.createNode({
                        domain: WORKSPACE_NODE_DOMAINS.RUNTIME,
                        options: createOptions,
                        parentId,
                        typeId: runtimeTypeId
                    }),
                    finish,
                    error => reportRuntimeNodeError(error, {action: 'create', typeId: nodeTypeId})
                );
            } catch (error) {
                return reportRuntimeNodeError(error, {action: 'create', typeId: nodeTypeId});
            }
        }
        const finishProjectCreate = payload => {
            const node = payload.node;
            if (parentId) handleToggleNode(parentId, true);
            handleToggleNode(PROJECT_ROOT_NODE_ID, true);
            handleToggleNode(ENTITIES_ROOT_NODE_ID, true);
            setSelectionAndActivate([node.id], node.id);
            setCreateNodeRequest(null);
            return node;
        };
        try {
            return settleWorkspaceNodeCommand(
                workspaceNodeCommandClient.createNode({
                    domain: WORKSPACE_NODE_DOMAINS.PROJECT_COMPATIBILITY,
                    options: {name},
                    parentId,
                    typeId: nodeTypeId
                }),
                finishProjectCreate,
                error => {
                    if (typeof window !== 'undefined') window.alert(error.message || 'Unable to create the node.');
                    return null;
                }
            );
        } catch (error) {
            if (typeof window !== 'undefined') window.alert(error.message || 'Unable to create the node.');
            return null;
        }
    };

    const getBranchIds = nodeId => {
        if (!nodeDatabase || !nodeId) return [];
        const ids = [];
        const visit = currentId => {
            if (ids.indexOf(currentId) !== -1) return;
            ids.push(currentId);
            nodeDatabase.getChildren(currentId).forEach(child => visit(child.id));
        };
        visit(nodeId);
        return ids;
    };

    const handleExpandBranches = nodes => {
        nodes.forEach(node => getBranchIds(node.id).forEach(nodeId => handleToggleNode(nodeId, true)));
    };

    const handleCollapseBranches = nodes => {
        nodes.forEach(node => getBranchIds(node.id).reverse().forEach(nodeId => handleToggleNode(nodeId, false)));
    };

    const handleExpandAll = () => {
        handleToggleNode(PROJECT_ROOT_NODE_ID, true);
        handleToggleNode(ENTITIES_ROOT_NODE_ID, true);
        if (sceneSystemEnabled) {
            handleToggleNode(GLOBAL_SCOPE_NODE_ID, true);
            scenes.forEach(scene => handleToggleNode(getSceneTreeNodeId(scene.id), true));
        }
        if (nodeDatabase) {
            allNodes.forEach(node => {
                if (nodeDatabase.getChildren(node.id).length) handleToggleNode(node.id, true);
            });
        }
        runtimeNodes.forEach(node => {
            if (getRuntimeChildren(node.id).length) handleToggleNode(node.id, true);
        });
    };

    const handleCollapseAll = () => {
        allNodes.forEach(node => handleToggleNode(node.id, false));
        runtimeNodes.forEach(node => handleToggleNode(node.id, false));
        if (sceneSystemEnabled) {
            handleToggleNode(GLOBAL_SCOPE_NODE_ID, false);
            scenes.forEach(scene => handleToggleNode(getSceneTreeNodeId(scene.id), false));
        }
    };

    const handleDuplicateNodes = nodes => {
        const editableIds = nodes.filter(node => !node.targetId).map(node => node.id);
        if (!editableIds.length) return;
        const finish = payload => {
            const duplicates = payload.nodes || [];
            if (!duplicates.length) return payload;
            duplicates.forEach(duplicate => {
                if (duplicate.parentId) handleToggleNode(duplicate.parentId, true);
            });
            setSelectionAndActivate(duplicates.map(node => node.id), duplicates[duplicates.length - 1].id);
            return payload;
        };
        return settleWorkspaceNodeCommand(
            workspaceNodeCommandClient.duplicateNodes({nodeIds: editableIds}),
            finish,
            error => {
                if (typeof window !== 'undefined') window.alert(error.message || 'Unable to duplicate the selected nodes.');
                return null;
            }
        );
    };

    const handleToggleNodesEnabled = (nodes, enabled) => {
        const editableIds = nodes.filter(node => !node.targetId).map(node => node.id);
        editableIds.forEach(nodeId => {
            workspaceNodeCommandClient.patchNode({nodeId, patch: {enabled}});
        });
    };

    const handleMakeNodesRoot = nodes => {
        const editableIds = nodes.filter(node => !node.targetId && node.parentId).map(node => node.id);
        if (!editableIds.length) return;
        const finish = payload => {
            handleToggleNode(ENTITIES_ROOT_NODE_ID, true);
            setSelectionAndActivate(editableIds, editableIds[editableIds.length - 1]);
            return payload;
        };
        return settleWorkspaceNodeCommand(
            workspaceNodeCommandClient.reparentNodes({nodeIds: editableIds, parentId: null}),
            finish,
            error => {
                if (typeof window !== 'undefined') window.alert(error.message || 'Unable to reparent the selected nodes.');
                return null;
            }
        );
    };

    const handleDeleteNodes = nodes => {
        if (!nodeDatabase) return;
        const editableNodes = nodes.filter(node => !node.targetId);
        if (!editableNodes.length) return;
        const label = editableNodes.length === 1 ?
            `"${editableNodes[0].name}"` : `${editableNodes.length} selected nodes`;
        if (typeof window !== 'undefined' && !window.confirm(`Delete ${label} and their child nodes?`)) return;
        const fallbackParent = editableNodes
            .map(node => node.parentId ? nodeById.get(node.parentId) : null)
            .find(Boolean);
        const editableIds = editableNodes.map(node => node.id);
        const finish = payload => {
            if (fallbackParent && nodeDatabase.getNode(fallbackParent.id)) {
                setSelectionAndActivate([fallbackParent.id], fallbackParent.id);
            } else if (editingTargetId) {
                const targetNode = nodeDatabase.getNodeForTarget(editingTargetId);
                if (targetNode) setSelectionAndActivate([targetNode.id], targetNode.id);
                else setSelectionAndActivate([], null);
            } else {
                setSelectionAndActivate([], null);
            }
            return payload;
        };
        return settleWorkspaceNodeCommand(
            workspaceNodeCommandClient.destroyNodes({nodeIds: editableIds}),
            finish,
            error => {
                if (typeof window !== 'undefined') window.alert(error.message || 'Unable to delete the selected nodes.');
                return null;
            }
        );
    };

    const handleRenameNode = node => {
        if (!node || node.targetId) return;
        setRenameNodeRequest(Object.assign({kind: 'project'}, node));
    };

    const submitRenameNode = name => {
        if (!renameNodeRequest) return;
        if (renameNodeRequest.kind === 'runtime') {
            if (!workspaceNodeCommandClient) return;
            try {
                return settleWorkspaceNodeCommand(
                    workspaceNodeCommandClient.patchNode({
                        nodeId: renameNodeRequest.id,
                        patch: {name}
                    }),
                    payload => {
                        const renamed = payload.node;
                        setRenameNodeRequest(null);
                        if (renamed) setSelectionAndActivate([renamed.id], renamed.id);
                        return renamed;
                    },
                    error => reportRuntimeNodeError(error, {action: 'rename', nodeId: renameNodeRequest.id})
                );
            } catch (error) {
                return reportRuntimeNodeError(error, {action: 'rename', nodeId: renameNodeRequest.id});
            }
        }
        try {
            const payload = workspaceNodeCommandClient.patchNode({
                nodeId: renameNodeRequest.id,
                patch: {name}
            });
            return settleWorkspaceNodeCommand(payload, commandPayload => {
                const renamed = commandPayload.node;
                setRenameNodeRequest(null);
                if (renamed) setSelectionAndActivate([renamed.id], renamed.id);
                return renamed;
            }, error => { throw error; });
        } catch (error) {
            if (typeof window !== 'undefined') window.alert(error.message || 'Unable to rename the node.');
        }
    };

    const handleRenameRuntimeNode = node => {
        if (!node || node.protected) return;
        setRenameNodeRequest({
            id: node.id,
            kind: 'runtime',
            name: node.name
        });
    };

    const handleDuplicateRuntimeNode = node => {
        if (!runtimeNodeModel || !node || node.protected || !workspaceNodeCommandClient) return;
        const finish = payload => {
            const duplicate = payload.node;
            if (duplicate.parentId) {
                const parent = runtimeNodeModel.getNodeSnapshot(duplicate.parentId);
                handleToggleNode(getRuntimeTreeId(parent) || duplicate.parentId, true);
            }
            setSelectionAndActivate([duplicate.id], duplicate.id);
            return duplicate;
        };
        try {
            return settleWorkspaceNodeCommand(
                workspaceNodeCommandClient.duplicateNode({nodeId: node.id}),
                finish,
                error => reportRuntimeNodeError(error, {action: 'duplicate', nodeId: node.id, nodeName: node.name})
            );
        } catch (error) {
            return reportRuntimeNodeError(error, {action: 'duplicate', nodeId: node.id, nodeName: node.name});
        }
    };

    const getRuntimeNodeMoveState = node => {
        if (!runtimeNodeModel || !node || node.protected) return {canMoveDown: false, canMoveUp: false};
        const parent = runtimeNodeModel.getParent(node.id);
        if (!parent) return {canMoveDown: false, canMoveUp: false};
        const siblings = runtimeNodeModel.getChildren(parent.id);
        const index = siblings.findIndex(sibling => sibling.id === node.id);
        return {
            canMoveDown: index >= 0 && index < siblings.length - 1,
            canMoveUp: index > 0,
            index,
            parentId: parent.id
        };
    };

    const handleMoveRuntimeNode = (node, delta) => {
        if (!runtimeNodeModel || !node || node.protected || !workspaceNodeCommandClient) return null;
        const moveState = getRuntimeNodeMoveState(node);
        const targetIndex = moveState.index + delta;
        if (!Number.isInteger(moveState.index) || targetIndex < 0 ||
            (delta < 0 && !moveState.canMoveUp) || (delta > 0 && !moveState.canMoveDown)) return null;
        try {
            return settleWorkspaceNodeCommand(
                workspaceNodeCommandClient.reparentNode({
                    nodeId: node.id,
                    parentId: moveState.parentId,
                    options: {index: targetIndex}
                }),
                payload => {
                    setSelectionAndActivate([node.id], node.id);
                    return payload;
                },
                error => reportRuntimeNodeError(error, {action: 'move', nodeId: node.id, nodeName: node.name})
            );
        } catch (error) {
            return reportRuntimeNodeError(error, {action: 'move', nodeId: node.id, nodeName: node.name});
        }
    };

    const handleToggleRuntimeNodeEnabled = (node, enabled) => {
        if (!runtimeNodeModel || !node || node.protected || !workspaceNodeCommandClient) return;
        try {
            return settleWorkspaceNodeCommand(
                workspaceNodeCommandClient.patchNode({nodeId: node.id, patch: {enabled}}),
                payload => payload,
                error => reportRuntimeNodeError(error, {action: 'update', nodeId: node.id, nodeName: node.name})
            );
        } catch (error) {
            return reportRuntimeNodeError(error, {action: 'update', nodeId: node.id, nodeName: node.name});
        }
    };

    const handleDeleteRuntimeNode = node => {
        if (!runtimeNodeModel || !node || node.protected || !workspaceNodeCommandClient) return;
        if (typeof window !== 'undefined' && !window.confirm(`Delete "${node.name}" and its child nodes?`)) return;
        const parent = runtimeNodeModel.getParent(node.id);
        const finish = payload => {
            if (parent) setSelectionAndActivate([parent.id], parent.id);
            else setSelectionAndActivate([], null);
            return payload;
        };
        try {
            return settleWorkspaceNodeCommand(
                workspaceNodeCommandClient.destroyNode({nodeId: node.id}),
                finish,
                error => reportRuntimeNodeError(error, {action: 'delete', nodeId: node.id, nodeName: node.name})
            );
        } catch (error) {
            return reportRuntimeNodeError(error, {action: 'delete', nodeId: node.id, nodeName: node.name});
        }
    };

    const handleMakeRuntimeNodeRoot = node => {
        if (!runtimeNodeModel || !node || node.protected) return;
        try {
            const root = node.scope === 'global' ?
                runtimeNodeModel.getGlobalRoot() : runtimeNodeModel.getSceneRoot(node.sceneId);
            if (!workspaceNodeCommandClient) return;
            return settleWorkspaceNodeCommand(
                workspaceNodeCommandClient.reparentNode({nodeId: node.id, parentId: root.id}),
                payload => {
                    handleToggleNode(getRuntimeTreeId(root) || root.id, true);
                    setSelectionAndActivate([node.id], node.id);
                    return payload;
                },
                error => reportRuntimeNodeError(error, {action: 'move', nodeId: node.id, nodeName: node.name})
            );
        } catch (error) {
            return reportRuntimeNodeError(error, {action: 'move', nodeId: node.id, nodeName: node.name});
        }
    };

    const openNodeContextMenu = (event, node) => {
        event.preventDefault();
        event.stopPropagation();
        if (selectedNodeIds.indexOf(node.id) === -1) {
            setSelectionAndActivate([node.id], node.id);
        } else {
            activatePrimaryNode(node);
        }
        setNodeContextMenu({
            nodeId: node.id,
            x: Math.min(event.clientX, window.innerWidth - 245),
            y: Math.min(event.clientY, window.innerHeight - 360)
        });
    };

    const openRuntimeNodeContextMenu = (event, node) => {
        event.preventDefault();
        event.stopPropagation();
        setSelectionAndActivate([node.id], node.id);
        setNodeContextMenu({
            runtimeNode: true,
            nodeId: node.id,
            x: Math.min(event.clientX, window.innerWidth - 245),
            y: Math.min(event.clientY, window.innerHeight - 360)
        });
    };

    const enterScene = React.useCallback(async sceneId => {
        if (!sceneId || !moduleManager || !sceneSystemEnabled) return null;
        try {
            const controller = moduleManager.getCapability(SCENE_CONTROLLER_CAPABILITY_ID);
            if (!controller || typeof controller.execute !== 'function') return null;
            const resultJSON = await controller.execute('enter', JSON.stringify({sceneId}));
            setSceneRevision(revision => revision + 1);
            return typeof resultJSON === 'string' ? JSON.parse(resultJSON) : null;
        } catch (error) {
            reportRuntimeNodeError(error, {action: 'import', title: 'Unable to enter scene'});
            return null;
        }
    }, [moduleManager, reportRuntimeNodeError, sceneSystemEnabled]);

    const openRuntimeRootContextMenu = (event, root, options = {}) => {
        event.preventDefault();
        event.stopPropagation();
        if (!root) return;
        setNodeContextMenu({
            addLabel: options.addLabel || '+ Add Child Node',
            enterSceneId: options.enterSceneId || null,
            runtimeRoot: true,
            parentId: root.id,
            sceneId: root.sceneId,
            scope: root.scope,
            title: options.title || root.name,
            x: Math.min(event.clientX, window.innerWidth - 230),
            y: Math.min(event.clientY, window.innerHeight - 190)
        });
    };

    const clearDragState = () => {
        if (dragExpandTimerRef.current) {
            window.clearTimeout(dragExpandTimerRef.current);
            dragExpandTimerRef.current = null;
        }
        setDragState({active: false, kind: null, nodeIds: [], targetId: null});
    };

    const startNodeDrag = (event, node) => {
        if (!nodeDatabase || !node || node.targetId) {
            event.preventDefault();
            return;
        }
        const candidateIds = selectedNodeIds.indexOf(node.id) !== -1 ?
            selectedNodes.filter(selectedNode => !selectedNode.targetId).map(selectedNode => selectedNode.id) :
            [node.id];
        const validation = typeof nodeDatabase.canReparentNodes === 'function' ?
            nodeDatabase.canReparentNodes(candidateIds, null) : {nodeIds: candidateIds, ok: true};
        if (!validation.ok || !validation.nodeIds.length) {
            event.preventDefault();
            return;
        }
        const dragIds = validation.nodeIds;
        if (selectedNodeIds.indexOf(node.id) === -1) setSelectionAndActivate([node.id], node.id);
        setDragState({active: true, kind: 'project', nodeIds: dragIds, targetId: null});
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/x-ngvge-node-ids', JSON.stringify(dragIds));
        event.dataTransfer.setData('text/plain', dragIds.join(','));
    };

    const canDropNodes = parentId => {
        if (!nodeDatabase || !dragState.active || dragState.kind !== 'project' || !dragState.nodeIds.length) return false;
        if (typeof nodeDatabase.canReparentNodes !== 'function') return true;
        return nodeDatabase.canReparentNodes(dragState.nodeIds, parentId).ok;
    };

    const handleNodeDragEnter = (event, parentId, targetKey) => {
        event.stopPropagation();
        if (!canDropNodes(parentId)) return;
        setDragState(previous => Object.assign({}, previous, {targetId: targetKey}));
        if (parentId && expandedNodeIds.indexOf(parentId) === -1 && !searchActive) {
            if (dragExpandTimerRef.current) window.clearTimeout(dragExpandTimerRef.current);
            dragExpandTimerRef.current = window.setTimeout(() => handleToggleNode(parentId, true), 650);
        }
    };

    const handleNodeDragOver = (event, parentId, targetKey) => {
        if (!canDropNodes(parentId)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        if (dragState.targetId !== targetKey) {
            setDragState(previous => Object.assign({}, previous, {targetId: targetKey}));
        }
    };

    const handleNodeDrop = (event, parentId) => {
        if (!canDropNodes(parentId)) return;
        event.preventDefault();
        event.stopPropagation();
        const finish = payload => {
            if (parentId) handleToggleNode(parentId, true);
            handleToggleNode(ENTITIES_ROOT_NODE_ID, true);
            setSelectionAndActivate(dragState.nodeIds, dragState.nodeIds[dragState.nodeIds.length - 1]);
            clearDragState();
            return payload;
        };
        try {
            return settleWorkspaceNodeCommand(
                workspaceNodeCommandClient.reparentNodes({nodeIds: dragState.nodeIds, parentId}),
                finish,
                error => {
                    if (typeof window !== 'undefined') window.alert(error.message || 'Unable to move the selected nodes.');
                    clearDragState();
                    return null;
                }
            );
        } catch (error) {
            if (typeof window !== 'undefined') window.alert(error.message || 'Unable to move the selected nodes.');
            clearDragState();
            return null;
        }
    };

    const startRuntimeNodeDrag = (event, node) => {
        if (!runtimeNodeModel || !node || node.protected) {
            event.preventDefault();
            return;
        }
        setSelectionAndActivate([node.id], node.id);
        setDragState({active: true, kind: 'runtime', nodeIds: [node.id], targetId: null});
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/x-ngvge-runtime-node-id', node.id);
        event.dataTransfer.setData('text/plain', node.id);
    };

    const canDropRuntimeNode = parentId => {
        if (!runtimeNodeModel || !dragState.active || dragState.kind !== 'runtime' ||
            dragState.nodeIds.length !== 1 || !parentId) return false;
        if (typeof runtimeNodeModel.canSetParent === 'function') {
            return runtimeNodeModel.canSetParent(dragState.nodeIds[0], parentId).ok;
        }
        const node = runtimeNodeModel.getNodeSnapshot(dragState.nodeIds[0]);
        const parent = runtimeNodeModel.getNodeSnapshot(parentId);
        if (!node || !parent || node.id === parent.id) return false;
        return node.scope === parent.scope && node.sceneId === parent.sceneId;
    };

    const handleRuntimeDragEnter = (event, parentId, targetKey) => {
        event.stopPropagation();
        if (!canDropRuntimeNode(parentId)) return;
        setDragState(previous => Object.assign({}, previous, {targetId: targetKey}));
        const parent = runtimeNodeModel.getNodeSnapshot(parentId);
        const treeId = getRuntimeTreeId(parent) || parentId;
        if (expandedNodeIds.indexOf(treeId) === -1 && !searchActive) {
            if (dragExpandTimerRef.current) window.clearTimeout(dragExpandTimerRef.current);
            dragExpandTimerRef.current = window.setTimeout(() => handleToggleNode(treeId, true), 650);
        }
    };

    const handleRuntimeDragOver = (event, parentId, targetKey) => {
        if (!canDropRuntimeNode(parentId)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        if (dragState.targetId !== targetKey) {
            setDragState(previous => Object.assign({}, previous, {targetId: targetKey}));
        }
    };

    const handleRuntimeDrop = (event, parentId) => {
        if (!canDropRuntimeNode(parentId)) return;
        event.preventDefault();
        event.stopPropagation();
        const nodeId = dragState.nodeIds[0];
        const finish = payload => {
            const parent = runtimeNodeModel.getNodeSnapshot(parentId);
            handleToggleNode(getRuntimeTreeId(parent) || parentId, true);
            setSelectionAndActivate([nodeId], nodeId);
            clearDragState();
            return payload;
        };
        try {
            if (!workspaceNodeCommandClient) return;
            return settleWorkspaceNodeCommand(
                workspaceNodeCommandClient.reparentNode({nodeId, parentId}),
                finish,
                error => {
                    clearDragState();
                    return reportRuntimeNodeError(error, {action: 'move', nodeId});
                }
            );
        } catch (error) {
            clearDragState();
            return reportRuntimeNodeError(error, {action: 'move', nodeId});
        }
    };

    const handleExplorerKeyDown = event => {
        const target = event.target;
        if (target && (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable
        )) return;
        if (createNodeRequest || renameNodeRequest) return;
        if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown') &&
            selectedRuntimeNodes.length === 1 && !selectedProjectNodes.length) {
            event.preventDefault();
            event.stopPropagation();
            handleMoveRuntimeNode(selectedRuntimeNodes[0], event.key === 'ArrowUp' ? -1 : 1);
        } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNodes.length) {
            event.preventDefault();
            if (selectedRuntimeNodes.length === 1 && !selectedProjectNodes.length) {
                handleDeleteRuntimeNode(selectedRuntimeNodes[0]);
            } else if (selectedProjectNodes.some(node => !node.targetId) && !selectedRuntimeNodes.length) {
                handleDeleteNodes(selectedProjectNodes);
            }
        } else if (event.key === 'F2' && selectedNodes.length === 1) {
            event.preventDefault();
            if (selectedRuntimeNodes.length) handleRenameRuntimeNode(selectedRuntimeNodes[0]);
            else if (!selectedNodes[0].targetId) handleRenameNode(selectedNodes[0]);
        } else if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === 'd' &&
            selectedNodes.length
        ) {
            event.preventDefault();
            if (selectedRuntimeNodes.length === 1 && !selectedProjectNodes.length) {
                handleDuplicateRuntimeNode(selectedRuntimeNodes[0]);
            } else if (selectedProjectNodes.some(node => !node.targetId) && !selectedRuntimeNodes.length) {
                handleDuplicateNodes(selectedProjectNodes);
            }
        } else if (event.key === 'Escape' && selectedNodeIds.length > 1) {
            event.preventDefault();
            const primaryId = selectedNodeId && selectableNodeById.has(selectedNodeId) ?
                selectedNodeId : selectedNodeIds[0];
            setSelectionAndActivate(primaryId ? [primaryId] : [], primaryId);
        }
    };

    const renderCustomNode = (node, depth) => {
        if (!isVisibleForSearch(node.id)) return null;
        const nodeType = nodeDatabase.getNodeType(node.typeId);
        const children = nodeDatabase.getChildren(node.id).filter(child => isVisibleForSearch(child.id));
        const acceptsChildren = !nodeType || nodeType.allowChildren !== false;
        return (
            <TreeNode
                depth={depth}
                draggable={!node.targetId}
                dragging={dragState.active && dragState.nodeIds.indexOf(node.id) !== -1}
                dropActive={dragState.active && dragState.targetId === node.id}
                expanded={isExpandedForRender(node.id)}
                icon={nodeType ? nodeType.icon : '?'}
                key={node.id}
                label={node.name}
                nodeId={node.id}
                secondaryLabel={nodeType ? nodeType.label : 'Missing type'}
                selected={selectedNodeIds.indexOf(node.id) !== -1}
                onActivate={event => handleNodeSelection(node, event)}
                onContextMenu={event => openNodeContextMenu(event, node)}
                onDragEnd={clearDragState}
                onDragEnter={acceptsChildren ? event => handleNodeDragEnter(event, node.id, node.id) : null}
                onDragLeave={event => {
                    if (!event.currentTarget.contains(event.relatedTarget) && dragState.targetId === node.id) {
                        setDragState(previous => Object.assign({}, previous, {targetId: null}));
                    }
                }}
                onDragOver={acceptsChildren ? event => handleNodeDragOver(event, node.id, node.id) : null}
                onDragStart={event => startNodeDrag(event, node)}
                onDrop={acceptsChildren ? event => handleNodeDrop(event, node.id) : null}
                onToggle={handleToggleNode}
            >
                {children.length ? children.map(child => renderCustomNode(child, depth + 1)) : null}
            </TreeNode>
        );
    };

    const getRuntimeNodeIcon = (node, nodeType = null) => {
        const resolvedType = nodeType || (node && node.id && node.allowedScopes ? node : null);
        if (node && node.originalTypeId) return '⚠';
        if (!resolvedType) return '?';
        if (resolvedType.family === 'service') return '◆';
        if (resolvedType.family === '2d') return '◇';
        return '○';
    };

    const renderSnapshotProjectNode = (projection, node, depth) => {
        if (!projection || !node) return null;
        const treeNodeId = getSceneSnapshotNodeTreeId(projection.sceneId, node.id);
        if (!isVisibleForSearch(treeNodeId)) return null;
        const nodeType = nodeDatabase ? nodeDatabase.getNodeType(node.typeId) : null;
        const children = projection.getChildren(node.id)
            .filter(child => isVisibleForSearch(getSceneSnapshotNodeTreeId(projection.sceneId, child.id)));
        return (
            <TreeNode
                depth={depth}
                expanded={isExpandedForRender(treeNodeId)}
                icon={nodeType ? nodeType.icon : '·'}
                key={treeNodeId}
                label={node.name}
                nodeId={treeNodeId}
                secondaryLabel={`${nodeType ? nodeType.label : node.typeId} · Snapshot`}
                selected={false}
                onToggle={handleToggleNode}
            >
                {children.length ? children.map(child => renderSnapshotProjectNode(projection, child, depth + 1)) : null}
            </TreeNode>
        );
    };

    const renderSnapshotTarget = (projection, target, depth) => {
        if (!projection || !target) return null;
        const targetNode = target.nodeId ? projection.getNode(target.nodeId) : null;
        const treeNodeId = targetNode ?
            getSceneSnapshotNodeTreeId(projection.sceneId, targetNode.id) :
            getSceneSnapshotTargetTreeId(projection.sceneId, target.index);
        if (!isVisibleForSearch(treeNodeId) && searchActive) return null;
        const children = targetNode ? projection.getChildren(targetNode.id) : [];
        return (
            <TreeNode
                depth={depth}
                expanded={isExpandedForRender(treeNodeId)}
                icon={target.isStage ? '▣' : '●'}
                key={treeNodeId}
                label={target.name}
                nodeId={treeNodeId}
                secondaryLabel={`${target.isStage ? 'Stage' : 'Sprite'} · Snapshot`}
                selected={false}
                onToggle={handleToggleNode}
            >
                {children.length ? children.map(child => renderSnapshotProjectNode(projection, child, depth + 1)) : null}
            </TreeNode>
        );
    };

    const renderRuntimeNode = (node, depth, snapshotProjection = null) => {
        if (!node || !isVisibleForSearch(node.id)) return null;
        const nodeType = runtimeNodeTypeById.get(node.typeId) || null;
        const children = getRuntimeChildren(node.id).filter(child => isVisibleForSearch(child.id));
        const scratchBinding = scratchBindingByNodeId.get(node.id);
        const compatibilityTargetNode = scratchBinding && scratchBinding.targetRuntimeId && nodeDatabase ?
            nodeDatabase.getNodeForTarget(scratchBinding.targetRuntimeId) : null;
        const compatibilityChildren = compatibilityTargetNode && nodeDatabase ?
            nodeDatabase.getChildren(compatibilityTargetNode.id)
                .filter(child => isVisibleForSearch(child.id)) : [];
        const snapshotTarget = scratchBinding && snapshotProjection &&
            Number.isInteger(scratchBinding.serializedTargetIndex) ?
            snapshotProjection.getTarget(scratchBinding.serializedTargetIndex) : null;
        const snapshotTargetNode = snapshotTarget && snapshotTarget.nodeId ?
            snapshotProjection.getNode(snapshotTarget.nodeId) : null;
        const snapshotCompatibilityChildren = snapshotTargetNode ?
            snapshotProjection.getChildren(snapshotTargetNode.id) : [];
        const acceptsChildren = !nodeType || nodeType.allowChildren !== false;
        const scratchStatusLabel = scratchBinding ?
            `Scratch · ${scratchBinding.status === 'bound' ? 'Bound' : scratchBinding.status}` : null;
        return (
            <TreeNode
                depth={depth}
                draggable={!node.protected}
                dragging={dragState.kind === 'runtime' && dragState.nodeIds.indexOf(node.id) !== -1}
                dropActive={dragState.kind === 'runtime' && dragState.targetId === node.id}
                expanded={isExpandedForRender(node.id)}
                icon={getRuntimeNodeIcon(node, nodeType)}
                key={node.id}
                label={node.name}
                nodeId={node.id}
                secondaryLabel={node.originalTypeId ? `Missing · ${node.originalTypeId}` : (
                    scratchStatusLabel || (nodeType ? `${nodeType.label} · Native` : 'Native node')
                )}
                selected={
                    selectedNodeIds.indexOf(node.id) !== -1 ||
                    (!selectedNodeIds.length && !selectedNodeId && scratchBinding &&
                        scratchBinding.targetRuntimeId === editingTargetId)
                }
                targetId={scratchBinding ? scratchBinding.targetRuntimeId : null}
                onActivate={event => handleNodeSelection(node, event)}
                onContextMenu={event => openRuntimeNodeContextMenu(event, node)}
                onDragEnd={clearDragState}
                onDragEnter={acceptsChildren ? event => handleRuntimeDragEnter(event, node.id, node.id) : null}
                onDragLeave={event => {
                    if (!event.currentTarget.contains(event.relatedTarget) && dragState.targetId === node.id) {
                        setDragState(previous => Object.assign({}, previous, {targetId: null}));
                    }
                }}
                onDragOver={acceptsChildren ? event => handleRuntimeDragOver(event, node.id, node.id) : null}
                onDragStart={event => startRuntimeNodeDrag(event, node)}
                onDrop={acceptsChildren ? event => handleRuntimeDrop(event, node.id) : null}
                onToggle={handleToggleNode}
            >
                {children.length ? children.map(child => renderRuntimeNode(child, depth + 1, snapshotProjection)) : null}
                {compatibilityChildren.length ?
                    compatibilityChildren.map(child => renderCustomNode(child, depth + 1)) : null}
                {!compatibilityChildren.length && snapshotCompatibilityChildren.length ?
                    snapshotCompatibilityChildren.map(child =>
                        renderSnapshotProjectNode(snapshotProjection, child, depth + 1)) : null}
            </TreeNode>
        );
    };

    const rootCustomNodes = nodeDatabase ?
        nodeDatabase.getChildren(null).filter(node => !node.targetId && isVisibleForSearch(node.id)) : [];
    const visibleEntityNodes = entityNodes.filter(entityNode => {
        if (entityNode.kind === 'sprite' && scratchBindingByTargetRuntimeId.has(entityNode.targetId)) return false;
        if (!searchActive || !nodeDatabase) return true;
        const targetNode = nodeDatabase.getNodeForTarget(entityNode.targetId);
        return targetNode && isVisibleForSearch(targetNode.id);
    });
    const contextNode = nodeContextMenu && !nodeContextMenu.root && !nodeContextMenu.runtimeNode && nodeDatabase ?
        nodeDatabase.getNode(nodeContextMenu.nodeId) : null;
    const contextNodes = contextNode ? (
        selectedNodeIds.indexOf(contextNode.id) !== -1 ? selectedProjectNodes : [contextNode]
    ) : [];
    const contextNodeType = contextNode && nodeDatabase ? nodeDatabase.getNodeType(contextNode.typeId) : null;
    const runtimeContextNode = nodeContextMenu && nodeContextMenu.runtimeNode && runtimeNodeModel ?
        runtimeNodeModel.getNodeSnapshot(nodeContextMenu.nodeId) : null;
    const runtimeContextBinding = runtimeContextNode ? scratchBindingByNodeId.get(runtimeContextNode.id) : null;
    const runtimeContextNodeType = runtimeContextNode ?
        (runtimeNodeTypeById.get(runtimeContextNode.typeId) || null) : null;
    const runtimeContextParent = runtimeContextNode && runtimeNodeModel ?
        runtimeNodeModel.getParent(runtimeContextNode.id) : null;
    const runtimeContextMenuNode = runtimeContextNode ? Object.assign({}, runtimeContextNode, {
        enabled: runtimeContextNode.enabledSelf,
        parentId: runtimeContextParent && !runtimeContextParent.protected ? runtimeContextParent.id : null
    }) : null;
    const runtimeContextMoveState = runtimeContextNode ? getRuntimeNodeMoveState(runtimeContextNode) : {
        canMoveDown: false,
        canMoveUp: false
    };
    const createNodeParent = createNodeRequest && createNodeRequest.parentNodeId ? (
        createNodeRequest.kind === 'runtime' && runtimeNodeModel ?
            runtimeNodeModel.getNodeSnapshot(createNodeRequest.parentNodeId) :
            (nodeDatabase ? nodeDatabase.getNode(createNodeRequest.parentNodeId) : null)
    ) : null;
    const runtimeNodeTypeSource = createNodeRequest && createNodeRequest.kind === 'runtime' && runtimeNodeModel ? {
        listNodeTypes: () => {
            const runtimeTypes = runtimeNodeModel.listNodeTypes({scope: createNodeRequest.scope})
                .filter(nodeType => !nodeType.abstract &&
                    nodeType.allowedScopes.indexOf(createNodeRequest.scope) !== -1);
            if (!functionalNodeCreation || typeof functionalNodeCreation.listArchetypes !== 'function') {
                return runtimeTypes.map(nodeType => Object.assign({}, nodeType, {
                    icon: getRuntimeNodeIcon(nodeType)
                }));
            }
            const archetypes = materializePortableCapabilityValue(
                functionalNodeCreation.listArchetypes({scope: createNodeRequest.scope})
            );
            const replacedRuntimeTypeIds = new Set(archetypes.map(archetype => archetype.baseRuntimeTypeId));
            return archetypes.map(archetype => Object.assign({}, archetype, {
                icon: getRuntimeNodeIcon(archetype),
                pluginId: 'NGVGE Core'
            })).concat(runtimeTypes
                .filter(nodeType => !replacedRuntimeTypeIds.has(nodeType.id))
                .map(nodeType => Object.assign({}, nodeType, {
                    icon: getRuntimeNodeIcon(nodeType)
                })));
        }
    } : null;
    const nodeSearchMatchCount = searchResult ? searchResult.matchIds.size : allNodes.length + runtimeNodes.length;

    return (
        <React.Fragment>
        <aside
            aria-label="Node Explorer"
            data-ngvge-command-scope="project"
            data-ngvge-object-manager="runtime-node-primary"
            data-ngvge-selection-authority="node-id"
            data-ngvge-role-manager-parity={scratchRoleManagerParity ? 'active' : 'compatibility-only'}
            data-ngvge-keyboard-command-scope="explorer-capture"
            data-ngvge-runtime-reorder-shortcut="Alt+ArrowUp|Alt+ArrowDown"
            className={classNames(styles.projectExplorer, {
                [styles.projectExplorerEmbedded]: showHeader
            })}
            ref={explorerRef}
            style={showHeader ? {width} : undefined}
            tabIndex={-1}
            onKeyDownCapture={handleExplorerKeyDown}
        >
            {showHeader ? (
                <header className={styles.header}>
                    <div className={styles.headerText}>
                        <span className={styles.eyebrow}>NGVGE</span>
                        <h2 className={styles.title}>
                            <FormattedMessage
                                defaultMessage="Node Explorer"
                                description="Title of the primary Runtime Node Explorer panel"
                                id="gui.nodeExplorer.title"
                            />
                        </h2>
                    </div>
                    <button
                        aria-label="Close Node Explorer"
                        className={styles.closeButton}
                        type="button"
                        onClick={onClose}
                    >
                        <CloseIcon />
                    </button>
                </header>
            ) : null}
            <div className={styles.sceneTreeToolbar}>
                <div className={styles.sceneTreeSearch}>
                    <span aria-hidden="true"><SearchIcon /></span>
                    <input
                        aria-label="Search scene nodes"
                        placeholder="Search nodes..."
                        value={searchQuery}
                        onChange={event => setSearchQuery(event.target.value)}
                    />
                    {searchQuery ? (
                        <button
                            aria-label="Clear node search"
                            type="button"
                            onClick={() => setSearchQuery('')}
                        >
                            <CloseIcon />
                        </button>
                    ) : null}
                </div>
                <button
                    aria-label="Add functional scene node"
                    className={styles.functionalNodeLauncher}
                    data-ngvge-functional-node-launcher="scene"
                    title={sceneSystemEnabled ? 'Add Scene Node' : 'Activate Functional Nodes and add a Scene Node'}
                    type="button"
                    onClick={openPrimarySceneNodeDialog}
                >
                    <span aria-hidden="true">+</span>
                </button>
                {onOpenLegacySprites ? (
                    <button
                        aria-label="Open Legacy Sprites compatibility view"
                        className={styles.legacySpritesLauncher}
                        data-ngvge-compatibility-launcher="scratch-target-pane"
                        title="Open Legacy Sprites (Compatibility)"
                        type="button"
                        onClick={onOpenLegacySprites}
                    >
                        <LegacySpritesIcon />
                    </button>
                ) : null}
                {selectedNodeIds.length > 1 ? (
                    <div className={styles.sceneTreeSelectionStatus}>{selectedNodeIds.length} selected</div>
                ) : null}
            </div>
            {runtimeEditorNotice ? (
                <div
                    className={classNames(styles.runtimeNodeNotice, {
                        [styles.runtimeNodeNoticeWarning]: runtimeEditorNotice.kind === 'warning'
                    })}
                    role="alert"
                >
                    <div className={styles.runtimeNodeNoticeBody}>
                        <strong>{runtimeEditorNotice.title}</strong>
                        <span>{runtimeEditorNotice.message}</span>
                        {runtimeEditorNotice.suggestion ? <small>{runtimeEditorNotice.suggestion}</small> : null}
                    </div>
                    <button
                        aria-label="Dismiss runtime node message"
                        type="button"
                        onClick={() => setRuntimeEditorNotice(null)}
                    >
                        <CloseIcon />
                    </button>
                </div>
            ) : null}
            <div className={styles.content}>
                <div aria-multiselectable="true" className={styles.tree} role="tree">
                    <TreeNode
                        expanded={rootExpanded || searchActive}
                        icon="◇"
                        label={(
                            <FormattedMessage
                                defaultMessage="Project"
                                description="Root node in the project explorer"
                                id="gui.projectExplorer.projectRoot"
                            />
                        )}
                        nodeId={PROJECT_ROOT_NODE_ID}
                        onToggle={handleToggleNode}
                    >
                        {sceneSystemEnabled ? (
                            <TreeNode
                                depth={1}
                                dropActive={dragState.kind === 'runtime' &&
                                    globalRuntimeRoot && dragState.targetId === globalRuntimeRoot.id}
                                expanded={expandedNodeIds.indexOf(GLOBAL_SCOPE_NODE_ID) !== -1 || searchActive}
                                icon="◆"
                                label="Global"
                                nodeId={GLOBAL_SCOPE_NODE_ID}
                                secondaryLabel={`${runtimeNodes.filter(node => node.scope === 'global').length} nodes · Persistent`}
                                selected={Boolean(globalRuntimeRoot && selectedNodeIds.indexOf(globalRuntimeRoot.id) !== -1)}
                                onActivate={event => {
                                    if (globalRuntimeRoot) handleNodeSelection(globalRuntimeRoot, event);
                                }}
                                onContextMenu={event => openRuntimeRootContextMenu(event, globalRuntimeRoot, {
                                    addLabel: '+ Add Global Node',
                                    title: 'Global'
                                })}
                                onDragEnter={globalRuntimeRoot ?
                                    event => handleRuntimeDragEnter(event, globalRuntimeRoot.id, globalRuntimeRoot.id) : null}
                                onDragLeave={event => {
                                    if (globalRuntimeRoot && !event.currentTarget.contains(event.relatedTarget) &&
                                        dragState.targetId === globalRuntimeRoot.id) {
                                        setDragState(previous => Object.assign({}, previous, {targetId: null}));
                                    }
                                }}
                                onDragOver={globalRuntimeRoot ?
                                    event => handleRuntimeDragOver(event, globalRuntimeRoot.id, globalRuntimeRoot.id) : null}
                                onDrop={globalRuntimeRoot ?
                                    event => handleRuntimeDrop(event, globalRuntimeRoot.id) : null}
                                onToggle={handleToggleNode}
                            >
                                {globalRuntimeRoot && getRuntimeChildren(globalRuntimeRoot.id).length ?
                                    getRuntimeChildren(globalRuntimeRoot.id).map(node => renderRuntimeNode(node, 2)) : (
                                        <div className={styles.emptyState} role="note">
                                            Right-click Global to add a persistent service or core node.
                                        </div>
                                    )}
                            </TreeNode>
                        ) : null}
                        <TreeNode
                            depth={1}
                            dropActive={Boolean(
                                dragState.active && (dragState.targetId === SCENE_ROOT_DROP_ID ||
                                (activeSceneRuntimeRoot && dragState.targetId === activeSceneRuntimeRoot.id))
                            )}
                            expanded={entitiesExpanded || searchActive}
                            icon={sceneSystemEnabled ? '▣' : '◫'}
                            label={sceneSystemEnabled && activeScene ? activeScene.name : (
                                <FormattedMessage
                                    defaultMessage="Entities"
                                    description="Entities provider root in the project explorer"
                                    id="gui.projectExplorer.entitiesRoot"
                                />
                            )}
                            nodeId={activeSceneTreeNodeId}
                            selected={Boolean(activeSceneRuntimeRoot &&
                                selectedNodeIds.indexOf(activeSceneRuntimeRoot.id) !== -1)}
                            secondaryLabel={
                                sceneSystemEnabled ? (
                                    searchActive ? `${nodeSearchMatchCount} matches` :
                                        `${visibleEntityNodeCount + customNodeCount + activeRuntimeNodeCount} nodes · Active`
                                ) : (
                                    searchActive ? `${nodeSearchMatchCount} matches` :
                                        (nodeDatabase ? allNodes.length : entityNodes.length)
                                )
                            }
                            onActivate={sceneSystemEnabled && activeSceneRuntimeRoot ? event =>
                                handleNodeSelection(activeSceneRuntimeRoot, event) : null}
                            onContextMenu={event => {
                                if (sceneSystemEnabled) {
                                    openRuntimeRootContextMenu(event, activeSceneRuntimeRoot, {
                                        addLabel: '+ Add Scene Node',
                                        enterSceneId: activeScene ? activeScene.id : null,
                                        title: activeScene ? activeScene.name : 'Scene'
                                    });
                                    return;
                                }
                                event.preventDefault();
                                event.stopPropagation();
                                setNodeContextMenu({
                                    root: true,
                                    x: Math.min(event.clientX, window.innerWidth - 230),
                                    y: Math.min(event.clientY, window.innerHeight - 170)
                                });
                            }}
                            onDragEnter={event => {
                                if (dragState.kind === 'runtime' && activeSceneRuntimeRoot) {
                                    handleRuntimeDragEnter(event, activeSceneRuntimeRoot.id, activeSceneRuntimeRoot.id);
                                } else {
                                    handleNodeDragEnter(event, null, SCENE_ROOT_DROP_ID);
                                }
                            }}
                            onDragLeave={event => {
                                if (
                                    !event.currentTarget.contains(event.relatedTarget) &&
                                    (dragState.targetId === SCENE_ROOT_DROP_ID ||
                                    (activeSceneRuntimeRoot && dragState.targetId === activeSceneRuntimeRoot.id))
                                ) {
                                    setDragState(previous => Object.assign({}, previous, {targetId: null}));
                                }
                            }}
                            onDragOver={event => {
                                if (dragState.kind === 'runtime' && activeSceneRuntimeRoot) {
                                    handleRuntimeDragOver(event, activeSceneRuntimeRoot.id, activeSceneRuntimeRoot.id);
                                } else {
                                    handleNodeDragOver(event, null, SCENE_ROOT_DROP_ID);
                                }
                            }}
                            onDrop={event => {
                                if (dragState.kind === 'runtime' && activeSceneRuntimeRoot) {
                                    handleRuntimeDrop(event, activeSceneRuntimeRoot.id);
                                } else {
                                    handleNodeDrop(event, null);
                                }
                            }}
                            onToggle={handleToggleNode}
                        >
                            {activeSceneRuntimeRoot ?
                                getRuntimeChildren(activeSceneRuntimeRoot.id).map(node => renderRuntimeNode(node, 2)) : null}
                            {visibleEntityNodes.length ? visibleEntityNodes.map(entityNode => {
                                const targetNode = nodeDatabase ?
                                    nodeDatabase.getNodeForTarget(entityNode.targetId) : null;
                                const nodeId = targetNode ? targetNode.id : entityNode.id;
                                const children = targetNode && nodeDatabase ?
                                    nodeDatabase.getChildren(targetNode.id)
                                        .filter(child => isVisibleForSearch(child.id)) : [];
                                const targetType = targetNode && nodeDatabase ?
                                    nodeDatabase.getNodeType(targetNode.typeId) : null;
                                const acceptsChildren = !targetType || targetType.allowChildren !== false;
                                return (
                                    <TreeNode
                                        depth={2}
                                        dropActive={dragState.active && dragState.targetId === nodeId}
                                        expanded={
                                            targetNode ? isExpandedForRender(nodeId) :
                                                expandedNodeIds.indexOf(nodeId) !== -1
                                        }
                                        icon={entityNode.icon}
                                        key={entityNode.id}
                                        label={entityNode.label}
                                        nodeId={nodeId}
                                        secondaryLabel={entityNode.kind === 'stage' ? 'Stage' : 'Sprite'}
                                        selected={
                                            selectedNodeIds.indexOf(nodeId) !== -1 ||
                                            (!selectedNodeIds.length && !selectedNodeId &&
                                                entityNode.id === getTargetNodeId(editingTargetId))
                                        }
                                        targetId={entityNode.targetId}
                                        onActivate={event => {
                                            if (targetNode) handleNodeSelection(targetNode, event);
                                            else onSelectTarget(entityNode.targetId);
                                        }}
                                        onContextMenu={event => {
                                            if (targetNode) openNodeContextMenu(event, targetNode);
                                        }}
                                        onDragEnter={acceptsChildren ?
                                            event => handleNodeDragEnter(event, nodeId, nodeId) : null}
                                        onDragLeave={event => {
                                            if (
                                                !event.currentTarget.contains(event.relatedTarget) &&
                                                dragState.targetId === nodeId
                                            ) {
                                                setDragState(previous => Object.assign({}, previous, {targetId: null}));
                                            }
                                        }}
                                        onDragOver={acceptsChildren ?
                                            event => handleNodeDragOver(event, nodeId, nodeId) : null}
                                        onDrop={acceptsChildren ? event => handleNodeDrop(event, nodeId) : null}
                                        onToggle={handleToggleNode}
                                    >
                                        {children.length ? children.map(child => renderCustomNode(child, 3)) : null}
                                    </TreeNode>
                                );
                            }) : null}
                            {rootCustomNodes.map(node => renderCustomNode(node, 2))}
                            {sceneNodeTreeEmpty && !searchActive ? (
                                sceneSystemEnabled ? (
                                    <div className={styles.emptyState} role="note">
                                        Right-click this scene to add its first native child node.
                                    </div>
                                ) : <EmptyNodeActions onCreatePreset={createPresetRoot} />
                            ) : null}
                            {searchActive && nodeSearchMatchCount === 0 ? (
                                <div className={styles.emptyState} role="note">
                                    No nodes match “{searchQuery.trim()}”.
                                </div>
                            ) : null}
                        </TreeNode>
                        {sceneSystemEnabled ? scenes
                            .filter(scene => !activeScene || scene.id !== activeScene.id)
                            .map(scene => {
                                const sceneTreeNodeId = getSceneTreeNodeId(scene.id);
                                const sceneRoot = getRuntimeRoot('scene', scene.id);
                                const nativeChildren = sceneRoot ? getRuntimeChildren(sceneRoot.id) : [];
                                const snapshotProjection = sceneSnapshotProjections.get(scene.id) || null;
                                const sceneBindings = scratchBindingsBySceneId.get(scene.id) || [];
                                const boundTargetIndexes = new Set(sceneBindings
                                    .filter(binding => Number.isInteger(binding.serializedTargetIndex))
                                    .map(binding => binding.serializedTargetIndex));
                                const snapshotTargets = snapshotProjection ? snapshotProjection.targets.filter(target => (
                                    target.isStage || !boundTargetIndexes.has(target.index)
                                )) : [];
                                const snapshotRootNodes = snapshotProjection ? snapshotProjection.rootCustomNodes : [];
                                const snapshotMetadata = scene.snapshot && scene.snapshot.metadata ?
                                    scene.snapshot.metadata : {};
                                const spriteCount = Number.isFinite(snapshotMetadata.spriteCount) ?
                                    snapshotMetadata.spriteCount : null;
                                const sceneSummary = [
                                    nativeChildren.length ? `${nativeChildren.length} native` : null,
                                    snapshotProjection ? `${snapshotProjection.nodes.length} projected` : null,
                                    spriteCount === null ? null : `${spriteCount} sprites`,
                                    'Inactive'
                                ].filter(Boolean).join(' · ');
                                return (
                                    <TreeNode
                                        depth={1}
                                        dropActive={dragState.kind === 'runtime' && sceneRoot &&
                                            dragState.targetId === sceneRoot.id}
                                        expanded={expandedNodeIds.indexOf(sceneTreeNodeId) !== -1 || searchActive}
                                        icon="▢"
                                        key={scene.id}
                                        label={scene.name}
                                        nodeId={sceneTreeNodeId}
                                        secondaryLabel={sceneSummary}
                                        selected={Boolean(sceneRoot && selectedNodeIds.indexOf(sceneRoot.id) !== -1)}
                                        onActivate={event => {
                                            if (sceneRoot) handleNodeSelection(sceneRoot, event);
                                        }}
                                        onContextMenu={event => openRuntimeRootContextMenu(event, sceneRoot, {
                                            addLabel: '+ Add Scene Node',
                                            enterSceneId: scene.id,
                                            title: scene.name
                                        })}
                                        onDragEnter={sceneRoot ?
                                            event => handleRuntimeDragEnter(event, sceneRoot.id, sceneRoot.id) : null}
                                        onDragLeave={event => {
                                            if (sceneRoot && !event.currentTarget.contains(event.relatedTarget) &&
                                                dragState.targetId === sceneRoot.id) {
                                                setDragState(previous => Object.assign({}, previous, {targetId: null}));
                                            }
                                        }}
                                        onDragOver={sceneRoot ?
                                            event => handleRuntimeDragOver(event, sceneRoot.id, sceneRoot.id) : null}
                                        onDrop={sceneRoot ? event => handleRuntimeDrop(event, sceneRoot.id) : null}
                                        onToggle={handleToggleNode}
                                    >
                                        {nativeChildren.length ?
                                            nativeChildren.map(node => renderRuntimeNode(node, 2, snapshotProjection)) : null}
                                        {snapshotTargets.length ?
                                            snapshotTargets.map(target => renderSnapshotTarget(snapshotProjection, target, 2)) : null}
                                        {snapshotRootNodes.length ?
                                            snapshotRootNodes.map(node => renderSnapshotProjectNode(snapshotProjection, node, 2)) : null}
                                        {!nativeChildren.length && !snapshotTargets.length && !snapshotRootNodes.length ? (
                                            <div className={styles.emptyState} role="note">
                                                Right-click this scene to add native nodes or enter it to inspect live Scratch targets.
                                            </div>
                                        ) : null}
                                    </TreeNode>
                                );
                            }) : null}
                        <TreeNode
                            depth={1}
                            expanded={assetsExpanded}
                            icon="▧"
                            label="Assets"
                            nodeId={ASSETS_ROOT_NODE_ID}
                            secondaryLabel={assetCount}
                            onActivate={onOpenAssetManager}
                            onToggle={handleToggleNode}
                        >
                            {assetDatabase ? (
                                <div className={styles.assetProviderSummary}>
                                    <div className={styles.assetSummaryGrid}>
                                        <div><span>Images</span><strong>{assetSummary.images}</strong></div>
                                        <div><span>Sounds</span><strong>{assetSummary.sounds}</strong></div>
                                        <div><span>Folders</span><strong>{assetSummary.folders}</strong></div>
                                    </div>
                                    <button
                                        className={styles.openAssetManagerButton}
                                        type="button"
                                        onClick={onOpenAssetManager}
                                    >
                                        Open Asset Workspace
                                    </button>
                                </div>
                            ) : (
                                <div className={styles.emptyState} role="note">
                                    Global asset services are not available.
                                </div>
                            )}
                        </TreeNode>
                    </TreeNode>
                </div>
            </div>
            <footer className={styles.footer}>
                <span className={styles.statusDot} />
                {selectedNodeIds.length > 1 ? `${selectedNodeIds.length} selected · ` : ''}
                {entityNodes.length} targets · {customNodeCount} compatibility nodes · {nativeRuntimeNodeCount} native nodes · {assetCount} global assets
            </footer>
        </aside>
        {createNodeRequest ? (
            <CreateNodeDialog
                family={createNodeRequest.family}
                nodeDatabase={runtimeNodeTypeSource || nodeDatabase}
                parentNode={createNodeParent}
                onCancel={() => setCreateNodeRequest(null)}
                onCreate={createNodeFromDialog}
            />
        ) : null}
        {renameNodeRequest ? (
            <RenameNodeDialog
                node={renameNodeRequest}
                onCancel={() => setRenameNodeRequest(null)}
                onRename={submitRenameNode}
            />
        ) : null}
        {nodeContextMenu && nodeContextMenu.root ? (
            <RootNodeContextMenu
                position={nodeContextMenu}
                onClose={() => setNodeContextMenu(null)}
                onCollapseAll={handleCollapseAll}
                onCreateRoot={moduleManager ? openPrimarySceneNodeDialog : () => openCreateNodeDialog(null, null)}
                onExpandAll={handleExpandAll}
            />
        ) : null}
        {nodeContextMenu && nodeContextMenu.runtimeRoot ? (
            <RootNodeContextMenu
                addLabel={nodeContextMenu.addLabel}
                enterSceneDisabled={Boolean(nodeContextMenu.enterSceneId && nodeContextMenu.enterSceneId === activeSceneId)}
                enterSceneLabel={nodeContextMenu.enterSceneId === activeSceneId ? 'Current Scene' : 'Enter Scene'}
                position={nodeContextMenu}
                title={nodeContextMenu.title}
                onClose={() => setNodeContextMenu(null)}
                onCollapseAll={() => {
                    if (!runtimeNodeModel) return;
                    runtimeNodeModel.querySubtree({
                        includeRoot: true,
                        maxDepth: null,
                        order: 'pre',
                        rootNodeId: nodeContextMenu.parentId
                    }).nodes.forEach(entry => {
                        handleToggleNode(getRuntimeTreeId(entry.node) || entry.node.id, false);
                    });
                }}
                onCreateRoot={() => openRuntimeCreateNodeDialog({
                    parentId: nodeContextMenu.parentId,
                    sceneId: nodeContextMenu.sceneId,
                    scope: nodeContextMenu.scope
                })}
                onEnterScene={nodeContextMenu.enterSceneId ?
                    () => enterScene(nodeContextMenu.enterSceneId) : null}
                onExpandAll={() => {
                    if (!runtimeNodeModel) return;
                    runtimeNodeModel.querySubtree({
                        includeRoot: true,
                        maxDepth: null,
                        order: 'pre',
                        rootNodeId: nodeContextMenu.parentId
                    }).nodes.forEach(entry =>
                        handleToggleNode(getRuntimeTreeId(entry.node) || entry.node.id, true));
                }}
            />
        ) : null}
        {nodeContextMenu && contextNode ? (
            <NodeContextMenu
                node={contextNode}
                nodes={contextNodes}
                nodeType={contextNodeType}
                position={nodeContextMenu}
                onClose={() => setNodeContextMenu(null)}
                onCollapseBranch={() => handleCollapseBranches(contextNodes)}
                onCreateChild={() => {
                    if (!openFunctionalChildDialogForCompatibilityNode(contextNode)) {
                        openCreateNodeDialog(contextNode, null);
                    }
                }}
                onDelete={() => handleDeleteNodes(contextNodes)}
                onDuplicate={() => handleDuplicateNodes(contextNodes)}
                onExpandBranch={() => handleExpandBranches(contextNodes)}
                onMakeRoot={() => handleMakeNodesRoot(contextNodes)}
                onRename={() => handleRenameNode(contextNode)}
                onToggleEnabled={enabled => handleToggleNodesEnabled(contextNodes, enabled)}
            />
        ) : null}
        {nodeContextMenu && runtimeContextMenuNode ? (
            <NodeContextMenu
                canDelete={true}
                canDuplicate={true}
                canMoveDown={runtimeContextMoveState.canMoveDown}
                canMoveUp={runtimeContextMoveState.canMoveUp}
                canRename={true}
                canToggleEnabled={!runtimeContextBinding}
                node={runtimeContextMenuNode}
                nodes={[runtimeContextMenuNode]}
                nodeType={runtimeContextNodeType}
                position={nodeContextMenu}
                onClose={() => setNodeContextMenu(null)}
                onCollapseBranch={() => {
                    runtimeNodeModel.querySubtree({
                        includeRoot: true,
                        maxDepth: null,
                        order: 'post',
                        rootNodeId: runtimeContextMenuNode.id
                    }).nodes.forEach(entry => handleToggleNode(entry.node.id, false));
                }}
                onCreateChild={() => openRuntimeCreateNodeDialog({
                    parentId: runtimeContextMenuNode.id,
                    sceneId: runtimeContextNode.sceneId,
                    scope: runtimeContextNode.scope
                })}
                onDelete={() => handleDeleteRuntimeNode(runtimeContextNode)}
                onDuplicate={() => handleDuplicateRuntimeNode(runtimeContextNode)}
                onExpandBranch={() => {
                    runtimeNodeModel.querySubtree({
                        includeRoot: true,
                        maxDepth: null,
                        order: 'pre',
                        rootNodeId: runtimeContextMenuNode.id
                    }).nodes.forEach(entry => handleToggleNode(entry.node.id, true));
                }}
                makeRootLabel={runtimeContextNode.scope === 'global' ?
                    'Reparent to Global Root' : 'Reparent to Scene Root'}
                onMakeRoot={() => handleMakeRuntimeNodeRoot(runtimeContextNode)}
                onMoveDown={() => handleMoveRuntimeNode(runtimeContextNode, 1)}
                onMoveUp={() => handleMoveRuntimeNode(runtimeContextNode, -1)}
                onRename={() => handleRenameRuntimeNode(runtimeContextNode)}
                onToggleEnabled={enabled => handleToggleRuntimeNodeEnabled(runtimeContextNode, enabled)}
            />
        ) : null}
        </React.Fragment>
    );
};

ProjectExplorer.propTypes = {
    editingTargetId: PropTypes.string,
    expandedNodeIds: PropTypes.arrayOf(PropTypes.string),
    onClose: PropTypes.func,
    onOpenAssetManager: PropTypes.func,
    onOpenLegacySprites: PropTypes.func,
    nodeCommandClient: PropTypes.shape({
        createNode: PropTypes.func.isRequired,
        destroyNode: PropTypes.func.isRequired,
        destroyNodes: PropTypes.func.isRequired,
        duplicateNode: PropTypes.func.isRequired,
        duplicateNodes: PropTypes.func.isRequired,
        patchNode: PropTypes.func.isRequired,
        reparentNode: PropTypes.func.isRequired,
        reparentNodes: PropTypes.func.isRequired,
        selectNode: PropTypes.func.isRequired
    }),
    onSelectNode: PropTypes.func,
    onSelectionContextChange: PropTypes.func,
    onSelectTarget: PropTypes.func,
    onToggleNode: PropTypes.func.isRequired,
    selectedNodeId: PropTypes.string,
    showHeader: PropTypes.bool,
    sprites: PropTypes.objectOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string,
        order: PropTypes.number
    })),
    stage: PropTypes.shape({
        id: PropTypes.string,
        isStage: PropTypes.bool,
        name: PropTypes.string
    }),
    stageLabel: PropTypes.string,
    vm: PropTypes.shape({
        addCostume: PropTypes.func,
        addSound: PropTypes.func,
        emitTargetsUpdate: PropTypes.func,
        on: PropTypes.func,
        runtime: PropTypes.shape({
            emitProjectChanged: PropTypes.func,
            getTargetById: PropTypes.func.isRequired,
            storage: PropTypes.object,
            targets: PropTypes.array
        }).isRequired,
        serializeAssets: PropTypes.func
    }),
    width: PropTypes.number
};

ProjectExplorer.defaultProps = {
    editingTargetId: null,
    expandedNodeIds: [],
    onClose: () => {},
    onOpenAssetManager: () => {},
    onOpenLegacySprites: null,
    nodeCommandClient: null,
    onSelectNode: () => {},
    onSelectionContextChange: () => {},
    onSelectTarget: () => {},
    selectedNodeId: null,
    showHeader: true,
    sprites: {},
    stage: {},
    stageLabel: 'Stage',
    vm: null,
    width: 280
};

export {
    ASSETS_ROOT_NODE_ID,
    ASSET_NODE_PREFIX,
    PROJECT_ROOT_NODE_ID,
    ENTITIES_ROOT_NODE_ID
};

export default ProjectExplorer;
