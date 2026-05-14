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
import { AggregateField } from '../collection/aggregate.js';
import { Query } from '../collection/reference.js';
import { QueryConstraint,QueryCompositeFilterConstraint,QueryEndAtConstraint,QueryFieldFilterConstraint,QueryFieldJoinsConstraint,
  QueryLimitConstraint,QueryOrderByConstraint,QueryStartAtConstraint, QueryVectorSearchConstraint
 } from '../collection/constraint.js';
 import { FieldPath } from '../field/path.js';
 import { OrderByDirection } from '../types/common.js';
 import { QueryFilterConstraint } from '../types/common.js';
 import { FieldValue } from '../field/value.js';
import { VectorMetric, VectorSearchQuery } from '../types/vector.js';
/**
 * Creates a new query instance by applying a composite filter and additional constraints to an existing query.
 *
 * @param query - The base Query instance to apply constraints to.
 * @param compositeFilter - A composite filter (created with `and()` or `or()`) to filter documents.
 * @param queryConstraints - Additional constraints such as `orderBy()`, `limit()`.
 * @returns A new Query instance with the applied constraints.
 *
 * @example
 * const activeUsersQuery = query(
 *   usersQuery,
 *   and(where('status', '==', 'active'), where('age', '>=', 18)),
 *   orderBy('createdAt', 'desc'),
 *   limit(10)
 * );
 */
export declare function query<AppModelType, DbModelType extends DocumentData>(
  query: Query<AppModelType, DbModelType>,
  compositeFilter: QueryCompositeFilterConstraint,
  ...queryConstraints: QueryFieldFilterConstraint[]
): Query<AppModelType, DbModelType>;

/**
 * Creates a new query instance by applying one or more query constraints to an existing query.
 *
 * @param query - The base Query instance to apply constraints to.
 * @param queryConstraints - One or more constraints (e.g., `where()`, `orderBy()`, `limit()`).
 * @returns A new Query instance with the applied constraints.
 *
 * @example
 * const recentUsersQuery = query(
 *   usersQuery,
 *   where('status', '==', 'active'),
 *   orderBy('createdAt', 'desc'),
 *   limit(5)
 * );
 */
export declare function query<AppModelType , DbModelType extends DocumentData>(
  query: Query<AppModelType, DbModelType>,
  ...queryConstraints: QueryConstraint[]
): Query<AppModelType, DbModelType>;


/**
 * Creates a QueryOrderByConstraint that sorts the query result by the specified field,
 * optionally in descending order instead of ascending.
 *
 * Documents that do not contain the specified field will not be present in the query result.
 */
export declare function orderBy(
  fieldPath: string | FieldPath,
  directionStr?: OrderByDirection
): QueryOrderByConstraint;



/**
 * Creates a QueryFieldFilterConstraint that enforces that documents must contain
 * the specified field and that the value should satisfy the relation constraint provided.
 */
export declare function where(
  fieldPath: string | FieldPath,
  opStr: WhereFilterOp,
  value: unknown
): QueryFieldFilterConstraint;

/**
 * Defines valid filter operators for Oracledb queries.
 */
export type WhereFilterOp =
  | '<'
  | '<='
  | '=='
  | '!='
  | '>='
  | '>'
  | 'array-contains'
  | 'in'
  | 'not-in'
  | 'array-contains-any';


/**
 * Creates a limit constraint for a Oracledb query.
 *
 * - Restricts the maximum number of documents returned by the query.
 * - The documents are returned starting from the beginning of the result set,
 *   according to the querys ordering (or natural order if no explicit ordering).
 *
 * Example:
 *   // Get the first 5 users ordered by age
 *   const q = query(usersRef, orderBy("age"), limit(5));
 */
export declare function limit(limit: number): QueryLimitConstraint;

/**
 * Creates a limit-to-last constraint for a Oracledb query.
 *
 * - Restricts the maximum number of documents returned by the query.
 * - Instead of returning documents from the beginning of the result set,
 *   it returns the **last N documents**, according to the querys ordering.
 *
 *
 * Example:
 *   // Get the last 5 users ordered by signup date
 *   const q = query(usersRef, orderBy("signupDate"), limitToLast(5));
 */
export declare function limitToLast(limit: number): QueryLimitConstraint;


/**
 * Creates a QueryStartAtConstraint that modifies the result set to start at
 * the provided fields relative to the order of the query.
 *
 * The order of the field values must match the order of the
 * `orderBy` clauses of the query.
 *
 * @param fieldValues - The field values to start this query at,
 *                      in order of the query's order by.
 * @returns A QueryStartAtConstraint to pass to `query()`.
 */
export declare function startAt(
  ...fieldValues: unknown[]
): QueryStartAtConstraint;
/**
 * Creates a QueryStartAtConstraint that modifies the result set to start after
 * the provided fields relative to the order of the query.
 *
 * The order of the field values must match the order of the
 * `orderBy` clauses of the query.
 *
 * @param fieldValues - The field values to start this query after,
 *                      in order of the query's order by.
 * @returns A QueryStartAtConstraint to pass to `query()`.
 */
export declare function startAfter(
  ...fieldValues: unknown[]
): QueryStartAtConstraint;

export declare function endAt(
  ...fieldValues: unknown[]
): QueryStartAtConstraint;

/**
 * Creates a QueryEndAtConstraint that modifies the result set to end before
 * the provided fields relative to the order of the query.
 *
 * The order of the field values must match the order of the
 * `orderBy` clauses of the query.
 *
 * @param fieldValues - The field values to end this query before,
 *                      in order of the query's order by.
 * @returns A QueryEndAtConstraint to pass to `query()`.
 */
export declare function endBefore(
  ...fieldValues: unknown[]
): QueryEndAtConstraint;


// /**
//  * Creates a composite filter using a logical OR.
//  * 
//  * - Combines multiple QueryFilterConstraints into a single condition.
//  * - A document matches if **any one** of the constraints is satisfied.
//  * - Constraints can be created using where(), or(), or and().
//  * 
//  * Example:
//  *   const filter = or(
//  *     where("city", "==", "Mumbai"),
//  *     where("city", "==", "Delhi")
//  *   );
//  */
// export declare function or(
//   ...queryConstraints: QueryFilterConstraint[]
// ): QueryCompositeFilterConstraint;


/**
 * Creates a special value that can be used with setDoc(), updateDoc(),
 * or write batch operations to remove one or more elements from an array field.
 *
 * - If the array contains the given element(s), all instances are removed.
 * - If the array does not contain the element(s), nothing happens.
 * - If the field does not yet exist, it is treated as an empty array.
 *
 * Example:
 *   // Remove a tag from the 'tags' array field
 *   await updateDoc(docRef, {
 *     tags: arrayRemove("obsolete")
 *   });
 *
 * @param elements The elements to remove from the array.
 * @returns A special FieldValue sentinel for removing elements.
 */
export declare function arrayRemove(...elements: unknown[]): FieldValue;

/**
 * Creates a special value that can be used with setDoc(), updateDoc(),
 * or write batch operations to add one or more elements to an array field.
 *
 * - If the array does not contain the given element(s), they are added.
 * - If the array already contains the element(s), they are not duplicated.
 * - If the field does not yet exist, it is created as a new array with the given element(s).
 *
 * Example:
 *   // Add a tag to the 'tags' array field
 *   await updateDoc(docRef, {
 *     tags: arrayUnion("new-feature")
 *   });
 *
 * @param elements The elements to add into the array.
 * @returns A special FieldValue sentinel for adding elements.
 */
export declare function arrayUnion(...elements: unknown[]): FieldValue;

/**
 * Returns true if the two queries are equal (target the same data).
 */
export declare function queryEqual<AppModelType, DbModelType extends DocumentData>(
  left: Query<AppModelType, DbModelType>,
  right: Query<AppModelType, DbModelType>
): boolean;


/**
 * Creates a join constraint for use in a query.
 * @param viewName - The name of the view to join with.
 * @returns A QueryFieldJoinsConstraint instance representing the join.
 */
export declare function join(viewName: string): QueryFieldJoinsConstraint;

export declare function findNearest(
  field: string,
  query: VectorSearchQuery,
  options?: { metric?: VectorMetric; topK?: number; threshold?: number }
): QueryVectorSearchConstraint;