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

/** Represents a condition required before a write is applied. @example `const condition = OracledbWritePrecondition.none();` */
export class OracledbWritePrecondition {
  /** Whether the target document must exist before the write is applied. */
  private constructor(readonly exists?: boolean) {}

/**
 * Executes the none operation for this public SDK type.
 *
 * @returns The result produced by `none`, including any requested data or handle.
 * @example
 * ```ts
 * import { OracledbWritePrecondition } from "fusabase/oracledb";
 * const result = OracledbWritePrecondition.none();
 * void result;
 * ```
 */
  static none(): OracledbWritePrecondition {
    return new OracledbWritePrecondition();
  }

/**
 * Executes the exists operation for this public SDK type.
 *
 * @param exists - The exists accepted by this operation.
 * @returns The result produced by `exists`, including any requested data or handle.
 * @example
 * ```ts
 * import { OracledbWritePrecondition } from "fusabase/oracledb";
 * const result = OracledbWritePrecondition.exists(value);
 * void result;
 * ```
 */
  static exists(exists: boolean): OracledbWritePrecondition {
    return new OracledbWritePrecondition(exists);
  }
}
