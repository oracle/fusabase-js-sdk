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
 * Create an AggregateField object that can be used to compute
 * the sum of a specified field over a range of documents in
 * the result set of a query.
 *
 * @param field - Specifies the field to sum across the result set.
 *                Can be a string field name or a FieldPath object.
 * @returns An AggregateField<number>
 */
export declare function count(
  field: string | FieldPath
): AggregateField<number>;

/**
 * Create an AggregateField object that can be used to compute
 * the sum of a specified field over a range of documents in
 * the result set of a query.
 *
 * @param field - Specifies the field to sum across the result set.
 *                Can be a string field name or a FieldPath object.
 * @returns An AggregateField<number>
 */
export declare function sum(
  field: string | FieldPath
): AggregateField<number>;

/**
 * Create an AggregateField object that can be used to compute
 * the average of a specified field over a range of documents in
 * the result set of a query.
 *
 * @param field - Specifies the field to average across the result set.
 *                Can be a string field name or a FieldPath object.
 * @returns An AggregateField<number | null>
 */
export declare function average(
  field: string | FieldPath
): AggregateField<number | null>;


/** Compares two AggregateField objects */
export declare function aggregateFieldEqual(left: AggregateField, right: AggregateField): boolean;

/** Compares two AggregateQuerySnapshot objects */
export declare function aggregateQuerySnapshotEqual(
  left: AggregateQuerySnapshot,
  right: AggregateQuerySnapshot
): boolean;
