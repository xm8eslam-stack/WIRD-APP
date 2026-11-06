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
| RxDB replication docs | https://rxdb.info/replication.html | Official docs | Offline/online replay, checkpoints, batch replication, conflict handling, multi-tab replication coordination | Reuse concepts, not implementation; default conflict behavior is not suitable for WIRD's conservative memorization semantics without custom logic |
| RxDB transactions/conflicts docs | https://rxdb.info/transactions-conflicts-revisions.html | Official docs | Local write conflicts, revision checks, deterministic conflict handlers, limitations of cross-device ACID | Architectural reference only; highlights why local atomicity and remote conflict resolution are separate concerns |
| Ummah Library ADRs | https://github.com/UmmahLibrary/ummah-library | AGPL-3.0-only (previously reviewed) | Stable IDs, immutable events, incremental sync, element-level merge | Architecture-only reference; do not copy code without a separate compatibility review |
| Firebase Firestore offline docs | https://firebase.google.com/docs/firestore/manage-data/enable-offline | Official Firebase docs | Memory/persistent cache and offline behavior | Keep WIRD's own UID-scoped local journal; do not enable persistent web cache by default on shared browsers |

## License and implementation notes

- Dexie Apache-2.0: retain license and notices if used/distributed; note modified source files if copying/modifying source. Prefer dependency use over copying.
- idb ISC: preserve copyright and permission notice if redistributed.
- RxDB Apache-2.0 is declared in the inspected package metadata; verify the exact release license and any plugin-specific terms before adopting optional modules.
- Ummah Library AGPL-3.0-only: no source copied.
- No dependency has been added based on this research alone.


## Runtime record-validation library comparison — 2026-11-06

| Project | URL | Inspected version / license | Strengths | Trade-offs for WIRD |
|---|---|---|---|---|
| Zod | https://github.com/colinhacks/zod | 4.6.7; MIT | TypeScript-first schemas, inferred types, safeParse, strict object support, JSON Schema conversion, no runtime dependencies | Ergonomic and widely adopted; core is reported around 2 KB gzipped; ensure strict objects so unknown fields are rejected rather than silently stripped |
| Valibot | https://github.com/open-circle/valibot | Official docs inspected; MIT; docs state TypeScript >=5.0.2 | Modular API, inferred types, small tree-shaken bundle, no dependencies, safeParse | Smaller footprint; API is more granular and team familiarity should be evaluated |
| Ajv | https://github.com/ajv-validator/ajv | 8.20.0; MIT | JSON Schema standard, strict object properties, compiled validators, strong interoperability for backups and Firestore contracts | Several runtime dependencies; schemas are less directly aligned with TypeScript interfaces without generated/inferred typing layer |

### Provisional decision

Do not add a validator dependency in this documentation/audit pass. First map all persisted record interfaces and define exact compatibility rules for legacy versions. Then prototype Zod 4 and Valibot on the same representative schemas (UserProfile, DailyLog, MemorizationPlan, EngineGeneratedPlan, RevisionItem, TestResult, WeakVerseItem, WirdPortion, BackupPayload). Compare strict unknown-key behavior, precise error paths, bundle impact, TypeScript compatibility, and legacy migration behavior. Ajv remains a candidate if shared JSON Schema definitions across client and server become a concrete requirement. No third-party code copied.


## Local outbox integrity review — 2026-11-06

- PR #6 uses a compact deterministic, non-cryptographic fingerprint only to detect accidental reuse of an acknowledged mutation ID with changed content. It is not an authentication or tamper-proofing mechanism.
- The current outbox remains localStorage-backed. Its read-modify-write sequence is not an atomic cross-tab transaction; the queue is therefore not safe to activate for remote sync until an IndexedDB transaction-backed event/outbox journal and multi-tab concurrency tests are implemented.
- Dexie and idb remain candidates for that future journal; RxDB remains an architectural reference for checkpoints, replication batches, multi-tab coordination, and conflict handling. No dependency or source code was added in PR #6.


## Domain conflict and concurrent-merge review — 2026-11-06 (PR #9)

| Project / source | URL | Inspected version / license | Reviewed for | WIRD decision |
|---|---|---|---|---|
| Automerge | https://github.com/automerge/automerge | Current repository; MIT | Concurrent document merge, deterministic conflict winners, access to preserved conflicting values | Architecture reference only. WIRD keeps explicit Quran-aware merge rules and audit entries; no CRDT package or code copied |
| Automerge conflict documentation | https://automerge.org/docs/reference/documents/conflicts/ | Official docs | Multi-value conflict visibility and deterministic conflict ordering | Useful pattern for retaining conflicting source values; WIRD preserves source review events and audit metadata without adopting its document model |
| RxDB | https://github.com/pubkey/rxdb | package metadata inspected; Apache-2.0 | Local-first replication and customizable conflict handlers | Architecture reference only. Its default master-wins behavior is not sufficient for WIRD's conservative memorization semantics; no dependency or code copied |
| RxDB replication/conflict docs | https://rxdb.info/replication.html | Official docs | Master/fork replication, checkpointing, batching, custom conflict handler | Reference for future sync protocol and explicit conflict resolution; not adopted |
| RxDB CRDT docs | https://rxdb.info/crdt.html | Official docs | Comparing deterministic operation merges with domain-specific conflict handlers | WIRD retains domain-specific merge logic; Quran ranges and review attempts need semantic validation rather than generic field merging |
| Yjs | https://github.com/yjs/yjs | Current repository; MIT | CRDT shared data structures and concurrent edits | Reference only for future collaborative editing if needed; not suitable as a replacement for the current portion migration rules |
| Yjs license/docs | https://docs.yjs.dev/license | Official docs | License and maintenance model | MIT; no source copied |

### PR #9 decision record

- The merge algorithm remains domain-specific and conservative: exact canonical Quran ranges are reconciled; distinct review attempts are deduplicated only by stable event ID; same-ID content conflicts are retained under deterministic alternate IDs; existing conflict-audit entries are unioned; weaker status/strength wins.
- Generic last-write-wins and CRDT libraries were not adopted because they do not replace Quran-aware range validation, explicit status severity, or review-event identity.
- No third-party source code, snippets, or dependencies were copied or added.


## Phase 2 mutation/idempotency and Quran-platform research — 2026-11-06

| Project / source | URL | License / terms | Reviewed for | WIRD decision |
|---|---|---|---|---|
| Microsoft Azure Architecture Center — Event Sourcing | https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing | Microsoft documentation; no source code copied | At-least-once delivery and idempotent event handlers; duplicate event processing must not double-apply side effects | Architecture guidance only; use stable event IDs and idempotent projections when the event ledger is implemented |
| Brenopms/ts-event-sourcing | https://github.com/Brenopms/ts-event-sourcing | Repository page reviewed; verify exact license before any adoption | Strongly typed command handlers and idempotency keys | Reference only; no code copied and no dependency added |
| UmmahLibrary/ummah-library | https://github.com/UmmahLibrary/ummah-library | AGPL-3.0 | Quran-first architecture, offline reader, Uthmani text, tafsir/Hifz feature organization | Architecture-only reference; do not copy code into WIRD without separate AGPL compatibility/legal review |

No third-party source code or dependencies were copied/added in this Phase 2 continuation. The current fixes use WIRD's existing domain model and storage abstractions.


## Phase 2 queue and spaced-repetition research — 2026-11-06

| Project / source | URL | License / terms | Reviewed for | WIRD decision |
|---|---|---|---|---|
| open-spaced-repetition/ts-fsrs | https://github.com/open-spaced-repetition/ts-fsrs | MIT; current v6 requires Node >=24 and was released 2026-10-28 with breaking API changes | TypeScript scheduler architecture, immutable review results, preview/rollback, FSRS-7 migration | Reference only. WIRD's Node >=24.12 is compatible, but do not replace current SM-2 or reschedule existing users without a separately approved migration and backup plan |
| open-spaced-repetition/fsrs.js | https://github.com/open-spaced-repetition/fsrs.js | License not relied upon or code copied | Alternative JS FSRS implementation and maintenance status | Not adopted; repository README recommends transition to ts-fsrs because fsrs.js is less actively maintained |
| Anki Manual — Deck Options / FSRS | https://docs.ankiweb.net/deck-options.html | Documentation reference; no code copied | Workload management and safe algorithm-switch behavior | Preserve existing due dates by default; avoid bulk rescheduling that can create an immediate backlog |
| open-spaced-repetition/fsrs4anki-helper | https://github.com/open-spaced-repetition/fsrs4anki-helper | License not relied upon or code copied | Queue balancing, flattening, postpone/advance, easy days | UX/algorithm reference only; WIRD's queue remains deterministic and does not adopt an external scheduler |

No source code, package, or algorithm implementation was copied or added in this slice.


## Phase 2 multi-key rollback and browser transaction research — 2026-11-06

| Project / source | URL | License / terms | Reviewed for | WIRD decision |
|---|---|---|---|---|
| MDN — Using IndexedDB | https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB | Documentation; no code copied | Transaction lifecycle, request errors, abort/complete events, and rollback | Use transaction completion as the commit boundary when the local event journal is implemented; do not confuse individual request success with durable transaction success |
| W3C — Indexed Database API 3.0 | https://www.w3.org/TR/IndexedDB/ | W3C specification | Atomic commit and rollback semantics, including quota and I/O failures | IndexedDB is the intended atomic boundary for related domain/outbox writes; no current localStorage replacement in this test-only slice |
| Dexie.js transaction documentation | https://dexie.org/docs/Dexie/Dexie.transaction%28%29 | Apache-2.0 (library); docs reference only | Multi-table readwrite transactions, rejection/abort semantics, transaction lifetime | Reference for possible future wrapper evaluation; not adopted and no dependency added |
| OWASP Web Security Testing Guide — Browser Storage | https://github.com/OWASP/www-project-web-security-testing-guide/blob/master/v41/4-Web_Application_Security_Testing/11-Client_Side_Testing/12-Testing_Browser_Storage.md | Documentation; no code copied | Browser storage inspection, client-side storage threat review | Security test checklist reference; no code copied |

No source code, snippets, or dependencies were copied or added in PR #12.


## Phase 2 durable readback verification research — 2026-11-06

| Project / source | URL | License / terms | Reviewed for | WIRD decision |
|---|---|---|---|---|
| MDN — Using the Web Storage API | https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API | Documentation; no code copied | Correct `getItem()` / `setItem()` use and string storage semantics | Use the standard Storage methods and explicit readback to verify WIRD's durable writes |
| MDN — Storage.setItem() | https://developer.mozilla.org/en-US/docs/Web/API/Storage/setItem | Documentation; no code copied | Return semantics and `QuotaExceededError` behavior | A void return is not used as a substitute for WIRD-level payload verification; quota exceptions remain failure paths |
| WHATWG HTML — Web Storage | https://html.spec.whatwg.org/multipage/webstorage.html | Living standard | Atomicity of individual set/remove operations and quota exception semantics | The standard defines each key operation; WIRD still verifies the requested value and multi-key caller-level rollback because app operations span multiple keys |
| OWASP Web Security Testing Guide — Browser Storage | https://github.com/OWASP/www-project-web-security-testing-guide/blob/master/v41/4-Web_Application_Security_Testing/11-Client_Side_Testing/12-Testing_Browser_Storage.md | Documentation; no code copied | Client-side storage inspection and security test coverage | Retained as a storage security review checklist |

No third-party source code, snippets, or dependencies were copied or added in PR #13.
