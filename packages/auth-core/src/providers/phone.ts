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
import { MultiFactorSessionImpl } from '../internal/multifactor_session.js';
import { PhoneAuthCredential, PhoneAuthCredentialContext, PhoneMultiFactorAssertion } from '../internal/phone.js';
import { Auth } from '../auth.js';
import { MultiFactorSession, PhoneMultiFactorInfo } from '../types/multifactor.js';

/** Describes the public `PhoneMultiFactorEnrollInfoOptions` value. */
export interface PhoneMultiFactorEnrollInfoOptions {
    /** Calling country code in E.164 form, for example "+1". */
    countryCode: string;
    /** Local or national phone number without the calling country code. */
    phoneNumber: string;
/** Describes the public `session` value. */
    session: MultiFactorSession;
/** Describes the public `displayName` value. */
    displayName?: string | null;
}

/** Describes the public `PhoneMultiFactorSignInInfoOptions` value. */
export interface PhoneMultiFactorSignInInfoOptions {
/** Describes the public `session` value. */
    session: MultiFactorSession;
/** Describes the public `multiFactorHint` value. */
    multiFactorHint?: PhoneMultiFactorInfo;
/** Describes the public `factorId` value. */
    factorId?: string;
}

/** Phone-number authentication provider. @example `const provider = new PhoneAuthProvider(auth);` */
export class PhoneAuthProvider {
/** Describes the public `PROVIDER_ID` value. */
    static readonly PROVIDER_ID: "phone" = "phone";

/**
 * Constructs a PhoneAuthProvider instance with the supplied configuration.
 *
 * @param auth - The Auth instance for this operation.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { PhoneAuthProvider } from "fusabase/auth";
 * const result = new PhoneAuthProvider(value);
 * void result;
 * ```
 */
    constructor(private readonly auth: Auth) {
        if (!(auth instanceof Auth)) {
            const error = new AuthError(ErrorCodeMessage.INVALID_ARGS, { message: "Invalid authentication instance" });
            error.status = ErrorCode.INVALID_ARGS;
            throw authErrorHandler(error);
        }
    }

/**
 * Executes the verifyPhoneNumber operation for this public SDK type.
 *
 * @param options - Optional settings that change this operation.
 * @param appVerifier - The appVerifier accepted by this operation.
 * @returns The result produced by `verifyPhoneNumber`, including any requested data or handle.
 * @example
 * ```ts
 * import { PhoneAuthProvider } from "fusabase/auth";
 * const result = client.verifyPhoneNumber(value, value);
 * void result;
 * ```
 */
    async verifyPhoneNumber(
        options: PhoneMultiFactorEnrollInfoOptions | PhoneMultiFactorSignInInfoOptions,
        appVerifier?: unknown
    ): Promise<string> {
        void appVerifier;

        if (!isObject(options) || !(options.session instanceof MultiFactorSessionImpl)) {
            throwInvalidPhoneRequest("Invalid phone verification options");
        }

        if (options.session._type === "enroll") {
            if (!options.session._user || !("phoneNumber" in options)) {
                throwInvalidPhoneRequest("Invalid phone enrollment options");
            }

            const enrollOptions = options as PhoneMultiFactorEnrollInfoOptions;
            const challengeId = requireString(options.session._id, "challengeId");
            const mfaSessionToken = requireString(options.session._token, "mfaSessionToken");
            const response = await MfaService.startSmsEnrollment(
                options.session,
                requireLocalPhoneNumber(enrollOptions.phoneNumber),
                requireCountryCode(enrollOptions.countryCode)
            );
            phoneAuthCredentialContexts.set(response.enrollmentId, {
                challengeId,
                mfaSessionToken,
                displayName: enrollOptions.displayName ?? "Personal phone"
            });
            return response.enrollmentId;
        }

        const challengeId = requireString(options.session._id, "challengeId");
        const mfaSessionToken = requireString(options.session._token, "mfaSessionToken");
        const factorId = getSignInFactorId(options);
        const response = await MfaService.sendSmsChallenge(this.auth, challengeId, mfaSessionToken, factorId);
        return response.factorId;
    }

/**
 * Executes the credential operation for this public SDK type.
 *
 * @param verificationId - The verificationId accepted by this operation.
 * @param verificationCode - The verificationCode accepted by this operation.
 * @returns The result produced by `credential`, including any requested data or handle.
 * @example
 * ```ts
 * import { PhoneAuthProvider } from "fusabase/auth";
 * const result = PhoneAuthProvider.credential(value, value);
 * void result;
 * ```
 */
    static credential(verificationId: string, verificationCode: string): PhoneAuthCredential {
        const context = phoneAuthCredentialContexts.get(verificationId);
        phoneAuthCredentialContexts.delete(verificationId);
        return new PhoneAuthCredential(verificationId, verificationCode, context);
    }
}

/** Creates phone-based multi-factor assertions. @example `const factorId = PhoneMultiFactorGenerator.FACTOR_ID;` */
export class PhoneMultiFactorGenerator {
/** Describes the public `FACTOR_ID` value. */
    static readonly FACTOR_ID: "phone" = "phone";

/**
 * Executes the assertion operation for this public SDK type.
 *
 * @param credential - The credential to attach or convert.
 * @returns The result produced by `assertion`, including any requested data or handle.
 * @example
 * ```ts
 * import { PhoneMultiFactorGenerator } from "fusabase/auth";
 * const result = PhoneMultiFactorGenerator.assertion(value);
 * void result;
 * ```
 */
    static assertion(credential: PhoneAuthCredential): PhoneMultiFactorAssertion {
        return PhoneMultiFactorAssertion._fromCredential(credential);
    }
}

function getSignInFactorId(options: PhoneMultiFactorSignInInfoOptions): string {
    if (options.multiFactorHint) {
        if (options.multiFactorHint.factorId !== "phone") {
            throwInvalidPhoneRequest("Invalid phone multi-factor hint");
        }

        return requireString(options.multiFactorHint.uid, "factorId");
    }

    return requireString(options.factorId, "factorId");
}

function requireString(value: unknown, fieldName: string): string {
    if (typeof value !== "string" || value.length === 0) {
        throwInvalidPhoneRequest(`Invalid ${fieldName}`);
    }

    return value;
}

function requireCountryCode(value: unknown): string {
    const countryCode = requireString(value, "countryCode").trim();
    if (!/^\+[1-9][0-9]{0,2}$/.test(countryCode)) {
        throwInvalidPhoneRequest("Invalid countryCode");
    }

    return countryCode;
}

function requireLocalPhoneNumber(value: unknown): string {
    const phoneNumber = requireString(value, "phoneNumber").trim();
    if (phoneNumber.startsWith("+")) {
        throwInvalidPhoneRequest("phoneNumber must not include countryCode");
    }
    if (!/^[0-9]{1,14}$/.test(phoneNumber)) {
        throwInvalidPhoneRequest("Invalid phoneNumber");
    }

    return phoneNumber;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function throwInvalidPhoneRequest(message: string): never {
    const error = new AuthError(ErrorCodeMessage.INVALID_ARGS, { message });
    error.status = ErrorCode.INVALID_ARGS;
    throw authErrorHandler(error);
}

const phoneAuthCredentialContexts = new Map<string, PhoneAuthCredentialContext>();
