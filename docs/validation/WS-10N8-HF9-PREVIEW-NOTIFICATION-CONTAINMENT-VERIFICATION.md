# WS-10N8-HF9 Verification

## Machine gate

Run:

```bash
npm run test:node-plan:ws10n8-hf9:focused
npm run test:regression
```

HF9 specifically verifies:

- transient preview events do not rerender Collider debug toolbar status;
- persistent Collider events still refresh the toolbar;
- `getStatus()` does not enumerate stable non-sensor external collider geometry when `getColliderCount()` is available;
- repeated preview patches after `beginAuthoringPreview()` do not re-read Runtime Node snapshots;
- HF8 coalescing and HF7 LoAF attribution remain installed.

## Browser gate

Use Production launcher and capture 5 seconds while continuously dragging the previously problematic Circle/Capsule handle.

Primary expected change:

```text
Collider Authoring Preview
P50/P95 should collapse from tens of milliseconds toward low single-digit milliseconds.
```

Also record:

- averageFps
- frameP95Ms / frameP99Ms
- browserMainThread.topScripts
- collider-authoring-preview
- collider-prepare
- colliderPointerSamples / colliderPointerFlushes
- trackedAverageMs / untrackedAverageMs

If `Collider Authoring Preview` collapses but frame time remains high, proceed using the new LoAF top offender rather than returning to Physics/Collider solver optimization.
