// Copyright (c) 2015, 2026, Oracle and/or its affiliates.

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
 * Error raised by application-level operations.
 *
 * @example
 * ```ts
 * try {
 *   getApp("missing");
 * } catch (error) {
 *   if (error instanceof FusabaseError) console.error(error.code);
 * }
 * ```
 */
export class FusabaseError extends Error {
/** Describes the public `code` value. */
  code: string;

  /**
   * Creates an application-level error.
   *
   * @param code - Stable error-code suffix.
   * @param message - Human-readable explanation of the failure.
   * @param stack - Optional stack trace to preserve.
   * @returns The error instance.
   * @example
   * ```ts
   * throw new FusabaseError("invalid-config", "Configuration is invalid");
   * ```
   */
  constructor(code: string, message: string, stack?: string) {
    super(message);
    this.code = 'app/' + code;
    this.name = 'FusabaseError';

    if (stack) {
      this.stack = stack;
    }

    // Fix prototype chain (important for extending built-ins in TS)
    Object.setPrototypeOf(this, FusabaseError.prototype);
  }
}
