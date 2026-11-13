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

import { AuthError, authErrorHandler, ErrorCode, ErrorCodeMessage } from '../errors.js';
import { MfaService } from '../mfa_service.js';
import { TotpMultiFactorAssertion } from '../internal/phone.js';
import { MultiFactorSessionImpl } from '../internal/multifactor_session.js';
import { MultiFactorSession, TotpSecret } from '../types/multifactor.js';

/** Creates time-based one-time-password multi-factor assertions. @example `const factorId = TotpMultiFactorGenerator.FACTOR_ID;` */
export class TotpMultiFactorGenerator {
/** Describes the public `FACTOR_ID` value. */
    static readonly FACTOR_ID: "totp" = "totp";

/**
 * Executes the generateSecret operation for this public SDK type.
 *
 * @param session - The session accepted by this operation.
 * @param displayName - The displayName accepted by this operation.
 * @returns The result produced by `generateSecret`, including any requested data or handle.
 * @example
 * ```ts
 * import { TotpMultiFactorGenerator } from "fusabase/auth";
 * const result = TotpMultiFactorGenerator.generateSecret(value, "example");
 * void result;
 * ```
 */
    static async generateSecret(
        session: MultiFactorSession,
        displayName?: string | null
    ): Promise<TotpSecret> {
        if (!(session instanceof MultiFactorSessionImpl) || session._type !== "enroll") {
            throwInvalidTotpRequest("Invalid MFA enrollment session");
        }

        if (!session._user) {
            throwInvalidTotpRequest("Invalid MFA enrollment user");
        }

        return MfaService.startTotpEnrollment(session, displayName);
    }

/**
 * Executes the assertionForEnrollment operation for this public SDK type.
 *
 * @param secret - The secret accepted by this operation.
 * @param verificationCode - The verificationCode accepted by this operation.
 * @returns The result produced by `assertionForEnrollment`, including any requested data or handle.
 * @example
 * ```ts
 * import { TotpMultiFactorGenerator } from "fusabase/auth";
 * const result = TotpMultiFactorGenerator.assertionForEnrollment(value, value);
 * void result;
 * ```
 */
    static assertionForEnrollment(secret: TotpSecret, verificationCode: string): TotpMultiFactorAssertion {
        return TotpMultiFactorAssertion._fromEnrollment(secret, verificationCode);
    }

/**
 * Executes the assertionForSignIn operation for this public SDK type.
 *
 * @param enrollmentId - The enrollmentId accepted by this operation.
 * @param verificationCode - The verificationCode accepted by this operation.
 * @returns The result produced by `assertionForSignIn`, including any requested data or handle.
 * @example
 * ```ts
 * import { TotpMultiFactorGenerator } from "fusabase/auth";
 * const result = TotpMultiFactorGenerator.assertionForSignIn(value, value);
 * void result;
 * ```
 */
    static assertionForSignIn(enrollmentId: string, verificationCode: string): TotpMultiFactorAssertion {
        return TotpMultiFactorAssertion._fromSignIn(enrollmentId, verificationCode);
    }
}

function throwInvalidTotpRequest(message: string): never {
    const error = new AuthError(ErrorCodeMessage.INVALID_ARGS, { message });
    error.status = ErrorCode.INVALID_ARGS;
    throw authErrorHandler(error);
}
