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
 import { DocumentData } from "../types/common.js";
 import { QuerySnapshot } from "../collection/snapshot.js";
 import { DocumentSnapshot } from "../document/snapshot.js";
import { OracledbError, oracledbErrorHandler } from "../util/utils.js";
import { DualityViewColReference, Query } from "../collection/reference.js";
import { SnapshotListenOptions, Unsubscribe } from "../types/snapshot.js";
import { DocumentReference, DualityViewDocReference } from "../document/reference.js";
import { CollectionReference } from "../collection/reference.js";
import { _listenOfflineIfEnabled } from "./offline.js";

/**
 * Returns true if two snapshots (QuerySnapshot or DocumentSnapshot) are logically equal.
 * @param left - A DocumentSnapshot or QuerySnapshot to compare.
 * @param right - A DocumentSnapshot or QuerySnapshot to compare.
 * @returns true if the snapshots are equal.
 * @example
 * ```ts
 * const same = snapshotEqual(firstSnapshot, secondSnapshot);
 * ```
 */
export function snapshotEqual<
  AppModelType,
  DbModelType extends DocumentData
>(
  left: DocumentSnapshot<AppModelType, DbModelType> | QuerySnapshot<any>,
  right: DocumentSnapshot<AppModelType, DbModelType> | QuerySnapshot<any>
): boolean {
  return left.isEqual(right as any);
}

/**
 * Listens for changes to a query, collection, or document.
 *
 * @param query - Query or collection to observe for this overload.
 * @param observer - Observer that receives snapshots, errors, and completion.
 * @returns A function that stops the listener.
 * @example
 * ```ts
 * const unsubscribe = onSnapshot(tasksQuery, snapshot => console.log(snapshot.size));
 * unsubscribe();
 * ```
 *
 * @example Use an observer object.
 * ```ts
 * const unsubscribe = onSnapshot(tasksQuery, {
 *   next: snapshot => console.log(snapshot.size),
 *   error: error => console.error(error)
 * });
 * ```
 *
 * @example Include metadata changes with an observer object.
 * ```ts
 * const unsubscribe = onSnapshot(tasksQuery, { includeMetadataChanges: true }, {
 *   next: snapshot => console.log(snapshot.metadata)
 * });
 * ```
 *
 * @example Use callbacks with listener options.
 * ```ts
 * const unsubscribe = onSnapshot(tasksQuery, { includeMetadataChanges: true },
 *   snapshot => console.log(snapshot.size),
 *   error => console.error(error),
 *   () => console.log("listener closed")
 * );
 * ```
 */
export function onSnapshot<AppModelType, DbModelType extends DocumentData>
(query: Query<AppModelType, DbModelType>, observer: {
    next?: (snapshot: QuerySnapshot<AppModelType, DbModelType>) => void;
    error?: (error: OracledbError) => void;
    complete?: () => void;
}): Unsubscribe;

/**
 * Listens to a query using listener options and an observer object.
 * @param query - Query whose snapshots to observe.
 * @param options - Listener options, including metadata-change behavior.
 * @param observer - Object with optional next, error, and complete callbacks.
 * @returns A function that stops the listener.
 * @example
 * ```ts
 * import { onSnapshot } from "fusabase/oracledb";
 * const unsubscribe = onSnapshot(tasksQuery, { includeMetadataChanges: true }, { next: console.log });
 * unsubscribe();
 * ```
 */
export function onSnapshot<AppModelType, DbModelType 
extends DocumentData>(query: Query<AppModelType, DbModelType>, 
  options: SnapshotListenOptions, observer: {
    next?: (snapshot: QuerySnapshot<AppModelType, DbModelType>) => void;
    error?: (error: OracledbError) => void;
    complete?: () => void;
}): Unsubscribe;

/**
 * Listens to a query using callbacks.
 * @param query - Query whose snapshots to observe.
 * @param onNext - Callback that receives each query snapshot.
 * @param onError - Optional callback that receives listener errors.
 * @param onCompletion - Optional callback called when the listener completes.
 * @returns A function that stops the listener.
 * @example
 * ```ts
 * import { onSnapshot } from "fusabase/oracledb";
 * const unsubscribe = onSnapshot(tasksQuery, console.log, console.error, () => console.log("complete"));
 * unsubscribe();
 * ```
 */
export function onSnapshot<AppModelType, DbModelType extends 
DocumentData>(query: Query<AppModelType, DbModelType>, onNext: 
  (snapshot: QuerySnapshot<AppModelType, DbModelType>) => void, 
  onError?: (error: OracledbError) => void, onCompletion?: () => void):
  Unsubscribe;

/**
 * Listens to a query using options and individual callbacks.
 * @param query - Query whose snapshots to observe.
 * @param options - Listener options, including metadata-change behavior.
 * @param onNext - Callback that receives each query snapshot.
 * @param onError - Optional callback that receives listener errors.
 * @param onCompletion - Optional callback called when the listener completes.
 * @returns A function that stops the listener.
 * @example
 * ```ts
 * import { onSnapshot } from "fusabase/oracledb";
 * const unsubscribe = onSnapshot(tasksQuery, { includeMetadataChanges: true }, console.log, console.error);
 * unsubscribe();
 * ```
 */
export function onSnapshot<AppModelType, DbModelType extends
 DocumentData>(query: Query<AppModelType, DbModelType>, 
 options: SnapshotListenOptions, onNext: (snapshot: 
 QuerySnapshot<AppModelType, DbModelType>) => void, onError?: (error: 
 OracledbError) => void, onCompletion?: () => void): Unsubscribe;

export function onSnapshot<AppModelType, DbModelType extends DocumentData>(
  ref:
    | Query<AppModelType, DbModelType>
    | DualityViewColReference<AppModelType>
    | DocumentReference<AppModelType, DbModelType>
    | CollectionReference<AppModelType, DbModelType>
    | DualityViewDocReference<AppModelType>,
  ...params: any[]
  ): Unsubscribe {
  if (
    !(
      ref instanceof Query ||
      ref instanceof DualityViewColReference ||
      ref instanceof DocumentReference ||
      ref instanceof CollectionReference ||
      ref instanceof DualityViewDocReference
    )
  ) {
    const error: any = new Error("Invalid reference");
    error.status = 400;
    throw oracledbErrorHandler(error);
  }

  if (ref instanceof Query || ref instanceof DualityViewColReference || ref instanceof CollectionReference) {
    (ref as any).__validateSnapshotQuery();
  }

  const offline = tryOfflineSnapshot(ref as any, params);
  if (offline) return offline;
  return (ref as any).onSnapshot(...params);
}

function tryOfflineSnapshot(ref: any, params: any[]): Unsubscribe | null {
  const { options, observer } = parseSnapshotParams(params);
  return _listenOfflineIfEnabled(ref, options, observer as any);
}

function parseSnapshotParams(params: any[]): {
  options: SnapshotListenOptions;
  observer: {
    next: (snapshot: any) => void;
    error?: (error: Error) => void;
  };
} {
  let options: SnapshotListenOptions = {};
  let callbacks: any[] = params;
  if (params[0] && typeof params[0] === 'object' && !('next' in params[0]) && typeof params[0] !== 'function') {
    options = params[0];
    callbacks = params.slice(1);
  }
  const first = callbacks[0];
  if (typeof first === 'function') {
    return {
      options,
      observer: {
        next: first,
        error: callbacks[1],
      },
    };
  }
  return {
    options,
    observer: {
      next: first?.next?.bind(first),
      error: first?.error?.bind(first),
    },
  };
}
