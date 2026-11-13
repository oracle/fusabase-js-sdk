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
import { User } from "../types/user.js";
import {
  MultiFactorAssertion,
  MultiFactorInfo,
  MultiFactorSession,
  MultiFactorUser
} from "../types/multifactor.js";
import { MultiFactorSessionImpl } from "./multifactor_session.js";
import { PhoneMultiFactorAssertion, TotpMultiFactorAssertion } from "./phone.js";

/**
 * Internal implementation for MFA operations on a signed-in user.
 */
export class MultiFactorUserImpl implements MultiFactorUser {
  readonly enrolledFactors: MultiFactorInfo[];

  constructor(private readonly user: User, enrolledFactors?: MultiFactorInfo[]) {
    this.enrolledFactors = [...(enrolledFactors ?? user._getMfaEnrolledFactors())];
  }

  async getSession(): Promise<MultiFactorSession> {
    return MfaService.createSession(this.user);
  }

  async enroll(assertion: MultiFactorAssertion, displayName?: string | null): Promise<void> {
    let factor: MultiFactorInfo;

    if (assertion instanceof TotpMultiFactorAssertion) {
      const payload = assertion.toJSON() as {
        enrollmentId?: string;
        code?: string;
        challengeId?: string;
        mfaSessionToken?: string;
      };
      const resolvedDisplayName = resolveTotpDisplayName(displayName, this.enrolledFactors);
      factor = await MfaService.verifyTotpEnrollment(
        this.user,
        requireString(payload.enrollmentId, "enrollmentId"),
        requireString(payload.code, "code"),
        requireString(payload.challengeId, "challengeId"),
        requireString(payload.mfaSessionToken, "mfaSessionToken"),
        resolvedDisplayName
      );
    } else if (assertion instanceof PhoneMultiFactorAssertion) {
      factor = await MfaService.verifySmsEnrollment(
        this.user,
        assertion.credential.verificationId,
        assertion.credential.verificationCode,
        requireString(assertion.credential.challengeId, "challengeId"),
        requireString(assertion.credential.mfaSessionToken, "mfaSessionToken"),
        displayName ?? assertion.credential.displayName
      );
    } else {
      throwInvalidMfaRequest("Invalid MFA assertion");
    }

    this.replaceEnrolledFactor(factor);
    this.user._replaceMfaEnrolledFactor(factor);
  }

  async unenroll(option: MultiFactorInfo | string): Promise<void> {
    const factorId = typeof option === "string" ? option : option.uid;
    await MfaService.deleteFactor(this.user, requireString(factorId, "factorId"));
    this.removeEnrolledFactor(factorId);
    this.user._removeMfaEnrolledFactor(factorId);
  }

  private replaceEnrolledFactor(factor: MultiFactorInfo): void {
    const index = this.enrolledFactors.findIndex((enrolledFactor) => enrolledFactor.uid === factor.uid);
    if (index >= 0) {
      this.enrolledFactors[index] = factor;
      return;
    }

    this.enrolledFactors.push(factor);
  }

  private removeEnrolledFactor(factorId: string): void {
    const index = this.enrolledFactors.findIndex((factor) => factor.uid === factorId);
    if (index >= 0) {
      this.enrolledFactors.splice(index, 1);
    }
  }
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throwInvalidMfaRequest(`Invalid ${fieldName}`);
  }

  return value;
}

function resolveTotpDisplayName(displayName: string | null | undefined, enrolledFactors: MultiFactorInfo[]): string {
  if (typeof displayName === "string" && displayName.trim().length > 0) {
    return displayName;
  }

  const nextTotpIndex = enrolledFactors.filter((factor) => factor.factorId === "totp").length + 1;
  return `Authenticator App ${nextTotpIndex}`;
}

function throwInvalidMfaRequest(message: string): never {
  const error = new AuthError(ErrorCodeMessage.INVALID_ARGS, { message });
  error.status = ErrorCode.INVALID_ARGS;
  throw authErrorHandler(error);
}
