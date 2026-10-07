# 0008.9.2.2.1 Local Host Dispose Preflight Hotfix

- Observer-stack `host.dispose()` is rejected before any cleanup side effect.
- Service remains available after the rejected call.
- Disposal succeeds and remains idempotent after observer dispatch returns.
- Persistent format and public Runtime Node capability are unchanged.
