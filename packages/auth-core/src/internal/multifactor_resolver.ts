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
import { MfaService } from "../mfa_service.js";
import { MultiFactorSessionImpl } from "./multifactor_session.js";
import { PhoneMultiFactorAssertion, TotpMultiFactorAssertion } from "./phone.js";
import { Auth } from "../types/auth.js";
import { UserCredential } from "./credential.js";
import {
  MultiFactorAssertion,
  MultiFactorInfo,
  MultiFactorResolver,
  MultiFactorSession
} from "../types/multifactor.js";

/**
 * Internal implementation for an MFA-required sign-in challenge.
 */
export class MultiFactorResolverImpl implements MultiFactorResolver {
  readonly hints: MultiFactorInfo[];

  constructor(
    hints: MultiFactorInfo[],
    readonly session: MultiFactorSession,
    private readonly auth?: Auth
  ) {
    this.hints = [...hints];
  }

  async resolveSignIn(assertion: MultiFactorAssertion): Promise<UserCredential> {
    if (!this.auth) {
      throwInvalidMfaRequest("Missing authentication instance");
    }
    if (!(this.session instanceof MultiFactorSessionImpl) || this.session._type !== "signin") {
      throwInvalidMfaRequest("Invalid MFA sign-in session");
    }

    const challengeId = requireString(this.session._id, "challengeId");
    const mfaSessionToken = requireString(this.session._token, "mfaSessionToken");
    const { factorId, code } = getChallengeVerification(assertion);
    const tokens = await MfaService.verifyMfaChallenge(this.auth, challengeId, mfaSessionToken, factorId, code);
    return this.auth._completeMfaSignIn(tokens);
  }
}

function getChallengeVerification(assertion: MultiFactorAssertion): { factorId: string; code: string } {
  if (assertion instanceof TotpMultiFactorAssertion) {
    const payload = assertion.toJSON() as { factorId?: string; code?: string };
    return {
      factorId: requireString(payload.factorId, "factorId"),
      code: requireString(payload.code, "code")
    };
  }

  if (assertion instanceof PhoneMultiFactorAssertion) {
    return {
      factorId: assertion.credential.verificationId,
      code: assertion.credential.verificationCode
    };
  }

  throwInvalidMfaRequest("Invalid MFA assertion");
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throwInvalidMfaRequest(`Invalid ${fieldName}`);
  }

  return value;
}

function throwInvalidMfaRequest(message: string): never {
  const error = new AuthError(ErrorCodeMessage.INVALID_ARGS, { message });
  error.status = ErrorCode.INVALID_ARGS;
  throw authErrorHandler(error);
}
