// Copyright (c) 2015, 2025, Oracle and/or its affiliates.

import { Query } from "../collection/reference.js";
import { QuerySnapshot } from "../collection/snapshot.js";
import { DocumentSnapshot } from "../document/snapshot.js";
import { Oracledb } from "../internal/core.js";
import { DocumentData } from "../types/common.js";
import { OracledbDataConverter } from "../types/converter.js";
import { SnapshotListenOptions, Unsubscribe } from "../types/snapshot.js";
import { OracledbError } from "../util/utils.js";

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
 * Attaches a listener for real-time updates to the result set of a Oracledb Query.
 * 
 * The listener is invoked with a new `QuerySnapshot` whenever the result set
 * changes (documents added, removed, or modified). The returned function can be
 * called to unsubscribe from future updates.
 * 
 * @typeParam AppModelType - The application model type for document data.
 * @typeParam DbModelType - The Oracledb database type, defaults to DocumentData.
 */

/**
 * Overload 1: Observer object form.
 *
 * @param query - The query to listen to.
 * @param observer - An object with optional `next`, `error`, and `complete` callbacks.
 *
 * @returns An `Unsubscribe` function to detach the listener.
 *
 * @example
 * import { collection, query, onSnapshot } from "fusabase/oracledb";
 *
 * const q = query(collection(db, "messages"));
 *
 * const unsubscribe = onSnapshot(q, {
 *   next: (snapshot) => {
 *     snapshot.forEach(doc => console.log("Message:", doc.data()));
 *   },
 *   error: (err) => console.error("Listen failed:", err),
 * });
 *
 * // Later, stop listening
 * unsubscribe();
 */
export declare function onSnapshot<
  AppModelType,
  DbModelType extends DocumentData
>(
  query: Query<AppModelType, DbModelType>,
  observer: {
    next?: (snapshot: QuerySnapshot<AppModelType, DbModelType>) => void;
    error?: (error: OracledbError) => void;
    complete?: () => void;
  }
): Unsubscribe;

/**
 * Overload 2: Observer object with listen options.
 *
 * @param query - The query to listen to.
 * @param options - Options controlling snapshot behavior (e.g., includeMetadataChanges).
 * @param observer - An object with optional `next`, `error`, and `complete` callbacks.
 *
 * @returns An `Unsubscribe` function to detach the listener.
 *
 * @example
 * import { collection, query, onSnapshot } from "fusabase/oracledb";
 *
 * const q = query(collection(db, "users"));
 *
 * const unsubscribe = onSnapshot(
 *   q,
 *   { includeMetadataChanges: true },
 *   {
 *     next: (snapshot) => console.log("User count:", snapshot.size),
 *     error: (err) => console.error("Error:", err),
 *   }
 * );
 */
export declare function onSnapshot<
  AppModelType,
  DbModelType extends DocumentData
>(
  query: Query<AppModelType, DbModelType>,
  options: SnapshotListenOptions,
  observer: {
    next?: (snapshot: QuerySnapshot<AppModelType, DbModelType>) => void;
    error?: (error: OracledbError) => void;
    complete?: () => void;
  }
): Unsubscribe;

/**
 * Overload 3: Callback form.
 *
 * @param query - The query to listen to.
 * @param onNext - A callback invoked with each new `QuerySnapshot`.
 * @param onError - Optional callback if the listener fails.
 * @param onCompletion - Ignored; streams never complete.
 *
 * @returns An `Unsubscribe` function to detach the listener.
 *
 * @example
 * import { collection, query, onSnapshot } from "fusabase/oracledb";
 *
 * const q = query(collection(db, "tasks"));
 *
 * const unsubscribe = onSnapshot(
 *   q,
 *   (snapshot) => {
 *     console.log("Tasks changed:", snapshot.docs.map(doc => doc.data()));
 *   },
 *   (error) => console.error("Listener error:", error)
 * );
 */
export declare function onSnapshot<
  AppModelType,
  DbModelType extends DocumentData
>(
  query: Query<AppModelType, DbModelType>,
  onNext: (snapshot: QuerySnapshot<AppModelType, DbModelType>) => void,
  onError?: (error: OracledbError) => void,
  onCompletion?: () => void
): Unsubscribe;

/**
 * Overload 4: Callback form with listen options.
 *
 * @param query - The query to listen to.
 * @param options - Options controlling snapshot behavior.
 * @param onNext - A callback invoked with each new `QuerySnapshot`.
 * @param onError - Optional callback if the listener fails.
 * @param onCompletion - Ignored; streams never complete.
 *
 * @returns An `Unsubscribe` function to detach the listener.
 *
 * @example
 * import { collection, query, onSnapshot } from "fusabase/oracledb";
 *
 * const q = query(collection(db, "orders"));
 *
 * const unsubscribe = onSnapshot(
 *   q,
 *   { includeMetadataChanges: true },
 *   (snapshot) => {
 *     snapshot.docChanges().forEach(change => {
 *       console.log("Order change:", change.type, change.doc.data());
 *     });
 *   },
 *   (error) => console.error("Error in listener:", error)
 * );
 */
export declare function onSnapshot<
  AppModelType,
  DbModelType extends DocumentData
>(
  query: Query<AppModelType, DbModelType>,
  options: SnapshotListenOptions,
  onNext: (snapshot: QuerySnapshot<AppModelType, DbModelType>) => void,
  onError?: (error: OracledbError) => void,
  onCompletion?: () => void
): Unsubscribe;



// /**
//  * Resumes a snapshot from a JSON representation for offline/serialized snapshots.
//  *
//  * Overloaded function signatures allow using options, observers, or converters.
//  *
//  * @example
//  * ```ts
//  * const snap = onSnapshotResume(Oracledb, snapshotJson, {
//  *   next: (snap) => console.log(snap.docs),
//  *   error: (err) => console.error(err)
//  * });
//  * ```
//  */
// export declare function onSnapshotResume<T = any>(
//   oracledb: Oracledb,
//   snapshotJson: any,
//   onNext: (snapshot: DocumentSnapshot<T> | QuerySnapshot<T>) => void,
//   onError?: (error: Error) => void,
//   onCompletion?: () => void,
//   converter?: OracledbDataConverter<T>
// ): void;

// export declare function onSnapshotResume<T = any>(
//   oracledb: Oracledb,
//   snapshotJson: any,
//   options: any,
//   onNext: (snapshot: DocumentSnapshot<T> | QuerySnapshot<T>) => void,
//   onError?: (error: Error) => void,
//   onCompletion?: () => void,
//   converter?: OracledbDataConverter<T>
// ): void;

// export declare function onSnapshotResume<T = any>(
//   oracledb: Oracledb,
//   snapshotJson: any,
//   observer: {
//     next: (snapshot: DocumentSnapshot<T> | QuerySnapshot<T>) => void;
//     error?: (error: Error) => void;
//     complete?: () => void;
//   },
//   converter?: OracledbDataConverter<T>
// ): void;


// /**
//  * Registers a callback that is called every time all snapshots are in sync.
//  *
//  * @example
//  * ```ts
//  * const unsub = onSnapshotsInSync(Oracledb, () => {
//  *   console.log("All snapshots are in sync");
//  * });
//  * ```
//  */
// export declare function onSnapshotsInSync(oracledb: Oracledb, onSync: () => void): Unsubscribe;

/**
 * Compares two Oracledb snapshots (QuerySnapshot or DocumentSnapshot) for equality.
 * 
 * @param left - A DocumentSnapshot or QuerySnapshot to compare.
 * @param right - A DocumentSnapshot or QuerySnapshot to compare.
 * @returns true if the snapshots are logically equal.
 */
export declare function snapshotEqual<
  AppModelType,
  DbModelType extends DocumentData
>(
  left: DocumentSnapshot<AppModelType, DbModelType> | QuerySnapshot<AppModelType, DbModelType>,
  right: DocumentSnapshot<AppModelType, DbModelType> | QuerySnapshot<AppModelType, DbModelType>
): boolean;