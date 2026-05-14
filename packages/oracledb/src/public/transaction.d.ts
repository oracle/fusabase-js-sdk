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
 * Runs a Oracledb transaction.
 *
 * @param oracledb - The Oracledb instance.
 * @param updateFunction - Function containing the transaction logic.
 * @param options - Optional transaction options.
 *
 * @example
 * ```ts
 * await runTransaction(oracledb, async (tx) => {
 *   const docSnap = await tx.get(docRef);
 *   if (docSnap.exists) {
 *     tx.update(docRef, { counter: docSnap.data().counter + 1 });
 *   }
 * });
 * ```
 */
export declare function runTransaction<T>(
  oracledb: Oracledb,
  updateFunction: (transaction: Transaction) => Promise<T>,
  options?: { maxAttempts?: number }
): Promise<T>;

/**
 * Creates a WriteBatch that can be used to perform multiple writes
 * as a single atomic operation.
 *
 * A WriteBatch instance allows you to queue multiple writes — set(),
 * update(), and delete() — across one or more documents.
 * All writes are committed together with commit().
 *
 * @param oracledb - The Oracledb instance for which to create the batch.
 * @returns A new WriteBatch instance.
 *
 * @example
 * ```ts
 * import { getOracledb, doc, writeBatch } from "fusabase/oracledb";
 *
 * const db = getOracledb();
 * const batch = writeBatch(db);
 *
 * const userRef = doc(db, "users/alice");
 * const postRef = doc(db, "posts/post1");
 *
 * batch.set(userRef, { name: "Alice", active: true });
 * batch.update(postRef, { views: 100 });
 * batch.delete(doc(db, "logs/oldLog"));
 *
 * await batch.commit();
 * console.log("Batch committed successfully!");
 * ```
 */
export declare function writeBatch(oracledb: Oracledb): WriteBatch;
