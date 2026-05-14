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
 * A `FieldPath` refers to a specific field in a Oracledb document.
 * Can be used to reference nested fields or top-level fields.
 *
 * @example
 * ```ts
 * import { FieldPath, getDoc, doc } from 'fusabase/oracledb';
 *
 * // Create a FieldPath for a top-level field
 * const topLevel = new FieldPath('username');
 *
 * // Create a FieldPath for a nested field
 * const nested = new FieldPath('address', 'city');
 *
 * const userDocRef = doc(db, 'users', 'uid123');
 * const city = await getDoc(userDocRef).then(snap => snap.get(nested));
 * ```
 *
 * @template AppModelType - Optional type for your app's data model.
 */
export declare class FieldPath {
  /**
   * Creates a FieldPath from the provided field names.
   * If more than one field name is provided, the path points to a nested field.
   *
   * @param fieldNames - One or more field names
   */
  constructor(...fieldNames: string[]);

  /**
   * Compares this FieldPath with another.
   *
   * @param other - Another FieldPath instance
   * @returns True if the two FieldPaths point to the same location
   */
  isEqual(other: FieldPath): boolean;
}
