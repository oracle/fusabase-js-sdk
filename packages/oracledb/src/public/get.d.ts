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
 * Retrieves all documents matching the provided query.
 * Resolves with a QuerySnapshot containing the documents.
 *
 * @param query - The Oracledb query to execute.
 * @returns Promise<QuerySnapshot> - Contains all documents matching the query.
 *
 * @example
 * const querySnap = await getDocs(userQuery);
 * querySnap.forEach(doc => console.log(doc.id, doc.data()));
 */
export declare function getDocs<AppModelType, DbModelType extends DocumentData>(
  query: Query<AppModelType, DbModelType>
): Promise<QuerySnapshot<AppModelType, DbModelType>>;


/**
 * Retrieves all documents matching the query from the server.
 * Will throw an error if network is unavailable.
 *
 * @param query - The Oracledb query to execute from server.
 * @returns Promise<QuerySnapshot> - Contains all server-side documents matching the query.
 *
 * @example
 * const serverSnap = await getDocsFromServer(userQuery);
 * serverSnap.forEach(doc => console.log(doc.id, doc.data()));
 */
export declare function getDocsFromServer<AppModelType, DbModelType extends DocumentData>(
  query: Query<AppModelType, DbModelType>
): Promise<QuerySnapshot<AppModelType, DbModelType>>;


/**
 * Reads the document referred to by the specified DocumentReference.
 *
 * - Retrieves the document from the Oracledb cache or server, depending on availability.
 * - Returns a `DocumentSnapshot` that contains the document data if it exists, or
 *   indicates that the document does not exist.
 *
 * Example:
 * ```ts
 * const docRef = doc(usersCollection, "user123");
 * const snapshot = await getDoc(docRef);
 *
 * if (snapshot.exists()) {
 *   console.log("User data:", snapshot.data());
 * } else {
 *   console.log("No such document!");
 * }
 * ```
 *
 * @param reference The reference of the document to fetch.
 * @returns A promise that resolves with a DocumentSnapshot of the requested document.
 */
export declare function getDoc<
  AppModelType,
  DbModelType extends DocumentData
>(
  reference: DocumentReference<AppModelType, DbModelType>
): Promise<DocumentSnapshot<AppModelType, DbModelType>>;

/**
 * Reads the document referred to by the specified DocumentReference **directly from the server**.
 *
 * - Always retrieves the latest version of the document from Oracledb backend.
 * - Will fail if the client is offline or the server cannot be reached.
 *
 * Example:
 * ```ts
 * const snapshot = await getDocFromServer(docRef);
 * if (snapshot.exists()) {
 *   console.log("Server data:", snapshot.data());
 * } else {
 *   console.log("No such document on server!");
 * }
 * ```
 *
 * @param reference The reference of the document to fetch from the server.
 * @returns A promise that resolves with a DocumentSnapshot from the Oracledb server.
 */
export declare function getDocFromServer<
  AppModelType,
  DbModelType extends DocumentData
>(
  reference: DocumentReference<AppModelType, DbModelType>
): Promise<DocumentSnapshot<AppModelType, DbModelType>>;

/**
 * Executes an aggregate query directly against the server and returns the results.
 * 
 * This function allows you to compute aggregates (such as `count`, `sum`, `average`) 
 * over a query result set without downloading all the documents.
 *
 * @typeParam AggregateSpecType - The type of the aggregate specification.
 * @typeParam AppModelType - The application model type.
 * @typeParam DbModelType - The Oracledb database type, defaults to DocumentData.
 *
 * @param query - The Oracledb Query to aggregate over.
 * @param aggregateSpec - An object that specifies which aggregates to compute. 
 *                        Each entry maps an alias (string) to an AggregateField.
 * 
 * @returns A Promise that resolves with an `AggregateQuerySnapshot`, containing 
 *          the aggregate results.
 *
 * @example
 * import { collection, query, where, getAggregateFromServer, sum, average } from "fusabase/oracledb";
 * import { db } from "./fusabase.js";
 *
 * async function getOrderStats() {
 *   // Define a query over the "orders" collection for completed orders
 *   const ordersQuery = query(
 *     collection(db, "orders"),
 *     where("status", "==", "completed")
 *   );
 *
 *   // Define aggregate spec with aliases
 *   const aggregateSpec = {
 *     totalRevenue: sum("amount"),
 *     avgRevenue: average("amount"),
 *   };
 *
 *   // Execute aggregate query
 *   const snapshot = await getAggregateFromServer(ordersQuery, aggregateSpec);
 *
 *   console.log("Total revenue:", snapshot.data().totalRevenue);
 *   console.log("Average revenue:", snapshot.data().avgRevenue);
 * }
 */
export declare function getAggregateFromServer<AggregateSpecType extends AggregateSpec,AppModelType,DbModelType extends DocumentData>(
  query: Query<AppModelType, DbModelType>,
  aggregateSpec: AggregateSpecType
): Promise<AggregateQuerySnapshot<AggregateSpecType, AppModelType, DbModelType>>;

/**
 * Executes a count aggregation directly against the server and returns the result.
 *
 * This is a convenience function for counting the number of documents 
 * that match a given query without downloading the entire result set.
 *
 * @typeParam AppModelType - The application model type.
 * @typeParam DbModelType - The Oracledb database type, defaults to DocumentData.
 *
 * @param query - The Oracledb Query whose result set size is calculated.
 *
 * @returns A Promise that resolves with an `AggregateQuerySnapshot`, 
 *          which contains the count result under the alias `count`.
 *
 * @example
 * import { collection, query, where, getCountFromServer } from "fusabase/oracledb";
 * import { db } from "./fusabase.js";
 *
 * async function getCompletedOrderCount() {
 *   // Define a query for completed orders
 *   const ordersQuery = query(
 *     collection(db, "orders"),
 *     where("status", "==", "completed")
 *   );
 *
 *   // Run count aggregation on the server
 *   const snapshot = await getCountFromServer(ordersQuery);
 *
 *   console.log("Number of completed orders:", snapshot.data().count);
 * }
 */
export declare function getCountFromServer<AppModelType,DbModelType extends DocumentData>(
  query: Query<AppModelType, DbModelType>
): Promise<
  AggregateQuerySnapshot<
    { count: AggregateField<number> },
    AppModelType,
    DbModelType
  >
>;

/**
 * Retrieves all documents matching the query from the local cache.
 * Will throw an error if documents are not cached.
 *
 * @param query - The Oracledb query to execute from cache.
 * @returns Promise<QuerySnapshot> - Contains all cached documents matching the query.
 *
 * @example
 * const cachedSnap = await getDocsFromCache(userQuery);
 * cachedSnap.forEach(doc => console.log(doc.id, doc.data()));
 */
export declare function getDocsFromCache<AppModelType, DbModelType extends DocumentData>(
  query: Query<AppModelType, DbModelType>
): Promise<QuerySnapshot<AppModelType, DbModelType>>;