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

import { 
  CollectionReference, 
  DocumentReference, 
  DocumentData 
} from "@fusabase/oracledb";

/**
 * Creates a DocumentReference pointing to a document within the specified collection.
 *
 * - If `path` is omitted, the document ID will be auto-generated when adding data.
 * - If `path` is provided, the DocumentReference will point to that specific document ID.
 * - You may also provide additional `pathSegments` to navigate deeper into subcollections.
 *
 * Example:
 *   // Reference with an auto-generated ID
 *   const docRef = doc(usersCollection);
 *
 *   // Reference with a specific ID
 *   const docRef = doc(usersCollection, "user123");
 *
 *   // Reference with nested path
 *   const docRef = doc(usersCollection, "user123", "orders", "order456");
 *
 * @param reference A reference to a Oracledb collection.
 * @param path Optional. A slash-separated path string for the document ID.
 * @param pathSegments Additional path segments applied relative to the first argument.
 * @returns A DocumentReference pointing to the specified document.
 */
export declare function doc<
  AppModelType,
  DbModelType extends DocumentData
>(
  reference: CollectionReference<AppModelType, DbModelType>,
  path?: string,
  ...pathSegments: string[]
): DocumentReference<AppModelType, DbModelType>;

/**
 * Creates a DocumentReference relative to another DocumentReference.
 *
 * - Allows navigation into subcollections under the given document reference.
 * - Requires providing a valid path string and optionally additional path segments.
 *
 * Example:
 *   // Reference to a subcollection document
 *   const orderRef = doc(userDocRef, "orders", "order456");
 *
 *   // Equivalent to Oracledb path: users/user123/orders/order456
 *
 * @param reference A DocumentReference to start from.
 * @param path A slash-separated path string for the document.
 * @param pathSegments Additional path segments applied relative to the first argument.
 * @returns A DocumentReference pointing to the specified nested document.
 */
export declare function doc<
  AppModelType,
  DbModelType extends DocumentData
>(
  reference: DocumentReference<AppModelType, DbModelType>,
  path: string,
  ...pathSegments: string[]
): DocumentReference<DocumentData, DocumentData>;

/**
 * Returns a FieldPath that refers to the ID of a document.
 */
export declare function documentId(): FieldPath;

/* Returns true if two references (DocumentReference or CollectionReference) are logically equal.
 *
 * @param left - The first reference to compare.
 * @param right - The second reference to compare.
 * @returns true if the references are equal.
 */
export declare function refEqual<
  AppModelType,
  DbModelType extends DocumentData
>(
  left: DocumentReference<AppModelType, DbModelType> | CollectionReference<AppModelType, DbModelType>,
  right: DocumentReference<AppModelType, DbModelType> | CollectionReference<AppModelType, DbModelType>
): boolean;