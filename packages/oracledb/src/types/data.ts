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
import { argCheck } from "../util/utils.js";
import { typeStrings } from "../util/utils.js";
import { OracledbError } from "../util/utils.js";
import { oracledbErrorHandler } from "../util/utils.js";
import { FieldValue } from "../field/value.js";

export class Timestamp {
  #seconds: number;
  #nanoseconds: number;

  constructor(seconds: number, nanoseconds: number) {
    argCheck(seconds, "Invalid seconds passed", true, [typeStrings.INT]);
    argCheck(nanoseconds, "Invalid nanoseconds passed", true, [typeStrings.INT]);
    if (seconds < -62135596800 || seconds > 253402300799) {
      const error = new Error("Seconds must be from 0001-01-01T00:00:00Z to 9999-12-31T23:59:59Z inclusive.") as OracledbError;
      error.status = 400;
      throw oracledbErrorHandler(error);
    }
    if (nanoseconds < 0 || nanoseconds >= 1e9) {
      const error = new Error("Nanoseconds must be from 0 to 999,999,999 inclusive.") as OracledbError;
      error.status = 400;
      throw oracledbErrorHandler(error);
    }
    this.#seconds = seconds;
    this.#nanoseconds = nanoseconds;
  }

  get seconds(): number {
    return this.#seconds;
  }

  get nanoseconds(): number {
    return this.#nanoseconds;
  }

  toDate(): Date {
    return new Date(this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6));
  }

  isEqual(other: Timestamp): boolean {
    if (!(other instanceof Timestamp)) {
      const error = new Error("The provided object must be an instance of Timestamp.") as OracledbError;
      error.status = 400;
      throw oracledbErrorHandler(error);
    }
    return this.seconds === other.seconds && this.nanoseconds === other.nanoseconds;
  }

  toMillis(): number {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6);
  }

  valueOf(): string {
    const secondsString = this.seconds.toString().padStart(11, '0');
    const nanosecondsString = this.nanoseconds.toString().padStart(9, '0');
    return `${secondsString}.${nanosecondsString}`;
  }

  toTimestampString(): string {
    const date = new Date(this.#seconds * 1000);
    const milliseconds = Math.floor(this.#nanoseconds / 1e6);
    const microseconds = Math.floor((this.#nanoseconds % 1e6) / 1e3);
    const dateString = date.toISOString().replace('Z', '');
    return `${dateString}${microseconds.toString().padStart(3, '0')}`;
  }

  toString(): string {
    return this.toTimestampString();
  }

  toJSON(): string {
    return this.toString();
  }

  static now(): Timestamp {
    const milliseconds = Date.now();
    const seconds = Math.floor(milliseconds / 1000);
    const nanoseconds = (milliseconds % 1000) * 1e6;
    return new Timestamp(seconds, nanoseconds);
  }

  static fromDate(date: Date): Timestamp {
    argCheck(date, "Invalid date passed", true, [typeStrings.DATE]);
    const milliseconds = date.getTime();
    const seconds = Math.floor(milliseconds / 1000);
    const nanoseconds = (milliseconds % 1000) * 1e6;
    return new Timestamp(seconds, nanoseconds);
  }

  static fromMillis(milliseconds: number): Timestamp {
    argCheck(milliseconds, "Invalid milliseconds passed", true, [typeStrings.INT]);
    const seconds = Math.floor(milliseconds / 1000);
    const nanoseconds = (milliseconds % 1000) * 1e6;
    return new Timestamp(seconds, nanoseconds);
  }

  static fromTimestampString(str: string): Timestamp {
    argCheck(str, "Invalid timestamp string passed", true, [typeStrings.STRING]);
    const regex = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?$/;
    const match = str.match(regex);
    if (!match) throw new Error("Invalid timestamp string: " + str);
    const base = match[1];      // "2025-01-01T00:00:00"
    let fraction = match[2] || "0";
    fraction = fraction.padEnd(6, "0");
    const millis = parseInt(fraction.slice(0, 3), 10);
    const micros = parseInt(fraction.slice(3, 6), 10);
    const date = new Date(base + "." + millis.toString().padStart(3, "0") + "Z");
    const seconds = Math.floor(date.getTime() / 1000);
    const nanoseconds = millis * 1e6 + micros * 1e3;
    return new Timestamp(seconds, nanoseconds);
  }
}

export declare type WithFieldValue<T> = T | (T extends any ? T : T extends {} ? {
    [K in keyof T]: WithFieldValue<T[K]> | FieldValue;
} : never);

export declare type PartialWithFieldValue<T> = Partial<T> | (T extends any ? T : T extends {} ? {
    [K in keyof T]?: PartialWithFieldValue<T[K]> | FieldValue;
} : never);