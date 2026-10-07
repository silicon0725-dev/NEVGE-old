import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import VM from 'scratch-vm';
import {defineMessages, injectIntl, intlShape, FormattedMessage} from 'react-intl';

import extensionLibraryContent, {
    galleryError,
    galleryLoading,
    galleryMore
} from '../lib/libraries/extensions/index.jsx';
import ExtensionCenter from '../components/extension-center';
import extensionIcon from '../components/gui/icon--extensions.svg';
import sceneSystemIcon from '../../static/extensions/NGVGE-Scene-System.svg';
import libraryStyles from '../components/library/library.css';
import {APP_NAME} from '../lib/brand.js';
import log from '../lib/log';
import {
    EXTENSION_SOURCE_GROUPS,
    SOURCE_KEYS,
    attachManifestToGalleryItem,
    extensionRegistry,
    inferLegacySourceId,
    sourceRegistry
} from '../lib/extension-hub';
import {
    createFirstPartyModuleGalleryItems,
    isFirstPartyModuleGalleryItem,
    toggleFirstPartyModule
} from '../lib/first-party-modules/module-gallery-adapter';
import {installScratchExtensionHost} from '../lib/extension-containment';

const messages = defineMessages({
    extensionTitle: {
        defaultMessage: 'Extension Center',
        description: 'Heading for the extension library',
        id: 'gui.extensionLibrary.chooseAnExtension'
    },
    enableModule: {
        defaultMessage: 'Enable module',
        description: 'Button label for enabling an NGVGE first-party module',
        id: 'ngvge.extensionLibrary.module.enable'
    },
    disableModule: {
        defaultMessage: 'Disable module',
        description: 'Button label for disabling an NGVGE first-party module',
        id: 'ngvge.extensionLibrary.module.disable'
    },
    retryModule: {
        defaultMessage: 'Retry enable',
        description: 'Button label for retrying a failed NGVGE first-party module',
        id: 'ngvge.extensionLibrary.module.retry'
    },
    sceneSystemName: {
        defaultMessage: 'Scene System',
        description: 'Name of the NGVGE Scene System first-party module',
        id: 'ngvge.module.sceneSystem.name'
    },
    sceneSystemDescription: {
        defaultMessage: 'Create, switch, duplicate, reorder and preload multiple scenes inside one project.',
        description: 'Description of the NGVGE Scene System first-party module',
        id: 'ngvge.module.sceneSystem.description'
    },
    batchImport: {
        defaultMessage: 'Batch import {count} extensions',
        description: 'Button label for importing multiple selected extensions',
        id: 'tw.extensionLibrary.batchImport'
    },
    clearSelection: {
        defaultMessage: 'Clear selection',
        description: 'Button label for clearing selected extensions from the batch queue',
        id: 'tw.extensionLibrary.clearSelection'
    },
    sourcesTitle: {
        defaultMessage: 'Sources',
        description: 'Sidebar title in the extension library',
        id: 'tw.extensionLibrary.sourcesTitle'
    },
    allSources: {
        defaultMessage: 'All',
        description: 'Label for the all-sources filter in the extension library',
        id: 'tw.extensionLibrary.source.all'
    },
    sourceNGVGE: {
        defaultMessage: 'NGVGE Official',
        description: 'Label for the NGVGE source filter in the extension library',
        id: 'tw.extensionLibrary.source.ngvge'
    },
    sourceScratch: {
        defaultMessage: 'Official Scratch',
        description: 'Label for the Scratch source filter in the extension library',
        id: 'tw.extensionLibrary.source.scratch'
    },
    source02Engine: {
        defaultMessage: '02Engine',
        description: 'Label for the 02Engine source filter in the extension library',
        id: 'tw.extensionLibrary.source.02engine'
    },
    sourceTurboWarp: {
        defaultMessage: 'TurboWarp',
        description: 'Label for the TurboWarp source filter in the extension library',
        id: 'tw.extensionLibrary.source.tw'
    },
    sourceAstraEditor: {
        defaultMessage: 'AstraEditor',
        description: 'Label for the AstraEditor source filter in the extension library',
        id: 'tw.extensionLibrary.source.astra'
    },
    sourcePenguinMod: {
        defaultMessage: 'PenguinMod',
        description: 'Label for the PenguinMod source filter in the extension library',
        id: 'tw.extensionLibrary.source.pm'
    },
    sourceMist: {
        defaultMessage: 'Mist',
        description: 'Label for the Mist source filter in the extension library',
        id: 'tw.extensionLibrary.source.mist'
    },
    sourceSharkPool: {
        defaultMessage: 'SharkPool',
        description: 'Label for the SharkPool source filter in the extension library',
        id: 'tw.extensionLibrary.source.sharkpool'
    },
    sourceCCW: {
        defaultMessage: 'CCW',
        description: 'Label for the CCW source filter in the extension library',
        id: 'tw.extensionLibrary.source.ccw'
    },
    sourceOther: {
        defaultMessage: 'Other',
        description: 'Label for the Other source filter in the extension library',
        id: 'tw.extensionLibrary.source.other'
    },
    sourceCustom: {
        defaultMessage: 'Custom',
        description: 'Label for custom extension items in the extension library',
        id: 'tw.extensionLibrary.source.custom'
    },
    sourceBuiltIn: {
        defaultMessage: 'Built-in',
        description: 'Label for special built-in feature items in the extension library',
        id: 'tw.extensionLibrary.source.builtin'
    },
    quickFavorites: {
        defaultMessage: 'Favorites',
        description: 'Quick filter label for favorite extensions',
        id: 'tw.extensionLibrary.quickFilter.favorites'
    },
    quickSelected: {
        defaultMessage: 'Selected',
        description: 'Quick filter label for selected extensions',
        id: 'tw.extensionLibrary.quickFilter.selected'
    },
    quickCompatible: {
        defaultMessage: 'Scratch-compatible',
        description: 'Quick filter label for Scratch-compatible extensions',
        id: 'tw.extensionLibrary.quickFilter.compatible'
    },
    quickNative: {
        defaultMessage: 'Native only',
        description: 'Quick filter label for native extensions',
        id: 'tw.extensionLibrary.quickFilter.native'
    },
    quickCustom: {
        defaultMessage: 'Custom only',
        description: 'Quick filter label for custom extensions',
        id: 'tw.extensionLibrary.quickFilter.custom'
    },
    commonSection: {
        defaultMessage: 'Favorites',
        description: 'Section title for favorite extensions',
        id: 'tw.extensionLibrary.section.common'
    },
    sourceSection: {
        defaultMessage: '{source} Extensions',
        description: 'Section title for a source group in the extension library',
        id: 'tw.extensionLibrary.section.source'
    },
    moreSection: {
        defaultMessage: 'More from {source}',
        description: 'Section title for remaining source extensions after the common section',
        id: 'tw.extensionLibrary.section.more'
    },
    emptyTitle: {
        defaultMessage: 'No extensions match those filters',
        description: 'Empty state title in the extension library',
        id: 'tw.extensionLibrary.emptyTitle'
    },
    emptyDescription: {
        defaultMessage: 'Try another source, clear a filter, or search for a different keyword.',
        description: 'Empty state description in the extension library',
        id: 'tw.extensionLibrary.emptyDescription'
    },
    clearFilters: {
        defaultMessage: 'Clear filters',
        description: 'Button label to clear extension library filters',
        id: 'tw.extensionLibrary.clearFilters'
    },
    badgeIncompatible: {
        defaultMessage: 'Not Scratch-compatible',
        description: 'Status badge for incompatible extensions',
        id: 'tw.extensionLibrary.badge.incompatible'
    },
    badgeNative: {
        defaultMessage: 'Native',
        description: 'Status badge for native extensions',
        id: 'tw.extensionLibrary.badge.native'
    },
    openCustomLoader: {
        defaultMessage: '加载自定义扩展',
        description: 'Action hint for the custom extension item',
        id: 'tw.extensionLibrary.action.custom'
    },
    openWebsite: {
        defaultMessage: 'Open website',
        description: 'Action hint for extension library website links',
        id: 'tw.extensionLibrary.action.website'
    },
    enableFeature: {
        defaultMessage: 'Enable feature',
        description: 'Action hint for special extension actions',
        id: 'tw.extensionLibrary.action.enableFeature'
    },
    importExtension: {
        defaultMessage: 'Install',
        description: 'Action hint for importing an extension',
        id: 'tw.extensionLibrary.action.import'
    },
    openInstalledExtension: {
        defaultMessage: 'Open',
        description: 'Action for an installed extension',
        id: 'tw.extensionLibrary.action.openInstalled'
    },
    hubSubtitle: {
        defaultMessage: 'Official modules, compatible extensions and online marketplaces',
        description: 'Subtitle for the NGVGE extension center',
        id: 'ngvge.extensionCenter.subtitle'
    },
    hubSearchPlaceholder: {
        defaultMessage: 'Search extensions, sources or authors',
        description: 'Search placeholder in the NGVGE extension center',
        id: 'ngvge.extensionCenter.searchPlaceholder'
    },
    hubDiscover: {
        defaultMessage: 'Discover',
        description: 'Discover navigation group',
        id: 'ngvge.extensionCenter.group.discover'
    },
    hubHome: {
        defaultMessage: 'Home',
        description: 'Extension center home navigation item',
        id: 'ngvge.extensionCenter.home'
    },
    hubInstalled: {
        defaultMessage: 'Installed',
        description: 'Installed extension navigation item',
        id: 'ngvge.extensionCenter.installed'
    },
    hubEcosystem: {
        defaultMessage: 'NGVGE Ecosystem',
        description: 'NGVGE ecosystem navigation group',
        id: 'ngvge.extensionCenter.group.ngvge'
    },
    hubCommunity: {
        defaultMessage: 'Community',
        description: 'Community plugins navigation item',
        id: 'ngvge.extensionCenter.community'
    },
    hubCompatibility: {
        defaultMessage: 'Compatibility',
        description: 'Compatibility extension group',
        id: 'ngvge.extensionCenter.group.compatibility'
    },
    hubOnlineMarkets: {
        defaultMessage: 'Online Markets',
        description: 'Online marketplace navigation group',
        id: 'ngvge.extensionCenter.group.online'
    },
    hubComingSoon: {
        defaultMessage: 'Soon',
        description: 'Coming soon status',
        id: 'ngvge.extensionCenter.soon'
    },
    hubSort: {
        defaultMessage: 'Sort',
        description: 'Sort control label',
        id: 'ngvge.extensionCenter.sort'
    },
    hubSortRecommended: {
        defaultMessage: 'Recommended',
        description: 'Recommended sort option',
        id: 'ngvge.extensionCenter.sort.recommended'
    },
    hubSortName: {
        defaultMessage: 'Name',
        description: 'Name sort option',
        id: 'ngvge.extensionCenter.sort.name'
    },
    hubSortSource: {
        defaultMessage: 'Source',
        description: 'Source sort option',
        id: 'ngvge.extensionCenter.sort.source'
    },
    hubResultCount: {
        defaultMessage: '{count} extensions',
        description: 'Visible extension count',
        id: 'ngvge.extensionCenter.resultCount'
    },
    hubOfficialDescription: {
        defaultMessage: 'Native modules maintained for the NGVGE editor and runtime.',
        description: 'NGVGE official section description',
        id: 'ngvge.extensionCenter.section.officialDescription'
    },
    hubCompatibilityDescription: {
        defaultMessage: 'Scratch-compatible and legacy 02Engine extensions.',
        description: 'Compatibility section description',
        id: 'ngvge.extensionCenter.section.compatibilityDescription'
    },
    hubOnlineDescription: {
        defaultMessage: 'Extensions fetched from preserved external marketplaces.',
        description: 'Online marketplace section description',
        id: 'ngvge.extensionCenter.section.onlineDescription'
    }
});

const HUB_VIEWS = Object.freeze({
    HOME: 'hub-home',
    INSTALLED: 'hub-installed',
    ONLINE: 'hub-online',
    COMPATIBILITY: 'hub-compatibility',
    COMMUNITY: 'hub-community'
});

const FAVORITES_STORAGE_KEY = 'tw:library-favorites:extensionLibrary';
const CCW_EXTENSION_API_BASE = 'https://ccwbfs-proxy.netlify.app/extensions';

const CCW_METADATA_CACHE = {};

const fetchCCWItemMetadata = async (eid) => {
    if (CCW_METADATA_CACHE[eid]) {
        return CCW_METADATA_CACHE[eid];
    }
    const response = await fetch(`${CCW_EXTENSION_API_BASE}/${encodeURIComponent(eid)}`);
    if (!response.ok) {
        throw new Error(`CCW metadata HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    const metadata = data?.body || data;
    if (!metadata || !Array.isArray(metadata.versions) || !metadata.versions.length) {
        throw new Error('No versions found for this CCW extension.');
    }
    if (!metadata.versions[0]?.assetUri) {
        throw new Error('The latest version does not include an asset URL.');
    }
    CCW_METADATA_CACHE[eid] = metadata;
    return metadata;
};

// 实时调用CCW API进行搜索/排序，完全参考ccw-ext.html的请求构建逻辑
const fetchCCWExtensions = async (name, sortField, page, perPage) => {
    let requestUrl = `${CCW_EXTENSION_API_BASE}?page=${page || 1}&perPage=${perPage || 30}&sortField=${sortField || 'updatedAt'}&sortType=DESC`;
    if (name) {
        requestUrl += `&name=${encodeURIComponent(name)}`;
    }
    const response = await fetch(requestUrl);
    if (!response.ok) {
        throw new Error(`CCW API HTTP error! status: ${response.status}`);
    }
    const json = await response.json();
    if (json?.body?.data) {
        const body = json.body;
        return {
            items: body.data,
            total: body.total || body.totalCount || body.count || null,
            page: body.page || page || 1,
            perPage: body.perPage || perPage || 30
        };
    }
    throw new Error('CCW API response format unexpected');
};

// 映射CCW API数据为内部扩展格式，不带标签
const toCCWGalleryItem = (item) => {
    const credits = [];
    if (item.publisher) {
        if (item.publisher.nickname) {
            const oid = item.publisher.oid || item.publisher._id || item.publisher.id || '';
            if (oid) {
                credits.push(
                    <a href={`https://www.ccw.site/student/${oid}`} target="_blank" rel="noreferrer" key={oid}>
                        {item.publisher.nickname}
                    </a>
                );
            } else {
                credits.push(item.publisher.nickname);
            }
        }
    }
    return {
        name: item.name || item.eid || '未知扩展',
        nameTranslations: {},
        description: item.description || '暂无描述',
        descriptionTranslations: {},
        extensionId: `ccw_${item.eid || item.id}`,
        extensionURL: null, // 点击时才通过fetchCCWItemMetadata获取assetUri
        iconURL: item.cover || 'https://placehold.co/600x310/f5f5f5/111111?text=No+Cover',
        tags: ['ccw'],
        credits,
        docsURI: null,
        samples: null,
        incompatibleWithScratch: false,
        featured: true,
        _ccwMeta: {
            eid: item.eid,
            id: item.id,
            publisher: item.publisher,
            stats: item.stats,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            versions: item.versions,
            activeVersionId: item.activeVersionId
        }
    };
};

const getItemSelectionKey = item => item.moduleId || item.extensionURL || item.extensionId;
const isBatchSelectableItem = item => {
    if (!item || item === '---' || item.disabled || item.href || !item.extensionId ||
        isFirstPartyModuleGalleryItem(item)) {
        return false;
    }
    return item.extensionId !== 'custom_extension';
};
const supportsTextImport = item => Boolean(item && item.extensionURL);

const toBatchItem = item => {
    if (item.extensionId === 'procedures_enable_return') {
        return {
            kind: 'procedure-returns',
            extensionId: item.extensionId,
            displayName: typeof item.name === 'string' ? item.name : item.extensionId
        };
    }
    if (!supportsTextImport(item)) {
        return {
            kind: 'native-extension',
            extensionId: item.extensionId,
            extensionURL: item.extensionId,
            displayName: typeof item.name === 'string' ? item.name : item.extensionId
        };
    }
    return {
        kind: 'extension-url',
        extensionId: item.extensionId,
        extensionURL: item.extensionURL || item.extensionId,
        displayName: typeof item.name === 'string' ? item.name : item.extensionId
    };
};

const toLibraryItem = extension => {
    if (typeof extension === 'object') {
        return ({
            rawURL: extension.iconURL || extensionIcon,
            ...extension
        });
    }
    return extension;
};

const normalizeMatchValue = value => {
    if (!value) return '';
    return String(value)
        .toLowerCase()
        .replace(/\.js$/i, '')
        .replace(/[^a-z0-9]+/g, '');
};

const getURLStem = value => {
    if (!value || typeof value !== 'string' || value.startsWith('data:')) {
        return '';
    }
    try {
        const parsed = new URL(value);
        const segments = parsed.pathname.split('/').filter(Boolean);
        return segments.length ? segments[segments.length - 1].replace(/\.js$/i, '') : '';
    } catch (error) {
        return '';
    }
};

const loadExtensionAsText = async (vm, extensionURL) => {
    const response = await fetch(extensionURL);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const text = await response.text();
    await installScratchExtensionHost(vm).loadExtensionURL(
        `data:application/javascript,${encodeURIComponent(text)}`,
        {sourceKind: 'text-import'}
    );
};

const getNameText = (intl, value) => {
    if (typeof value === 'string') {
        return value;
    }
    if (React.isValidElement(value) && value.props) {
        return intl.formatMessage(value.props, {APP_NAME});
    }
    return '';
};

const getLocalizedGalleryText = (fallbackValue, translations, locale) => {
    if (!translations || typeof translations !== 'object') {
        return fallbackValue;
    }
    const normalizedLocale = typeof locale === 'string' ? locale.replace(/_/g, '-').toLowerCase() : '';
    const languageCode = normalizedLocale.split('-')[0];
    const entries = Object.entries(translations);
    const exactMatch = entries.find(([key]) => key.replace(/_/g, '-').toLowerCase() === normalizedLocale);
    if (exactMatch && typeof exactMatch[1] === 'string' && exactMatch[1]) {
        return exactMatch[1];
    }
    const languageMatch = entries.find(([key]) => key.replace(/_/g, '-').toLowerCase().split('-')[0] === languageCode);
    if (languageMatch && typeof languageMatch[1] === 'string' && languageMatch[1]) {
        return languageMatch[1];
    }
    return fallbackValue;
};

const translateGalleryItem = (item, locale) => {
    if (!item || typeof item !== 'object') {
        return item;
    }
    return {
        ...item,
        name: typeof item.name === 'string' ?
            getLocalizedGalleryText(item.name, item.nameTranslations, locale) :
            item.name,
        description: typeof item.description === 'string' ?
            getLocalizedGalleryText(item.description, item.descriptionTranslations, locale) :
            item.description
    };
};

const fetchPenguinModLibrary = async () => {
    try {
        const module = await import(
            /* webpackIgnore: true */
            '/penguinmod/extensions.js'
        );
        return module.default.map(extension => ({
            name: extension.name,
            nameTranslations: {},
            description: extension.description,
            descriptionTranslations: {},
            extensionId: extension.name,
            extensionURL: `https://extensions.penguinmod.com/extensions/${extension.code}`,
            iconURL: `https://extensions.penguinmod.com/images/${extension.banner || 'images/unknown.svg'}`,
            tags: ['pm'],
            credits: [extension.creator],
            docsURI: null,
            samples: null,
            incompatibleWithScratch: false,
            featured: true
        }));
    } catch (err) {
        log.error(err);
        return [];
    }
};

let cachedGallery = null;

const fetchLibrary = async () => {
    const safeFetch = async (url, processor, defaultData = []) => {
        try {
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            return processor(data);
        } catch (error) {
            log.error(error);
            return defaultData;
        }
    };

    const [engineData, twData, astraData, mistData, sharkPoolData, penguinModData] = await Promise.all([
        safeFetch(
            'https://extensions.02engine.02studio.xyz/extensions.json',
            data => data.extensions.map(extension => ({
                name: extension.name,
                nameTranslations: extension.nameTranslations || {},
                description: extension.description,
                descriptionTranslations: extension.descriptionTranslations || {},
                extensionId: extension.id,
                extensionURL: `https://extensions.02engine.02studio.xyz/extension/${extension.slug}.js`,
                iconURL: `https://extensions.02engine.02studio.xyz/image/${extension.image || 'images/unknown.svg'}`,
                tags: ['ztengine'],
                credits: [
                    ...(extension.original || []),
                    ...(extension.by || [])
                ].map(credit => {
                    if (credit.link) {
                        return (
                            <a href={credit.link} target="_blank" rel="noreferrer" key={credit.name}>
                                {credit.name}
                            </a>
                        );
                    }
                    return credit.name;
                }),
                docsURI: null,
                samples: extension.samples ? extension.samples.map(sample => ({
                    href: `${process.env.ROOT}editor?project_url=https://extensions.02engine.02studio.xyz/samples/${encodeURIComponent(sample)}.sb3`,
                    text: sample
                })) : null,
                incompatibleWithScratch: !extension.scratchCompatible,
                featured: true
            })),
            []
        ),
        safeFetch(
            'https://extensions.turbowarp.org/generated-metadata/extensions-v0.json',
            data => data.extensions.map(extension => ({
                name: extension.name,
                nameTranslations: extension.nameTranslations || {},
                description: extension.description,
                descriptionTranslations: extension.descriptionTranslations || {},
                extensionId: extension.id,
                extensionURL: `https://extensions.turbowarp.org/${extension.slug}.js`,
                iconURL: `https://extensions.turbowarp.org/${extension.image || 'images/unknown.svg'}`,
                tags: ['tw'],
                credits: [
                    ...(extension.original || []),
                    ...(extension.by || [])
                ].map(credit => {
                    if (credit.link) {
                        return (
                            <a href={credit.link} target="_blank" rel="noreferrer" key={credit.name}>
                                {credit.name}
                            </a>
                        );
                    }
                    return credit.name;
                }),
                docsURI: extension.docs ? `https://extensions.turbowarp.org/${extension.slug}` : null,
                samples: extension.samples ? extension.samples.map(sample => ({
                    href: `${process.env.ROOT}editor?project_url=https://extensions.turbowarp.org/samples/${encodeURIComponent(sample)}.sb3`,
                    text: sample
                })) : null,
                incompatibleWithScratch: !extension.scratchCompatible,
                featured: true
            })),
            []
        ),
        safeFetch(
            'https://editors.astras.top/extensions/generated-metadata/extensions-v0.json',
            data => data.extensions.map(extension => ({
                name: extension.name,
                nameTranslations: extension.nameTranslations || {},
                description: extension.description,
                descriptionTranslations: extension.descriptionTranslations || {},
                extensionId: extension.id,
                extensionURL: `https://editors.astras.top/extensions/${extension.slug}.js`,
                iconURL: extension.image ?
                    `https://editors.astras.top/extensions/${extension.image}` :
                    'https://extensions.turbowarp.org/images/unknown.svg',
                tags: ['astra'],
                credits: [
                    ...(extension.original || []),
                    ...(extension.by || [])
                ].filter(credit => credit && typeof credit === 'object').map(credit => {
                    if (credit.link) {
                        return (
                            <a href={credit.link} target="_blank" rel="noreferrer" key={credit.name}>
                                {credit.name}
                            </a>
                        );
                    }
                    return credit.name;
                }),
                docsURI: extension.docs ? `https://editors.astras.top/extensions/${extension.slug}` : null,
                samples: extension.samples ? extension.samples.map(sample => ({
                    href: `${process.env.ROOT}editor?project_url=https://editors.astras.top/extensions/samples/${encodeURIComponent(sample)}.sb3`,
                    text: sample
                })) : null,
                incompatibleWithScratch: !extension.scratchCompatible,
                featured: true
            })),
            []
        ),
        safeFetch(
            'https://mistiumextensions.02studio.xyz/generated-metadata/extensions-v0.json',
            data => data.extensions.map(extension => ({
                name: extension.name,
                nameTranslations: extension.nameTranslations || {},
                description: extension.description,
                descriptionTranslations: extension.descriptionTranslations || {},
                extensionId: extension.id,
                extensionURL: `https://mistiumextensions.02studio.xyz/featured/${extension.name}.js`,
                iconURL: `https://mistiumextensions.02studio.xyz/${extension.image || 'images/unknown.svg'}`,
                tags: ['mist'],
                credits: [
                    ...(extension.original || []),
                    ...(extension.by || [])
                ].map(credit => {
                    if (credit.link) {
                        return (
                            <a href={credit.link} target="_blank" rel="noreferrer" key={credit.name}>
                                {credit.name}
                            </a>
                        );
                    }
                    return credit.name;
                }),
                docsURI: null,
                samples: extension.samples ? extension.samples.map(sample => ({
                    href: `${process.env.ROOT}editor?project_url=https://extensions.turbowarp.org/samples/${encodeURIComponent(sample)}.sb3`,
                    text: sample
                })) : null,
                incompatibleWithScratch: !extension.scratchCompatible,
                featured: true
            })),
            []
        ),
        safeFetch(
            'https://sharkpoolextensions.02studio.xyz/Gallery%20Files/Extension-Keys.json',
            data => Object.entries(data.extensions).map(([slug, extension]) => ({
                name: slug,
                nameTranslations: {},
                description: extension.desc,
                descriptionTranslations: {},
                extensionId: slug,
                extensionURL: `https://sharkpoolextensions.02studio.xyz/extension-code/${extension.url}`,
                iconURL: `https://sharkpoolextensions.02studio.xyz/extension-thumbs/${extension.banner || 'images/unknown.svg'}`,
                tags: [...extension.tags, 'sp'],
                credits: extension.creator.split(', ').map(creator => {
                    const match = creator.match(/(.+?)(?:\s*\((.+)\))?$/);
                    const name = match[1];
                    const role = match[2] || '';
                    return role ? `${name} (${role})` : name;
                }),
                docsURI: null,
                samples: null,
                incompatibleWithScratch: false,
                featured: true
            })),
            []
        ),
        fetchPenguinModLibrary()
    ]);

    return [
        ...engineData,
        ...twData,
        ...astraData,
        ...penguinModData,
        ...mistData,
        ...sharkPoolData
    ];
};

class ExtensionLibrary extends React.PureComponent {
    constructor (props) {
        super(props);
        bindAll(this, [
            'executeItemAction',
            'fetchAndSetCCWItems',
            'getCCWRecommendationButtons',
            'getActionLabel',
            'getBatchSelectableItems',
            'getFilterChips',
            'getHubSidebarGroups',
            'getHubSummary',
            'getCCWSortControl',
            'getFirstPartyModuleItems',
            'getLibraryItems',
            'getNormalizedItems',
            'getSourceCounts',
            'getSourceLabel',
            'getSections',
            'handleBatchImport',
            'handleCCWSortChange',
            'handleCCWPageChange',
            'handleCCWRecommendationSelect',
            'handleClearFilters',
            'handleClearQuery',
            'handleClearSelection',
            'handleCustomExtensionOpen',
            'handleEnableProcedureReturns',
            'handleItemSelect',
            'handleQueryChange',
            'handleSelectionToggle',
            'handleSourceSelect',
            'handleSortChange',
            'handleFavoriteToggle',
            'handleToggleQuickFilter',
            'isItemFavorite',
            'isItemSelectable',
            'isItemSelected',
            'matchesQuickFilters',
            'matchesSearch',
            'matchesSource',
            'readFavoritesFromStorage',
            'renderEmptyState',
            'sortItems'
        ]);
        this.state = {
            favorites: this.readFavoritesFromStorage(),
            gallery: cachedGallery,
            galleryError: null,
            galleryTimedOut: false,
            ccwItems: [],
            ccwLoading: false,
            ccwSortField: 'likeCount',
            ccwPage: 1,
            ccwPerPage: 30,
            ccwHasMore: false,
            ccwTotal: null,
            query: '',
            quickFilters: {
                favorites: false,
                selected: false,
                compatible: false,
                native: false,
                custom: false
            },
            selectedItemKeys: [],
            selectedSource: HUB_VIEWS.HOME,
            sortMode: 'recommended'
        };
        this._queryTimeout = null;
        this._galleryTimeout = null;
        this._ccwRequestGeneration = 0;
        this._isMounted = false;
        this._unsubscribeModules = null;
    }
    componentDidMount () {
        this._isMounted = true;
        const moduleManager = this.props.vm?.runtime?.ngvgeFirstPartyModules;
        if (moduleManager && typeof moduleManager.subscribe === 'function') {
            this._unsubscribeModules = moduleManager.subscribe(() => this.forceUpdate());
        }
        if (!this.state.gallery) {
            this._galleryTimeout = setTimeout(() => {
                if (!this._isMounted) return;
                this.setState({
                    galleryTimedOut: true
                });
            }, 750);

            fetchLibrary()
                .then(gallery => {
                    cachedGallery = gallery;
                    if (this._isMounted) {
                        this.setState({
                            gallery
                        });
                    }
                    if (this._galleryTimeout) clearTimeout(this._galleryTimeout);
                    this._galleryTimeout = null;
                })
                .catch(error => {
                    log.error(error);
                    if (this._isMounted) {
                        this.setState({
                            galleryError: error
                        });
                    }
                    if (this._galleryTimeout) clearTimeout(this._galleryTimeout);
                    this._galleryTimeout = null;
                });
        }
        // 初始加载CCW扩展
        this.fetchAndSetCCWItems('', 'likeCount', 1);
    }
    componentWillUnmount () {
        this._isMounted = false;
        this._ccwRequestGeneration += 1;
        if (this._queryTimeout) clearTimeout(this._queryTimeout);
        if (this._galleryTimeout) clearTimeout(this._galleryTimeout);
        this._galleryTimeout = null;
        if (this._unsubscribeModules) this._unsubscribeModules();
    }
    async fetchAndSetCCWItems (name, sortField, page = 1) {
        const requestGeneration = ++this._ccwRequestGeneration;
        if (this._isMounted) this.setState({ccwLoading: true});
        try {
            const result = await fetchCCWExtensions(name, sortField, page, this.state.ccwPerPage);
            const rawItems = Array.isArray(result.items) ? result.items : [];
            const ccwItems = rawItems.map(item => toCCWGalleryItem(item));
            const hasMore = typeof result.total === 'number' ?
                (page * result.perPage) < result.total :
                rawItems.length >= result.perPage;
            if (!this._isMounted || requestGeneration !== this._ccwRequestGeneration) return;
            this.setState({
                ccwItems,
                ccwLoading: false,
                ccwPage: page,
                ccwHasMore: hasMore,
                ccwTotal: result.total
            });
        } catch (err) {
            log.error(err);
            if (!this._isMounted || requestGeneration !== this._ccwRequestGeneration) return;
            this.setState({ccwItems: [], ccwLoading: false, ccwHasMore: false, ccwTotal: null});
        }
    }
    readFavoritesFromStorage () {
        let data;
        try {
            data = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY));
        } catch (error) {
            data = [];
        }
        return Array.isArray(data) ? data : [];
    }
    getSourceLabel (sourceKey) {
        const sourceMessages = {
            [SOURCE_KEYS.ALL]: messages.allSources,
            [SOURCE_KEYS.NGVGE]: messages.sourceNGVGE,
            [SOURCE_KEYS.SCRATCH]: messages.sourceScratch,
            [SOURCE_KEYS.ENGINE]: messages.source02Engine,
            [SOURCE_KEYS.TW]: messages.sourceTurboWarp,
            [SOURCE_KEYS.ASTRA]: messages.sourceAstraEditor,
            [SOURCE_KEYS.PM]: messages.sourcePenguinMod,
            [SOURCE_KEYS.MIST]: messages.sourceMist,
            [SOURCE_KEYS.SHARKPOOL]: messages.sourceSharkPool,
            [SOURCE_KEYS.CCW]: messages.sourceCCW,
            [SOURCE_KEYS.OTHER]: messages.sourceOther,
            [SOURCE_KEYS.CUSTOM]: messages.sourceCustom,
            [SOURCE_KEYS.SPECIAL]: messages.sourceBuiltIn
        };
        return this.props.intl.formatMessage(sourceMessages[sourceKey] || messages.sourceOther);
    }
    getFirstPartyModuleItems () {
        const moduleManager = this.props.vm?.runtime?.ngvgeFirstPartyModules;
        const translations = {
            'ngvge.scene-system': {
                name: this.props.intl.formatMessage(messages.sceneSystemName),
                description: this.props.intl.formatMessage(messages.sceneSystemDescription)
            }
        };
        return createFirstPartyModuleGalleryItems(moduleManager, {
            fallbackIcon: extensionIcon,
            icons: {
                'ngvge.scene-system': sceneSystemIcon
            },
            translations
        }).map(toLibraryItem);
    }
    getLibraryItems () {
        const locale = this.props.intl?.locale;
        const moduleItems = this.getFirstPartyModuleItems();
        const baseLibrary = extensionLibraryContent
            .map(toLibraryItem)
            .map(item => translateGalleryItem(item, locale));
        if (this.state.gallery) {
            const ccwItems = this.state.ccwItems.map(toLibraryItem);
            return [
                ...moduleItems,
                ...baseLibrary,
                toLibraryItem(galleryMore),
                ...this.state.gallery
                    .map(toLibraryItem)
                    .map(item => translateGalleryItem(item, locale)),
                ...ccwItems
            ];
        }
        if (this.state.galleryError) {
            return [
                ...moduleItems,
                ...baseLibrary,
                toLibraryItem(galleryError)
            ];
        }
        return [
            ...moduleItems,
            ...baseLibrary,
            toLibraryItem(galleryLoading)
        ];
    }
    getNormalizedItems () {
        const library = this.getLibraryItems();
        if (!library) {
            return [];
        }
        const scratchExtensionHost = installScratchExtensionHost(this.props.vm);
        const loadedExtensionURLs = scratchExtensionHost.getLoadedExtensionURLs();
        const loadedURLValues = new Set(Object.values(loadedExtensionURLs));
        const loadedIds = new Set(scratchExtensionHost.listLoadedExtensionIds());
        const loadedEntries = Array.from(loadedIds).map(loadedId => ({
            id: loadedId,
            normalizedId: normalizeMatchValue(loadedId),
            normalizedURLStem: normalizeMatchValue(getURLStem(loadedExtensionURLs[loadedId]))
        }));
        return library
            .filter(item => item && item !== '---')
            .map((item, originalIndex) => {
                const extensionId = item.extensionId || '';
                const source = inferLegacySourceId(item);
                const itemWithManifest = attachManifestToGalleryItem(item, {sourceId: source});
                extensionRegistry.register(itemWithManifest.ngvgeManifest, itemWithManifest);

                const isCustomLoad = extensionId === 'custom_extension';
                const isCCWLoad = source === SOURCE_KEYS.CCW;
                const isSpecialAction = extensionId === 'procedures_enable_return';
                const isNative = isFirstPartyModuleGalleryItem(item) || Boolean(extensionId && !item.extensionURL && !item.href && !isCustomLoad && !isCCWLoad && !isSpecialAction);
                const candidateValues = new Set([
                    normalizeMatchValue(extensionId),
                    normalizeMatchValue(getNameText(this.props.intl, item.name)),
                    normalizeMatchValue(getURLStem(item.extensionURL))
                ].filter(Boolean));
                const fuzzyInstalled = loadedEntries.some(loadedEntry => (
                    candidateValues.has(loadedEntry.normalizedId) ||
                    candidateValues.has(loadedEntry.normalizedURLStem)
                ));
                const isInstalled = isFirstPartyModuleGalleryItem(item) ?
                    Boolean(item.moduleEnabled) :
                    Boolean(
                        extensionId &&
                        !item.href &&
                        !item.disabled &&
                        !isSpecialAction &&
                        (
                            installScratchExtensionHost(this.props.vm).isExtensionLoaded(extensionId) ||
                            loadedIds.has(extensionId) ||
                            (item.extensionURL && loadedURLValues.has(item.extensionURL)) ||
                            fuzzyInstalled
                        )
                    );
                const sourceLabel = this.getSourceLabel(source);
                const textParts = [];
                textParts.push(getNameText(this.props.intl, item.name));
                if (typeof item.description === 'string') {
                    textParts.push(item.description);
                } else if (React.isValidElement(item.description) && item.description.props) {
                    textParts.push(this.props.intl.formatMessage(item.description.props, {APP_NAME}));
                }
                if (Array.isArray(item.tags)) {
                    textParts.push(...item.tags);
                }
                if (Array.isArray(item.credits)) {
                    textParts.push(...item.credits.map(credit => {
                        if (typeof credit === 'string') {
                            return credit;
                        }
                        if (React.isValidElement(credit) && typeof credit.props?.children === 'string') {
                            return credit.props.children;
                        }
                        return '';
                    }));
                }
                textParts.push(sourceLabel);

                return {
                    ...itemWithManifest,
                    favoriteKey: item.extensionURL || item.extensionId,
                    isBatchSelectable: isBatchSelectableItem(item),
                    isCompatible: !item.incompatibleWithScratch,
                    isCCWLoad,
                    isCustomLoad,
                    isInstalled,
                    isNative,
                    originalIndex,
                    isSpecialAction,
                    searchText: textParts.join('\n').toLowerCase(),
                    source,
                    sourceLabel
                };
            });
    }
    getBatchSelectableItems () {
        return this.getNormalizedItems().filter(item => item.isBatchSelectable);
    }
    handleEnableProcedureReturns () {
        if (this.props.onEnableProcedureReturns) {
            this.props.onEnableProcedureReturns();
            return;
        }
        if (window.__twEnableProcedureReturns) {
            window.__twEnableProcedureReturns();
            return;
        }
        const Blockly = window.ScratchBlocks || window.Blockly;
        const workspace = Blockly && Blockly.getMainWorkspace ? Blockly.getMainWorkspace() : null;
        if (workspace && workspace.enableProcedureReturns) {
            workspace.enableProcedureReturns();
            if (workspace.refreshToolboxSelection_) {
                workspace.refreshToolboxSelection_();
            }
        }
        if (this.props.onCategorySelected) {
            this.props.onCategorySelected('myBlocks');
        }
    }
    executeItemAction (item, {useImportModal}) {
        if (item.href) {
            window.open(item.href, '_blank', 'noopener,noreferrer');
            return;
        }

        const extensionId = item.extensionId;
        const extensionURL = item.extensionURL || extensionId;

        if (extensionId === 'custom_extension') {
            this.props.onOpenCustomExtensionModal();
            return;
        }

        if (extensionId === 'procedures_enable_return') {
            this.handleEnableProcedureReturns();
            return;
        }

        if (isFirstPartyModuleGalleryItem(item)) {
            try {
                const moduleManager = this.props.vm?.runtime?.ngvgeFirstPartyModules;
                toggleFirstPartyModule(moduleManager, item.moduleId);
            } catch (error) {
                log.error(error);
                // eslint-disable-next-line no-alert
                alert(error && error.message ? error.message : String(error));
            }
            return;
        }

        if (item.disabled) {
            return;
        }

        // Handle CCW gallery items: fetch metadata and load extension
        if (item._ccwMeta && item._ccwMeta.eid) {
            const ccwEid = item._ccwMeta.eid;
            fetchCCWItemMetadata(ccwEid)
                .then(metadata => {
                    const versions = Array.isArray(metadata.versions) ? metadata.versions : [];
                    const selectedVersion = versions[0];
                    if (!selectedVersion?.assetUri) {
                        throw new Error('No valid asset URL found for this CCW extension.');
                    }
                    const assetUri = selectedVersion.assetUri;
                    if (this.props.onSetSelectedExtension && this.props.onOpenExtensionImportMethodModal) {
                        if (this.props.onSetSelectedExtensions) {
                            this.props.onSetSelectedExtensions([]);
                        }
                        this.props.onSetSelectedExtension({
                            extensionId: ccwEid,
                            extensionURL: assetUri,
                            _ccwMeta: metadata
                        });
                        this.props.onOpenExtensionImportMethodModal();
                    } else {
                        installScratchExtensionHost(this.props.vm).loadExtensionURL(assetUri)
                            .then(() => {
                                if (this.props.onCategorySelected) {
                                    this.props.onCategorySelected(ccwEid);
                                }
                            })
                            .catch(err => {
                                log.error(err);
                                // eslint-disable-next-line no-alert
                                alert(err);
                            });
                    }
                })
                .catch(err => {
                    log.error(err);
                    // eslint-disable-next-line no-alert
                    alert(err || String(err));
                });
            return;
        }

        if (extensionId === 'extfind') {
            loadExtensionAsText(this.props.vm, extensionURL)
                .then(() => {
                    this.props.onCategorySelected(extensionId);
                })
                .catch(err => {
                    log.error(err);
                    // eslint-disable-next-line no-alert
                    alert(err);
                });
            return;
        }

        if (
            useImportModal &&
            supportsTextImport(item) &&
            this.props.onSetSelectedExtension &&
            this.props.onOpenExtensionImportMethodModal
        ) {
            if (this.props.onSetSelectedExtensions) {
                this.props.onSetSelectedExtensions([]);
            }
            this.props.onSetSelectedExtension({
                extensionId,
                extensionURL
            });
            this.props.onOpenExtensionImportMethodModal();
        } else if (installScratchExtensionHost(this.props.vm).isExtensionLoaded(extensionId)) {
            this.props.onCategorySelected(extensionId);
        } else {
            installScratchExtensionHost(this.props.vm).loadExtensionURL(extensionURL)
                .then(() => {
                    this.props.onCategorySelected(extensionId);
                })
                .catch(err => {
                    log.error(err);
                    // eslint-disable-next-line no-alert
                    alert(err);
                });
        }
    }
    handleItemSelect (item) {
        this.executeItemAction(item, {useImportModal: true});
    }
    handleSelectionToggle (item) {
        const selectionKey = getItemSelectionKey(item);
        this.setState(prevState => ({
            selectedItemKeys: prevState.selectedItemKeys.includes(selectionKey) ?
                prevState.selectedItemKeys.filter(key => key !== selectionKey) :
                [...prevState.selectedItemKeys, selectionKey]
        }));
    }
    handleBatchImport () {
        const selectedExtensions = this.getBatchSelectableItems()
            .filter(item => this.state.selectedItemKeys.includes(getItemSelectionKey(item)))
            .map(toBatchItem);
        if (!selectedExtensions.length) {
            return;
        }
        if (this.props.onSetSelectedExtension) {
            this.props.onSetSelectedExtension(null);
        }
        this.props.onSetSelectedExtensions(selectedExtensions);
        this.props.onOpenExtensionImportMethodModal();
    }
    handleClearSelection () {
        this.setState({
            selectedItemKeys: []
        });
    }
    handleFavoriteToggle (item) {
        const key = getItemSelectionKey(item);
        const favorites = this.state.favorites.includes(key) ?
            this.state.favorites.filter(favoriteKey => favoriteKey !== key) :
            [...this.state.favorites, key];
        try {
            localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
        } catch (error) {
            // Ignore storage failures; the in-memory state still updates.
        }
        this.setState({favorites});
    }
    handleSortChange (event) {
        this.setState({sortMode: event.target.value});
    }
    handleCCWSortChange (event) {
        const sortField = event.target.value;
        this.setState({ccwSortField: sortField, ccwPage: 1});
        this.fetchAndSetCCWItems(this.state.query, sortField, 1);
    }
    handleCCWRecommendationSelect (sortField) {
        this.setState({ccwSortField: sortField, ccwPage: 1});
        this.fetchAndSetCCWItems(this.state.query, sortField, 1);
    }
    handleCCWPageChange (delta) {
        const nextPage = Math.max(1, this.state.ccwPage + delta);
        if (nextPage === this.state.ccwPage) {
            return;
        }
        if (delta > 0 && !this.state.ccwHasMore) {
            return;
        }
        this.fetchAndSetCCWItems(this.state.query, this.state.ccwSortField, nextPage);
    }
    handleSourceSelect (selectedSource) {
        this.setState({
            selectedSource
        });
        // 切换到CCW时触发实时搜索
        if (
            selectedSource === SOURCE_KEYS.CCW ||
            selectedSource === SOURCE_KEYS.ALL ||
            selectedSource === HUB_VIEWS.HOME ||
            selectedSource === HUB_VIEWS.ONLINE
        ) {
            this.fetchAndSetCCWItems(this.state.query, this.state.ccwSortField, 1);
        }
    }
    handleQueryChange (query) {
        this.setState({
            query
        });
        // 防抖：用户停止输入500ms后触发CCW搜索
        if (this._queryTimeout) {
            clearTimeout(this._queryTimeout);
        }
        this._queryTimeout = setTimeout(() => {
            this.fetchAndSetCCWItems(query, this.state.ccwSortField, 1);
        }, 500);
    }
    handleToggleQuickFilter (filterKey) {
        this.setState(prevState => ({
            quickFilters: {
                ...prevState.quickFilters,
                [filterKey]: !prevState.quickFilters[filterKey]
            }
        }));
    }
    handleClearQuery () {
        this.setState({
            query: ''
        });
        this.fetchAndSetCCWItems('', this.state.ccwSortField, 1);
    }
    handleClearFilters () {
        this.setState({
            query: '',
            quickFilters: {
                favorites: false,
                selected: false,
                compatible: false,
                native: false,
                custom: false
            },
            selectedSource: HUB_VIEWS.HOME,
            ccwPage: 1
        });
        this.fetchAndSetCCWItems('', this.state.ccwSortField, 1);
    }
    handleCustomExtensionOpen () {
        this.props.onOpenCustomExtensionModal();
    }
    isItemFavorite (item) {
        return this.state.favorites.includes(getItemSelectionKey(item));
    }
    isItemSelectable (item) {
        return item.isBatchSelectable;
    }
    isItemSelected (item) {
        return this.state.selectedItemKeys.includes(getItemSelectionKey(item));
    }
    matchesSource (item, sourceKey) {
        if (sourceKey === HUB_VIEWS.HOME || sourceKey === SOURCE_KEYS.ALL) {
            return true;
        }
        if (sourceKey === HUB_VIEWS.INSTALLED) {
            return item.isInstalled;
        }
        if (sourceKey === HUB_VIEWS.ONLINE) {
            const source = sourceRegistry.get(item.source);
            return Boolean(source && source.group === EXTENSION_SOURCE_GROUPS.ONLINE);
        }
        if (sourceKey === HUB_VIEWS.COMPATIBILITY) {
            const source = sourceRegistry.get(item.source);
            return Boolean(source && source.group === EXTENSION_SOURCE_GROUPS.COMPATIBILITY);
        }
        if (sourceKey === HUB_VIEWS.COMMUNITY) {
            return false;
        }
        if (sourceKey === SOURCE_KEYS.CCW) {
            return item.source === SOURCE_KEYS.CCW;
        }
        if (sourceKey === SOURCE_KEYS.OTHER) {
            return !sourceRegistry.has(item.source) || item.source === SOURCE_KEYS.OTHER;
        }
        return item.source === sourceKey;
    }
    matchesQuickFilters (item) {
        const filters = this.state.quickFilters;
        const selectionKey = getItemSelectionKey(item);
        if (filters.favorites && !this.state.favorites.includes(selectionKey)) {
            return false;
        }
        if (filters.selected && !this.state.selectedItemKeys.includes(selectionKey)) {
            return false;
        }
        if (filters.compatible && !item.isCompatible) {
            return false;
        }
        if (filters.native && !item.isNative) {
            return false;
        }
        if (filters.custom && !item.isCustomLoad) {
            return false;
        }
        return true;
    }
    matchesSearch (item) {
        if (!this.state.query) {
            return true;
        }
        return item.searchText.includes(this.state.query.toLowerCase());
    }
    sortItems (a, b) {
        if (this.state.sortMode === 'name') {
            return getNameText(this.props.intl, a.name).localeCompare(getNameText(this.props.intl, b.name));
        }
        if (this.state.sortMode === 'source') {
            const sourceOrder = a.sourceLabel.localeCompare(b.sourceLabel);
            return sourceOrder || getNameText(this.props.intl, a.name).localeCompare(getNameText(this.props.intl, b.name));
        }
        if (a.isInstalled !== b.isInstalled) {
            return a.isInstalled ? -1 : 1;
        }
        if (a.source === SOURCE_KEYS.NGVGE && b.source !== SOURCE_KEYS.NGVGE) return -1;
        if (b.source === SOURCE_KEYS.NGVGE && a.source !== SOURCE_KEYS.NGVGE) return 1;
        return a.originalIndex - b.originalIndex;
    }
    getSourceCounts (items) {
        const counts = {
            [HUB_VIEWS.HOME]: items.length,
            [HUB_VIEWS.INSTALLED]: 0,
            [HUB_VIEWS.ONLINE]: 0,
            [HUB_VIEWS.COMPATIBILITY]: 0,
            [HUB_VIEWS.COMMUNITY]: 0,
            [SOURCE_KEYS.ALL]: items.length,
            [SOURCE_KEYS.NGVGE]: 0,
            [SOURCE_KEYS.SCRATCH]: 0,
            [SOURCE_KEYS.ENGINE]: 0,
            [SOURCE_KEYS.TW]: 0,
            [SOURCE_KEYS.ASTRA]: 0,
            [SOURCE_KEYS.PM]: 0,
            [SOURCE_KEYS.MIST]: 0,
            [SOURCE_KEYS.SHARKPOOL]: 0,
            [SOURCE_KEYS.CCW]: 0,
            [SOURCE_KEYS.OTHER]: 0
        };
        for (const item of items) {
            if (item.isInstalled) counts[HUB_VIEWS.INSTALLED] += 1;
            if (this.matchesSource(item, HUB_VIEWS.ONLINE)) counts[HUB_VIEWS.ONLINE] += 1;
            if (this.matchesSource(item, HUB_VIEWS.COMPATIBILITY)) counts[HUB_VIEWS.COMPATIBILITY] += 1;
            if (this.matchesSource(item, SOURCE_KEYS.OTHER)) {
                counts[SOURCE_KEYS.OTHER] += 1;
            } else if (typeof counts[item.source] === 'number') {
                counts[item.source] += 1;
            }
        }
        return counts;
    }
    getSections () {
        const allItems = this.getNormalizedItems().filter(item => !item.isCustomLoad);
        const counts = this.getSourceCounts(allItems);
        const normalized = allItems
            .filter(item => this.matchesQuickFilters(item) && this.matchesSearch(item));
        const visibleItems = normalized
            .filter(item => this.matchesSource(item, this.state.selectedSource))
            .sort(this.sortItems);
        const sections = [];
        const favoriteItems = visibleItems.filter(this.isItemFavorite);
        const favoriteKeys = new Set(favoriteItems.map(getItemSelectionKey));
        const remainingItems = visibleItems.filter(item => !favoriteKeys.has(getItemSelectionKey(item)));

        if (favoriteItems.length) {
            sections.push({
                key: 'favorites',
                title: this.props.intl.formatMessage(messages.commonSection),
                description: 'Pinned extensions from every ecosystem.',
                items: favoriteItems
            });
        }

        if (this.state.query) {
            if (remainingItems.length) {
                sections.push({
                    key: 'search-results',
                    title: `Search results for “${this.state.query}”`,
                    description: 'Results include NGVGE modules and preserved external sources.',
                    items: remainingItems
                });
            }
        } else if (this.state.selectedSource === HUB_VIEWS.HOME) {
            const official = remainingItems.filter(item => item.source === SOURCE_KEYS.NGVGE);
            const compatibility = remainingItems.filter(item => this.matchesSource(item, HUB_VIEWS.COMPATIBILITY));
            const online = remainingItems.filter(item => this.matchesSource(item, HUB_VIEWS.ONLINE));
            const usedKeys = new Set([...official, ...compatibility, ...online].map(getItemSelectionKey));
            const other = remainingItems.filter(item => !usedKeys.has(getItemSelectionKey(item)));

            if (official.length) sections.push({
                key: 'home-ngvge',
                title: this.getSourceLabel(SOURCE_KEYS.NGVGE),
                description: this.props.intl.formatMessage(messages.hubOfficialDescription),
                items: official
            });
            if (compatibility.length) sections.push({
                key: 'home-compatibility',
                title: this.props.intl.formatMessage(messages.hubCompatibility),
                description: this.props.intl.formatMessage(messages.hubCompatibilityDescription),
                items: compatibility
            });
            if (online.length) sections.push({
                key: 'home-online',
                title: this.props.intl.formatMessage(messages.hubOnlineMarkets),
                description: this.props.intl.formatMessage(messages.hubOnlineDescription),
                items: online
            });
            if (other.length) sections.push({
                key: 'home-other',
                title: this.getSourceLabel(SOURCE_KEYS.OTHER),
                items: other
            });
        } else if (
            this.state.selectedSource === HUB_VIEWS.ONLINE ||
            this.state.selectedSource === HUB_VIEWS.COMPATIBILITY
        ) {
            const sourceDefinitions = sourceRegistry.list({enabledOnly: true})
                .filter(source => (
                    this.state.selectedSource === HUB_VIEWS.ONLINE ?
                        source.group === EXTENSION_SOURCE_GROUPS.ONLINE :
                        source.group === EXTENSION_SOURCE_GROUPS.COMPATIBILITY
                ));
            for (const source of sourceDefinitions) {
                const sourceItems = remainingItems.filter(item => item.source === source.id);
                if (!sourceItems.length) continue;
                sections.push({
                    key: `group-${source.id}`,
                    title: this.getSourceLabel(source.id),
                    description: source.metadataURL ? `Remote source: ${source.metadataURL}` : null,
                    items: sourceItems
                });
            }
        } else if (remainingItems.length) {
            let title = this.getSourceLabel(this.state.selectedSource);
            let description = null;
            if (this.state.selectedSource === HUB_VIEWS.INSTALLED) {
                title = this.props.intl.formatMessage(messages.hubInstalled);
                description = 'Extensions currently loaded in this editor session.';
            } else if (this.state.selectedSource === HUB_VIEWS.COMMUNITY) {
                title = this.props.intl.formatMessage(messages.hubCommunity);
                description = 'The NGVGE community repository will be connected in a later task.';
            }
            sections.push({
                key: `source-${this.state.selectedSource}`,
                title,
                description,
                items: remainingItems
            });
        }

        return {
            counts,
            sections,
            visibleCount: visibleItems.length
        };
    }
    getHubSidebarGroups (counts) {
        const createItem = (key, label, icon, options = {}) => ({
            key,
            label,
            icon,
            count: options.count,
            status: options.status,
            disabled: options.disabled,
            active: this.state.selectedSource === key,
            onClick: () => this.handleSourceSelect(key)
        });
        return [
            {
                key: 'discover',
                title: this.props.intl.formatMessage(messages.hubDiscover),
                items: [
                    createItem(HUB_VIEWS.HOME, this.props.intl.formatMessage(messages.hubHome), '⌂', {
                        count: counts[HUB_VIEWS.HOME]
                    }),
                    createItem(HUB_VIEWS.INSTALLED, this.props.intl.formatMessage(messages.hubInstalled), '✓', {
                        count: counts[HUB_VIEWS.INSTALLED]
                    })
                ]
            },
            {
                key: 'ngvge',
                title: this.props.intl.formatMessage(messages.hubEcosystem),
                items: [
                    createItem(SOURCE_KEYS.NGVGE, this.getSourceLabel(SOURCE_KEYS.NGVGE), 'N', {
                        count: counts[SOURCE_KEYS.NGVGE]
                    }),
                    createItem(HUB_VIEWS.COMMUNITY, this.props.intl.formatMessage(messages.hubCommunity), 'C', {
                        count: 0,
                        disabled: true,
                        status: this.props.intl.formatMessage(messages.hubComingSoon)
                    })
                ]
            },
            {
                key: 'compatibility',
                title: this.props.intl.formatMessage(messages.hubCompatibility),
                items: [
                    createItem(HUB_VIEWS.COMPATIBILITY, 'All compatibility', '↔', {
                        count: counts[HUB_VIEWS.COMPATIBILITY]
                    }),
                    createItem(SOURCE_KEYS.SCRATCH, this.getSourceLabel(SOURCE_KEYS.SCRATCH), 'S', {
                        count: counts[SOURCE_KEYS.SCRATCH]
                    }),
                    createItem(SOURCE_KEYS.ENGINE, this.getSourceLabel(SOURCE_KEYS.ENGINE), '02', {
                        count: counts[SOURCE_KEYS.ENGINE]
                    }),
                    createItem(SOURCE_KEYS.OTHER, this.getSourceLabel(SOURCE_KEYS.OTHER), '…', {
                        count: counts[SOURCE_KEYS.OTHER]
                    })
                ]
            },
            {
                key: 'online',
                title: this.props.intl.formatMessage(messages.hubOnlineMarkets),
                items: [
                    createItem(HUB_VIEWS.ONLINE, 'All online sources', '◎', {
                        count: counts[HUB_VIEWS.ONLINE]
                    }),
                    createItem(SOURCE_KEYS.TW, this.getSourceLabel(SOURCE_KEYS.TW), 'TW', {count: counts[SOURCE_KEYS.TW]}),
                    createItem(SOURCE_KEYS.PM, this.getSourceLabel(SOURCE_KEYS.PM), 'PM', {count: counts[SOURCE_KEYS.PM]}),
                    createItem(SOURCE_KEYS.ASTRA, this.getSourceLabel(SOURCE_KEYS.ASTRA), 'A', {count: counts[SOURCE_KEYS.ASTRA]}),
                    createItem(SOURCE_KEYS.MIST, this.getSourceLabel(SOURCE_KEYS.MIST), 'M', {count: counts[SOURCE_KEYS.MIST]}),
                    createItem(SOURCE_KEYS.SHARKPOOL, this.getSourceLabel(SOURCE_KEYS.SHARKPOOL), 'SP', {count: counts[SOURCE_KEYS.SHARKPOOL]}),
                    createItem(SOURCE_KEYS.CCW, this.getSourceLabel(SOURCE_KEYS.CCW), 'CCW', {count: counts[SOURCE_KEYS.CCW]})
                ]
            }
        ];
    }
    getFilterChips () {
        const filterConfig = [
            ['favorites', messages.quickFavorites],
            ['selected', messages.quickSelected],
            ['compatible', messages.quickCompatible],
            ['native', messages.quickNative]
        ];
        return filterConfig.map(([key, message]) => ({
            key,
            label: this.props.intl.formatMessage(message),
            active: this.state.quickFilters[key],
            onClick: () => this.handleToggleQuickFilter(key)
        }));
    }
    getHubSummary (counts) {
        return [
            {key: 'official', value: counts[SOURCE_KEYS.NGVGE], label: 'NGVGE official'},
            {key: 'online', value: counts[HUB_VIEWS.ONLINE], label: 'Online market'},
            {key: 'installed', value: counts[HUB_VIEWS.INSTALLED], label: 'Installed'}
        ];
    }
    getActionLabel (item) {
        if (isFirstPartyModuleGalleryItem(item)) {
            if (item.moduleError) return <FormattedMessage {...messages.retryModule} />;
            return item.isInstalled ?
                <FormattedMessage {...messages.disableModule} /> :
                <FormattedMessage {...messages.enableModule} />;
        }
        if (item.isInstalled) {
            return <FormattedMessage {...messages.openInstalledExtension} />;
        }
        if (item.isCustomLoad) {
            return <FormattedMessage {...messages.openCustomLoader} />;
        }
        if (item.isCCWLoad) {
            return <FormattedMessage {...messages.importExtension} />;
        }
        if (item.href) {
            return <FormattedMessage {...messages.openWebsite} />;
        }
        if (item.isSpecialAction) {
            return <FormattedMessage {...messages.enableFeature} />;
        }
        return <FormattedMessage {...messages.importExtension} />;
    }
    getCCWRecommendationButtons () {
        const options = [
            ['likeCount', '最多喜欢'],
            ['updatedAt', '最近更新'],
            ['createdAt', '最新创建'],
            ['donateCount', '最多投币']
        ];
        return options.map(([value, label]) => (
            <button
                key={value}
                type="button"
                className={[
                    libraryStyles.quickFilterButton,
                    this.state.ccwSortField === value ? libraryStyles.quickFilterButtonActive : ''
                ].join(' ')}
                onClick={() => this.handleCCWRecommendationSelect(value)}
            >
                {label}
            </button>
        ));
    }
    getCCWSortControl () {
        return (
            <div style={{marginTop: '0.75rem'}}>
                <div className={libraryStyles.sidebarTitle} style={{marginBottom: '0.5rem', opacity: 0.6, fontSize: '0.75rem'}}>
                    推荐方式
                </div>
                <div className={libraryStyles.quickFilters}>
                    {this.getCCWRecommendationButtons()}
                </div>
                <div className={libraryStyles.sidebarTitle} style={{marginTop: '0.75rem', marginBottom: '0.5rem', opacity: 0.6, fontSize: '0.75rem'}}>
                    第 {this.state.ccwPage} 页{typeof this.state.ccwTotal === 'number' ? ` / 共 ${this.state.ccwTotal} 个` : ''}
                </div>
                <div className={libraryStyles.quickFilters}>
                    <button
                        type="button"
                        className={libraryStyles.quickFilterButton}
                        disabled={this.state.ccwPage <= 1 || this.state.ccwLoading}
                        onClick={() => this.handleCCWPageChange(-1)}
                    >
                        上一页
                    </button>
                    <button
                        type="button"
                        className={libraryStyles.quickFilterButton}
                        disabled={!this.state.ccwHasMore || this.state.ccwLoading}
                        onClick={() => this.handleCCWPageChange(1)}
                    >
                        下一页
                    </button>
                </div>
            </div>
        );
    }
    renderEmptyState () {
        return (
            <div className={libraryStyles.emptyState}>
                <div className={libraryStyles.emptyStateTitle}>
                    <FormattedMessage {...messages.emptyTitle} />
                </div>
                <div className={libraryStyles.emptyStateDescription}>
                    <FormattedMessage {...messages.emptyDescription} />
                </div>
                <button
                    type="button"
                    className={libraryStyles.headerSecondaryButton}
                    onClick={this.handleClearFilters}
                >
                    <FormattedMessage {...messages.clearFilters} />
                </button>
            </div>
        );
    }
    render () {
        const library = this.getLibraryItems();
        const {counts, sections, visibleCount} = this.getSections();
        const sortOptions = [
            {value: 'recommended', label: this.props.intl.formatMessage(messages.hubSortRecommended)},
            {value: 'name', label: this.props.intl.formatMessage(messages.hubSortName)},
            {value: 'source', label: this.props.intl.formatMessage(messages.hubSortSource)}
        ];

        return (
            <ExtensionCenter
                customExtensionLabel={<FormattedMessage {...messages.openCustomLoader} />}
                emptyState={this.renderEmptyState()}
                filterChips={this.getFilterChips()}
                getActionLabel={this.getActionLabel}
                headerAction={this.state.selectedItemKeys.length > 0 ? (
                    <React.Fragment>
                        <button
                            type="button"
                            className={libraryStyles.headerSecondaryButton}
                            onClick={this.handleClearSelection}
                        >
                            <FormattedMessage {...messages.clearSelection} />
                        </button>
                        <button
                            type="button"
                            className={libraryStyles.headerActionButton}
                            onClick={this.handleBatchImport}
                        >
                            <FormattedMessage
                                {...messages.batchImport}
                                values={{count: this.state.selectedItemKeys.length}}
                            />
                        </button>
                    </React.Fragment>
                ) : null}
                isFavorite={this.isItemFavorite}
                isItemSelectable={this.isItemSelectable}
                isItemSelected={this.isItemSelected}
                query={this.state.query}
                resultLabel={this.props.intl.formatMessage(messages.hubResultCount, {count: visibleCount})}
                searchPlaceholder={this.props.intl.formatMessage(messages.hubSearchPlaceholder)}
                sections={library ? sections : []}
                showOverview={this.state.selectedSource === HUB_VIEWS.HOME && !this.state.query}
                sidebarExtra={this.state.selectedSource === SOURCE_KEYS.CCW ? this.getCCWSortControl() : null}
                sidebarGroups={this.getHubSidebarGroups(counts)}
                sortLabel={<FormattedMessage {...messages.hubSort} />}
                sortMode={this.state.sortMode}
                sortOptions={sortOptions}
                subtitle={<FormattedMessage {...messages.hubSubtitle} />}
                summary={this.getHubSummary(counts)}
                title={this.props.intl.formatMessage(messages.extensionTitle)}
                onFavorite={this.handleFavoriteToggle}
                onItemSelected={this.handleItemSelect}
                onOpenCustomExtension={this.handleCustomExtensionOpen}
                onQueryChange={this.handleQueryChange}
                onQueryClear={this.handleClearQuery}
                onRequestClose={this.props.onRequestClose}
                onSelectionToggle={this.handleSelectionToggle}
                onSortChange={this.handleSortChange}
            />
        );
    }
}

ExtensionLibrary.propTypes = {
    intl: intlShape.isRequired,
    onCategorySelected: PropTypes.func,
    onEnableProcedureReturns: PropTypes.func,
    onOpenCustomExtensionModal: PropTypes.func,
    onOpenExtensionImportMethodModal: PropTypes.func,
    onRequestClose: PropTypes.func,
    onSetSelectedExtension: PropTypes.func,
    onSetSelectedExtensions: PropTypes.func,
    visible: PropTypes.bool,
    vm: PropTypes.instanceOf(VM).isRequired
};

export {ExtensionLibrary};
export default injectIntl(ExtensionLibrary);
