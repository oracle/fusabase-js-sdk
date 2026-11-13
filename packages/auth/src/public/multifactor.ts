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

import { AuthError, authErrorHandler, ErrorCode, ErrorCodeMessage } from "../errors.js";
import { Auth } from "../types/auth.js";
import { MultiFactorResolver } from "../types/multifactor.js";

/**
 * Extracts the multi-factor resolver from a sign-in error that requires an additional factor.
 *
 * @param auth - Authentication service that produced the error.
 * @param error - Error returned by the sign-in operation.
 * @returns Resolver used to finish the sign-in operation.
 * @example
 * ```ts
 * const resolver = getMultiFactorResolver(auth, error);
 * ```
 */
export function getMultiFactorResolver(auth: Auth, error: unknown): MultiFactorResolver {
  if (!(auth instanceof Auth)) {
    const authError = new AuthError(ErrorCodeMessage.INVALID_ARGS, { message: "Invalid authentication instance" });
    authError.status = ErrorCode.INVALID_ARGS;
    throw authErrorHandler(authError);
  }

  const resolver = getResolver(error);
  if (!resolver) {
    const authError = new AuthError(ErrorCodeMessage.INVALID_ARGS, { message: "Invalid multi-factor error" });
    authError.status = ErrorCode.INVALID_ARGS;
    throw authErrorHandler(authError);
  }

  return resolver;
}

function getResolver(error: unknown): MultiFactorResolver | null {
  if (typeof error !== "object" || error === null || !("resolver" in error)) {
    return null;
  }

  const resolver = (error as { resolver?: unknown }).resolver;
  return isMultiFactorResolver(resolver) ? resolver : null;
}

function isMultiFactorResolver(value: unknown): value is MultiFactorResolver {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as MultiFactorResolver).hints) &&
    "session" in value &&
    typeof (value as MultiFactorResolver).resolveSignIn === "function"
  );
}
