// Copyright (c) 2015, 2026, Oracle and/or its affiliates.

//-----------------------------------------------------------------------------
//
// This software is dual-licensed to you under the Universal Permissive License
// (UPL) 1.0 as shown at https://oss.oracle.com/licenses/upl and Apache License
// 2.0 as shown at http://www.apache.org/licenses/LICENSE-2.0. You may choose
// either license.
//
// If you elect to accept the software under the Apache License, Version 2.0,
// the following applies:
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
//-----------------------------------------------------------------------------
// 

import type { App } from '../../../app/src/public-types.js';
import type { Projection } from '../projection.js';

/**
 * Browser persistence used by the relational offline cache.
 *
 * `indexeddb` survives reloads and can synchronize tabs. `memory` is discarded
 * when the page is reloaded and is useful for short-lived sessions or tests.
 *
 * @example
 * ```ts
 * const persistence: RelationalPersistenceKind = 'indexeddb';
 * ```
 */
export type RelationalPersistenceKind = 'indexeddb' | 'memory';

/**
 * Declares the stable primary key for one relation made available offline.
 *
 * @example
 * ```ts
 * const users: RelationalOfflineRelationOptions = { primaryKey: ['UUID'] };
 * ```
 */
export type RelationalOfflineRelationOptions = {
  /** Column names, in key order, that uniquely identify a cached row. */
  primaryKey: string[];
};

/**
 * Configuration for relational database offline support.
 *
 * Only relations listed in {@link relations} use offline behavior. All other
 * relations retain normal request behavior.
 *
 * @example
 * ```ts
 * const options: RelationalOfflineOptions = {
 *   persistence: 'indexeddb',
 *   cacheSizeBytes: 2 * 1024 * 1024,
 *   synchronizeTabs: true,
 *   relations: { users_1: { primaryKey: ['UUID'] } },
 * };
 * ```
 */
export type RelationalOfflineOptions = {
  /** Storage engine. Defaults to `'indexeddb'`. */
  persistence?: RelationalPersistenceKind;
  /** Maximum approximate cache size in bytes. Defaults to no size limit. */
  cacheSizeBytes?: number;
  /** Whether persistent caches coordinate rows and mutation replay across tabs. Defaults to `false`. */
  synchronizeTabs?: boolean;
  /** Relation names and their stable primary-key columns. */
  relations: Record<string, RelationalOfflineRelationOptions>;
};

/**
 * Options for a persistent local cache. This is equivalent to
 * {@link RelationalOfflineOptions}, with `persistence` fixed to `'indexeddb'`.
 *
 * @example
 * ```ts
 * const options: RelationalPersistentCacheOptions = {
 *   synchronizeTabs: true,
 *   relations: { users_1: { primaryKey: ['UUID'] } },
 * };
 * ```
 */
export type RelationalPersistentCacheOptions = Omit<RelationalOfflineOptions, 'persistence'>;

/**
 * Metadata describing how a relational response was produced.
 *
 * @example
 * ```ts
 * if (result.offline?.fromCache) console.log('Local result');
 * ```
 */
export type RelationalOfflineMetadata = {
  /** `true` when the response was produced locally rather than by an HTTP request. */
  fromCache: boolean;
  /** `true` when queued local writes still affect the local view. */
  hasPendingWrites: boolean;
};

export type RelationalOfflineRequest = {
  /** Runtime-only. It is omitted before a mutation is persisted. */
  app?: App;
  schema?: string;
  object: string;
  operation: 'select' | 'insert' | 'upsert' | 'update' | 'delete' | 'rpc';
  projection: Projection;
  qbe: {
    $query?: Record<string, unknown>;
    $orderby?: Array<{
      column: string;
      path?: string;
      direction?: 'ASC' | 'DESC';
      nulls?: 'FIRST' | 'LAST';
    }>;
    $limit?: number;
    $offset?: number;
  };
  rows?: unknown[];
  set?: unknown;
  args?: Record<string, unknown>;
  overload?: string;
  onConflict?: string;
  columns?: string[];
  headers?: Array<[string, string]>;
  throwOnError?: boolean;
  signal?: AbortSignal;
  retry?: { enabled: boolean; maxRetries: number; initialDelayMs: number; maxDelayMs: number };
  returnRows: boolean;
  maybeSingle?: boolean;
  cacheSource?: 'default' | 'cache';
  requireComplete?: boolean;
  /** Durable client mutation ID used by the backend to deduplicate replay. */
  mutationId?: string;
};

export type RelationalOfflineMutation = {
  batchId: number;
  mutationId: string;
  request: RelationalOfflineRequest;
  createdAt: number;
  state: 'pending' | 'acknowledged' | 'rejected';
  error?: { message: string; status: number; code?: string };
};

export type RelationalCachedRow = {
  relation: string;
  key: IDBValidKey[];
  data: Record<string, unknown>;
  sequenceNumber: number;
};

/** A materialized local row change belonging to one pending mutation batch. */
export type RelationalRowOverlay = {
  batchId: number;
  relation: string;
  key: IDBValidKey[];
  kind: 'set' | 'delete';
  data: Record<string, unknown> | null;
};

/** Maps a pending mutation batch to each row whose local view it changes. */
export type RelationalMutationRow = {
  batchId: number;
  relation: string;
  key: IDBValidKey[];
};

export type RelationalOfflineSnapshot = {
  nextBatchId: number;
  nextSequenceNumber: number;
  rows: RelationalCachedRow[];
  mutations: RelationalOfflineMutation[];
  overlays: RelationalRowOverlay[];
  mutationRows: RelationalMutationRow[];
  targets: Array<{ canonical: string; relation: string; keys: IDBValidKey[][] }>;
};
