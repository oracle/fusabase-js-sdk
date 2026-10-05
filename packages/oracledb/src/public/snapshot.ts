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
 * Returns true if two snapshots are logically equal.
 *
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
 * Subscribes to snapshot updates for a query, collection, or document reference.
 *
 * @param ref - The target to observe.
 * @param params - Listener options and callbacks accepted by the overloads.
 * @returns A function that stops the listener.
 * @example
 * ```ts
 * const unsubscribe = onSnapshot(users, snapshot => {
 *   console.log(snapshot.docs.length);
 * });
 * ```
 */
export function onSnapshot<AppModelType, DbModelType extends DocumentData>
(query: Query<AppModelType, DbModelType>, observer: {
    next?: (snapshot: QuerySnapshot<AppModelType, DbModelType>) => void;
    error?: (error: OracledbError) => void;
    complete?: () => void;
}): Unsubscribe;

export function onSnapshot<AppModelType, DbModelType 
extends DocumentData>(query: Query<AppModelType, DbModelType>, 
  options: SnapshotListenOptions, observer: {
    next?: (snapshot: QuerySnapshot<AppModelType, DbModelType>) => void;
    error?: (error: OracledbError) => void;
    complete?: () => void;
}): Unsubscribe;

export function onSnapshot<AppModelType, DbModelType extends 
DocumentData>(query: Query<AppModelType, DbModelType>, onNext: 
  (snapshot: QuerySnapshot<AppModelType, DbModelType>) => void, 
  onError?: (error: OracledbError) => void, onCompletion?: () => void):
  Unsubscribe;

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

  const offline = tryOfflineSnapshot(ref as any, params);
  if (offline) return offline;
  return (ref as any).onSnapshot(...params);
}

function tryOfflineSnapshot(ref: any, params: any[]): Unsubscribe | null {
  if (ref instanceof DualityViewColReference || ref instanceof DualityViewDocReference) {
    return null;
  }
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
