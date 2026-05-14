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
 * Returns a sentinel for deleting a field in Oracledb.
 */
export declare function deleteField(): FieldValue;

/**
 * Returns a sentinel for setting a field to the server-generated timestamp.
 */
export declare function serverTimestamp(): FieldValue;

/**
 * Returns a sentinel for adding elements to an array field.
 *
 * @param elements - Elements to add
 */
export declare function arrayUnion<T>(...elements: T[]): FieldValue;

/**
 * Returns a sentinel for removing elements from an array field.
 *
 * @param elements - Elements to remove
 */
export declare function arrayRemove<T>(...elements: T[]): FieldValue;

/**
 * Returns a sentinel for incrementing a numeric field.
 *
 * @param n - The amount to increment by
 */
export declare function increment(n: number): FieldValue;