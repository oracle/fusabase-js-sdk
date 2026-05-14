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
import { compareValues } from "../util/utils_helper.js";
import { argCheck, nullCheck, typeStrings } from "../util/utils.js";
import { getErrorMessage } from "../errors.js";
/**
 * Represents an operation for a field value to be applied to the server.
 */
export class FieldValue {
  /**
   * @internal
   */
  #value: any;
  /**
   * @internal
   */
  #operation: string;

  /**
   * Private constructor.
   * Use one of the static factory methods instead.
   * @param op - The operation type.
   * @param value - The value to apply.
   */
  constructor(op: string, value: any) {
    this.#value = value;
    this.#operation = op;
  }

  /**
   * Compares this `FieldValue` with another.
   * @param other Another `FieldValue` instance.
   * @returns `true` if both are equal (type and value), else `false`.
   * @throws {Error} if `other` is not a `FieldValue`.
   */
  isEqual(other: FieldValue): boolean {
    if (!(other instanceof FieldValue)) {
      const error: any = new Error("The provided object must be an instance of FieldValue.");
      error.status = 400;
      throw oracledbErrorHandler(error);
    }
    return compareValues(this.value, other.value)
      && this.operation === other.operation;
  }

  /**
   * Gets the value change.
   */
  /**
   * @internal
   */
  get value(): any {
    return this.#value;
  }

  /**
   * Gets the type of the operation.
   */
  /**
   * @internal
   */
  get operation(): string {
    return this.#operation;
  }

  /**
   * Creates a `FieldValue` for removing elements from an array.
   * @param elements Elements to be removed.
   */
  static arrayRemove(...elements: any[]): FieldValue {
    nullCheck(elements, "Invalid arguments passed");
    return new FieldValue("FieldValue:arrayRemove", elements);
  }

  /**
   * Creates a `FieldValue` for adding elements to an array (union).
   * @param elements Elements to be added (union).
   */
  static arrayUnion(...elements: any[]): FieldValue {
    nullCheck(elements, "Invalid arguments passed");
    return new FieldValue("FieldValue:arrayUnion", elements);
  }

  /**
   * Creates a `FieldValue` for deleting a field.
   */
  static delete(): FieldValue {
    return new FieldValue("FieldValue:delete", null);
  }

  /**
   * Creates a `FieldValue` for incrementing a numeric field.
   * @param value Amount to increment by.
   */
  static increment(value: number): FieldValue {
    nullCheck(value, "Invalid argument passed");
    return new FieldValue("FieldValue:increment", value);
  }

  /**
   * Creates a `FieldValue` for setting a server timestamp.
   */
  static serverTimestamp(): FieldValue {
    return new FieldValue("FieldValue:serverTimestamp", "servertimestamp");
  }
}

// You should import or declare these in your actual codebase.
/**
   * @internal
   */
declare function oracledbErrorHandler(err: Error): Error;

export class Timestamp {
  #seconds: number;
  #nanoseconds: number;

  /**
   * Creates a new `Timestamp` instance.
   * @param seconds - The number of seconds since the Unix epoch.
   * @param nanoseconds - Nanoseconds (0-999,999,999).
   * @throws {Error} If the provided values are out of range.
   */
  constructor(seconds: number, nanoseconds: number) {
    argCheck(seconds, "Invalid seconds passed", true, [typeStrings.INT]);
    argCheck(nanoseconds, "Invalid nanoseconds passed", true, [typeStrings.INT]);
    if (seconds < -62135596800 || seconds > 253402300799) {
      const error: any = new Error(getErrorMessage('invalidSecondsRange'));
      error.status = 400;
      throw oracledbErrorHandler(error);
    }
    if (nanoseconds < 0 || nanoseconds >= 1e9) {
      const error: any = new Error(getErrorMessage('invalidNanosecondsRange'));
      error.status = 400;
      throw oracledbErrorHandler(error);
    }
    this.#seconds = seconds;
    this.#nanoseconds = nanoseconds;
  }

  /** Gets the seconds part of the timestamp. */
  get seconds(): number {
    return this.#seconds;
  }

  /** Gets the nanoseconds part of the timestamp. */
  get nanoseconds(): number {
    return this.#nanoseconds;
  }

  /** Converts the timestamp to a JavaScript `Date` object. */
  toDate(): Date {
    return new Date(this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6));
  }

  /**
   * Compares this Timestamp with another.
   * @param other - Another Timestamp.
   * @throws {Error} if the provided object is not a Timestamp instance.
   */
  isEqual(other: Timestamp): boolean {
    if (!(other instanceof Timestamp)) {
      const error: any = new Error(getErrorMessage('notTimestampInstance'));
      error.status = 400;
      throw oracledbErrorHandler(error);
    }
    return this.seconds === other.seconds &&
      this.nanoseconds === other.nanoseconds;
  }

  /** Converts the Timestamp to milliseconds since epoch. */
  toMillis(): number {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6);
  }

  /** Returns a string representation: seconds.nanoseconds */
  valueOf(): string {
    const secondsString = this.seconds.toString().padStart(11, '0');
    const nanosecondsString = this.nanoseconds.toString().padStart(9, '0');
    return `${secondsString}.${nanosecondsString}`;
  }

  /**
   * Creates a Timestamp from a JavaScript Date object.
   * @throws {Error} If an invalid date is provided.
   */
  static fromDate(date: Date): Timestamp {
    argCheck(date, "Invalid date passed", true, [typeStrings.DATE]);
    const milliseconds = date.getTime();
    const seconds = Math.floor(milliseconds / 1000);
    const nanoseconds = (milliseconds % 1000) * 1e6;
    return new Timestamp(seconds, nanoseconds);
  }

  /**
   * Creates a Timestamp from milliseconds since the Unix epoch.
   * @throws {Error} If an invalid value is provided.
   */
  static fromMillis(milliseconds: number): Timestamp {
    argCheck(milliseconds, "Invalid milliseconds passed", true, [typeStrings.INT]);
    const seconds = Math.floor(milliseconds / 1000);
    const nanoseconds = (milliseconds % 1000) * 1e6;
    return new Timestamp(seconds, nanoseconds);
  }

  /** Returns the current time as a Timestamp. */
  static now(): Timestamp {
    const milliseconds = Date.now();
    const seconds = Math.floor(milliseconds / 1000);
    const nanoseconds = (milliseconds % 1000) * 1e6;
    return new Timestamp(seconds, nanoseconds);
  }

  /**
   * Converts the Timestamp to an ISO 8601 string with microseconds precision.
   */
  toTimestampString(): string {
    const date = new Date(this.#seconds * 1000);
    const milliseconds = Math.floor(this.#nanoseconds / 1e6);
    const microseconds = Math.floor((this.#nanoseconds % 1e6) / 1e3);
    const dateString = date.toISOString().replace('Z', '');
    return `${dateString}${microseconds.toString().padStart(3, '0')}`;
  }

  /**
   * Parses an ISO 8601 string and converts it to a Timestamp instance.
   * @throws {Error} If an invalid timestamp string is provided.
   */
  static fromTimestampString(str: string): Timestamp {
    argCheck(str, "Invalid timestamp string passed", true, [typeStrings.STRING]);
    const regex = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?$/;
    const match = str.match(regex);
    if (!match) throw new Error(getErrorMessage('invalidTimestampString', str));
    const base = match[1];
    let fraction = match[2] || "0";
    fraction = fraction.padEnd(6, "0");
    const millis = parseInt(fraction.slice(0, 3), 10);
    const micros = parseInt(fraction.slice(3, 6), 10);
    const date = new Date(base + "." + millis.toString().padStart(3, "0") + "Z");
    const seconds = Math.floor(date.getTime() / 1000);
    const nanoseconds = millis * 1e6 + micros * 1e3;
    return new Timestamp(seconds, nanoseconds);
  }

  /**
   * Returns this Timestamp as an ISO8601 string with microseconds.
   */
  toString(): string {
    return this.toTimestampString();
  }

  /**
   * Returns JSON representation (ISO8601 with microseconds).
   */
  toJSON(): string {
    return this.toString();
  }
}
