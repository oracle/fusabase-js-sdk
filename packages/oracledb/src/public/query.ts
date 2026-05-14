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
import { CollectionReference } from '../collection/reference.js';
import { DualityViewColReference } from '../collection/reference.js';
import { Query } from '../collection/reference.js';
import { QueryCompositeFilterConstraint,QueryEndAtConstraint,QueryFieldFilterConstraint,QueryFieldJoinsConstraint,
  QueryLimitConstraint,QueryOrderByConstraint,QueryStartAtConstraint, QueryVectorSearchConstraint
 } from '../collection/constraint.js';
 import { FieldPath } from '../field/path.js';
 import { OrderByDirection } from '../types/common.js';
 import { oracledbErrorHandler } from '../util/utils.js';
 import { serializeCompositeFilter } from '../util/utils.js';
import { WhereFilterOp } from '../types/common.js';
import { VectorMetric, VectorSearchQuery } from '../types/vector.js';
import { argCheck, typeStrings, validateVectorSearchQuery } from '../util/utils.js';

/**
 * Builds a query from a base query and a sequence of constraints, and/or a composite filter.
 */
export function query<
  AppModelType ,
  DbModelType extends DocumentData
>(
  quer: Query<AppModelType, DbModelType> | CollectionReference<AppModelType, DbModelType> | DualityViewColReference<AppModelType>,
  ...args: any[]
): Query<AppModelType, DbModelType> {

  let j = 0;
  let quer_composite_cons: any[] = [];
  let quer_cons_where: any[] = [];
  let quer_cons_order: any[] = [];
  let quer_cons_limit: any[] = [];
  let quer_cons_rem: any[] = [];

  // Handle composite filter
  if (args[0] && args[0] instanceof QueryCompositeFilterConstraint) {
    quer_composite_cons = serializeCompositeFilter(args[0]);
    j = 1;
  }
  for (let i = j; i < args.length; i++) {
    if (args[i] instanceof QueryFieldFilterConstraint) {
      quer_cons_where.push(args[i]);
    } else if (args[i] instanceof QueryOrderByConstraint) {
      quer_cons_order.push(args[i]);
    } else if (args[i] instanceof QueryLimitConstraint) {
      quer_cons_limit.push(args[i]);
    } else {
      quer_cons_rem.push(args[i]);
    }
  }

  let new_quer: any = quer;

  if (quer_composite_cons.length > 0) {
    for (let i = 0; i < quer_composite_cons.length; i++) {
      new_quer._conditions.push(quer_composite_cons[i]);
    }
  } else {
    for (let i = 0; i < quer_cons_where.length; i++) {
      new_quer = new_quer.where(
        quer_cons_where[i].__cons.path,
        quer_cons_where[i].__cons.opStr,
        quer_cons_where[i].__cons.value
      );
    }
  }

  for (let i = 0; i < quer_cons_order.length; i++) {
    new_quer = new_quer.orderBy(
      quer_cons_order[i].__cons.path,
      quer_cons_order[i].__cons.direction
    );
  }

  for (let i = 0; i < quer_cons_limit.length; i++) {
    if (quer_cons_limit[i].type === 'limit') {
      new_quer = new_quer.limit(quer_cons_limit[i].__cons);
    } else {
      new_quer = new_quer.limitToLast(quer_cons_limit[i].__cons);
    }
  }

  for (let i = 0; i < quer_cons_rem.length; i++) {
    if (quer_cons_rem[i] instanceof QueryEndAtConstraint) {
      if (quer_cons_rem[i].type === 'endAt') {
        new_quer = new_quer.endAt(...quer_cons_rem[i].__cons);
      } else {
        new_quer = new_quer.endBefore(...quer_cons_rem[i].__cons);
      }
    } else if (quer_cons_rem[i] instanceof QueryStartAtConstraint) {
      if (quer_cons_rem[i].type === 'startAt') {
        new_quer = new_quer.startAt(...quer_cons_rem[i].__cons);
      } else {
        new_quer = new_quer.startAfter(...quer_cons_rem[i].__cons);
      }
    } else if (quer_cons_rem[i] instanceof QueryFieldJoinsConstraint) {
      new_quer = new_quer.join(quer_cons_rem[i].__cons.view_name);
    } else if (quer_cons_rem[i] instanceof QueryVectorSearchConstraint) {
      new_quer = new_quer.withVectorSearch(quer_cons_rem[i].__cons);
    }
  }

  return new_quer;
}

/**
 * Creates a QueryOrderByConstraint that sorts the query result by the specified field,
 * optionally in descending order instead of ascending.
 *
 * Documents that do not contain the specified field will not be present in the query result.
 */
export function orderBy(
  fieldPath: string | FieldPath,
  directionStr: OrderByDirection = 'asc'
): QueryOrderByConstraint {
  return new QueryOrderByConstraint({
    path: fieldPath,
    direction: directionStr
  });
}

/**
 * Creates a QueryFieldFilterConstraint that enforces that documents must contain
 * the specified field and that the value should satisfy the relation constraint provided.
 */
export function where(
  fieldPath: string | FieldPath,
  opStr: WhereFilterOp,
  value: unknown
): QueryFieldFilterConstraint {
  return new QueryFieldFilterConstraint({
    path: fieldPath,
    opStr,
    value
  });
}


/**
 * Creates a limit constraint for a Oracledb query.
 *
 * - Restricts the maximum number of documents returned by the query.
 * - The documents are returned starting from the beginning of the result set,
 *   according to the query's ordering (or natural order if no explicit ordering).
 *
 * @example
 *   // Get the first 5 users ordered by age
 *   const q = query(usersRef, orderBy("age"), limit(5));
 */
export function limit(limit: number): QueryLimitConstraint {
  return new QueryLimitConstraint('limit', limit);
}

/**
 * Creates a limit-to-last constraint for a Oracledb query.
 *
 * - Restricts the maximum number of documents returned by the query.
 * - Instead of returning documents from the beginning of the result set,
 *   it returns the last N documents, according to the query's ordering.
 *
 * @example
 *   // Get the last 5 users ordered by signup date
 *   const q = query(usersRef, orderBy("signupDate"), limitToLast(5));
 */
export function limitToLast(limit: number): QueryLimitConstraint {
  return new QueryLimitConstraint('limitToLast', limit);
}

/**
 * Creates an 'endAt' query constraint.
 */
export function endAt(...fieldValues: unknown[]): QueryEndAtConstraint {
  const cons: unknown[] = [...fieldValues];
  return new QueryEndAtConstraint('endAt', cons);
}

/**
 * Creates an 'endBefore' query constraint.
 */
export function endBefore(...fieldValues: unknown[]): QueryEndAtConstraint {
  const cons: unknown[] = [...fieldValues];
  return new QueryEndAtConstraint('endBefore', cons);
}

/**
 * Creates a 'startAt' query constraint.
 */
export function startAt(...fieldValues: unknown[]): QueryStartAtConstraint {
  const cons: unknown[] = [...fieldValues];
  return new QueryStartAtConstraint('startAt', cons);
}

/**
 * Creates a 'startAfter' query constraint.
 */
export function startAfter(...fieldValues: unknown[]): QueryStartAtConstraint {
  const cons: unknown[] = [...fieldValues];
  return new QueryStartAtConstraint('startAfter', cons);
}

/**
 * Returns true if the two queries are equal (target the same data).
 *
 * @param left - First query
 * @param right - Second query
 * @returns true if the queries are logically equal
 */
export function queryEqual<AppModelType, DbModelType extends DocumentData>(
  left: Query<AppModelType, DbModelType>,
  right: Query<AppModelType, DbModelType>
): boolean {
  return left.isEqual(right);
}

/**
 * Creates a join constraint for use in a query.
 * @param viewName - The name of the view to join with.
 * @returns A QueryFieldJoinsConstraint instance representing the join.
 */
export function join(viewName: string): QueryFieldJoinsConstraint {
  return new QueryFieldJoinsConstraint({
    view_name: viewName,
  });
}

/**
 * Creates a vector similarity query constraint for v2 runQuery.
 *
 * @example
 * const q = query(
 *   collection(db, "docs"),
 *   findNearest("EMB", { vector: [0.22, 0.93, -0.1] }, { metric: "COSINE", topK: 10 })
 * );
 * const snap = await getDocs(q);
 *
 * @example
 * const qSparse = query(
 *   collection(db, "docs"),
 *   findNearest(
 *     "EMB",
 *     { sparse: { type: "sparse", dimension: 1000, indices: [2, 7, 900], values: [0.9, 0.3, 0.5] } },
 *     { metric: "DOT", topK: 5 }
 *   )
 * );
 * const sparseSnap = await getDocs(qSparse);
 */
export function findNearest(
  field: string,
  query: VectorSearchQuery,
  options?: { metric?: VectorMetric; topK?: number; threshold?: number }
): QueryVectorSearchConstraint {
  argCheck(field, "Invalid vector search field", true, [typeStrings.STRING]);
  validateVectorSearchQuery(query);
  if (options?.topK != null && (!Number.isInteger(options.topK) || options.topK <= 0)) {
    const error: any = new Error("findNearest topK must be a positive integer.");
    error.status = 400;
    throw oracledbErrorHandler(error);
  }
  if (options?.threshold != null && typeof options.threshold !== "number") {
    const error: any = new Error("findNearest threshold must be a number.");
    error.status = 400;
    throw oracledbErrorHandler(error);
  }
  return new QueryVectorSearchConstraint({
    field,
    query,
    metric: options?.metric,
    topK: options?.topK,
    threshold: options?.threshold,
  });
}