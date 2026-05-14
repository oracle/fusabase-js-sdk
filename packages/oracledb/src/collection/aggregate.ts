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

import { AggregateType, AggregateSpec , DocumentData } from '../types/common.js';
import { FieldPath } from '../field/path.js';
import { argCheck, typeStrings } from '../../../auth/src/errors.js';
import { Utils,oracledbErrorHandler,QueryHelper,getAccessToken } from '../util/utils.js';
import { Query } from './reference.js';

export class AggregateField<T = unknown> {
  readonly type: string;
  readonly aggregateType: AggregateType;
  readonly field: string;

  /**
   * (Private) Creates a new `AggregateField` instance.
   *
   * @param field - Field name.
   * @param op - Aggregate operation.
   */
  constructor(field: string, op: AggregateType) {
    this.type = "AggregateField";
    this.aggregateType = op;
    this.field = field;
  }

  /**
   * Creates a `AggregateField` instance for sum operation.
   * @param field - Field name.
   * @returns A new `AggregateField` instance.
   */
  /** @internal */
  static sum<T = unknown>(field: string | FieldPath): AggregateField<T> {
    if (field instanceof FieldPath) {
      field = field.fullPath;
    }
    argCheck(field, "Invalid field provided in AggregateField.", true, [typeStrings.STRING]);
    return new AggregateField<T>(field, "sum");
  }

  /**
   * Creates a `AggregateField` instance for average operation.
   * @param field - Field name.
   * @returns A new `AggregateField` instance.
   */
  /** @internal */
  static average<T = unknown>(field: string | FieldPath): AggregateField<T> {
    if (field instanceof FieldPath) {
      field = field.fullPath;
    }
    argCheck(field, "Invalid field provided in AggregateField.", true, [typeStrings.STRING]);
    return new AggregateField<T>(field, "average");
  }

  /**
   * Creates a `AggregateField` instance for count operation.
   * @returns A new `AggregateField` instance.
   */
  /** @internal */
  static count<T = unknown>(): AggregateField<T> {
    return new AggregateField<T>("", "count");
  }

  /**
   * Checks whether this `AggregateField` is equal to the provided one.
   * @param other - AggregateField that needs to be compared.
   * @return Returns true if both AggregateField instances are the same.
   * @throws OracledbError if other is not an AggregateField instance.
   */
  /** @internal */
  isEqual(other: AggregateField<T>): boolean {
    if (!(other instanceof AggregateField)) {
      const error = new Error("The other instance to be compared should be an instance of AggregateField.");
      (error as any).status = 400;
      throw oracledbErrorHandler(error);
    }
    return other.field === this.field && other.aggregateType === this.aggregateType;
  }
}

/**
 * AggregateQuery - Query class to store aggregate queries.
 */
export class AggregateQuery<AppModelType = DocumentData, DbModelType extends DocumentData = DocumentData> {
  #query: Query<AppModelType, DbModelType>;
  #queryHelper: QueryHelper;

  constructor(q: Query<AppModelType, DbModelType>, obj?: any) {
    this.#queryHelper = new QueryHelper(q.oracledb.app);
    this.#query = q;
    if (obj && this.#query) {
      this.#query.addAggregate(obj);
    }
  }

  /**
   * Returns the underlying query over which the aggregations are applied.
   *
   * @returns {Query} Underlying query.
   */
  get query(): Query<AppModelType, DbModelType> {
    return this.#query;
  }

  /**
   * Checks whether this `AggregateQuery` is equal to the provided one.
   *
   * @param {AggregateQuery} q Query that needs to be compared.
   * @return {boolean} Returns true if both queries are the same.
   * @throws {OracledbError} Throws an error if q is not a AggregateQuery instance.
   */
  isEqual(q: AggregateQuery): boolean {
    if (!(q instanceof AggregateQuery)) {
      const error: any = new Error(
        "The other instance to be compared should be an instance of AggregateQuery."
      );
      error.status = 400;
      throw oracledbErrorHandler(error);
    }
    return this.#query.isEqual(q.query);
  }

  /**
   * Executes the aggregate query and gets the result.
   *
   * @return {Promise<AggregateQuerySnapshot>} Returns snapshot of query result.
   * @throws {OracledbError} Throws an error if requests fails.
   */
  /**
   * @internal
   */
  async get(): Promise<AggregateQuerySnapshot<any, AppModelType, DbModelType> | null> {
    let promJson: any;
    let result: AggregateQuerySnapshot<any, AppModelType, DbModelType> | null = null;
  const access_token = await getAccessToken(this.#query.oracledb.app);
  try {
    promJson = await this.#queryHelper.fetchDocuments(this.#query as any, access_token ?? undefined);
  } catch (err) {
    Utils.baasTrace(this.#query.oracledb.app.logLevel);
    throw oracledbErrorHandler(err);
  }
      if (promJson) {
        result = new AggregateQuerySnapshot<any, AppModelType, DbModelType>(this.#query, promJson["ret"][0]["result"]);
      }
      return result;
    }
}

export class AggregateQuerySnapshot<
  AggregateSpecType extends AggregateSpec,
  AppModelType = DocumentData,
  DbModelType extends DocumentData = DocumentData
> implements AggregateQuerySnapshot<AggregateSpecType, AppModelType, DbModelType>
{
  readonly query: Query<AppModelType, DbModelType>;
  private _data: {
    [K in keyof AggregateSpecType]: AggregateSpecType[K] extends AggregateSpec ? number : never;
  };
  readonly type: string;

  /**
   * Creates a new `AggregateQuerySnapshot` instance.
   *
   * @param q - Underlying query.
   * @param data - Data received after query execution.
   */
  constructor(
    q: Query<AppModelType, DbModelType>,
    data: {
      [K in keyof AggregateSpecType]: AggregateSpecType[K] extends AggregateSpec ? number : never;
    }
  ) {
    this._data = data;
    this.query = q;
    this.type = "AggregateQuerySnapshot";
  }

  /**
   * Returns the results of the aggregations performed over the underlying query.
   * The keys of the returned object will match the keys of the AggregateSpec used to generate this snapshot.
   */
  data(): {
    [K in keyof AggregateSpecType]: AggregateSpecType[K] extends AggregateSpec ? number : never;
  } {
    return this._data;
  }

  /**
   * Checks whether this `AggregateQuerySnapshot` is equal to the provided one.
   *
   * @param snap Snapshot to compare from.
   * @return Returns true if both snapshots are the same.
   * @throws OracledbError if `snap` is not an AggregateQuerySnapshot instance.
   */
  isEqual(
    snap: AggregateQuerySnapshot<AggregateSpecType, AppModelType, DbModelType>
  ): boolean {
    if (!(snap instanceof AggregateQuerySnapshot)) {
      const error = new Error(
        "The other instance to be compared should be an instance of AggregateQuerySnapshot."
      );
      (error as any).status = 400;
      throw oracledbErrorHandler(error);
    }
    let res = snap.query.isEqual(this.query);
    if (!res) {
      return false;
    }
    return JSON.stringify(snap.data()) === JSON.stringify(this.data());
  }
}
