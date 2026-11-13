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
/** Represents a value sentinel used in a write operation. @example `const value = FieldValue.serverTimestamp();` */
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
 * Constructs a FieldValue instance with the supplied configuration.
 *
 * @param op - The op accepted by this operation.
 * @param value - The value to store or transform.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { FieldValue } from "fusabase/oracledb";
 * const result = new FieldValue("custom", { title: "Example" });
 * void result;
 * ```
 */
  constructor(op: string, value: any) {
    this.#value = value;
    this.#operation = op;
  }

/**
 * Executes the isEqual operation for this public SDK type.
 *
 * @param other - The value to compare with this value.
 * @returns The result produced by `isEqual`, including any requested data or handle.
 * @example
 * ```ts
 * import { FieldValue } from "fusabase/oracledb";
 * const result = new FieldValue("custom", ["a"]).isEqual(new FieldValue("custom", ["a"]));
 * void result;
 * ```
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
 * Executes the arrayRemove operation for this public SDK type.
 *
 * @param elements - One or more array elements to transform.
 * @returns The result produced by `arrayRemove`, including any requested data or handle.
 * @example
 * ```ts
 * import { FieldValue } from "fusabase/oracledb";
 * const result = FieldValue.arrayRemove("example");
 * void result;
 * ```
 */
  static arrayRemove(...elements: any[]): FieldValue {
    nullCheck(elements, "Invalid arguments passed");
    return new FieldValue("FieldValue:arrayRemove", elements);
  }

/**
 * Executes the arrayUnion operation for this public SDK type.
 *
 * @param elements - One or more array elements to transform.
 * @returns The result produced by `arrayUnion`, including any requested data or handle.
 * @example
 * ```ts
 * import { FieldValue } from "fusabase/oracledb";
 * const result = FieldValue.arrayUnion("example");
 * void result;
 * ```
 */
  static arrayUnion(...elements: any[]): FieldValue {
    nullCheck(elements, "Invalid arguments passed");
    return new FieldValue("FieldValue:arrayUnion", elements);
  }

/**
 * Executes the delete operation for this public SDK type.
 *
 * @returns The result produced by `delete`, including any requested data or handle.
 * @example
 * ```ts
 * import { FieldValue } from "fusabase/oracledb";
 * const result = FieldValue.delete();
 * void result;
 * ```
 */
  static delete(): FieldValue {
    return new FieldValue("FieldValue:delete", null);
  }

/**
 * Executes the increment operation for this public SDK type.
 *
 * @param value - The value to store or transform.
 * @returns The result produced by `increment`, including any requested data or handle.
 * @example
 * ```ts
 * import { FieldValue } from "fusabase/oracledb";
 * const result = FieldValue.increment({ title: "Example" });
 * void result;
 * ```
 */
  static increment(value: number): FieldValue {
    nullCheck(value, "Invalid argument passed");
    return new FieldValue("FieldValue:increment", value);
  }

/**
 * Executes the serverTimestamp operation for this public SDK type.
 *
 * @returns The result produced by `serverTimestamp`, including any requested data or handle.
 * @example
 * ```ts
 * import { FieldValue } from "fusabase/oracledb";
 * const result = FieldValue.serverTimestamp();
 * void result;
 * ```
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

/** Represents an instant with seconds and nanoseconds. @example `const timestamp = Timestamp.now();` */
export class Timestamp {
  #seconds: number;
  #nanoseconds: number;

/**
 * Constructs a Timestamp instance with the supplied configuration.
 *
 * @param seconds - Whole seconds since the Unix epoch.
 * @param nanoseconds - Nanoseconds within the current second.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { Timestamp } from "fusabase/oracledb";
 * const result = new Timestamp(0, 0);
 * void result;
 * ```
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

/**
 * Executes the toDate operation for this public SDK type.
 *
 * @returns The result produced by `toDate`, including any requested data or handle.
 * @example
 * ```ts
 * import { Timestamp } from "fusabase/oracledb";
 * const result = new Timestamp(1_700_000_000, 0).toDate();
 * void result;
 * ```
 */
  toDate(): Date {
    return new Date(this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6));
  }

/**
 * Executes the isEqual operation for this public SDK type.
 *
 * @param other - The value to compare with this value.
 * @returns The result produced by `isEqual`, including any requested data or handle.
 * @example
 * ```ts
 * import { Timestamp } from "fusabase/oracledb";
 * const result = new Timestamp(1_700_000_000, 0).isEqual(new Timestamp(1_700_000_000, 0));
 * void result;
 * ```
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

/**
 * Executes the toMillis operation for this public SDK type.
 *
 * @returns The result produced by `toMillis`, including any requested data or handle.
 * @example
 * ```ts
 * import { Timestamp } from "fusabase/oracledb";
 * const result = new Timestamp(1_700_000_000, 0).toMillis();
 * void result;
 * ```
 */
  toMillis(): number {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6);
  }

/**
 * Executes the valueOf operation for this public SDK type.
 *
 * @returns The result produced by `valueOf`, including any requested data or handle.
 * @example
 * ```ts
 * import { Timestamp } from "fusabase/oracledb";
 * const result = new Timestamp(1_700_000_000, 0).valueOf();
 * void result;
 * ```
 */
  valueOf(): string {
    const secondsString = this.seconds.toString().padStart(11, '0');
    const nanosecondsString = this.nanoseconds.toString().padStart(9, '0');
    return `${secondsString}.${nanosecondsString}`;
  }

/**
 * Executes the fromDate operation for this public SDK type.
 *
 * @param date - The date accepted by this operation.
 * @returns The result produced by `fromDate`, including any requested data or handle.
 * @example
 * ```ts
 * import { Timestamp } from "fusabase/oracledb";
 * const result = Timestamp.fromDate(value);
 * void result;
 * ```
 */
  static fromDate(date: Date): Timestamp {
    argCheck(date, "Invalid date passed", true, [typeStrings.DATE]);
    const milliseconds = date.getTime();
    const seconds = Math.floor(milliseconds / 1000);
    const nanoseconds = (milliseconds % 1000) * 1e6;
    return new Timestamp(seconds, nanoseconds);
  }

/**
 * Executes the fromMillis operation for this public SDK type.
 *
 * @param milliseconds - Milliseconds since the Unix epoch.
 * @returns The result produced by `fromMillis`, including any requested data or handle.
 * @example
 * ```ts
 * import { Timestamp } from "fusabase/oracledb";
 * const result = Timestamp.fromMillis(0);
 * void result;
 * ```
 */
  static fromMillis(milliseconds: number): Timestamp {
    argCheck(milliseconds, "Invalid milliseconds passed", true, [typeStrings.INT]);
    const seconds = Math.floor(milliseconds / 1000);
    const nanoseconds = (milliseconds % 1000) * 1e6;
    return new Timestamp(seconds, nanoseconds);
  }

/**
 * Executes the now operation for this public SDK type.
 *
 * @returns The result produced by `now`, including any requested data or handle.
 * @example
 * ```ts
 * import { Timestamp } from "fusabase/oracledb";
 * const result = Timestamp.now();
 * void result;
 * ```
 */
  static now(): Timestamp {
    const milliseconds = Date.now();
    const seconds = Math.floor(milliseconds / 1000);
    const nanoseconds = (milliseconds % 1000) * 1e6;
    return new Timestamp(seconds, nanoseconds);
  }

/**
 * Executes the toTimestampString operation for this public SDK type.
 *
 * @returns The result produced by `toTimestampString`, including any requested data or handle.
 * @example
 * ```ts
 * import { Timestamp } from "fusabase/oracledb";
 * const result = new Timestamp(1_700_000_000, 0).toTimestampString();
 * void result;
 * ```
 */
  toTimestampString(): string {
    const date = new Date(this.#seconds * 1000);
    const milliseconds = Math.floor(this.#nanoseconds / 1e6);
    const microseconds = Math.floor((this.#nanoseconds % 1e6) / 1e3);
    const dateString = date.toISOString().replace('Z', '');
    return `${dateString}${microseconds.toString().padStart(3, '0')}`;
  }

/**
 * Executes the fromTimestampString operation for this public SDK type.
 *
 * @param str - The str accepted by this operation.
 * @returns The result produced by `fromTimestampString`, including any requested data or handle.
 * @example
 * ```ts
 * import { Timestamp } from "fusabase/oracledb";
 * const result = Timestamp.fromTimestampString(value);
 * void result;
 * ```
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
 * Executes the toString operation for this public SDK type.
 *
 * @returns The result produced by `toString`, including any requested data or handle.
 * @example
 * ```ts
 * import { Timestamp } from "fusabase/oracledb";
 * const result = new Timestamp(1_700_000_000, 0).toString();
 * void result;
 * ```
 */
  toString(): string {
    return this.toTimestampString();
  }

/**
 * Executes the toJSON operation for this public SDK type.
 *
 * @returns The result produced by `toJSON`, including any requested data or handle.
 * @example
 * ```ts
 * import { Timestamp } from "fusabase/oracledb";
 * const result = new Timestamp(1_700_000_000, 0).toJSON();
 * void result;
 * ```
 */
  toJSON(): string {
    return this.toString();
  }
}
