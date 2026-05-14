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

import { FieldPath } from "../field/path.js";
import { AggregateField } from "../collection/aggregate.js";
import { AggregateQuerySnapshot } from "../collection/aggregate.js";
import { AggregateSpec, DocumentData } from "../types/common.js";
/**
 * Create an AggregateField object that can be used to compute
 * the count of documents in the result set of a query.
 * @returns An AggregateField<number>
 */
export function count(
): AggregateField<number> {
  // Some systems may allow count('field') (for counts of non-null field values), but often just plain count()
  // For max compatibility, support the field param if the backend does;
  // otherwise ignore it if not provided.
  return AggregateField.count();
}

/**
 * Create an AggregateField object that can be used to compute
 * the sum of a specified field over a range of documents in
 * the result set of a query.
 * @param field - Specifies the field to sum across the result set.
 *                Can be a string field name or a FieldPath object.
 * @returns An AggregateField<number>
 */
export function sum(
  field: string | FieldPath
): AggregateField<number> {
  return AggregateField.sum(field);
}

/**
 * Create an AggregateField object that can be used to compute
 * the average of a specified field over a range of documents in
 * the result set of a query.
 * @param field - Specifies the field to average across the result set.
 *                Can be a string field name or a FieldPath object.
 * @returns An AggregateField<number | null>
 */
export function average(
  field: string | FieldPath
): AggregateField<number | null> {
  return AggregateField.average(field);
}

/**
 * Checks if two AggregateField objects are equal.
 * @param left - The first AggregateField.
 * @param right - The second AggregateField.
 * @returns `true` if equal, otherwise `false`.
 */
export function aggregateFieldEqual(
  left: AggregateField,
  right: AggregateField
): boolean {
  return left.isEqual(right);
}

/**
 * Compares two AggregateQuerySnapshot objects for equality.
 * @param left - The first AggregateQuerySnapshot.
 * @param right - The second AggregateQuerySnapshot.
 * @returns True if both snapshots are equal, otherwise false.
 */
export function aggregateQuerySnapshotEqual
<AggregateSpecType extends AggregateSpec, AppModelType,
 DbModelType extends DocumentData>
 (left: AggregateQuerySnapshot<AggregateSpecType, AppModelType, DbModelType>, 
  right: AggregateQuerySnapshot<AggregateSpecType, AppModelType, DbModelType>): boolean {
  return left.isEqual(right);
}