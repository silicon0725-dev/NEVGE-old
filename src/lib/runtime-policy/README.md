# NGVGE Runtime Policy

This directory owns the LRC-2 boundary between NGVGE runtime semantics and replaceable execution/presentation backends.

Rules:

- Simulation tick rate and presentation refresh are independent domains.
- Editor/Settings code expresses Runtime Policy mutations as Engine Protocol commands; it never supplies Writer Authority identity.
- The Runtime Policy command executor resolves the unique Writer Authority inside the Host boundary, resolves a candidate policy, applies it through a Compatibility Adapter, and commits only after backend application succeeds.
- Scratch/TurboWarp setters are backend operations, not Runtime Policy identity.
- `OpsPerFrame`, `miscLimits`, `_twconfig_`, stage geometry, Scratch Target and renderer handles are not Native Runtime Policy fields.
- `miscLimits` may exist only inside the Scratch Compatibility Adapter as a backend projection of explicit compatibility fields.
- Execution backend overrides and backend hints are runtime-only and are stripped from project persistence DTOs.
- Presenter interpolation is declared per visual domain. The legacy Scratch interpolation capability applies only to `scratch.sprite.transform`.
- Legacy Advanced Settings consumes `LegacyAdvancedSettingsBridge`; Runtime Policy-owned controls route through the command path.
- `OpsPerFrame`, Warp Timer, stage geometry and legacy `storeProjectOptions()` remain explicitly quarantined until their later owner/migration stages.
- A legacy unbounded clone request is compatibility intent only and is always capped by `hostHardCeiling`.
