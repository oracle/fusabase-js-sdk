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

// snapshot/documentSnapshot.d.ts

import { DocumentReference } from '../document/reference.js';
import { DocumentData } from '../types/common.js';
import { SnapshotMetadata } from '../listener/snapshot.js';
import { SnapshotOptions } from '../types/snapshot.js';

/**
 * A DocumentSnapshot contains data read from a document in a Oracledb database.
 * The data can be extracted with `.data()` or `.get(<field>)`.
 *
 * @template AppModelType - Type of the application's data model.
 * @template DbModelType - Type of the Oracledb-stored data.
 *
 * @example
 * ```ts
 * import { doc, getDoc, DocumentSnapshot } from 'fusabase/oracledb';
 *
 * const userDocRef = doc(db, 'users', 'uid123');
 * const snapshot: DocumentSnapshot = await getDoc(userDocRef);
 *
 * if (snapshot.exists()) {
 *   console.log('User data:', snapshot.data());
 * } else {
 *   console.log('No such document!');
 * }
 * ```
 */
export declare class DocumentSnapshot<
  AppModelType = DocumentData,
  DbModelType extends DocumentData = DocumentData
> {
  /**
   * Constructs a new instance of the DocumentSnapshot class.
   */
  constructor();

  /**
   * The document's identifier.
   */
  readonly id: string;

  /**
   * Metadata about the snapshot, such as its source and local modifications.
   */
  readonly metadata: SnapshotMetadata;

  /**
   * The DocumentReference for the document included in this snapshot.
   */
  readonly ref: DocumentReference<AppModelType, DbModelType>;

  /**
   * Retrieves all fields in the document as an object.
   * Returns `undefined` if the document doesn't exist.
   *
   * @param options - Options for how to return server timestamps.
   * @returns The document data or undefined.
   */
  data(options?: { serverTimestamps?: 'estimate' | 'previous' | 'none' }): AppModelType | undefined;

  /**
   * Returns whether or not the document exists.
   */
  exists(): boolean;

  /**
   * Retrieves the field specified by fieldPath.
   * Returns `undefined` if the document or field doesn't exist.
   *
   * @param fieldPath - Path to the field to retrieve.
   * @param options - Options for how to return server timestamps.
   */
  get<K extends keyof AppModelType>(
    fieldPath: K | string,
    options?: { serverTimestamps?: 'estimate' | 'previous' | 'none' }
  ): AppModelType[K] | undefined;

  /**
   * Returns a JSON-serializable representation of this DocumentSnapshot.
   */
  toJSON(): object;
}


/**
 * A QueryDocumentSnapshot contains data read from a document in your Oracledb database
 * as part of a query. The document is guaranteed to exist, unlike a regular DocumentSnapshot.
 *
 * Extends DocumentSnapshot, so you can access all its properties and methods.
 *
 * @example
 * ```ts
 * const qSnap = await getDocs(query(collection(db, 'users')));
 * qSnap.forEach(docSnap => {
 *   console.log(docSnap.id); // Document ID
 *   console.log(docSnap.data()); // Document data
 * });
 * ```
 */
export declare class QueryDocumentSnapshot<
  AppModelType = DocumentData,
  DbModelType extends DocumentData = DocumentData
> extends DocumentSnapshot<AppModelType, DbModelType> {

  /**
   * Retrieves all fields in the document as an object.
   * Since the document is guaranteed to exist, `data()` will never return undefined.
   *
   * @param options Optional settings for how serverTimestamp() values are returned.
   * @returns An object containing all fields in the document.
   */
  data(options?: SnapshotOptions): AppModelType;
}

