# 0008.9.2.2.1 Local Host Dispose Preflight Hotfix

`localHost.dispose()` now runs the shared Runtime semantic mutation guard before changing `disposed`, unregistering providers, removing subscriptions, or disposing the graph.

Observer-stack disposal is rejected atomically with `RUNTIME_LIFECYCLE_REENTRANT_MUTATION`. The service remains usable until disposal is invoked outside the observer callback.
