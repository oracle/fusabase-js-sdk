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

import {QueryConstraintType} from '../types/common.js';
import { VectorSearch } from '../types/vector.js';

/**
 * Abstract base class representing a query constraint in Oracledb.
 * All specific query constraints (like where, orderBy, limit, etc.) extend this class.
 *
 * You do not create instances of this class directly. Instead, use the
 * provided functions such as `where()`, `orderBy()`, `limit()`, etc.
 *
 * @example
 * ```ts
 * const q = query(
 *   collection(db, 'users'),
 *   where('age', '>=', 18),
 *   orderBy('age', 'desc'),
 *   limit(10)
 * );
 * ```
 */
export declare abstract class QueryConstraint {
  
  /**
   * The type of this query constraint.
   * Determines how Oracledb applies the constraint.
   */
  type: QueryConstraintType;
}


/**
 * Represents a composite filter in Oracledb queries, which can combine multiple
 * field filters using a logical "and" or "or".
 *
 * Use `and()` or `or()` functions to create instances of this class.
 *
 * @example
 * ```ts
 * const compositeFilter = and([
 *   where('age', '>=', 18),
 *   where('verified', '==', true)
 * ]);
 * const queryRef = query(collection(db, 'users'), compositeFilter);
 * ```
 */
export declare class QueryCompositeFilterConstraint {

  /**
   * The type of this composite filter.
   * Can be 'and' for conjunction or 'or' for disjunction.
   */
  type: 'or' | 'and';
}

/**
 * QueryEndAtConstraint is used to specify where a query should end.
 * It can either end **at** a document/field or **before** a document/field.
 *
 * @example
 * ```ts
 * const q = query(collection(db, 'users'), endAt(lastDoc));
 * ```
 */
export declare class QueryEndAtConstraint extends QueryConstraint {
  /** The type of this query constraint */
  type: 'endBefore' | 'endAt';
}

/**
 * QueryFieldFilterConstraint represents a filter constraint applied to a query,
 * such as where('age', '>=', 18).
 *
 * @example
 * ```ts
 * const q = query(collection(db, 'users'), where('age', '>=', 18));
 * ```
 */
export declare class QueryFieldFilterConstraint extends QueryConstraint {
  /** Type of this constraint (internal) */
  type: QueryConstraintType;
}

/**
 * QueryLimitConstraint is used to limit the number of results returned by a query.
 * Can be used with limit() or limitToLast().
 *
 * @example
 * ```ts
 * const q = query(collection(db, 'users'), limit(10));
 * const q2 = query(collection(db, 'users'), limitToLast(5));
 * ```
 */
export declare class QueryLimitConstraint extends QueryConstraint {
  /** The type of this query constraint */
  type: 'limit' | 'limitToLast';
}

/**
 * QueryOrderByConstraint is used to sort the results of a query.
 * Created by orderBy() and added to a query.
 *
 * @example
 * ```ts
 * const q = query(collection(db, 'users'), orderBy('lastName', 'asc'));
 * ```
 */
export declare class QueryOrderByConstraint extends QueryConstraint {
  /** Type of this constraint (internal) */
  type: QueryConstraintType;
}

export declare class QueryStartAtConstraint extends QueryConstraint {
  /** The type of this query constraint */
  type: 'startAt' | 'startAfter';
}

/**
 * QueryFieldJoinsConstraint allows joining on fields.
 */
export declare class QueryFieldJoinsConstraint extends QueryConstraint {
  /** Type of this constraint (internal) */
  readonly type: QueryConstraintType;
}

export declare class QueryVectorSearchConstraint extends QueryConstraint {
  readonly type: 'vectorSearch';
}