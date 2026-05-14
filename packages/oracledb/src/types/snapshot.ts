// Copyright (c) 2015, 2025, Oracle and/or its affiliates.

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

/**
 * Options that configure the Oracledb SDK's underlying network transport
 * when long-polling is used (typically in environments with restricted WebSocket support).
 *
 * This interface is experimental and may change in future releases.
 *
 * @example
 * ```ts
 * import { initializeOracledb } from 'fusabase/oracledb';
 *
 * const db = initializeOracledb(app, {
 *   experimentalForceLongPolling: true,
 *   experimentalLongPollingOptions: {
 *     timeoutMs: 30000,
 *     maxRetries: 5
 *   }
 * });
 * ```
 */
export declare interface ExperimentalLongPollingOptions {
  /**
   * Maximum number of milliseconds to wait for a long-polling request before timing out.
   * Default behavior depends on the SDK.
   */
  timeoutSeconds?: number;

}

/**
 * Options that configure the behavior of snapshot listeners in Oracledb.
 * These options apply to both `onSnapshot()` for queries and document references.
 */
export declare interface SnapshotListenOptions {
  /**
   * Whether metadata-only changes (such as local writes being committed,
   * or documents being from cache vs. server) should trigger snapshot events.
   *
   * Default: `false`
   *
   * @example
   * ```ts
   * onSnapshot(docRef, { includeMetadataChanges: true }, snapshot => {
   *   console.log("Received snapshot with metadata:", snapshot.metadata);
   * });
   * ```
   */
  includeMetadataChanges?: boolean;

  /**
   * The source from which to listen to query or document snapshots.
   * Defaults to `"default"`, which listens to both local cache and server updates.
   * 
   * Possible values include:
   * - `"default"` (cache + server)
   * - `"cache"` (only local cache)
   * - `"server"` (only server)
   *
   * @example
   * ```ts
   * onSnapshot(docRef, { source: "server" }, snapshot => {
   *   console.log("Received server-only snapshot:", snapshot.data());
   * });
   * ```
   */
  // source?: ListenSource;
}

/**
 * Options that control how data is returned from a Oracledb snapshot
 * (e.g., `DocumentSnapshot.data()` or `QueryDocumentSnapshot.data()`).
 */
export declare interface SnapshotOptions {
  /**
   * Controls the return value for server timestamps that have not yet
   * been set to their final value by the Oracledb backend.
   *
   * - `'estimate'`: Return an estimate based on the local clock.  
   *   This may differ from the final value set by the server.
   *
   * - `'previous'`: Return the previous value for the field if it exists,
   *   otherwise `null`.
   *
   * - `'none'`: Return `null` until the server resolves the field to its
   *   final value.
   */
  readonly serverTimestamps?: 'estimate' | 'previous' | 'none';
}

/**
 * A function that removes a listener or subscription.
 *
 * @example
 * ```ts
 * const unsub: Unsubscribe = onSnapshot(docRef, (snap) => {});
 * unsub(); // stops listening
 * ```
 */
export type Unsubscribe = () => void;