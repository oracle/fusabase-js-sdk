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

import { Oracledb } from "../internal/core";
import { FieldPath } from "../field/path";

/**
 * Represents a bulk update operation on a collection.
 */
export class BulkUpdate <
  AppModelType = DocumentData,
  DbModelType extends DocumentData = DocumentData
> {
  /**
   * Creates a new `BulkUpdate` instance.
   *
   * @param db - Database instance.
   * @param path - Path to the collection for bulk update.
   */
  constructor(db: any, path: string);

  /**
   * Returns the path of the collection.
   */
  readonly path: string;

  /**
   * Checks whether this `BulkUpdate` is equal to the provided one.
   *
   * @param other - BulkUpdate that needs to be compared.
   * @returns true if both BulkUpdate instances are the same.
   */
  isEqual(other: BulkUpdate<any, any>): boolean;

  /**
   * Adds a condition to filter documents for the bulk update.
   *
   * @param field - Field name.
   * @param opStr - Operator to be used with where.
   * "==", ">=", "<=", "<", ">", "in", "not-in", "like", "!=",
   * "array-contains", "array-contains-any", "is-null"
   * (supported operators)
   * @param fieldValue - Value to be used while applying operator.
   * @returns this BulkUpdate instance for chaining.
   */
  where(field: string | FieldPath, opStr: string, fieldValue: any): BulkUpdate<AppModelType, DbModelType>;

  /**
   * Updates fields for the documents in the collection that match the where conditions.
   */
  
  update(data: Object): Promise<void>;
  update(field: string | FieldPath, value: any, ...fieldValues: any[]): Promise<void>;
}