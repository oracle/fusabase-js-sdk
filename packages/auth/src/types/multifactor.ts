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

import { UserCredential } from "../internal/credential.js";
/**
 * Represents a second-factor assertion for MFA.
 *
 * @example
 * ```ts
 * import { MultiFactorAssertion } from './type/multi-factor.js';
 * function submitAssertion(assertion: MultiFactorAssertion) {
 *   console.log(assertion.toJSON());
 * }
 * ```
 */
export interface MultiFactorAssertion {
  /** Serialize to JSON */
  toJSON(): object;
}

/**
 * Information about a second factor enrolled for a user.
 */
export interface MultiFactorInfo {
  uid: string;
  displayName?: string | null;
  factorId: string;
}

/**
 * MFA errors thrown during sign-in.
 */
export interface MultiFactorError extends Error {
  resolver?: MultiFactorResolver;
}

/**
 * Resolver to handle MFA sign-in.
 */
export interface MultiFactorResolver {
  hints: MultiFactorInfo[];
  resolveSignIn(assertion: MultiFactorAssertion): Promise<UserCredential>;
}

/**
 * Represents a user's multi-factor session.
 */
export interface MultiFactorSession {}
