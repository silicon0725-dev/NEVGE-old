import PropTypes from 'prop-types';
import React from 'react';

import {WORKSPACE_DOCK_RUNTIME_MODEL_ID} from '../../lib/editor-shell/dock-runtime-model';
import {WORKSPACE_DOCK_INTERACTION_CONTROLLER_ID} from '../../lib/editor-shell/dock-interaction-controller';
import {WORKSPACE_DOCK_PLACEMENT_MODEL_ID} from '../../lib/editor-shell/dock-placement-model';
import {
    WORKSPACE_DOCK_ORGANIZATION_MODEL_ID,
    DOCK_ORGANIZATION_KINDS
} from '../../lib/editor-shell/dock-organization-model';
import {WORKSPACE_LAUNCHPAD_MODEL_ID} from '../../lib/editor-shell/launchpad-model';
import WorkspaceLaunchpad from '../workspace-launchpad/workspace-launchpad.jsx';

import styles from './workspace-dock.css';

const TOOL_ICON_PATHS = Object.freeze({
    'node-explorer': (
        <React.Fragment>
            <circle
                cx="5"
                cy="5"
                r="2"
            />
            <circle
                cx="15"
                cy="5"
                r="2"
            />
            <circle
                cx="10"
                cy="15"
                r="2"
            />
            <path d="M6.8 6.2L8.9 12.9M13.2 6.2L11.1 12.9M7 5h6" />
        </React.Fragment>
    ),
    'inspector': (
        <React.Fragment>
            <path d="M4 5h12M4 10h12M4 15h12" />
            <circle
                className={styles.iconFill}
                cx="8"
                cy="5"
                r="1.55"
            />
            <circle
                className={styles.iconFill}
                cx="13"
                cy="10"
                r="1.55"
            />
            <circle
                className={styles.iconFill}
                cx="7"
                cy="15"
                r="1.55"
            />
        </React.Fragment>
    ),
    'assets': (
        <React.Fragment>
            <path d="M3.5 5.5h5l1.5 2h6.5v8.5h-13z" />
            <path d="M3.5 7.5h13" />
        </React.Fragment>
    ),
    'stage': (
        <React.Fragment>
            <rect
                x="3.2"
                y="3.2"
                width="13.6"
                height="13.6"
                rx="2"
            />
            <path d="M7 7h6v6H7z" />
        </React.Fragment>
    ),
    'legacy-sprites': (
        <React.Fragment>
            <rect
                x="3"
                y="4"
                width="14"
                height="12"
                rx="2"
            />
            <circle
                cx="8"
                cy="9"
                r="2"
            />
            <path d="M5.5 14c.5-1.8 1.5-2.7 2.5-2.7s2 .9 2.5 2.7M12 8.5h3M12 11.5h3" />
        </React.Fragment>
    ),
    'extension-manager': (
        <React.Fragment>
            <rect
                x="3"
                y="3"
                width="6"
                height="6"
                rx="1.4"
            />
            <rect
                x="11"
                y="3"
                width="6"
                height="6"
                rx="1.4"
            />
            <rect
                x="3"
                y="11"
                width="6"
                height="6"
                rx="1.4"
            />
            <path d="M12 14h4M14 12v4" />
        </React.Fragment>
    ),
    'agent': (
        <React.Fragment>
            <path d="M5 7.5A5 5 0 0115 7.5v3A5 5 0 015 10.5z" />
            <path d="M7 15.5h6M10 13v2.5M7.5 8.5h.01M12.5 8.5h.01M8 11h4" />
        </React.Fragment>
    ),
    'todo': (
        <React.Fragment>
            <rect x="3.5" y="3.5" width="13" height="13" rx="2" />
            <path d="M6.5 7.5l1.2 1.2 2.1-2.3M11.5 7.5h2M6.5 12h.01M9 12h4.5" />
        </React.Fragment>
    ),
    'paint': (
        <React.Fragment>
            <path d="M4 15.5l3.2-.7 7.7-7.7-2-2-7.7 7.7z" />
            <path d="M11.9 6.1l2 2M4.3 15.2l-.7 1.3 1.3-.7M14.5 4.5l1-1 1.9 1.9-1 1" />
        </React.Fragment>
    ),
    'editor': (
        <React.Fragment>
            <rect
                x="3"
                y="3.5"
                width="14"
                height="13"
                rx="2"
            />
            <path d="M6 7h8M6 10h5M6 13h7" />
        </React.Fragment>
    )
});

const DockToolIcon = ({iconKey}) => (
    <svg
        aria-hidden="true"
        className={styles.toolIcon}
        viewBox="0 0 20 20"
    >
        <g
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.45"
        >
            {TOOL_ICON_PATHS[iconKey] || <rect
                x="4"
                y="4"
                width="12"
                height="12"
                rx="2"
            />}
        </g>
    </svg>
);

DockToolIcon.propTypes = {
    iconKey: PropTypes.string
};

const PinIcon = () => (
    <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
    >
        <path d="M5.2 2.7h5.6l-.8 3 1.7 1.7v1H8.7v4.9L8 14l-.7-.7V8.4H4.3v-1L6 5.7z" />
    </svg>
);

const LaunchpadIcon = () => (
    <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
    >
        <rect
            x="3.5"
            y="3.5"
            width="5"
            height="5"
            rx="1.2"
        />
        <rect
            x="11.5"
            y="3.5"
            width="5"
            height="5"
            rx="1.2"
        />
        <rect
            x="3.5"
            y="11.5"
            width="5"
            height="5"
            rx="1.2"
        />
        <rect
            x="11.5"
            y="11.5"
            width="5"
            height="5"
            rx="1.2"
        />
    </svg>
);

const FolderIcon = () => (
    <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
    >
        <path d="M2.8 5.6h5.4l1.6 2h7.4v8.2H2.8zM2.8 7.6h14.4" />
    </svg>
);

const ChevronIcon = ({expanded}) => (
    <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
    >
        <path d={expanded ? 'M4 9.5L8 5.5l4 4' : 'M4 6.5l4 4 4-4'} />
    </svg>
);

ChevronIcon.propTypes = {
    expanded: PropTypes.bool.isRequired
};

const reorderBlock = (toolIds, sourceIds, targetId) => {
    const sourceSet = new Set(sourceIds);
    if (sourceIds.length === 0 || sourceSet.has(targetId)) return toolIds;
    const remaining = toolIds.filter(toolId => !sourceSet.has(toolId));
    const targetIndex = remaining.indexOf(targetId);
    if (targetIndex < 0) return toolIds;
    const next = remaining.slice();
    next.splice(targetIndex, 0, ...sourceIds.filter(toolId => toolIds.includes(toolId)));
    return next;
};

const moveByOffset = (toolIds, toolId, offset) => {
    const sourceIndex = toolIds.indexOf(toolId);
    const targetIndex = sourceIndex + offset;
    if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= toolIds.length) return toolIds;
    const next = toolIds.slice();
    const [entry] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, entry);
    return next;
};

const WorkspaceDockItem = ({
    interactionController,
    item,
    onDragEnd,
    onDragOver,
    onDragStart,
    onDrop,
    onKeyboardReorder,
    onOpenOrganizationMenu
}) => {
    const handleActivate = React.useCallback(() => {
        interactionController.activateTool(item.toolId);
    }, [interactionController, item.toolId]);
    const handlePinToggle = React.useCallback(event => {
        event.stopPropagation();
        interactionController.togglePin(item.toolId);
    }, [interactionController, item.toolId]);
    const handleDragEnd = React.useCallback(() => {
        onDragEnd(item.toolId);
    }, [item.toolId, onDragEnd]);
    const handleDragOver = React.useCallback(event => {
        onDragOver(event, item.toolId);
    }, [item.toolId, onDragOver]);
    const handleDragStart = React.useCallback(event => {
        if (event.stopPropagation) event.stopPropagation();
        onDragStart(event, [item.toolId]);
    }, [item.toolId, onDragStart]);
    const handleDrop = React.useCallback(event => {
        if (event.stopPropagation) event.stopPropagation();
        onDrop(event, item.toolId);
    }, [item.toolId, onDrop]);
    const handleContextMenu = React.useCallback(event => {
        event.preventDefault();
        onOpenOrganizationMenu(item.toolId, event.clientX || 0, event.clientY || 0);
    }, [item.toolId, onOpenOrganizationMenu]);
    const handleKeyDown = React.useCallback(event => {
        if (event.shiftKey && event.key === 'F10') {
            event.preventDefault();
            onOpenOrganizationMenu(item.toolId, 0, 0);
            return;
        }
        onKeyboardReorder(event, item.toolId);
    }, [item.toolId, onKeyboardReorder, onOpenOrganizationMenu]);
    const statusLabel = `${item.title}${item.minimized ? ', minimized' : ''}${item.active ? ', active' : ''}`;

    return (
        <div
            className={styles.itemSlot}
            data-active={item.active ? 'true' : 'false'}
            data-minimized={item.minimized ? 'true' : 'false'}
            data-pinned={item.pinned ? 'true' : 'false'}
            data-running={item.running ? 'true' : 'false'}
            data-tool-id={item.toolId}
            data-ngvge-dock-transition-targets={item.toolId}
            draggable
            onContextMenu={handleContextMenu}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
        >
            <button
                aria-label={statusLabel}
                aria-pressed={item.active}
                className={styles.toolButton}
                title={item.title}
                type="button"
                onClick={handleActivate}
                onKeyDown={handleKeyDown}
            >
                <DockToolIcon iconKey={item.iconKey} />
                <span className={styles.srOnly}>{item.title}</span>
                {item.runningWindowIds.length > 1 ? (
                    <span className={styles.instanceBadge}>{item.runningWindowIds.length}</span>
                ) : null}
                <span
                    aria-hidden="true"
                    className={styles.runningIndicator}
                />
                <span
                    aria-hidden="true"
                    className={styles.minimizedIndicator}
                />
            </button>
            <button
                aria-label={item.pinned ? `Unpin ${item.title}` : `Pin ${item.title}`}
                aria-pressed={item.pinned}
                className={styles.pinButton}
                title={item.pinned ? `Unpin ${item.title}` : `Pin ${item.title}`}
                type="button"
                onClick={handlePinToggle}
            >
                <PinIcon />
            </button>
        </div>
    );
};

WorkspaceDockItem.propTypes = {
    interactionController: PropTypes.shape({
        activateTool: PropTypes.func.isRequired,
        togglePin: PropTypes.func.isRequired
    }).isRequired,
    item: PropTypes.shape({
        active: PropTypes.bool.isRequired,
        iconKey: PropTypes.string,
        minimized: PropTypes.bool.isRequired,
        pinned: PropTypes.bool.isRequired,
        running: PropTypes.bool.isRequired,
        runningWindowIds: PropTypes.arrayOf(PropTypes.string).isRequired,
        title: PropTypes.string.isRequired,
        toolId: PropTypes.string.isRequired
    }).isRequired,
    onDragEnd: PropTypes.func.isRequired,
    onDragOver: PropTypes.func.isRequired,
    onDragStart: PropTypes.func.isRequired,
    onDrop: PropTypes.func.isRequired,
    onKeyboardReorder: PropTypes.func.isRequired,
    onOpenOrganizationMenu: PropTypes.func.isRequired
};

const DockSeparator = ({node, orientation}) => (
    <div
        aria-orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
        className={styles.separator}
        data-organization-id={node.id}
        role="separator"
    />
);

DockSeparator.propTypes = {
    node: PropTypes.shape({id: PropTypes.string.isRequired}).isRequired,
    orientation: PropTypes.string.isRequired
};

const DockFolder = ({
    interactionController,
    node,
    onContainerDrop,
    onContainerDragStart,
    onDragEnd,
    onDragOver,
    onDrop,
    onDragStart,
    onKeyboardReorder,
    onOpenOrganizationMenu,
    organizationModel,
    placement
}) => {
    const handleToggle = React.useCallback(() => {
        organizationModel.toggleFolder(node.id);
    }, [node.id, organizationModel]);
    const handleDragStart = React.useCallback(event => {
        onContainerDragStart(event, node.orderToolIds);
    }, [node.orderToolIds, onContainerDragStart]);
    const handleDrop = React.useCallback(event => {
        event.preventDefault();
        onContainerDrop(node.id, node.orderToolIds);
    }, [node.id, node.orderToolIds, onContainerDrop]);
    return (
        <div
            className={styles.folder}
            data-active={node.summary.active ? 'true' : 'false'}
            data-expanded={node.expanded ? 'true' : 'false'}
            data-minimized={node.summary.minimized ? 'true' : 'false'}
            data-organization-id={node.id}
            data-running={node.summary.running ? 'true' : 'false'}
            draggable
            onDragEnd={onDragEnd}
            onDragOver={onDragOver}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
        >
            <button
                aria-expanded={node.expanded}
                aria-label={`${node.label}, ${node.items.length} tools`}
                className={styles.folderButton}
                data-ngvge-dock-transition-targets={node.items.map(item => item.toolId).join(' ')}
                title={node.label}
                type="button"
                onClick={handleToggle}
            >
                <FolderIcon />
                <span className={styles.folderCount}>{node.items.length}</span>
                <span
                    aria-hidden="true"
                    className={styles.runningIndicator}
                />
            </button>
            <span className={styles.folderChevron}><ChevronIcon expanded={node.expanded} /></span>
            {node.expanded ? (
                <div
                    className={styles.folderPopover}
                    data-placement={placement.placement}
                    role="group"
                    aria-label={node.label}
                >
                    <div className={styles.containerLabel}>{node.label}</div>
                    <div className={styles.folderItems}>
                        {node.items.map(item => (
                            <WorkspaceDockItem
                                interactionController={interactionController}
                                item={item}
                                key={item.toolId}
                                onDragEnd={onDragEnd}
                                onDragOver={onDragOver}
                                onDragStart={onDragStart}
                                onDrop={onDrop}
                                onKeyboardReorder={onKeyboardReorder}
                                onOpenOrganizationMenu={onOpenOrganizationMenu}
                            />
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
};

DockFolder.propTypes = {
    interactionController: PropTypes.object.isRequired,
    node: PropTypes.object.isRequired,
    onContainerDrop: PropTypes.func.isRequired,
    onContainerDragStart: PropTypes.func.isRequired,
    onDragEnd: PropTypes.func.isRequired,
    onDragOver: PropTypes.func.isRequired,
    onDrop: PropTypes.func.isRequired,
    onDragStart: PropTypes.func.isRequired,
    onKeyboardReorder: PropTypes.func.isRequired,
    onOpenOrganizationMenu: PropTypes.func.isRequired,
    organizationModel: PropTypes.object.isRequired,
    placement: PropTypes.object.isRequired
};

const DockGroup = ({
    interactionController,
    node,
    onContainerDrop,
    onContainerDragStart,
    onDragEnd,
    onDragOver,
    onDrop,
    onDragStart,
    onKeyboardReorder,
    onOpenOrganizationMenu
}) => {
    const handleDragStart = React.useCallback(event => {
        onContainerDragStart(event, node.orderToolIds);
    }, [node.orderToolIds, onContainerDragStart]);
    const handleDrop = React.useCallback(event => {
        event.preventDefault();
        onContainerDrop(node.id, node.orderToolIds);
    }, [node.id, node.orderToolIds, onContainerDrop]);
    return (
        <div
            className={styles.group}
            data-organization-id={node.id}
            draggable
            onDragEnd={onDragEnd}
            onDragOver={onDragOver}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
        >
            <span className={styles.groupLabel}>{node.label}</span>
            <div
                className={styles.groupItems}
                role="group"
                aria-label={node.label}
            >
                {node.items.map(item => (
                    <WorkspaceDockItem
                        interactionController={interactionController}
                        item={item}
                        key={item.toolId}
                        onDragEnd={onDragEnd}
                        onDragOver={onDragOver}
                        onDragStart={onDragStart}
                        onDrop={onDrop}
                        onKeyboardReorder={onKeyboardReorder}
                        onOpenOrganizationMenu={onOpenOrganizationMenu}
                    />
                ))}
            </div>
        </div>
    );
};

DockGroup.propTypes = {
    interactionController: PropTypes.object.isRequired,
    node: PropTypes.object.isRequired,
    onContainerDrop: PropTypes.func.isRequired,
    onContainerDragStart: PropTypes.func.isRequired,
    onDragEnd: PropTypes.func.isRequired,
    onDragOver: PropTypes.func.isRequired,
    onDrop: PropTypes.func.isRequired,
    onDragStart: PropTypes.func.isRequired,
    onKeyboardReorder: PropTypes.func.isRequired,
    onOpenOrganizationMenu: PropTypes.func.isRequired
};

const OrganizationMenu = ({menu, organizationModel, onClose}) => {
    if (!menu) return null;
    const membership = organizationModel.getMembership(menu.toolId);
    const containers = organizationModel.listContainers();
    const separator = organizationModel.getSeparatorBefore(menu.toolId);
    const invoke = callback => () => {
        callback();
        onClose();
    };
    return (
        <div
            aria-label="Dock organization menu"
            className={styles.organizationMenu}
            data-ngvge-dock-organization-menu="true"
            role="menu"
            style={menu.x || menu.y ? {left: menu.x, top: menu.y} : null}
        >
            {membership ? null : (
                <React.Fragment>
                    <button
                        role="menuitem"
                        type="button"
                        onClick={invoke(() => organizationModel.createGroup({toolIds: [menu.toolId]}))}
                    >
                        {'Create group'}
                    </button>
                    <button
                        role="menuitem"
                        type="button"
                        onClick={invoke(() => organizationModel.createFolder({toolIds: [menu.toolId]}))}
                    >
                        {'Create folder'}
                    </button>
                </React.Fragment>
            )}
            <button
                role="menuitem"
                type="button"
                onClick={invoke(() => {
                    if (separator) organizationModel.removeSeparator(separator.id);
                    else organizationModel.createSeparator({beforeToolId: menu.toolId});
                })}
            >
                {separator ? 'Remove separator before' : 'Insert separator before'}
            </button>
            {membership ? (
                <React.Fragment>
                    <button
                        role="menuitem"
                        type="button"
                        onClick={invoke(() => organizationModel.moveToolToContainer(menu.toolId, null))}
                    >
                        {'Remove from '}{membership.kind}
                    </button>
                    <button
                        role="menuitem"
                        type="button"
                        onClick={invoke(() => organizationModel.removeContainer(membership.organizationId))}
                    >
                        {'Dissolve '}{membership.label}
                    </button>
                </React.Fragment>
            ) : null}
            {containers
                .filter(container => !membership || container.id !== membership.organizationId)
                .map(container => (
                    <button
                        key={container.id}
                        role="menuitem"
                        type="button"
                        onClick={invoke(() => organizationModel.moveToolToContainer(menu.toolId, container.id))}
                    >
                        {'Move to '}{container.label}
                    </button>
                ))}
            <button
                role="menuitem"
                type="button"
                onClick={onClose}
            >{'Cancel'}</button>
        </div>
    );
};

OrganizationMenu.propTypes = {
    menu: PropTypes.shape({
        toolId: PropTypes.string.isRequired,
        x: PropTypes.number.isRequired,
        y: PropTypes.number.isRequired
    }),
    onClose: PropTypes.func.isRequired,
    organizationModel: PropTypes.object.isRequired
};

const WorkspaceDock = ({
    dockRuntimeModel,
    interactionController,
    launchpadModel,
    organizationModel,
    organizationMode = 'custom',
    placementModel,
    presentation = 'floating'
}) => {
    const [revision, setRevision] = React.useState(dockRuntimeModel.revision);
    const [placementRevision, setPlacementRevision] = React.useState(placementModel.revision);
    const [organizationRevision, setOrganizationRevision] = React.useState(organizationModel.revision);
    const [dragging, setDragging] = React.useState(null);
    const [organizationMenu, setOrganizationMenu] = React.useState(null);
    const [launchpadOpen, setLaunchpadOpen] = React.useState(false);

    React.useEffect(() => dockRuntimeModel.subscribe(event => setRevision(event.revision)), [dockRuntimeModel]);
    React.useEffect(() => placementModel.subscribe(event => setPlacementRevision(event.revision)), [placementModel]);
    React.useEffect(
        () => organizationModel.subscribe(event => setOrganizationRevision(event.revision)),
        [organizationModel]
    );

    const items = React.useMemo(() => dockRuntimeModel.listItems(), [dockRuntimeModel, revision]);
    const placement = React.useMemo(() => placementModel.getProjection(), [placementModel, placementRevision]);
    const organization = React.useMemo(() => {
        if (organizationMode === 'flat') {
            return {
                nodes: items.map(item => ({
                    kind: 'tool',
                    id: item.toolId,
                    toolId: item.toolId,
                    orderToolIds: [item.toolId],
                    item
                }))
            };
        }
        return organizationModel.project(items);
    }, [items, organizationMode, organizationModel, organizationRevision]);
    const visibleToolIds = items.map(item => item.toolId);

    const handleDrop = React.useCallback(targetToolId => {
        if (!dragging || dragging.toolIds.length === 0) return;
        const next = reorderBlock(visibleToolIds, dragging.toolIds, targetToolId);
        if (next !== visibleToolIds) interactionController.setVisibleOrder(next);
        setDragging(null);
    }, [dragging, interactionController, visibleToolIds]);

    const handleContainerDrop = React.useCallback((containerId, targetToolIds) => {
        if (!dragging || dragging.toolIds.length === 0) return;
        if (dragging.toolIds.length === 1) {
            organizationModel.moveToolToContainer(dragging.toolIds[0], containerId);
        }
        if (targetToolIds.length > 0) {
            const next = reorderBlock(visibleToolIds, dragging.toolIds, targetToolIds[0]);
            if (next !== visibleToolIds) interactionController.setVisibleOrder(next);
        }
        setDragging(null);
    }, [dragging, interactionController, organizationModel, visibleToolIds]);

    const handleKeyboardReorder = React.useCallback((event, toolId) => {
        if (!event.altKey) return;
        const previousKey = placement.orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
        const nextKey = placement.orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
        if (event.key !== previousKey && event.key !== nextKey) return;
        event.preventDefault();
        const offset = event.key === previousKey ? -1 : 1;
        const next = moveByOffset(visibleToolIds, toolId, offset);
        if (next !== visibleToolIds) interactionController.setVisibleOrder(next);
    }, [interactionController, placement.orientation, visibleToolIds]);
    const handleDragEnd = React.useCallback(() => setDragging(null), []);
    const handleDragOver = React.useCallback(event => event.preventDefault(), []);
    const handleDragStart = React.useCallback((event, toolIds) => {
        setDragging({toolIds});
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', toolIds.join(','));
    }, []);
    const handleItemDrop = React.useCallback((event, toolId) => {
        event.preventDefault();
        handleDrop(toolId);
    }, [handleDrop]);
    const handleOpenOrganizationMenu = React.useCallback((toolId, x, y) => {
        if (organizationMode !== 'custom') return;
        setOrganizationMenu({toolId, x, y});
    }, [organizationMode]);
    const handleCloseOrganizationMenu = React.useCallback(() => {
        setOrganizationMenu(null);
    }, []);
    const handleToggleLaunchpad = React.useCallback(() => {
        setOrganizationMenu(null);
        setLaunchpadOpen(open => !open);
    }, []);
    const handleCloseLaunchpad = React.useCallback(() => {
        setLaunchpadOpen(false);
    }, []);

    if (items.length === 0) return null;

    const renderItem = item => (
        <WorkspaceDockItem
            interactionController={interactionController}
            item={item}
            key={item.toolId}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragStart={handleDragStart}
            onDrop={handleItemDrop}
            onKeyboardReorder={handleKeyboardReorder}
            onOpenOrganizationMenu={handleOpenOrganizationMenu}
        />
    );

    return (
        <nav
            aria-label="Workspace Dock"
            className={styles.dock}
            data-alignment={placement.alignment}
            data-ngvge-dock-interaction={WORKSPACE_DOCK_INTERACTION_CONTROLLER_ID}
            data-ngvge-dock-organization-model={WORKSPACE_DOCK_ORGANIZATION_MODEL_ID}
            data-ngvge-dock-organization-revision={organizationRevision}
            data-ngvge-dock-placement-model={WORKSPACE_DOCK_PLACEMENT_MODEL_ID}
            data-ngvge-dock-placement-revision={placementRevision}
            data-ngvge-dock-runtime={WORKSPACE_DOCK_RUNTIME_MODEL_ID}
            data-ngvge-dock-runtime-revision={revision}
            data-ngvge-dock-organization-mode={organizationMode}
            data-ngvge-dock-presentation={presentation}
            data-orientation={placement.orientation}
            data-placement={placement.placement}
            data-presentation={presentation}
            style={placement.cssVariables}
        >
            <div
                aria-orientation={placement.orientation}
                className={styles.track}
                role="toolbar"
            >
                {organization.nodes.map(node => {
                    if (node.kind === 'tool') return renderItem(node.item);
                    if (node.kind === DOCK_ORGANIZATION_KINDS.SEPARATOR) {
                        return (<DockSeparator
                            key={node.id}
                            node={node}
                            orientation={placement.orientation}
                        />);
                    }
                    if (node.kind === DOCK_ORGANIZATION_KINDS.GROUP) {
                        return (
                            <DockGroup
                                interactionController={interactionController}
                                key={node.id}
                                node={node}
                                onContainerDrop={handleContainerDrop}
                                onContainerDragStart={handleDragStart}
                                onDragEnd={handleDragEnd}
                                onDragOver={handleDragOver}
                                onDragStart={handleDragStart}
                                onDrop={handleItemDrop}
                                onKeyboardReorder={handleKeyboardReorder}
                                onOpenOrganizationMenu={handleOpenOrganizationMenu}
                            />
                        );
                    }
                    if (organizationMode === 'grouped') {
                        return (
                            <DockGroup
                                interactionController={interactionController}
                                key={node.id}
                                node={{...node, kind: DOCK_ORGANIZATION_KINDS.GROUP, expanded: true}}
                                onContainerDrop={handleContainerDrop}
                                onContainerDragStart={handleDragStart}
                                onDragEnd={handleDragEnd}
                                onDragOver={handleDragOver}
                                onDragStart={handleDragStart}
                                onDrop={handleItemDrop}
                                onKeyboardReorder={handleKeyboardReorder}
                                onOpenOrganizationMenu={handleOpenOrganizationMenu}
                            />
                        );
                    }
                    return (
                        <DockFolder
                            interactionController={interactionController}
                            key={node.id}
                            node={node}
                            onContainerDrop={handleContainerDrop}
                            onContainerDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            onDragOver={handleDragOver}
                            onDragStart={handleDragStart}
                            onDrop={handleItemDrop}
                            onKeyboardReorder={handleKeyboardReorder}
                            onOpenOrganizationMenu={handleOpenOrganizationMenu}
                            organizationModel={organizationModel}
                            placement={placement}
                        />
                    );
                })}
                <span
                    aria-hidden="true"
                    className={styles.launchpadDivider}
                />
                <button
                    aria-expanded={launchpadOpen}
                    aria-label="Open Workspace Launchpad"
                    className={styles.launchpadButton}
                    data-ngvge-launchpad-model={WORKSPACE_LAUNCHPAD_MODEL_ID}
                    title="Launchpad"
                    type="button"
                    onClick={handleToggleLaunchpad}
                >
                    <LaunchpadIcon />
                </button>
            </div>
            {launchpadOpen ? (
                <WorkspaceLaunchpad
                    interactionController={interactionController}
                    launchpadModel={launchpadModel}
                    placement={placement}
                    onClose={handleCloseLaunchpad}
                />
            ) : null}
            <OrganizationMenu
                menu={organizationMode === 'custom' ? organizationMenu : null}
                organizationModel={organizationModel}
                onClose={handleCloseOrganizationMenu}
            />
        </nav>
    );
};

WorkspaceDock.propTypes = {
    dockRuntimeModel: PropTypes.shape({
        id: PropTypes.string.isRequired,
        listItems: PropTypes.func.isRequired,
        revision: PropTypes.number.isRequired,
        subscribe: PropTypes.func.isRequired
    }).isRequired,
    interactionController: PropTypes.shape({
        activateTool: PropTypes.func.isRequired,
        id: PropTypes.string.isRequired,
        setVisibleOrder: PropTypes.func.isRequired,
        togglePin: PropTypes.func.isRequired
    }).isRequired,
    launchpadModel: PropTypes.shape({
        getSnapshot: PropTypes.func.isRequired,
        id: PropTypes.string.isRequired,
        revision: PropTypes.number.isRequired,
        subscribe: PropTypes.func.isRequired
    }).isRequired,
    organizationMode: PropTypes.oneOf(['flat', 'grouped', 'custom']),
    organizationModel: PropTypes.shape({
        getMembership: PropTypes.func.isRequired,
        moveToolToContainer: PropTypes.func.isRequired,
        id: PropTypes.string.isRequired,
        listContainers: PropTypes.func.isRequired,
        project: PropTypes.func.isRequired,
        revision: PropTypes.number.isRequired,
        subscribe: PropTypes.func.isRequired,
        toggleFolder: PropTypes.func.isRequired
    }).isRequired,
    placementModel: PropTypes.shape({
        getProjection: PropTypes.func.isRequired,
        id: PropTypes.string.isRequired,
        revision: PropTypes.number.isRequired,
        subscribe: PropTypes.func.isRequired
    }).isRequired,
    presentation: PropTypes.oneOf(['floating', 'sidebar', 'drawer', 'compact-shelf'])
};

export default WorkspaceDock;
