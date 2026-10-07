export default async function ({addon}) {
  const scratchExtensions = addon.tab.capabilities.scratchExtensions;
  const loadExtensions = () => {
    if (addon.self.disabled) return;
    // IDs are taken from Scratch's built-in extension registry.
    const EXTENSIONS = ["music", "pen", "text2speech", "translate"];
    for (const ext of EXTENSIONS) {
      if (addon.settings.get(ext) && !scratchExtensions.isLoaded(ext)) {
        scratchExtensions.loadBuiltIn(ext);
      }
    }
  };
  scratchExtensions.whenProjectReady(loadExtensions);
}
