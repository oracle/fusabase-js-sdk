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
import {DocumentData} from '../types/common.js';
import { DocumentReference } from '../document/reference.js';
import {WithFieldValue} from '../types/data.js';
import { DocumentSnapshot } from '../document/snapshot.js';
import { CollectionReference } from '../collection/reference.js';
import { SetOptions,UpdateData } from '../types/common.js';
import { FieldPath } from '../field/path.js';
/**
 * A Transaction in Oracledb provides atomic read and write operations.
 *
 * All reads must be done before any writes. If a document read inside the
 * transaction changes before the transaction commits, Oracledb will retry
 * the transaction.
 */
export declare class Transaction {
  /**
   * Deletes the document referred to by the provided DocumentReference.
   */
  delete<AppModelType, DbModelType extends DocumentData>(
    documentRef: DocumentReference<AppModelType, DbModelType>
  ): Transaction;

  /**
   * Reads the document referenced by the provided DocumentReference.
   */
  get<AppModelType, DbModelType extends DocumentData>(
    documentRef: DocumentReference<AppModelType, DbModelType>
  ): Promise<DocumentSnapshot<AppModelType, DbModelType>>;

  /**
   * Writes to the document referred to by the provided DocumentReference.
   * If the document does not exist yet, it will be created.
   */
  set<AppModelType, DbModelType extends DocumentData>(
    documentRef: DocumentReference<AppModelType, DbModelType>,
    data: WithFieldValue<AppModelType>
  ): Transaction;

  /**
   * Writes to the document referred to by the provided DocumentReference.
   * If the document does not exist yet, it will be created.
   * With `merge` or `mergeFields`, the provided data can be merged into
   * an existing document.
   */
  set<AppModelType, DbModelType extends DocumentData>(
    documentRef: DocumentReference<AppModelType, DbModelType>,
    data: Partial<AppModelType>,
    options: SetOptions
  ): Transaction;

  /**
   * Updates fields in the document referred to by the provided DocumentReference.
   * The update will fail if applied to a document that does not exist.
   */
  update<AppModelType, DbModelType extends DocumentData>(
    documentRef: DocumentReference<AppModelType, DbModelType>,
    data: UpdateData<AppModelType>
  ): Transaction;

  /**
   * Updates specific fields in the document referred to by the provided DocumentReference.
   * Nested fields can be updated using dot-separated field paths or FieldPath objects.
   * The update will fail if applied to a document that does not exist.
   */
  update<AppModelType, DbModelType extends DocumentData>(
    documentRef: DocumentReference<AppModelType, DbModelType>,
    field: string | FieldPath,
    value: unknown,
    ...moreFieldsAndValues: unknown[]
  ): Transaction;
}


/**
 * Represents a batch of writes that can be committed together.
 */
/**
 * Represents a batch of write operations to perform atomically.
 *
 * All writes in a batch succeed or all fail. A WriteBatch can
 * include any combination of set, update, and delete operations.
 */
export declare class WriteBatch {
  /**
   * Writes to the specified document reference.
   * If the document does not exist, it will be created.
   *
   * @param reference - Reference to the document to set.
   * @param data - The data to write to the document.
   * @returns The WriteBatch instance for method chaining.
   *
   * @example
   * ```ts
   * const userRef = doc(db, "users/alice");
   * batch.set(userRef, { name: "Alice", city: "Delhi" });
   * ```
   */
  set<T>(reference: DocumentReference<T>, data: WithFieldValue<T>): WriteBatch;

  /**
   * Updates fields in the document referred to by the specified DocumentReference.
   * The update will fail if applied to a document that does not exist.
   *
   * @param reference - Reference to the document to update.
   * @param data - An object containing field paths and updated values.
   * @returns The WriteBatch instance for method chaining.
   *
   * @example
   * ```ts
   * const userRef = doc(db, "users/alice");
   * batch.update(userRef, { age: 31 });
   * ```
   */
  update<T>(reference: DocumentReference<T>, data: UpdateData): WriteBatch;

  /**
   * Deletes the document referred to by the specified DocumentReference.
   *
   * @param reference - Reference to the document to delete.
   * @returns The WriteBatch instance for method chaining.
   *
   * @example
   * ```ts
   * const userRef = doc(db, "users/oldUser");
   * batch.delete(userRef);
   * ```
   */
  delete<T>(reference: DocumentReference<T>): WriteBatch;

  /**
   * Commits all the writes in this WriteBatch as a single atomic operation.
   * Returns a Promise that resolves once all operations have been applied.
   *
   * @returns A Promise resolved when the batch is successfully committed.
   *
   * @example
   * ```ts
   * await batch.commit();
   * console.log("Batch committed successfully!");
   * ```
   */
  commit(): Promise<void>;
}
