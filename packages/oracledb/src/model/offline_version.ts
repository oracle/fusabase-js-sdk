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

/** Represents a document version. @example `const version = OracledbDocumentVersion.min();` */
export class OracledbDocumentVersion {
/**
 * Constructs a OracledbDocumentVersion instance with the supplied configuration.
 *
 * @param value - The value to store or transform.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { OracledbDocumentVersion } from "fusabase/oracledb";
 * const result = new OracledbDocumentVersion({ title: "Example" });
 * void result;
 * ```
 */
  constructor(readonly value: string = '') {}

/**
 * Executes the isEqual operation for this public SDK type.
 *
 * @param other - The value to compare with this value.
 * @returns The result produced by `isEqual`, including any requested data or handle.
 * @example
 * ```ts
 * import { OracledbDocumentVersion } from "fusabase/oracledb";
 * const result = new OracledbDocumentVersion("1").isEqual(new OracledbDocumentVersion("1"));
 * void result;
 * ```
 */
  isEqual(other: OracledbDocumentVersion): boolean {
    return this.value === other.value;
  }
}

/** Represents a snapshot version. @example `const version = OracledbSnapshotVersion.min();` */
export class OracledbSnapshotVersion {
/**
 * Constructs a OracledbSnapshotVersion instance with the supplied configuration.
 *
 * @param value - The value to store or transform.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { OracledbSnapshotVersion } from "fusabase/oracledb";
 * const result = new OracledbSnapshotVersion({ title: "Example" });
 * void result;
 * ```
 */
  constructor(readonly value: string = '') {}

/**
 * Executes the isEqual operation for this public SDK type.
 *
 * @param other - The value to compare with this value.
 * @returns The result produced by `isEqual`, including any requested data or handle.
 * @example
 * ```ts
 * import { OracledbSnapshotVersion } from "fusabase/oracledb";
 * const result = new OracledbSnapshotVersion("1").isEqual(new OracledbSnapshotVersion("1"));
 * void result;
 * ```
 */
  isEqual(other: OracledbSnapshotVersion): boolean {
    return this.value === other.value;
  }
}
