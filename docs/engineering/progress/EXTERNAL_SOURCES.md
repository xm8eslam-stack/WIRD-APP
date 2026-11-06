# WIRD — External Sources and License Register

**Updated:** 2026-11-06  
**Policy:** research and architecture review do not imply permission to copy source. Record exact license and any code actually reused. No third-party source code was copied in this checkpoint.

| Project / source | URL | Inspected version / license | Reviewed for | WIRD decision |
|---|---|---|---|---|
| Dexie.js | https://github.com/dexie/Dexie.js | package 4.4.7; Apache-2.0 | Typed IndexedDB abstraction, schema versioning, atomic read/write transactions | Leading candidate for a local journal, pending compatibility/bundle/migration tests; not installed |
| Dexie transaction docs | https://dexie.org/docs/Dexie/Dexie.transaction%28%29 | Official docs | Transaction abort/rollback and transaction lifetime constraints | Adopt the principle of a single IndexedDB transaction for event+outbox; never await unrelated APIs inside the transaction |
| idb | https://github.com/jakearchibald/idb | package 8.0.4; ISC | Minimal promise wrapper over native IndexedDB | Lightweight alternative; more schema and transaction orchestration remains WIRD-owned; not installed |
| idb README | https://github.com/jakearchibald/idb/blob/main/README.md | Official repository | openDB, promise API, transactions, async iterators | Reference only; no source copied |
| RxDB | https://github.com/pubkey/rxdb | package 17.6.0; Apache-2.0 declared in package metadata | Local-first replication, checkpoints, batching, conflict handlers, multi-tab behavior | Architectural reference only; full adoption appears unnecessarily broad for initial Firestore-backed sync |
| RxDB replication docs | https://rxdb.info/replication.html | Official docs | Offline/online replay, checkpoints, batch replication, conflict handling | Reuse concepts, not implementation; default conflict behavior is not suitable for WIRD's conservative memorization semantics without custom logic |
| Ummah Library ADRs | https://github.com/UmmahLibrary/ummah-library | AGPL-3.0-only (previously reviewed) | Stable IDs, immutable events, incremental sync, element-level merge | Architecture-only reference; do not copy code without a separate compatibility review |
| Firebase Firestore offline docs | https://firebase.google.com/docs/firestore/manage-data/enable-offline | Official Firebase docs | Memory/persistent cache and offline behavior | Keep WIRD's own UID-scoped local journal; do not enable persistent web cache by default on shared browsers |

## License and implementation notes

- Dexie Apache-2.0: retain license and notices if used/distributed; note modified source files if copying/modifying source. Prefer dependency use over copying.
- idb ISC: preserve copyright and permission notice if redistributed.
- RxDB Apache-2.0 is declared in the inspected package metadata; verify the exact release license and any plugin-specific terms before adopting optional modules.
- Ummah Library AGPL-3.0-only: no source copied.
- No dependency has been added based on this research alone.
