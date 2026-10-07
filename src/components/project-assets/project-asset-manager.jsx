/* eslint-disable react/jsx-no-literals */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

import {
    costumeUpload,
    handleFileUpload,
    soundUpload
} from '../../lib/file-uploader';

import {getEditorCommandManager} from '../../lib/editor-commands/editor-command-manager';

import styles from './project-asset-manager.css';

const ALL_FOLDERS = '__all__';
const UNFILED_FOLDER = '__unfiled__';

const getFileType = (fileName, fileType) => {
    if (fileType) return fileType;
    const extension = String(fileName).split('.').pop().toLowerCase();
    const byExtension = {
        bmp: 'image/bmp',
        flac: 'audio/flac',
        gif: 'image/gif',
        jpeg: 'image/jpeg',
        jpg: 'image/jpeg',
        m4a: 'audio/mp4',
        mp3: 'audio/mpeg',
        ogg: 'audio/ogg',
        png: 'image/png',
        svg: 'image/svg+xml',
        wav: 'audio/wav',
        webp: 'image/webp'
    };
    return byExtension[extension] || '';
};

const AssetIcon = ({kind}) => (
    <span aria-hidden="true" className={styles.assetTypeIcon}>
        {kind === 'sound' ? '♪' : '▧'}
    </span>
);

AssetIcon.propTypes = {
    kind: PropTypes.string.isRequired
};

const ProjectAssetManager = props => {
    const {
        assetDatabase,
        currentTarget,
        onSelectionContextChange,
        onSelectTarget,
        vm
    } = props;
    const [revision, setRevision] = React.useState(0);
    const [selectedAssetId, setSelectedAssetId] = React.useState(null);
    const [search, setSearch] = React.useState('');
    const [kindFilter, setKindFilter] = React.useState('all');
    const [folderFilter, setFolderFilter] = React.useState(ALL_FOLDERS);
    const [viewMode, setViewMode] = React.useState('grid');
    const [nameDraft, setNameDraft] = React.useState('');
    const [folderNameDraft, setFolderNameDraft] = React.useState('');
    const [folderEditDraft, setFolderEditDraft] = React.useState('');
    const [status, setStatus] = React.useState('');
    const fileInputRef = React.useRef(null);
    const commandManager = React.useMemo(() => (vm && vm.runtime ? getEditorCommandManager(vm.runtime) : null), [vm]);

    React.useEffect(() => {
        if (!assetDatabase) return () => {};
        return assetDatabase.subscribe(change => {
            setRevision(change.revision || assetDatabase.getRevision());
        });
    }, [assetDatabase]);

    const assets = assetDatabase ? assetDatabase.listAssets() : [];
    const folders = assetDatabase ? assetDatabase.listFolders() : [];
    const selectedAsset = assets.find(asset => asset.id === selectedAssetId) || null;
    const historyState = assetDatabase ? assetDatabase.getHistoryState() : {
        canRedo: false,
        canUndo: false,
        redoCount: 0,
        undoCount: 0
    };
    const currentCostumes = currentTarget && typeof currentTarget.getCostumes === 'function' ?
        currentTarget.getCostumes() : [];
    const currentCostume = currentCostumes.length ?
        currentCostumes[currentTarget.currentCostume || 0] : null;

    const selectedAssetName = selectedAsset ? selectedAsset.name : '';
    const activeFolder = folders.find(folder => folder.id === folderFilter) || null;
    const activeFolderName = activeFolder ? activeFolder.name : '';
    const imageAssetCount = assets.filter(asset => asset.kind === 'costume').length;
    const soundAssetCount = assets.filter(asset => asset.kind === 'sound').length;
    const unfiledAssetCount = assets.filter(asset => !asset.folderId).length;

    React.useEffect(() => {
        setNameDraft(selectedAssetName);
    }, [selectedAssetId, selectedAssetName]);

    React.useEffect(() => {
        onSelectionContextChange(selectedAsset ? selectedAsset.resourceId : null);
    }, [onSelectionContextChange, selectedAsset]);

    React.useEffect(() => () => {
        onSelectionContextChange(null);
    }, [onSelectionContextChange]);

    React.useEffect(() => {
        setFolderEditDraft(activeFolderName);
    }, [folderFilter, activeFolderName]);

    React.useEffect(() => {
        if (selectedAssetId && !selectedAsset) setSelectedAssetId(null);
    }, [revision, selectedAsset, selectedAssetId]);

    const filteredAssets = assets.filter(asset => {
        const query = search.trim().toLowerCase();
        if (query && !`${asset.name} ${asset.dataFormat} ${asset.md5ext}`.toLowerCase().includes(query)) {
            return false;
        }
        if (kindFilter === 'images' && asset.kind !== 'costume') return false;
        if (kindFilter === 'sounds' && asset.kind !== 'sound') return false;
        if (folderFilter === UNFILED_FOLDER && asset.folderId) return false;
        if (
            folderFilter !== ALL_FOLDERS &&
            folderFilter !== UNFILED_FOLDER &&
            asset.folderId !== folderFilter
        ) return false;
        return true;
    });

    const runAction = React.useCallback(async (label, action, successMessage) => {
        if (!assetDatabase) return;
        setStatus('Working…');
        try {
            const result = await assetDatabase.perform(label, action);
            setStatus(successMessage);
            return result;
        } catch (error) {
            setStatus(error && error.message ? error.message : String(error));
            return null;
        }
    }, [assetDatabase]);

    const activeFolderId = (
        folderFilter !== ALL_FOLDERS && folderFilter !== UNFILED_FOLDER ? folderFilter : null
    );

    const handleCaptureCurrent = () => runAction(
        'Capture current costume',
        () => {
            if (!currentTarget || !currentCostume) throw new Error('Select a target with a costume first.');
            const assetId = assetDatabase.captureCurrentCostume(currentTarget, activeFolderId);
            setSelectedAssetId(assetId);
            return assetId;
        },
        'Current costume captured as a global image asset.'
    );

    const handleUseSelected = () => runAction(
        `Use ${selectedAsset ? selectedAsset.name : 'asset'} on selected target`,
        async () => {
            if (!selectedAsset) throw new Error('Select an asset first.');
            if (!currentTarget) throw new Error('Select a Stage or Sprite first.');
            return assetDatabase.addAssetToTarget(selectedAsset.id, currentTarget.id);
        },
        'Asset added to the selected target.'
    );

    const handleReplaceSelected = () => runAction(
        'Replace global image asset',
        () => {
            if (!selectedAsset || selectedAsset.kind !== 'costume') {
                throw new Error('Select an image asset first.');
            }
            if (!currentTarget || !currentCostume) throw new Error('Select a source costume first.');
            return assetDatabase.replaceAssetFromCurrent(selectedAsset.id, currentTarget);
        },
        'Global image replaced and all linked costumes updated.'
    );

    const handleDeleteSelected = () => runAction(
        'Delete unused global asset',
        () => {
            if (!selectedAsset) throw new Error('Select an asset first.');
            const result = assetDatabase.removeAsset(selectedAsset.id);
            setSelectedAssetId(null);
            return result;
        },
        'Unused asset deleted.'
    );

    const handleRenameSelected = event => {
        event.preventDefault();
        runAction(
            'Rename global asset',
            () => assetDatabase.renameAsset(selectedAsset.id, nameDraft),
            'Asset renamed.'
        );
    };

    const handleMoveSelected = event => runAction(
        'Move global asset',
        () => assetDatabase.moveAsset(
            selectedAsset.id,
            event.target.value === UNFILED_FOLDER ? null : event.target.value
        ),
        'Asset moved.'
    );

    const handleCreateFolder = event => {
        event.preventDefault();
        if (!folderNameDraft.trim()) return;
        runAction(
            'Create asset folder',
            () => {
                const folderId = assetDatabase.createFolder(folderNameDraft);
                setFolderFilter(folderId);
                setFolderNameDraft('');
                return folderId;
            },
            'Folder created.'
        );
    };


    const handleRenameFolder = () => runAction(
        'Rename asset folder',
        () => {
            if (!activeFolderId) throw new Error('Select a folder first.');
            if (!folderEditDraft.trim()) throw new Error('Enter a folder name first.');
            return assetDatabase.renameFolder(activeFolderId, folderEditDraft);
        },
        'Folder renamed.'
    );

    const handleDeleteFolder = () => runAction(
        'Delete asset folder',
        () => {
            if (!activeFolderId) throw new Error('Select a folder first.');
            const result = assetDatabase.removeFolder(activeFolderId);
            setFolderFilter(ALL_FOLDERS);
            return result;
        },
        'Folder deleted; contained assets moved to Unfiled.'
    );

    const handleUnlinkReference = reference => runAction(
        'Unlink global asset reference',
        () => assetDatabase.unlinkReference(
            selectedAsset.id,
            reference.targetId,
            reference.itemIndex
        ),
        'Reference converted to an independent local item.'
    );

    const handleUndo = () => {
        const handled = commandManager ?
            commandManager.execute('editor.undo', {scopeId: 'assets'}) :
            Boolean(assetDatabase && assetDatabase.undo());
        if (handled) setStatus('Asset change undone.');
    };

    const handleRedo = () => {
        const handled = commandManager ?
            commandManager.execute('editor.redo', {scopeId: 'assets'}) :
            Boolean(assetDatabase && assetDatabase.redo());
        if (handled) setStatus('Asset change redone.');
    };

    const handleImportClick = () => {
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const handleImportFiles = event => {
        const input = event.target;
        setStatus('Importing files…');
        handleFileUpload(input, (buffer, fileType, fileName, fileIndex, fileCount) => {
            const normalizedType = getFileType(`${fileName}.${String(fileType).split('/').pop()}`, fileType);
            const finish = message => {
                if (fileIndex === fileCount - 1) setStatus(message);
            };
            if (normalizedType.startsWith('image/')) {
                costumeUpload(buffer, normalizedType, vm, costumes => {
                    runAction(
                        `Import image ${fileName}`,
                        () => {
                            let lastId = null;
                            costumes.forEach((costume, index) => {
                                const name = `${fileName}${index ? index + 1 : ''}`;
                                lastId = assetDatabase.importCostume(costume, name, activeFolderId);
                            });
                            if (lastId) setSelectedAssetId(lastId);
                            return lastId;
                        },
                        `Imported image asset: ${fileName}`
                    ).then(() => finish('Asset import complete.'));
                }, error => setStatus(error && error.message ? error.message : String(error)));
                return;
            }
            if (normalizedType.startsWith('audio/')) {
                soundUpload(buffer, normalizedType, vm.runtime.storage, sound => {
                    sound.name = fileName;
                    runAction(
                        `Import sound ${fileName}`,
                        () => {
                            const assetId = assetDatabase.importSound(sound, fileName, activeFolderId);
                            setSelectedAssetId(assetId);
                            return assetId;
                        },
                        `Imported sound asset: ${fileName}`
                    ).then(() => finish('Asset import complete.'));
                }, error => setStatus(error && error.message ? error.message : String(error)));
                return;
            }
            setStatus(`Unsupported file type: ${normalizedType || fileName}`);
        }, error => setStatus(error && error.message ? error.message : String(error)));
    };

    const selectedReferences = selectedAsset && assetDatabase ?
        assetDatabase.getReferences(selectedAsset.id) : [];
    const selectedDataURL = selectedAsset && assetDatabase ?
        assetDatabase.getDataURL(selectedAsset.id) : null;

    return (
        <div className={styles.manager} data-ngvge-command-scope="assets">
            <header className={styles.toolbar}>
                <div className={styles.toolbarGroup}>
                    <button
                        className={styles.primaryButton}
                        type="button"
                        onClick={handleImportClick}
                    >
                        + Import files
                    </button>
                    <button
                        disabled={!currentCostume}
                        type="button"
                        onClick={handleCaptureCurrent}
                    >
                        Capture costume
                    </button>
                    <input
                        multiple
                        accept=".svg,.png,.bmp,.jpg,.jpeg,.webp,.gif,.wav,.mp3,.ogg,.m4a,.flac"
                        className={styles.hiddenInput}
                        ref={fileInputRef}
                        type="file"
                        onChange={handleImportFiles}
                    />
                </div>
                <div className={styles.toolbarGroup}>
                    <button
                        className={styles.historyButton}
                        disabled={!historyState.canUndo}
                        type="button"
                        onClick={handleUndo}
                    >
                        ↶ Undo{historyState.undoCount ? ` (${historyState.undoCount})` : ''}
                    </button>
                    <button
                        className={styles.historyButton}
                        disabled={!historyState.canRedo}
                        type="button"
                        onClick={handleRedo}
                    >
                        Redo{historyState.redoCount ? ` (${historyState.redoCount})` : ''} ↷
                    </button>
                    <span className={styles.assetCount}>{assets.length} assets</span>
                </div>
            </header>

            <div className={styles.workspaceBody}>
                <aside className={styles.sidebar} aria-label="Asset navigation">
                    <section className={styles.sidebarSection}>
                        <h3 className={styles.sectionHeading}>Library</h3>
                        <div className={styles.navList}>
                            <button
                                aria-pressed={kindFilter === 'all' && folderFilter === ALL_FOLDERS}
                                className={classNames(styles.navButton, {
                                    [styles.navButtonActive]: kindFilter === 'all' && folderFilter === ALL_FOLDERS
                                })}
                                type="button"
                                onClick={() => {
                                    setKindFilter('all');
                                    setFolderFilter(ALL_FOLDERS);
                                }}
                            >
                                <span className={styles.navLabel}>All assets</span>
                                <span className={styles.navCount}>{assets.length}</span>
                            </button>
                            <button
                                aria-pressed={kindFilter === 'images'}
                                className={classNames(styles.navButton, {
                                    [styles.navButtonActive]: kindFilter === 'images'
                                })}
                                type="button"
                                onClick={() => setKindFilter('images')}
                            >
                                <span className={styles.navLabel}>Images</span>
                                <span className={styles.navCount}>{imageAssetCount}</span>
                            </button>
                            <button
                                aria-pressed={kindFilter === 'sounds'}
                                className={classNames(styles.navButton, {
                                    [styles.navButtonActive]: kindFilter === 'sounds'
                                })}
                                type="button"
                                onClick={() => setKindFilter('sounds')}
                            >
                                <span className={styles.navLabel}>Sounds</span>
                                <span className={styles.navCount}>{soundAssetCount}</span>
                            </button>
                        </div>
                    </section>

                    <section className={styles.sidebarSection}>
                        <div className={styles.sectionHeadingRow}>
                            <h3 className={styles.sectionHeading}>Folders</h3>
                            <span>{folders.length}</span>
                        </div>
                        <div className={styles.navList}>
                            <button
                                aria-pressed={folderFilter === ALL_FOLDERS}
                                className={classNames(styles.navButton, {
                                    [styles.navButtonActive]: folderFilter === ALL_FOLDERS
                                })}
                                type="button"
                                onClick={() => setFolderFilter(ALL_FOLDERS)}
                            >
                                <span className={styles.navLabel}>All folders</span>
                            </button>
                            <button
                                aria-pressed={folderFilter === UNFILED_FOLDER}
                                className={classNames(styles.navButton, {
                                    [styles.navButtonActive]: folderFilter === UNFILED_FOLDER
                                })}
                                type="button"
                                onClick={() => setFolderFilter(UNFILED_FOLDER)}
                            >
                                <span className={styles.navLabel}>Unfiled</span>
                                <span className={styles.navCount}>{unfiledAssetCount}</span>
                            </button>
                            {folders.map(folder => {
                                const folderCount = assets.filter(asset => asset.folderId === folder.id).length;
                                return (
                                    <button
                                        aria-pressed={folderFilter === folder.id}
                                        className={classNames(styles.navButton, {
                                            [styles.navButtonActive]: folderFilter === folder.id
                                        })}
                                        key={folder.id}
                                        type="button"
                                        onClick={() => setFolderFilter(folder.id)}
                                    >
                                        <span aria-hidden="true" className={styles.folderIcon}>▰</span>
                                        <span className={styles.navLabel}>{folder.name}</span>
                                        <span className={styles.navCount}>{folderCount}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <section className={styles.folderTools}>
                        <form className={styles.folderCreateForm} onSubmit={handleCreateFolder}>
                            <input
                                aria-label="New folder name"
                                placeholder="New folder"
                                value={folderNameDraft}
                                onChange={event => setFolderNameDraft(event.target.value)}
                            />
                            <button disabled={!folderNameDraft.trim()} type="submit">Create</button>
                        </form>
                        {activeFolderId ? (
                            <div className={styles.folderEditor}>
                                <input
                                    aria-label="Selected folder name"
                                    value={folderEditDraft}
                                    onChange={event => setFolderEditDraft(event.target.value)}
                                />
                                <div className={styles.folderEditorActions}>
                                    <button type="button" onClick={handleRenameFolder}>Rename</button>
                                    <button
                                        className={styles.dangerButton}
                                        type="button"
                                        onClick={handleDeleteFolder}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </section>
                </aside>

                <main className={styles.browser}>
                    <div className={styles.browserToolbar}>
                        <input
                            aria-label="Search assets"
                            className={styles.searchInput}
                            placeholder="Search by name, format, or hash…"
                            type="search"
                            value={search}
                            onChange={event => setSearch(event.target.value)}
                        />
                        <div className={styles.viewToggle} aria-label="Asset view mode">
                            <button
                                aria-label="Grid view"
                                aria-pressed={viewMode === 'grid'}
                                className={classNames({[styles.activeToggle]: viewMode === 'grid'})}
                                title="Grid view"
                                type="button"
                                onClick={() => setViewMode('grid')}
                            >
                                ▦
                            </button>
                            <button
                                aria-label="List view"
                                aria-pressed={viewMode === 'list'}
                                className={classNames({[styles.activeToggle]: viewMode === 'list'})}
                                title="List view"
                                type="button"
                                onClick={() => setViewMode('list')}
                            >
                                ☷
                            </button>
                        </div>
                    </div>

                    <div className={classNames(styles.assetCollection, {
                        [styles.assetGrid]: viewMode === 'grid',
                        [styles.assetList]: viewMode === 'list'
                    })}>
                        {filteredAssets.length ? filteredAssets.map(asset => {
                            const previewURL = assetDatabase.getPreviewURL(asset.id);
                            const folder = folders.find(candidate => candidate.id === asset.folderId);
                            return (
                                <button
                                    aria-pressed={asset.id === selectedAssetId}
                                    className={classNames(styles.assetCard, {
                                        [styles.assetCardSelected]: asset.id === selectedAssetId
                                    })}
                                    key={asset.id}
                                    type="button"
                                    onClick={() => setSelectedAssetId(asset.id)}
                                >
                                    <div className={styles.thumbnail}>
                                        {previewURL ? (
                                            <img alt="" src={previewURL} />
                                        ) : (
                                            <AssetIcon kind={asset.kind} />
                                        )}
                                    </div>
                                    <div className={styles.cardText}>
                                        <strong>{asset.name}</strong>
                                        <span>
                                            {asset.kind === 'sound' ? 'Sound' : 'Image'} · {asset.referenceCount} refs
                                        </span>
                                        <span>{folder ? folder.name : 'Unfiled'}</span>
                                    </div>
                                </button>
                            );
                        }) : (
                            <div className={styles.emptyState}>
                                <strong>No assets found</strong>
                                <span>Import files, capture a costume, or change the current filters.</span>
                            </div>
                        )}
                    </div>

                    <footer className={styles.browserFooter}>
                        <span>Showing {filteredAssets.length} of {assets.length}</span>
                        <span>{kindFilter === 'all' ? 'All types' : (kindFilter === 'images' ? 'Images' : 'Sounds')}</span>
                    </footer>
                </main>

                <aside className={styles.details} aria-label="Asset details">
                    {selectedAsset ? (
                        <div className={styles.detailsScroll}>
                            <div className={styles.previewPanel}>
                                <div className={styles.largePreview}>
                                    {selectedAsset.kind === 'sound' ? (
                                        <AssetIcon kind="sound" />
                                    ) : selectedDataURL ? (
                                        <img alt="" src={selectedDataURL} />
                                    ) : (
                                        <AssetIcon kind="costume" />
                                    )}
                                </div>
                                {selectedAsset.kind === 'sound' && selectedDataURL ? (
                                    // eslint-disable-next-line jsx-a11y/media-has-caption
                                    <audio className={styles.audioPreview} controls src={selectedDataURL} />
                                ) : null}
                            </div>

                            <div className={styles.detailsTitle}>
                                <strong>{selectedAsset.name}</strong>
                                <span>{selectedAsset.kind === 'sound' ? 'Sound asset' : 'Image asset'}</span>
                            </div>

                            <dl className={styles.metadataGrid}>
                                <div className={styles.metadataRow}>
                                    <dt>Format</dt>
                                    <dd>{selectedAsset.dataFormat.toUpperCase()}</dd>
                                </div>
                                <div className={styles.metadataRow}>
                                    <dt>References</dt>
                                    <dd>{selectedReferences.length}</dd>
                                </div>
                                <div className={styles.metadataRow}>
                                    <dt>Hash</dt>
                                    <dd title={selectedAsset.md5ext}>{selectedAsset.md5ext}</dd>
                                </div>
                            </dl>

                            <section className={styles.detailSection}>
                                <h3>Organization</h3>
                                <form className={styles.renameRow} onSubmit={handleRenameSelected}>
                                    <input
                                        aria-label="Asset name"
                                        value={nameDraft}
                                        onChange={event => setNameDraft(event.target.value)}
                                    />
                                    <button type="submit">Rename</button>
                                </form>
                                <label className={styles.folderSelect}>
                                    <span>Folder</span>
                                    <select
                                        value={selectedAsset.folderId || UNFILED_FOLDER}
                                        onChange={handleMoveSelected}
                                    >
                                        <option value={UNFILED_FOLDER}>Unfiled</option>
                                        {folders.map(folder => (
                                            <option key={folder.id} value={folder.id}>{folder.name}</option>
                                        ))}
                                    </select>
                                </label>
                            </section>

                            <section className={styles.detailSection}>
                                <h3>Actions</h3>
                                <div className={styles.actionStack}>
                                    <button
                                        className={styles.primaryAction}
                                        disabled={!currentTarget}
                                        type="button"
                                        onClick={handleUseSelected}
                                    >
                                        Use on selected target
                                    </button>
                                    <button
                                        disabled={selectedAsset.kind !== 'costume' || !currentCostume}
                                        type="button"
                                        onClick={handleReplaceSelected}
                                    >
                                        Replace globally
                                    </button>
                                    <button
                                        className={styles.dangerButton}
                                        disabled={selectedReferences.length > 0}
                                        type="button"
                                        onClick={handleDeleteSelected}
                                    >
                                        Delete unused asset
                                    </button>
                                </div>
                            </section>

                            <section className={styles.detailSection}>
                                <div className={styles.detailSectionHeading}>
                                    <h3>References</h3>
                                    <span>{selectedReferences.length}</span>
                                </div>
                                <div className={styles.references}>
                                    {selectedReferences.length ? selectedReferences.map(reference => (
                                        <div
                                            className={styles.referenceRow}
                                            key={`${reference.targetId}:${reference.kind}:${reference.itemIndex}`}
                                        >
                                            <button type="button" onClick={() => onSelectTarget(reference.targetId)}>
                                                <strong>{reference.targetName}</strong>
                                                <span>{reference.itemName}</span>
                                            </button>
                                            <button type="button" onClick={() => handleUnlinkReference(reference)}>
                                                Unlink
                                            </button>
                                        </div>
                                    )) : <span className={styles.mutedText}>Not used by any target.</span>}
                                </div>
                            </section>
                        </div>
                    ) : (
                        <div className={styles.detailsEmpty}>
                            <span aria-hidden="true">▧</span>
                            <strong>Select an asset</strong>
                            <p>Asset metadata, references, and actions will appear here.</p>
                        </div>
                    )}
                </aside>
            </div>

            <footer className={styles.statusBar}>
                <span className={styles.statusText}>{status || 'Ready'}</span>
                <span className={styles.targetText}>
                    Target: {currentTarget && typeof currentTarget.getName === 'function' ? currentTarget.getName() : 'None'}
                    {currentCostume ? ` · Costume: ${currentCostume.name}` : ''}
                </span>
            </footer>
        </div>
    );
};

ProjectAssetManager.propTypes = {
    assetDatabase: PropTypes.shape({
        addAssetToTarget: PropTypes.func.isRequired,
        captureCurrentCostume: PropTypes.func.isRequired,
        createFolder: PropTypes.func.isRequired,
        getAsset: PropTypes.func.isRequired,
        getDataURL: PropTypes.func.isRequired,
        getHistoryState: PropTypes.func.isRequired,
        getPreviewURL: PropTypes.func.isRequired,
        getReferences: PropTypes.func.isRequired,
        getRevision: PropTypes.func.isRequired,
        importCostume: PropTypes.func.isRequired,
        importSound: PropTypes.func.isRequired,
        listAssets: PropTypes.func.isRequired,
        listFolders: PropTypes.func.isRequired,
        moveAsset: PropTypes.func.isRequired,
        perform: PropTypes.func.isRequired,
        redo: PropTypes.func.isRequired,
        removeAsset: PropTypes.func.isRequired,
        removeFolder: PropTypes.func.isRequired,
        renameAsset: PropTypes.func.isRequired,
        renameFolder: PropTypes.func.isRequired,
        replaceAssetFromCurrent: PropTypes.func.isRequired,
        subscribe: PropTypes.func.isRequired,
        undo: PropTypes.func.isRequired,
        unlinkReference: PropTypes.func.isRequired
    }),
    currentTarget: PropTypes.shape({
        currentCostume: PropTypes.number,
        getCostumes: PropTypes.func,
        getName: PropTypes.func,
        id: PropTypes.string
    }),
    onSelectionContextChange: PropTypes.func,
    onSelectTarget: PropTypes.func,
    vm: PropTypes.shape({
        addCostume: PropTypes.func,
        addSound: PropTypes.func,
        runtime: PropTypes.shape({
            storage: PropTypes.object
        }).isRequired
    }).isRequired
};

ProjectAssetManager.defaultProps = {
    assetDatabase: null,
    currentTarget: null,
    onSelectionContextChange: () => {},
    onSelectTarget: () => {}
};

export default ProjectAssetManager;
