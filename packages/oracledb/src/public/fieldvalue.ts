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

import { FieldValue } from "../field/value.js";
/**
 * Returns a sentinel for setting a field to the server-generated timestamp.
 *
 * @returns A timestamp sentinel value.
 * @example
 * ```ts
 * await setDoc(ref, { updatedAt: serverTimestamp() });
 * ```
 */
export function serverTimestamp(): FieldValue {
  return FieldValue.serverTimestamp();
}

/**
 * Returns a sentinel for deleting a field in Oracledb.
 *
 * @returns A field-deletion sentinel value.
 * @example
 * ```ts
 * await updateDoc(ref, { obsoleteField: deleteField() });
 * ```
 */
export function deleteField(): FieldValue {
  return FieldValue.delete();
}

/**
 * Returns a sentinel for adding elements to an array field.
 * @param elements - Elements to add
 * @returns An array-union sentinel value.
 * @example
 * ```ts
 * await updateDoc(ref, { tags: arrayUnion("new") });
 * ```
 */
export function arrayUnion<T>(...elements: T[]): FieldValue {
  return FieldValue.arrayUnion(...elements);
}

/**
 * Returns a sentinel for removing elements from an array field.
 * @param elements - Elements to remove
 * @returns An array-removal sentinel value.
 * @example
 * ```ts
 * await updateDoc(ref, { tags: arrayRemove("old") });
 * ```
 */
export function arrayRemove<T>(...elements: T[]): FieldValue {
  return FieldValue.arrayRemove(...elements);
}

/**
 * Returns a sentinel for incrementing a numeric field.
 * @param n - The amount to increment by
 * @returns A numeric-increment sentinel value.
 * @example
 * ```ts
 * await updateDoc(ref, { views: increment(1) });
 * ```
 */
export function increment(n: number): FieldValue {
  return FieldValue.increment(n);
}
