/// Copyright (c) 2015, 2025, Oracle and/or its affiliates.

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
 * `FieldValue` represents sentinel values used in Oracledb document writes
 * (via `setDoc` or `updateDoc`) for special behaviors such as deletion,
 * server-generated timestamps, array operations, or numeric increments.
 *
 * This class is abstract; do not instantiate directly.
 *
 * @example
 * ```ts
 * import { doc, updateDoc, deleteField, serverTimestamp, arrayUnion, increment, FieldValue } from 'fusabase/oracledb';
 *
 * const docRef = doc(db, 'users', 'uid123');
 *
 * await updateDoc(docRef, {
 *   middleName: deleteField(),
 *   lastUpdated: serverTimestamp(),
 *   roles: arrayUnion('admin'),
 *   loginCount: increment(1)
 * });
 * ```
 */
/**
 * Represents an operation for a field value to be applied to the server.
 */
export declare class FieldValue {
  private constructor();
  
  /**
   * Gets the value associated with this operation.
   */
  /**
   * @internal
   */
  get value(): any;

  /**
   * Gets the operation type string.
   */
  /**
   * @internal
   */
  get operation(): string;

  /**
   * Compares this `FieldValue` with another.
   * @param other Another `FieldValue` instance
   * @returns True if both represent the same operation and value.
   */
  isEqual(other: FieldValue): boolean;

  /**
   * Creates a `FieldValue` for removing elements from an array.
   * @param elements Elements to be removed.
   */
  /**
   * @internal
   */
  static arrayRemove(...elements: any[]): FieldValue;

  /**
   * Creates a `FieldValue` for adding elements to an array (union).
   * @param elements Elements to be added (union).
   */
  /**
   * @internal
   */
  static arrayUnion(...elements: any[]): FieldValue;

  /**
   * Creates a `FieldValue` for deleting a field.
   */
  /**
   * @internal
   */
  static delete(): FieldValue;

  /**
   * Creates a `FieldValue` for incrementing a numeric field.
   * @param value Amount to increment by.
   */
  /**
   * @internal
   */
  static increment(value: number): FieldValue;

  /**
   * Creates a `FieldValue` for setting a server timestamp.
   */
  /**
   * @internal
   */
  static serverTimestamp(): FieldValue;

  /**
   * (Private) Use the static methods instead of calling the constructor directly.
   * @hidden
   */
  // Private constructor -- not for direct use
  /**
   * @internal
   */
  private constructor(op: string, value: any);
}

/**
 * Represents a point in time with seconds and nanoseconds precision.
 */
export declare class Timestamp {
  /**
   * Gets the seconds part of the timestamp.
   */
  get seconds(): number;

  /**
   * Gets the nanoseconds part of the timestamp.
   */
  get nanoseconds(): number;

  /**
   * Creates a new Timestamp.
   * @throws If out-of-range arguments provided.
   */
  constructor(seconds: number, nanoseconds: number);

  /**
   * Returns a JS Date object representing this timestamp.
   */
  toDate(): Date;

  /**
   * Compares this Timestamp to another.
   * @throws If the argument is not a Timestamp.
   */
  isEqual(other: Timestamp): boolean;

  /**
   * Returns this time as milliseconds since Unix epoch.
   */
  toMillis(): number;

  /**
   * Returns a string "seconds.nanoseconds".
   */
  valueOf(): string;

  /**
   * Returns an ISO8601 string with microsecond precision.
   */
  /**
   * @internal
   */
  toTimestampString(): string;

  /**
   * Returns string representation of this Timestamp (ISO8601, microseconds).
   */
  toString(): string;

  /**
   * Returns a JSON string representation.
   */
  toJSON(): string;

  /**
   * Creates a Timestamp from a JS Date object.
   * @throws If not a valid date.
   */
  static fromDate(date: Date): Timestamp;

  /**
   * Creates a Timestamp from epoch milliseconds.
   * @throws If not a valid number.
   */
  static fromMillis(milliseconds: number): Timestamp;
}