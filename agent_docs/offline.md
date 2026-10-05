# OracleDB Offline APIs

Use the browser offline APIs from `fusabase/oracledb` when document reads, listeners, and writes must keep working during a network interruption. Enable offline support on the `Oracledb` instance before operations that should use the local cache. This does not enable offline behavior for Auth or Storage.

## Enable a Local Cache

```ts
import { initializeApp } from "fusabase/app";
import { enableOffline, getOracledb, persistentLocalCache } from "fusabase/oracledb";

const app = initializeApp(config);
const db = getOracledb(app);
await enableOffline(db, persistentLocalCache({ synchronizeTabs: true }));
```

`enableOffline(db)` uses IndexedDB by default. `persistentLocalCache({ cacheSizeBytes, synchronizeTabs })` supplies IndexedDB options; `synchronizeTabs` defaults to `false`. For a cache that lasts only as long as the page, use `enableMemoryPersistence(db)` or `enableOffline(db, { persistence: "memory" })`. `enableIndexedDbPersistence(db)` is another way to enable IndexedDB without custom options. Choose one setup call per instance; calling another replaces the active offline state. IndexedDB requires a browser environment where it is available.

## Read and Write While Offline

```ts
import {
  addDoc,
  collection,
  disableNetwork,
  enableNetwork,
  getDocFromCache,
  onSnapshot,
  query,
  waitForPendingWrites
} from "fusabase/oracledb";

const tasks = collection(db, "tasks");
const unsubscribe = onSnapshot(
  query(tasks),
  { includeMetadataChanges: true },
  snapshot => {
    console.log(snapshot.docs.length, snapshot.metadata.fromCache,
      snapshot.metadata.hasPendingWrites);
  }
);

await disableNetwork(db);
const taskRef = await addDoc(tasks, { title: "Draft offline" });
const cachedTask = await getDocFromCache(taskRef);
console.log(cachedTask.data());

await enableNetwork(db);
await waitForPendingWrites(db);
unsubscribe();
```

With offline support enabled, document writes are applied to the local cache and queued for the backend. Write promises resolve after the local write; use `waitForPendingWrites(db)` when the next step requires backend acknowledgement. A rejected backend write removes its local overlay and can reject a pending wait.

`getDocFromCache(ref)` and `getDocsFromCache(queryOrCollection)` read only local data and require offline support to be enabled. A document missing from the cache yields a snapshot with `exists() === false`; a query can return an empty snapshot even if the backend has matching documents. Standard `getDoc` and `getDocs` use the cache while offline and can fall back to it when a server request throws. `getDocFromServer` and `getDocsFromServer` require network access.

## Public Offline API

| API | Purpose |
| --- | --- |
| `enableOffline(db, options?)` | Enable offline behavior; IndexedDB is the default persistence mode. |
| `persistentLocalCache(options?)` | Build IndexedDB options with optional `cacheSizeBytes` and `synchronizeTabs`. |
| `enableIndexedDbPersistence(db)` | Enable IndexedDB using default options. |
| `enableMemoryPersistence(db)` | Enable an in-memory cache that is not retained across page reloads. |
| `disableNetwork(db)` / `enableNetwork(db)` | Pause or resume remote access for this instance. |
| `getDocFromCache(ref)` / `getDocsFromCache(query)` | Read local document or query snapshots without a network request. |
| `waitForPendingWrites(db)` | Wait for writes pending at the time of the call to be acknowledged or rejected. |
| `clearIndexedDbPersistence(db)` | Clear the active offline cache, or the instance's IndexedDB cache if offline support is not active. |

The exported types are `OfflineOptions`, `PersistenceKind`, and `PersistentLocalCacheOptions`. `OfflineOptions` has `persistence?: "indexeddb" | "memory"`, `cacheSizeBytes?: number`, and `synchronizeTabs?: boolean`.

## Limits and Cache Care

- Cache queries use locally available documents. Fetch or listen to needed documents while connected before relying on them offline. Snapshot metadata exposes `fromCache` and `hasPendingWrites`.
- Local query evaluation supports ordinary filters, ordering, and limits. Cache reads reject joins, aggregates, vector search, and composite filters. Server-backed reads for those operations need network access.
- `runTransaction` needs the server. Offline `writeBatch(db)` is queued locally when committed. `addDoc` on a normal collection generates a local ID.
- Keep IndexedDB data until pending writes have synced. `clearIndexedDbPersistence(db)` removes cached data and queued writes from the active persistence mode; reserve it for cases where that data should be discarded.

## Related Docs

- `agent_docs/oracledb.md` for document, query, and write APIs.
- `agent_docs/configuration.md` for app initialization.
