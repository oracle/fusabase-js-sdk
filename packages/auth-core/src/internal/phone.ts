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

import { AuthCredential } from './credential.js';
import { AuthError, authErrorHandler, argCheck, ErrorCode, ErrorCodeMessage, typeStrings } from '../errors.js';
import { MultiFactorAssertion, TotpSecret } from '../types/multifactor.js';

export interface PhoneAuthCredentialContext {
  challengeId?: string;
  mfaSessionToken?: string;
  displayName?: string | null;
}

/**
 * Represents OAuth credentials returned by an OAuthProvider.
 *
 * @example
 * ```ts
 * import { OAuthCredential, GoogleAuthProvider } from 'fusabase/auth';
 * const credential = GoogleAuthProvider.credential(idToken);
 * ```
 */
/** Credential issued by an OAuth provider. @example `await signInWithCredential(auth, credential);` */
export class OAuthCredential extends AuthCredential {
  /** The access token used for OAuth authentication */
  accessToken?: string;
  /** The ID token used for OAuth authentication */
  idToken?: string;

/**
 * Executes the toJSON operation for this public SDK type.
 *
 * @returns The result produced by `toJSON`, including any requested data or handle.
 * @example
 * ```ts
 * import { OAuthCredential } from "fusabase/auth";
 * const result = client.toJSON();
 * void result;
 * ```
 */
  toJSON(): { providerId: string; signInMethod: string; accessToken?: string; idToken?: string } {
    const cred = {
      providerId: this.providerId,
      signInMethod: this.signInMethod,
      accessToken: this.accessToken,
      idToken: this.idToken
    };
    return cred;
  }

/**
 * Executes the fromJSON operation for this public SDK type.
 *
 * @param authCredential - The authCredential accepted by this operation.
 * @returns The result produced by `fromJSON`, including any requested data or handle.
 * @example
 * ```ts
 * import { OAuthCredential } from "fusabase/auth";
 * const result = OAuthCredential.fromJSON(value);
 * void result;
 * ```
 */
  static fromJSON(authCredential: string): OAuthCredential {
    argCheck(authCredential, "Invalid object", true, [typeStrings.OBJECT]);
    const res = JSON.parse(authCredential);
    const oauth = new OAuthCredential(res.providerId, res.signInMethod);
    oauth.accessToken = res.accessToken;
    oauth.idToken = res.idToken;
    return oauth;
  }
}

/**
 * Represents credentials returned by PhoneAuthProvider.
 *
 * @example
 * ```ts
 * import { PhoneAuthCredential, PhoneAuthProvider } from 'fusabase/auth';
 * const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
 * ```
 */
/** Credential issued after phone verification. @example `await signInWithCredential(auth, credential);` */
export class PhoneAuthCredential extends AuthCredential {
/** Describes the public `verificationId` value. */
  readonly verificationId: string;
/** Describes the public `verificationCode` value. */
  readonly verificationCode: string;
/** Describes the public `challengeId` value. */
  readonly challengeId?: string;
/** Describes the public `mfaSessionToken` value. */
  readonly mfaSessionToken?: string;
/** Describes the public `displayName` value. */
  readonly displayName?: string | null;

/**
 * Constructs a PhoneAuthCredential instance with the supplied configuration.
 *
 * @param verificationId - The verificationId accepted by this operation.
 * @param verificationCode - The verificationCode accepted by this operation.
 * @param context - The context accepted by this operation.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { PhoneAuthCredential } from "fusabase/auth";
 * const result = new PhoneAuthCredential(value, value, value);
 * void result;
 * ```
 */
  constructor(verificationId: string, verificationCode: string, context: PhoneAuthCredentialContext = {}) {
    super("phone", "phone");
    this.verificationId = requireString(verificationId, "verificationId");
    this.verificationCode = requireString(verificationCode, "verificationCode");
    this.challengeId = context.challengeId;
    this.mfaSessionToken = context.mfaSessionToken;
    this.displayName = context.displayName;
  }

/**
 * Executes the toJSON operation for this public SDK type.
 *
 * @returns The result produced by `toJSON`, including any requested data or handle.
 * @example
 * ```ts
 * import { PhoneAuthCredential } from "fusabase/auth";
 * const result = client.toJSON();
 * void result;
 * ```
 */
  toJSON(): { providerId: string; signInMethod: string; verificationId: string; verificationCode: string } {
    return {
      providerId: this.providerId,
      signInMethod: this.signInMethod,
      verificationId: this.verificationId,
      verificationCode: this.verificationCode
    };
  }
}

/**
 * Represents a phone-based MultiFactor assertion for MFA.
 *
 * @example
 * ```ts
 * import { PhoneMultiFactorAssertion, PhoneMultiFactorGenerator } from 'fusabase/auth';
 * const assertion = PhoneMultiFactorGenerator.assertion(credential);
 * ```
 */
export class PhoneMultiFactorAssertion implements MultiFactorAssertion {
  readonly factorId = "phone";

  private constructor(readonly credential: PhoneAuthCredential) {}

  static _fromCredential(credential: PhoneAuthCredential): PhoneMultiFactorAssertion {
    if (!(credential instanceof PhoneAuthCredential)) {
      throwInvalidMfaAssertion("Invalid phone auth credential");
    }

    return new PhoneMultiFactorAssertion(credential);
  }

  /** Converts the assertion to a JSON serializable object */
  toJSON(): object {
    return {
      factorId: this.factorId,
      credential: this.credential.toJSON()
    };
  }
}

/**
 * Represents a TOTP-based MultiFactor assertion for MFA.
 *
 * @example
 * ```ts
 * import { TotpMultiFactorAssertion, TotpMultiFactorGenerator } from 'fusabase/auth';
 * const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret);
 * ```
 */
export class TotpMultiFactorAssertion implements MultiFactorAssertion {
  readonly factorId = "totp";

  private constructor(
    readonly operation: "enroll" | "signin",
    private readonly identifier: string,
    private readonly verificationCode: string,
    private readonly challengeId?: string,
    private readonly mfaSessionToken?: string
  ) {}

  static _fromEnrollment(secret: TotpSecret, verificationCode: string): TotpMultiFactorAssertion {
    const enrollmentId = getTotpEnrollmentId(secret);
    return new TotpMultiFactorAssertion(
      "enroll",
      enrollmentId,
      requireString(verificationCode, "verificationCode"),
      requireString(secret.challengeId, "challengeId"),
      requireString(secret.mfaSessionToken, "mfaSessionToken")
    );
  }

  static _fromSignIn(enrollmentId: string, verificationCode: string): TotpMultiFactorAssertion {
    return new TotpMultiFactorAssertion(
      "signin",
      requireString(enrollmentId, "enrollmentId"),
      requireString(verificationCode, "verificationCode")
    );
  }

  /** Converts the assertion to a JSON serializable object */
  toJSON(): object {
    if (this.operation === "enroll") {
      return {
        enrollmentId: this.identifier,
        code: this.verificationCode,
        challengeId: this.challengeId,
        mfaSessionToken: this.mfaSessionToken
      };
    }

    return {
      factorId: this.identifier,
      code: this.verificationCode
    };
  }
}

function getTotpEnrollmentId(secret: TotpSecret): string {
  if (typeof secret !== "object" || secret === null) {
    throwInvalidMfaAssertion("Invalid TOTP secret");
  }

  return requireString(secret.enrollmentId, "enrollmentId");
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throwInvalidMfaAssertion(`Invalid ${fieldName}`);
  }

  return value;
}

function throwInvalidMfaAssertion(message: string): never {
  const error = new AuthError(ErrorCodeMessage.INVALID_ARGS, { message });
  error.status = ErrorCode.INVALID_ARGS;
  throw authErrorHandler(error);
}
