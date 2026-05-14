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


import { Oracledb } from '../oracledb/oracledb.js';
import { CollectionReference } from './collectionReference.js';
import { DocumentData } from '../common/common.js';

/**
 * Gets a CollectionReference instance that refers to a collection at the specified path.
 * You can provide additional path segments relative to the first argument.
 *
 * @param oracledb - A reference to the root Oracledb instance.
 * @param path - A slash-separated path to a collection.
 * @param pathSegments - Additional path segments to apply relative to the first argument.
 * @returns A CollectionReference for the specified path.
 *
 * @example
 * ```ts
 * import { collection } from 'fusabase/oracledb';
 *
 * // Root-level collection
 * const usersCollection = collection(db, 'users');
 *
 * // Nested subcollection
 * const ordersCollection = collection(db, 'users', 'uid123', 'orders');
 * ```
 */
export declare function collection(
  oracledb: Oracledb,
  path: string,
  ...pathSegments: string[]
): CollectionReference<DocumentData, DocumentData>;


// Returns a reference to a duality view collection.
export declare function dualityViewCollection<T = any>(
  db: Oracledb,
  name: string
): DualityViewColReference<T>;

// Returns a reference to a duality view document.
export declare function dualityViewDoc<T = any>(
  db: Oracledb | DualityViewColReference<T>,
  path: string,
  ...pathSegments: string[]
): DualityViewDocReference<T>;

/**
 * Returns a `CollectionReference` referring to a collection group with the given name.
 * @param oracledb - An Oracledb instance.
 * @param name - The collection group name.
 */
export declare function collectionGroup(
  oracledb: Oracledb,
  name: string
): CollectionReference;