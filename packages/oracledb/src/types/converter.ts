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

import { DocumentData } from "./common.js";
import { DocumentSnapshot } from "../document/snapshot.js";
import { SnapshotOptions } from "./snapshot.js";

/**
 * Converts between custom model objects (AppModelType) and Oracledb data (DbModelType).
 * Use with `withConverter()` on DocumentReference or CollectionReference.
 *
 * @example
 * ```ts
 * interface User {
 *   name: string;
 *   age: number;
 * }
 *
 * const userConverter: OracledbDataConverter<User> = {
 *   fromOracledb(snapshot) {
 *     const data = snapshot.data();
 *     return { name: data.name, age: data.age };
 *   },
 *   toOracledb(user: User) {
 *     return { name: user.name, age: user.age };
 *   }
 * };
 *
 * const userRef = doc(db, 'users/123').withConverter(userConverter);
 * ```
 */
export declare interface OracledbDataConverter<AppModelType, DbModelType extends DocumentData = DocumentData> {

  /**
   * Converts Oracledb data from a DocumentSnapshot into a custom model object.
   *
   * @param snapshot - The DocumentSnapshot to convert.
   * @param options - Optional snapshot options, e.g., how to handle server timestamps.
   * @returns The converted object of type AppModelType.
   */
  fromOracledb(snapshot: DocumentSnapshot<DbModelType>, options?: SnapshotOptions): AppModelType;

  /**
   * Converts a custom model object into a plain Oracledb-compatible object.
   * 
   * @param modelObject - The custom object to convert.
   * @returns The plain object suitable for Oracledb.
   */
  toOracledb(modelObject: AppModelType): DbModelType;

}
