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

/** Represents the canonical key of a document. @example `const key = OracledbDocumentKey.fromPath("tasks/task-1");` */
export class OracledbDocumentKey {
/** Describes the public `segments` value. */
  readonly segments: string[];

/**
 * Constructs a OracledbDocumentKey instance with the supplied configuration.
 *
 * @param path - The relative resource path.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { OracledbDocumentKey } from "fusabase/oracledb";
 * const result = new OracledbDocumentKey("example");
 * void result;
 * ```
 */
  constructor(path: string | string[]) {
    this.segments = Array.isArray(path) ? [...path] : path.split('/').filter(Boolean);
  }

  get path(): string {
    return this.segments.join('/');
  }

/**
 * Executes the isEqual operation for this public SDK type.
 *
 * @param other - The value to compare with this value.
 * @returns The result produced by `isEqual`, including any requested data or handle.
 * @example
 * ```ts
 * import { OracledbDocumentKey } from "fusabase/oracledb";
 * const result = new OracledbDocumentKey("tasks/task-1").isEqual(new OracledbDocumentKey("tasks/task-1"));
 * void result;
 * ```
 */
  isEqual(other: OracledbDocumentKey): boolean {
    return this.path === other.path;
  }

/**
 * Executes the fromPath operation for this public SDK type.
 *
 * @param path - The relative resource path.
 * @returns The result produced by `fromPath`, including any requested data or handle.
 * @example
 * ```ts
 * import { OracledbDocumentKey } from "fusabase/oracledb";
 * const result = OracledbDocumentKey.fromPath("example");
 * void result;
 * ```
 */
  static fromPath(path: string): OracledbDocumentKey {
    return new OracledbDocumentKey(path);
  }
}
