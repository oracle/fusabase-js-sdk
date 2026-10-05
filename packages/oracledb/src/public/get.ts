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
import { DualityViewColReference, Query } from "../collection/reference.js";
import { CollectionReference } from "../collection/reference.js";
import { DocumentReference, DualityViewDocReference } from "../document/reference.js";
import { DocumentSnapshot } from "../document/snapshot.js";
import { doc } from "./document.js";
import { getOracledb } from "./core.js";
import { oracledbErrorHandler } from "../util/utils.js";
import { isQuerySnapshotFromFailedRequest, QuerySnapshot } from "../collection/snapshot.js";
import { AggregateSpec } from "../types/common.js";
import { AggregateField, AggregateQuerySnapshot } from "../collection/aggregate.js";
import {
  _assertServerReadable,
  _cacheDocumentSnapshot,
  _cacheQuerySnapshot,
  _getDocFromCacheIfEnabled,
  _getDocsFromCacheIfEnabled,
  _getPendingCacheSnapshotForQuery,
  _hasPendingWritesForDocument,
  _shouldReadFromCache,
} from "./offline.js";

/**
 * Reads all results for a query directly from the remote service.
 *
 * @param q - The query or collection to read.
 * @returns A promise resolving to a query snapshot.
 * @example
 * ```ts
 * const snapshot = await getDocsFromServer(users);
 * ```
 */
export async function getDocsFromServer<
  AppModelType = any,
  DbModelType extends DocumentData = DocumentData
>(
  q: Query<AppModelType, DbModelType> 
    | DualityViewColReference<AppModelType>
    | CollectionReference<AppModelType, DbModelType>
): Promise<any> {
  // if (
  //   !(q instanceof Query || q instanceof DualityViewColReference || q instanceof CollectionReference)
  // ) {
  //   const error = new Error("Invalid query") as Error & { status?: number };
  //   error.status = 400;
  //   throw oracledbErrorHandler(error);
  // }
  _assertServerReadable((q as any).oracledb);
  const snap = await q.get();
  await _cacheQuerySnapshot(snap as any);
  return snap;
}


/**
 * Retrieves all documents matching the provided query.
 * Resolves with a QuerySnapshot containing the documents.
 *
 * @param q - The Oracledb query to execute.
 * @returns Promise<QuerySnapshot> - Contains all documents matching the query.
 *
 * @example
 * const querySnap = await getDocs(userQuery);
 * querySnap.forEach(doc => console.log(doc.id, doc.data()));
 */
export async function getDocs<AppModelType, DbModelType extends DocumentData>(
  q:
    | Query<AppModelType, DbModelType>
    | DualityViewColReference<AppModelType>
    | CollectionReference<AppModelType, DbModelType>
): Promise<QuerySnapshot<AppModelType, DbModelType>> {
  // if (
  //   !(q instanceof Query || q instanceof DualityViewColReference || q instanceof CollectionReference)
  // ) {
  //   const error = new Error("Invalid query") as Error & { status?: number };
  //   error.status = 400;
  //   throw oracledbErrorHandler(error);
  // }
  const db = (q as any).oracledb;
  if (_shouldReadFromCache(db)) {
    const cached = _getDocsFromCacheIfEnabled(q);
    if (cached) return cached as Promise<QuerySnapshot<AppModelType, DbModelType>>;
  }
  try {
    // The `.get()` method should return a QuerySnapshot<AppModelType, DbModelType>
    const snap = await q.get() as any;
    await _cacheQuerySnapshot(snap);
    if (isQuerySnapshotFromFailedRequest(snap)) return snap;
    const pendingCache = await _getPendingCacheSnapshotForQuery(q);
    if (pendingCache) return pendingCache as QuerySnapshot<AppModelType, DbModelType>;
    return snap;
  } catch (error) {
    const cached = _getDocsFromCacheIfEnabled(q);
    if (cached) return cached as Promise<QuerySnapshot<AppModelType, DbModelType>>;
    throw error;
  }
}


/**
 * Retrieves a single document referenced by the provided DocumentReference or string path.
 * Resolves with a DocumentSnapshot containing the document data.
 *
 * @param ref - DocumentReference or string path
 * @returns Promise<DocumentSnapshot> - Contains the document data, if exists
 *
 * @example
 * const userSnap = await getDoc(userRef);
 * console.log(userSnap.id, userSnap.data());
 */
export async function getDoc<
  AppModelType,
  DbModelType extends DocumentData
>(
  ref: DocumentReference<AppModelType, DbModelType> | DualityViewDocReference<AppModelType> | string
): Promise<DocumentSnapshot<AppModelType, DbModelType>> {
  if (typeof ref === 'string') {
    ref = doc(getOracledb(), ref) as DocumentReference<AppModelType, DbModelType>;
  }
  if (!(ref instanceof DocumentReference || ref instanceof DualityViewDocReference)) {
    const error = new Error('Invalid reference') as Error & { status?: number };
    error.status = 400;
    throw oracledbErrorHandler(error);
  }
  if (ref instanceof DocumentReference && _shouldReadFromCache(ref.oracledb)) {
    const cached = _getDocFromCacheIfEnabled(ref);
    if (cached) return cached as Promise<DocumentSnapshot<AppModelType, DbModelType>>;
  }
  try {
    const snap = await ref.get() as any;
    await _cacheDocumentSnapshot(snap);
    if (ref instanceof DocumentReference && await _hasPendingWritesForDocument(ref)) {
      const cached = _getDocFromCacheIfEnabled(ref);
      if (cached) return cached as Promise<DocumentSnapshot<AppModelType, DbModelType>>;
    }
    return snap;
  } catch (error) {
    if (ref instanceof DocumentReference) {
      const cached = _getDocFromCacheIfEnabled(ref);
      if (cached) return cached as Promise<DocumentSnapshot<AppModelType, DbModelType>>;
    }
    throw error;
  }
}

/**
 * Executes a server fetch and returns the document snapshot.
 *
 * @param ref - DocumentReference or DualityViewDocReference
 * @returns Promise<DocumentSnapshot>
 * @example
 * ```ts
 * const snapshot = await getDocFromServer(profile);
 * ```
 */
export async function getDocFromServer<
  AppModelType,
  DbModelType extends DocumentData
>(
  ref: DocumentReference<AppModelType, DbModelType> | DualityViewDocReference<AppModelType>
): Promise<DocumentSnapshot<AppModelType, DbModelType>> {
  if (!(ref instanceof DocumentReference || ref instanceof DualityViewDocReference)) {
    const error = new Error('Invalid reference') as Error & { status?: number };
    error.status = 400;
    throw oracledbErrorHandler(error);
  }
  _assertServerReadable(ref.oracledb);
  const snap = await ref.get() as any;
  await _cacheDocumentSnapshot(snap);
  return snap;
}

/**
 * Executes an aggregate query on the server and returns an AggregateQuerySnapshot.
 *
 * @param query - Query or collection to aggregate
 * @param aggregateSpec - The specification for aggregate fields
 * @returns AggregateQuerySnapshot with results of the aggregation
 * @example
 * ```ts
 * const snapshot = await getAggregateFromServer(orders, { total: sum('amount') });
 * ```
 */
export async function getAggregateFromServer<
  AggregateSpecType extends AggregateSpec,
  AppModelType,
  DbModelType extends DocumentData
>(
  query:
    | Query<AppModelType, DbModelType>
    | CollectionReference<AppModelType, DbModelType>
    | DualityViewColReference<AppModelType>,
  aggregateSpec: AggregateSpecType
): Promise<AggregateQuerySnapshot<AggregateSpecType, AppModelType, DbModelType>> {
  // if (
  //   !(query instanceof CollectionReference ||
  //     query instanceof Query ||
  //     query instanceof DualityViewColReference)
  // ) {
  //   const err = new Error("Provided query is not valid!") as Error & { status?: number };
  //   err.status = 400;
  //   throw oracledbErrorHandler(err);
  // }
  // TypeScript will infer the result properly
  const newQuery = query.aggregate(aggregateSpec);
  return newQuery.get() as any;
}


/**
 * Executes a count aggregation on the provided query and returns an AggregateQuerySnapshot.
 *
 * @param query - The query or collection to execute the count on.
 * @returns Promise with AggregateQuerySnapshot containing the count.
 * @example
 * ```ts
 * const snapshot = await getCountFromServer(users);
 * console.log(snapshot.data().count);
 * ```
 */
export async function getCountFromServer<
  AppModelType,
  DbModelType extends DocumentData
>(
  query:
    | Query<AppModelType, DbModelType>
    | CollectionReference<AppModelType, DbModelType>
    | DualityViewColReference<AppModelType>
): Promise<AggregateQuerySnapshot<{ count: AggregateField<number> }, AppModelType, DbModelType>> {
  // if (
  //   !(query instanceof CollectionReference ||
  //     query instanceof Query ||
  //     query instanceof DualityViewColReference)
  // ) {
  //   const err = new Error("Provided query is not valid!") as Error & { status?: number };
  //   err.status = 400;
  //   throw oracledbErrorHandler(err);
  // }
  // .count() should return an aggregate query; .get() executes and returns the aggregate snapshot.
  const new_query = query.count();
  return new_query.get() as any;
}
