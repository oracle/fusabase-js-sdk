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
 * import type { MultiFactorAssertion } from "fusabase/auth";
 * function submitAssertion(assertion: MultiFactorAssertion) {
 *   console.log(assertion.toJSON());
 * }
 * ```
 */
export interface MultiFactorAssertion {
/**
 * Executes the toJSON operation for this public SDK type.
 *
 * @returns The result produced by `toJSON`, including any requested data or handle.
 * @example
 * ```ts
 * const result = assertion.toJSON();
 * void result;
 * ```
 */
  toJSON(): object;
}

/**
 * Information about a second factor enrolled for a user.
 */
export type MultiFactorFactorId = "totp" | "phone";

/** Describes the public `MultiFactorInfo` value. */
export interface MultiFactorInfo {
/** Describes the public `uid` value. */
  readonly uid: string;
/** Describes the public `displayName` value. */
  readonly displayName?: string | null;
/** Describes the public `factorId` value. */
  readonly factorId: MultiFactorFactorId;
/** Describes the public `enrollmentTime` value. */
  readonly enrollmentTime: string;
}

/**
 * Information about a phone/SMS second factor enrolled for a user.
 */
export interface PhoneMultiFactorInfo extends MultiFactorInfo {
/** Describes the public `factorId` value. */
  readonly factorId: "phone";
/** Describes the public `phoneNumber` value. */
  readonly phoneNumber: string;
}

/**
 * Information about a TOTP second factor enrolled for a user.
 */
export interface TotpMultiFactorInfo extends MultiFactorInfo {
/** Describes the public `factorId` value. */
  readonly factorId: "totp";
}

/**
 * TOTP setup details returned when starting MFA enrollment.
 */
export interface TotpSecret {
/** Describes the public `enrollmentId` value. */
  readonly enrollmentId: string;
/** Describes the public `qrCodeUrl` value. */
  readonly qrCodeUrl: string;
/** Describes the public `manualEntryKey` value. */
  readonly manualEntryKey: string;
/** Describes the public `digits` value. */
  readonly digits?: number;
/** Describes the public `periodSeconds` value. */
  readonly periodSeconds?: number;
/** Describes the public `issuer` value. */
  readonly issuer?: string;
/** Describes the public `expiresInSeconds` value. */
  readonly expiresInSeconds?: number;
/** Describes the public `challengeId` value. */
  readonly challengeId?: string;
/** Describes the public `mfaSessionToken` value. */
  readonly mfaSessionToken?: string;
}

/**
 * Operations for managing MFA factors for a signed-in user.
 */
export interface MultiFactorUser {
/** Describes the public `enrolledFactors` value. */
  readonly enrolledFactors: MultiFactorInfo[];

/**
 * Executes the getSession operation for this public SDK type.
 *
 * @returns The result produced by `getSession`, including any requested data or handle.
 * @example
 * ```ts
 * import { getSession } from "fusabase/auth";
 * const result = client.getSession();
 * void result;
 * ```
 */
  getSession(): Promise<MultiFactorSession>;

/**
 * Executes the enroll operation for this public SDK type.
 *
 * @param assertion - The assertion accepted by this operation.
 * @param displayName - The displayName accepted by this operation.
 * @returns The result produced by `enroll`, including any requested data or handle.
 * @example
 * ```ts
 * import { enroll } from "fusabase/auth";
 * const result = client.enroll(value, "example");
 * void result;
 * ```
 */
  enroll(assertion: MultiFactorAssertion, displayName?: string | null): Promise<void>;

/**
 * Executes the unenroll operation for this public SDK type.
 *
 * @param option - The option accepted by this operation.
 * @returns The result produced by `unenroll`, including any requested data or handle.
 * @example
 * ```ts
 * import { unenroll } from "fusabase/auth";
 * const result = client.unenroll(value);
 * void result;
 * ```
 */
  unenroll(option: MultiFactorInfo | string): Promise<void>;
}

/**
 * MFA errors thrown during sign-in.
 */
export interface MultiFactorError extends Error {
/** Describes the public `resolver` value. */
  resolver?: MultiFactorResolver;
}

/**
 * Resolver to handle MFA sign-in.
 */
export interface MultiFactorResolver {
/** Describes the public `hints` value. */
  readonly hints: MultiFactorInfo[];
/** Describes the public `session` value. */
  readonly session: MultiFactorSession;

/**
 * Executes the resolveSignIn operation for this public SDK type.
 *
 * @param assertion - The assertion accepted by this operation.
 * @returns The result produced by `resolveSignIn`, including any requested data or handle.
 * @example
 * ```ts
 * import { resolveSignIn } from "fusabase/auth";
 * const result = client.resolveSignIn(value);
 * void result;
 * ```
 */
  resolveSignIn(assertion: MultiFactorAssertion): Promise<UserCredential>;
}

/**
 * Represents a user's multi-factor session.
 */
export interface MultiFactorSession {}
