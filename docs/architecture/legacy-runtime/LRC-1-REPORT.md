# LRC-1｜Legacy Advanced Runtime Options Semantic Audit

**Status:** COMPLETE / AUDIT FREEZE  
**Baseline:** LSC-0 Credentials & Unsafe Agent Containment / WS-2 Window Manager Foundation  
**Scope:** Legacy `Advanced Settings` runtime-affecting controls, their hidden project persistence, alternate writer surfaces, and the pinned 02 Scratch VM/Renderer behavior they actually mutate.  
**Next:** LRC-2｜Execution / Presentation / Safety Profile Foundation

## 1. Executive conclusion

The legacy `Advanced Settings` surface is not a coherent settings model. It is a thin UI over direct VM/Renderer/Compiler mutation and currently mixes at least seven different semantic ownership domains:

1. simulation scheduling;
2. presentation/resampling;
3. rendering backend optimization;
4. compatibility semantics;
5. runtime safety/resource budgets;
6. execution backend/debug controls;
7. project/scene geometry.

It also persists many of those unrelated values together through TurboWarp's legacy `_twconfig_` Scratch-comment mechanism. The correct NGVGE response is therefore **not** to redesign the modal and keep the same booleans. LRC-1 freezes a field-by-field migration map so LRC-2 can replace the mixed surface with explicit policies and compatibility adapters.

The audit covers **11 visible Advanced Runtime controls**, **1 additional latent policy (`turbo`) that is persisted by the same project-options mechanism**, and **1 persistence mechanism**, for **13 audit records**. The machine registry currently records **15 concrete findings**.

## 2. Audit coverage and evidence surfaces

The coverage gate scans and freezes the following legacy surfaces:

- `src/containers/tw-settings-modal.jsx` — direct writer handlers;
- `src/components/tw-settings-modal/settings-modal.jsx` — visible control inventory;
- `src/lib/tw-state-manager-hoc.jsx` — URL/session writer and URL mirroring;
- `src/lib/vm-listener-hoc.jsx` — VM → Redux synchronization;
- `src/reducers/tw.js` and `src/reducers/custom-stage-size.js` — GUI state/defaults and URL stage-size parsing;
- pinned `scratch-vm/src/engine/runtime.js` — runtime/compiler options, project config parsing and storage;
- pinned `scratch-vm/src/engine/tw-frame-loop.js` — simulation/render cadence;
- pinned `scratch-vm/src/engine/tw-interpolate.js` — interpolation support envelope;
- pinned `scratch-vm/src/sprites/rendered-target.js` — fencing/size behavior;
- pinned Sound/Pen/Music/Mouse implementations — `miscLimits` fan-out;
- pinned `scratch-render/src/RenderWebGL.js` and `Drawable.js` — high-quality rendering and culling semantics.

The gate intentionally fails if a visible legacy runtime control, `_twconfig_` field, runtime option field, compiler field, or the high-risk implementation evidence changes without re-auditing the policy registry.

## 3. Frozen semantic classification

| Policy | Legacy UI/key | Actual domain | NGVGE disposition |
| --- | --- | --- | --- |
| LRC1-POL-001 | 60 FPS / `framerate` | Simulation scheduler | Keep concept, redesign as `ExecutionProfile.simulationTickRate` |
| LRC1-POL-002 | OpsPerFrame | Simulation scheduler hack | Remove from public policy; legacy compatibility quarantine only |
| LRC1-POL-003 | Interpolation | Presentation/resampling | Wrap as legacy Scratch presenter; native per-domain presenters later |
| LRC1-POL-004 | High Quality Pen / `hq` | Mixed presentation + compatibility | Split render quality from coordinate/Pen semantics |
| LRC1-POL-005 | Offscreen Drawable Culling | Renderer optimization | Backend-auto; remove from native project semantics |
| LRC1-POL-006 | Infinite Clones / `maxClones` | Resource budget | Replace boolean/infinity with finite/adaptive budget policy |
| LRC1-POL-007 | Remove Fencing | Scratch compatibility | Keep only in Scratch Compatibility Profile |
| LRC1-POL-008 | Remove Misc Limits | Invalid cross-domain aggregate | Decompose into separate compatibility capabilities |
| LRC1-POL-009 | Warp Timer | Runtime safety/compiler | Remove from normal UI; runtime safety owns it |
| LRC1-POL-010 | Disable Compiler | Execution backend/debug | Developer/internal only |
| LRC1-POL-011 | Custom Stage Size | Project/scene geometry | Promote to versioned Project/Scene viewport schema |
| LRC1-POL-012 | Turbo Mode | Scratch scheduler compatibility | Keep only as explicit legacy execution mode |
| LRC1-PERSIST-001 | `_twconfig_` comment | Legacy persistence adapter | Import/export compatibility only; never NGVGE authority |

## 4. Detailed audit

### LRC1-POL-001 — Simulation Tick Rate (`framerate`)

Legacy UI calls `vm.setFramerate()`. In the pinned VM that directly restarts the FrameLoop and changes how often `Runtime._step()` runs. `currentStepTime` becomes `1000 / framerate`, so the value feeds Sequencer/I/O timing as well as script/hat/monitor cadence. This is **simulation rate**, not merely display refresh.

The current legacy UI supports custom values through `prompt()`. Its validation is inconsistent across ingress paths: the modal accepts any finite number, including `0` and negative values; another framerate UI accepts only values greater than zero; the Runtime converts negatives to 1 and treats `0` as a special display-refresh-synchronized simulation mode.

The pinned 02 fork also comments out the upper clamp that current TurboWarp retains at 250 Hz. At high values, the 02 FrameLoop can enter its `setImmediate` polling path. This is a fork-specific safety regression and must not become an NGVGE contract.

**Disposition:** preserve 30 Hz as the Scratch-compatibility simulation profile. Non-30 legacy values import as explicit compatibility overrides with warnings. `0` is a quarantined legacy mode, not a normal frame-rate choice. Native NGVGE must separate simulation tick rate from presentation refresh.

### LRC1-POL-002 — OpsPerFrame

02 adds `opsPerFrame` to FrameLoop and executes:

```text
outer step callback
  -> Runtime._step()
  -> Runtime._step()
  -> ... N times
  -> render callback
```

This is not equivalent to a higher stable simulation frequency. Several logical steps occur back-to-back in one outer scheduler interval.

Confirmed implementation defects:

- `0` is accepted and produces zero `_step()` calls, effectively stopping project logic while the outer render loop can continue;
- fractional values are accepted even though the implementation is an integer `for` loop, giving ceiling-like loop-count behavior rather than a meaningful fractional policy;
- negative values are normalized by Runtime to 1, but the modal immediately dispatches the raw negative number into Redux;
- the VM emits `OPSPERFRAME_CHANGED`, but `vm-listener-hoc` does not subscribe to it, so `_twconfig_` project-load changes can leave GUI/Redux state stale;
- there is no useful upper bound.

Current TurboWarp `develop` does not contain `opsPerFrame` in Runtime or `_twconfig_`; it is an 02-specific fork addition.

**Disposition:** delete from normal user settings. Preserve non-1 values only as a temporary legacy Scratch-backend override until compatibility corpus results justify migration or removal.

### LRC1-POL-003 — Interpolation

Interpolation is a presentation layer that runs from `requestAnimationFrame` while simulation continues on the configured step cadence. The legacy implementation snapshots visible Scratch targets at `_step()` boundaries and interpolates only:

- x/y;
- rendered direction;
- scale;
- ghost effect.

It does **not** resample Pen strokes, stamps, custom extension render state, arbitrary renderer effects, 3D state, or other visual domains. It also directly reads `renderer._allDrawables`, binding the feature to Scratch renderer internals.

This means interpolation can make a transform-driven Sprite project look smoother without preserving visual continuity for Pen-heavy or custom-renderer projects. The user's original Pen counterexample is therefore structural, not a UI problem.

**Disposition:** retain as a Legacy Scratch Transform Presenter behind the compatibility adapter. Native NGVGE presentation must expose interpolation/resampling capability per semantic visual domain and explicitly report unsupported domains.

### LRC1-POL-004 — “High Quality Pen” (`hq`)

The label is materially misleading. `renderer.setUseHighQualityRender()` does more than change Pen render resolution:

- PenSkin render quality follows framebuffer/native-stage scaling;
- every Drawable is switched to high-quality mode;
- `Drawable.updatePosition()` stops integer-rounding coordinates when high-quality mode is active;
- Scratch Pen size clamping is also relaxed when renderer high-quality mode is active.

So a single “High Quality Pen” checkbox simultaneously changes presentation quality, global coordinate precision and Pen compatibility limits.

**Disposition:** split. Render quality belongs to Presentation/Rendering Backend policy; coordinate/limit behavior belongs to compatibility semantics. Legacy `hq` remains readable only inside the Scratch adapter.

### LRC1-POL-005 — Offscreen Drawable Culling

The 02 renderer adds a conservative fast path that culls drawables only when the draw is the normal default stage pass. It explicitly avoids many query/filter/effect/private-skin cases, and only simple Bitmap/SVG drawables without shape-changing effects are eligible.

This is fundamentally a backend optimization hint. It should not be portable project semantics. Yet because it is stored inside `runtimeOptions`, 02's `_twconfig_` persists it with the project. It is also not mirrored into the URL-state mapping, unlike several other runtime options.

Current TurboWarp `develop` does not include `offscreenDrawableCulling` in Runtime, making this another 02-specific fork extension.

**Disposition:** rendering backend automatic optimization. Legacy import may accept the old bit as a non-authoritative hint; native NGVGE serialization must omit it.

### LRC1-POL-006 — Clone Budget (`maxClones` / “Infinite Clones”)

Scratch-compatible default is 300. The checkbox changes it to JavaScript `Infinity`, and Runtime clone admission is simply `cloneCounter < maxClones`.

This converts a resource budget into a boolean “limit/no limit” model and removes a safety ceiling. It also relies on ExtendedJSON to serialize Infinity through `_twconfig_`.

**Disposition:** `RuntimeSafetyPolicy.cloneBudget` / Resource Budget with finite or adaptive budgets and host hard ceilings. Legacy Infinity must be represented as an explicit compatibility request with warnings, not as actual unbounded native authority.

### LRC1-POL-007 — Fencing

Disabling `runtimeOptions.fencing` changes several Scratch semantics together:

- `RenderedTarget.setXY()` no longer uses renderer fencing;
- Sprite size min/max clamps are relaxed to 0..Infinity;
- renderer touching bounds are allowed offstage.

This is not “remove a restriction” in a generic engine sense; it is a specific Scratch compatibility variant affecting motion, size and collision queries.

**Disposition:** `ScratchCompatibilityProfile.fencing`. Native NGVGE scene geometry must not inherit it.

### LRC1-POL-008 — `miscLimits`

This is the most structurally invalid legacy option. One boolean affects multiple unrelated domains:

- Sound effect ranges;
- Sound effect/volume yield behavior;
- Pen size clamping;
- Music concurrency limiting;
- Mouse coordinate precision (integer-rounded vs three-decimal values).

It cannot become an NGVGE field because there is no coherent semantic concept called “miscellaneous limits”.

**Disposition:** decompose into explicit Scratch compatibility capabilities. Legacy `miscLimits=false` may temporarily import as a compatibility bundle that reproduces all historical side effects, but the native schema must not preserve the aggregate flag.

### LRC1-POL-009 — Warp Timer

The setting writes `compilerOptions.warpTimer`, resets compiler caches, and changes compiler-generated stuck-loop yielding. It is also independently forced to `true` when the Blocks workspace mounts. Therefore the checkbox is not even stable user authority inside the legacy editor.

It is not persisted by `_twconfig_`; URL behavior is partial/player-oriented.

**Disposition:** runtime safety/watchdog policy, host-owned by default. Remove from normal creator settings. A diagnostic override may survive under Developer Tools if needed.

### LRC1-POL-010 — Compiler Enable/Disable

This option controls whether new threads attempt compilation and resets block caches. It is an execution backend/debugging selection, not intended project semantics. Precompiled-project loading also has its own compiler behavior.

**Disposition:** backend-owned automatic selection; optional Developer Tools override only. Never serialize it as NGVGE project semantics.

### LRC1-POL-011 — Custom Stage Size

This setting is actually project/scene geometry. Runtime updates stage width/height, adjusts renderer bounds and shifts monitor positions to preserve center-relative location.

Validation is inconsistent:

- Advanced Settings numeric inputs declare max 1024;
- `?size=` reducer accepts up to 4096;
- Runtime `setStageSize()` only enforces positive rounded values and has no equivalent upper cap;
- collaboration sync is another direct writer.

**Disposition:** promote to versioned Project/Scene viewport schema. The Scratch compatibility backend consumes this geometry; it should disappear from “Advanced Runtime” settings.

### LRC1-POL-012 — Turbo Mode

Turbo is not displayed in the Advanced Settings list, but `storeProjectOptions()` persists it in the same `_twconfig_` payload. The Sequencer uses turbo mode to continue stepping despite redraw requests, so it changes scheduling/yield behavior.

**Disposition:** explicit legacy Scratch/TurboWarp execution mode only. Do not generalize it as the native NGVGE scheduler contract.

### LRC1-PERSIST-001 — `_twconfig_` project comment

The VM serializes differing options into a Scratch Stage comment ending with `// _twconfig_` using ExtendedJSON. On whole-project load it parses the comment and directly calls setters.

This mechanism mixes:

- simulation rate;
- OpsPerFrame;
- compatibility runtime options;
- interpolation;
- turbo;
- renderer high-quality mode;
- stage geometry;
- 02-specific culling hints.

It has no NGVGE schema identity, no versioned policy ownership, no Authority routing and no explicit precedence resolver against URL/session/workspace writers. It also uses a user-visible Scratch comment as configuration transport.

**Disposition:** legacy import/export adapter only. NGVGE import must parse each field and route it to its owning domain. Native NGVGE project files must never use `_twconfig_` as authority.

## 5. Confirmed cross-cutting findings

### A. Writer authority is fragmented

The same semantic state can be written from multiple places:

```text
Advanced Settings
Green Flag modifier gestures
Framerate Changer
URL query parameters
_twconfig_ project load
Blocks workspace mount
Collaboration sync
VM/Renderer direct API callers
```

There is no central `RuntimePolicyResolver`. Current behavior is effectively a lifecycle-dependent last-writer model.

### B. Persistence classes are mixed

Values that should be device/backend/session hints can become project state (`hq`, offscreen culling), while values that look like user-visible runtime safety settings are deliberately not project-persisted (warp timer, compiler enabled). This is evidence that the current surface has no ownership model.

### C. No conflict/capability analyzer exists

The editor allows combinations such as:

```text
custom simulation rate
+ interpolation
+ high-quality renderer
+ Pen/custom renderer workload
+ relaxed Scratch limits
```

without checking whether the project can preserve expected behavior. The system relies on help text and user experimentation instead of compatibility evidence.

## 6. Current TurboWarp comparison

A reference check against current TurboWarp `scratch-vm` `develop` shows:

- TurboWarp still owns generic framerate/interpolation/runtime-options and legacy `_twconfig_` behavior;
- current TurboWarp retains a `framerate > 250 => 250` clamp that the pinned 02 fork has commented out;
- current TurboWarp Runtime does not contain 02's `opsPerFrame` extension;
- current TurboWarp Runtime does not contain 02's `offscreenDrawableCulling` option.

This matters for disposition: rebasing to current TurboWarp can remove some 02-only debt, but it **will not** solve the semantic ownership problem by itself. Framerate, interpolation, `miscLimits`, fencing, clone limits and `_twconfig_` still require NGVGE policy/adaptor boundaries.

## 7. LRC-2 target model

LRC-2 should establish policy foundations, not rebuild every backend feature at once:

```text
ExecutionProfile
  simulationTickRate
  Scratch legacy turbo mode

PresentationProfile
  refresh policy
  per-domain interpolation capability
  render quality policy

RuntimeSafetyPolicy
  script watchdog
  clone/resource budgets

ScratchCompatibilityProfile
  fencing
  sound limits
  sound yield semantics
  pen limits
  music concurrency
  input precision

ExecutionBackendPolicy
  compiler/interpreter selection (internal/developer)

Project / Scene Schema
  viewport width/height

Rendering Backend
  automatic offscreen culling

LegacyScratchProjectOptionsAdapter
  _twconfig_ import/export only
```

The key invariant for LRC-2 is that **a user-facing control may only exist after its owning semantic domain is explicit**. No new checkbox may call `vm.set*()` or renderer methods directly from the settings component.

## 8. Migration rules frozen by LRC-1

- Scratch imports default to a 30 Hz simulation compatibility profile.
- Legacy non-30 framerate remains an explicit compatibility override, not silently normalized.
- `opsPerFrame != 1` is quarantined; it is not promoted to native NGVGE semantics.
- Legacy interpolation maps to a Scratch transform presenter and must carry partial-coverage diagnostics.
- `hq` is split rather than copied as one native boolean.
- offscreen culling is stripped from native project semantics.
- Infinity clone limit becomes a compatibility request plus host safety ceiling.
- fencing remains Scratch-adapter compatibility state.
- `miscLimits` is decomposed; legacy false may temporarily expand into a bundle of explicit flags.
- Warp Timer and compiler enabled are not imported as project semantics.
- stage width/height become versioned project/scene geometry.
- `_twconfig_` remains read/write only at legacy Scratch/TurboWarp interoperability boundaries.

## 9. Exit criteria

LRC-1 is complete when:

- all runtime-affecting Advanced Settings controls are represented in the audit registry;
- all `_twconfig_` fields are represented, including latent Turbo mode;
- all Runtime/Compiler option fields behind the modal are represented;
- major hidden fan-out (`miscLimits`, fencing, high-quality render) is evidenced from implementation;
- fork-specific OpsPerFrame/culling deltas are identified;
- a machine gate fails on uncovered new/changed legacy options;
- no production runtime behavior is changed by the audit stage.

Those conditions are met by the accompanying registry, matrix and validation script.
