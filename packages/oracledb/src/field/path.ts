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

import { nullCheck } from "../util/utils.js";
import { oracledbErrorHandler } from "../util/utils.js";
/**
 * Class representing a path to a field (including deeply nested fields).
 */
export class FieldPath {
  /**
   * (Private) Path string representing the field (i.e. "a.b.c").
   */
  /**
   * @internal
   */
  #fullPath: string;

  /**
   * (Private for comparison) Encoded path for internal uniqueness.
   */
  /**
   * @internal
   */
  fullPathSec: string;

  /**
   * Creates a new `FieldPath` instance.
   * @param {...string[]} arr - Array of path tokens.
   */
  constructor(...fieldNames: string[]) {
    nullCheck(fieldNames, "Invalid argument passed");
    let path = "";
    let pathSec = "$FieldPath$";
    for (let i = 0; i < fieldNames.length; i++) {
      path += fieldNames[i];
      pathSec += fieldNames[i];
      if (i < fieldNames.length - 1) {
        pathSec += "#FieldPath#";
        path += ".";
      }
    }
    this.#fullPath = path;
    this.fullPathSec = pathSec;
  }

  /**
   * Returns the path string pointing to the field.
   * @returns {string} Path string.
   */
  /**
   * @internal
   */
  get fullPath(): string {
    return this.#fullPath;
  }

  /**
   * Checks whether this `FieldPath` is equal to the provided one.
   * @param {FieldPath} fp - FieldPath to compare to.
   * @returns {boolean} Returns true if both point to the same field.
   * @throws {Error} Throws if fp is not a FieldPath instance.
   */
  isEqual(fp: FieldPath): boolean {
    if (!(fp instanceof FieldPath)) {
      const error: any = new Error("The other instance to be compared should be a FieldPath.");
      error.status = 400;
      throw oracledbErrorHandler(error);
    }
    return this.fullPathSec === fp.fullPathSec;
  }

  /**
   * Get the path string pointing to the field.
   * @returns {string} The path string.
   */
  toString(): string {
    return this.fullPathSec;
  }

  /**
   * JSON representation of this path.
   * @returns {string}
   */
  /**
   * @internal
   */
  toJSON(): string {
    return this.toString();
  }

  /**
   * Creates a `FieldPath` instance for document ID.
   * @returns {FieldPath} A new FieldPath instance.
   */
  static documentId(): FieldPath {
    return new FieldPath("OID");
  }
}