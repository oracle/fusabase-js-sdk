# Backend Requirements For OracleDB Offline Support

This document lists the backend contract needed by the JavaScript SDK offline implementation.

Offline support is mostly SDK-side, but the backend must provide stable write acknowledgements, durable precondition handling, machine-readable error classification, and transaction semantics that the SDK can replay safely.

## Single-Document Write Acknowledgements

Every create, set, update, delete, and transform write should return stable server metadata.

Required response fields:

```ts
{
  OID: string;
  version: string | number;
}
```

Recommended response fields:

```ts
{
  OID: string;
  version: string | number;
  updateTime?: string;
  commitTime?: string;
  transformResults?: unknown[];
}
```

The SDK stores `version` in the local cache after acknowledgement and uses it to clear pending local write state. The backend may return `version` as either a string or number because ORDS supports two document version models.

Field details:

- `OID`: The final OracleDB document identifier accepted by the backend. This confirms that the replayed mutation was applied to the intended local document. It is required for all writes.
- `version`: The stable server-assigned document version after the write. It may be a string or number. It must change when the document changes and is used for cache reconciliation, stale-write detection, listener ordering, and future precondition checks.
- `updateTime`: Server timestamp/version for the individual document after this write. It is used to order document changes and reason about cache freshness.
- `commitTime`: Server timestamp/version for the whole commit operation. For a single write it may match `updateTime`; for batch writes all writes in the same commit should share one `commitTime`.
- `transformResults`: Final backend-computed values for field transforms, returned in the same order the SDK sent transforms.

## Create-Only Preconditions

Offline-safe `addDoc(collectionRef, id, data)` requires backend create-only semantics.

The backend should support a precondition equivalent to:

```ts
{
  exists: false
}
```

Required behavior:

- If the document does not exist, create it.
- If the document already exists, reject with `already-exists` or `failed-precondition`.

This preserves `addDoc` semantics even though the SDK internally creates a known document path before replay.

## Update Preconditions

Offline `updateDoc` requires update-only semantics.

The backend should support a precondition equivalent to:

```ts
{
  exists: true
}
```

Required behavior:

- If the document exists, update it.
- If the document is missing, reject with `not-found` or `failed-precondition`.

Future conflict handling may also require version preconditions:

```ts
{
  lastKnownVersion: string;
}
```

## Transform Results

The backend should return final server-computed transform values.

Needed for:

- `serverTimestamp()`
- `increment()`
- `arrayUnion()`
- `arrayRemove()`

Recommended behavior:

- Return `transformResults` in the same order that the SDK sends field transforms.
- Return final array transform results unless ORDS guarantees SDK-local array transform semantics are identical to server semantics.

Example:

```ts
{
  OID: "SF",
  version: "v10",
  updateTime: "2026-06-13T12:00:00.000Z",
  commitTime: "2026-06-13T12:00:00.000Z",
  transformResults: [
    "2026-06-13T12:00:00.000Z",
    42
  ]
}
```

Without transform results, the SDK can show local estimates but cannot reliably reconcile final server values.

## Batch And Transaction Writes

The current ORDS transaction flow can remain:

- SDK creates a transaction ID.
- Each write operation is sent under that transaction ID.
- Each operation returns provisional `OID` and `version`.
- Final commit makes the batch durable.
- Abort discards provisional operations.

Backend requirements:

- Per-operation versions must be valid after final commit succeeds.
- No operation should be durable if abort is called.
- No partial batch should be committed if final commit fails.
- Final commit should return a commit marker when possible.

Recommended final commit response:

```ts
{
  commitTime: string;
}
```

Recommended batch response shape:

```ts
{
  commitTime: string;
  writeResults: Array<{
    OID: string;
    version: string | number;
    updateTime: string;
  }>;
}
```

The SDK can clear pending writes without `commitTime`, but listener and query ordering will be weaker.

## Structured Error Classification

Backend errors must be machine-readable.

Recommended error response:

```ts
{
  code: "permission-denied",
  message: "User does not have write access"
}
```

Permanent errors cause SDK rollback:

- `permission-denied`
- `not-found`
- `already-exists`
- `failed-precondition`
- `invalid-argument`
- `unauthenticated`

Retryable errors keep writes queued:

- `unavailable`
- `deadline-exceeded`
- transient network errors
- retryable `internal`

## Query Result Versions

Query responses should include document versions and read metadata.

Recommended response metadata:

```ts
{
  readTime: string;
  documents: Array<{
    OID: string;
    version: string | number;
    updateTime?: string;
    data: Record<string, unknown>;
  }>;
}
```

The SDK uses this metadata for:

- cache freshness
- listener ordering
- query reconciliation
- stale result detection

## Listener Reconnect Support

Minimum requirements:

- Allow full query refetch after reconnect.
- Return document versions in query results.

Optional future improvements:

- Return resume tokens or snapshot versions.
- Support WebSocket and long-poll incremental resume instead of full refetch.

## Not Required From Backend Initially

These are useful later, but not required for the current SDK offline implementation:

- multi-tab coordination
- server-side cache awareness
- server-generated ID remapping for offline `addDoc`
- conflict resolution beyond preconditions
- resume tokens, unless incremental listener recovery is desired
