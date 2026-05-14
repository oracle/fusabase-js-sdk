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

// collection/aggregate.d.ts

import { AggregateType , AggregateSpec , DocumentData} from '../types/common.js';
import { Query } from './query.js';

/**
 * Represents an aggregation operation that can be performed on a Oracledb query.
 *
 * @template T - The type of the aggregation result.
 *
 * @example
 * ```ts
 * import { count, AggregateField } from 'fusabase/oracledb';
 *
 * const countField: AggregateField<number> = count();
 * ```
 */

export declare class AggregateField<T> {
  /**
   * Indicates the aggregation operation of this AggregateField.
   * Examples: 'count', 'sum', 'average'.
   */
  readonly aggregateType: AggregateType;

  /**
   * A unique type string identifying this instance.
   */
  readonly type: string;
}

export declare class AggregateQuery {
  /** Creates a new AggregateQuery. */
  constructor(q: Query, obj?: any);

  /** Returns the underlying query over which aggregations are applied. */
  get query(): Query;

  /**
   * Checks whether this AggregateQuery is equal to another.
   * @throws {Error} if argument is not AggregateQuery.
   */
  isEqual(q: AggregateQuery): boolean;
  /**
   * Executes the aggregate query and gets the result.
   * @throws {Error} if request fails.
   */
  get(): Promise<AggregateQuerySnapshot<AggregateSpec> | null>;
}

/**
 * Represents the results of executing an aggregation query on a Oracledb collection or query.
 *
 * @template AggregateSpecType - The specification of aggregations requested.
 * @template AppModelType - The type of application model data returned.
 * @template DbModelType - The type of Oracledb stored data.
 *
 * @example
 * ```ts
 * import { AggregateQuerySnapshot, count, query, collection } from 'fusabase/oracledb';
 *
 * const usersQuery = query(collection(db, 'users'));
 * const aggregateSnapshot: AggregateQuerySnapshot<{ total: ReturnType<typeof count> }> = await getAggregateFromServer(usersQuery, { total: count() });
 * const data = aggregateSnapshot.data();
 * console.log(data.total); // prints total count of documents
 * ```
 */
export declare class AggregateQuerySnapshot<
  AggregateSpecType extends AggregateSpec,
  AppModelType = DocumentData,
  DbModelType extends DocumentData = DocumentData
> {
  /**
   * The underlying query over which the aggregations were performed.
   */
  readonly query: Query<AppModelType, DbModelType>;

  /**
   * A type string uniquely identifying this instance.
   */
  readonly type: string;

  /**
   * Returns the results of the aggregations performed over the underlying query.
   *
   * The keys of the returned object will match the keys of the AggregateSpec used to generate this snapshot.
   */
  data(): {
    [K in keyof AggregateSpecType]: AggregateSpecType[K] extends AggregateSpec ? number : never;
  };
}

