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

 /* Returns true if two snapshots (QuerySnapshot or DocumentSnapshot) are logically equal.
 * @param left - A DocumentSnapshot or QuerySnapshot to compare.
 * @param right - A DocumentSnapshot or QuerySnapshot to compare.
 * @returns true if the snapshots are equal.
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

  return (ref as any).onSnapshot(...params);
}
