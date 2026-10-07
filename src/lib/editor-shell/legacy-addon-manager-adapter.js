import addonManifests from '../../addons/generated/addon-manifests';
import SettingsStore from '../../addons/settings-store-singleton';
import {installLegacyAddonHost} from '../extension-containment';

const LEGACY_ADDON_MANAGER_ADAPTER_ID = 'ngvge.workspace-extension-manager.legacy-addon-adapter@1';

const normalizeSetting = (settingsStore, addonId, setting) => Object.freeze({
    defaultValue: setting.default,
    id: setting.id,
    name: typeof setting.name === 'string' ? setting.name : setting.id,
    potentialValues: Object.freeze(Array.isArray(setting.potentialValues) ? setting.potentialValues.map(value => (
        Object.freeze({
            id: value.id,
            name: typeof value.name === 'string' ? value.name : String(value.id)
        })
    )) : []),
    type: setting.type,
    value: settingsStore.getAddonSetting(addonId, setting.id)
});

const createLegacyAddonManagerAdapter = (vm, options = {}) => {
    const settingsStore = options.settingsStore || SettingsStore;
    const manifests = options.manifests || addonManifests;
    const host = options.host || installLegacyAddonHost(vm);

    Object.entries(manifests).forEach(([addonId, manifest]) => host.registerAddon(addonId, manifest));

    const list = () => Object.freeze(Object.entries(manifests).map(([addonId, manifest]) => Object.freeze({
        description: typeof manifest.description === 'string' ? manifest.description : '',
        dynamicDisable: Boolean(manifest.dynamicDisable),
        enabled: settingsStore.getAddonEnabled(addonId),
        extensionId: addonId,
        installed: true,
        name: typeof manifest.name === 'string' ? manifest.name : addonId,
        settings: Object.freeze((Array.isArray(manifest.settings) ? manifest.settings : []).map(setting => (
            normalizeSetting(settingsStore, addonId, setting)
        ))),
        tags: Object.freeze(Array.isArray(manifest.tags) ? manifest.tags.slice() : [])
    })));

    return Object.freeze({
        adapterId: LEGACY_ADDON_MANAGER_ADAPTER_ID,
        list,
        setEnabled (addonId, enabled) {
            settingsStore.setAddonEnabled(addonId, Boolean(enabled));
            return settingsStore.getAddonEnabled(addonId);
        },
        setSetting (addonId, settingId, value) {
            settingsStore.setAddonSetting(addonId, settingId, value);
            return settingsStore.getAddonSetting(addonId, settingId);
        },
        subscribe (listener) {
            if (typeof listener !== 'function') return () => {};
            const handler = event => listener(Object.freeze({
                addonId: event && event.detail ? event.detail.addonId : null,
                type: event && event.type ? event.type : 'legacy-addon:changed'
            }));
            settingsStore.addEventListener('addon-changed', handler);
            settingsStore.addEventListener('setting-changed', handler);
            return () => {
                settingsStore.removeEventListener('addon-changed', handler);
                settingsStore.removeEventListener('setting-changed', handler);
            };
        }
    });
};

export {
    LEGACY_ADDON_MANAGER_ADAPTER_ID,
    createLegacyAddonManagerAdapter
};
