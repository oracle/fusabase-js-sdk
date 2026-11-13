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
import { MultiFactorFactorId, MultiFactorInfo, PhoneMultiFactorInfo, TotpMultiFactorInfo } from "../types/multifactor.js";

/**
 * Server shape for an enrolled MFA factor. ORDS uses snake_case names.
 * The SDK-facing output uses uid/factorId/displayName/enrollmentTime.
 */
export type MfaFactorResponse = {
  factor_id: string;
  display_name: string;
  provider: string;
  enrollment_time?: string;
  masked_phone_number?: string | null;
};

/**
 * Internal implementation for SDK-safe MFA factor metadata.
 */
export abstract class MultiFactorInfoImpl<TFactorId extends MultiFactorFactorId = MultiFactorFactorId> implements MultiFactorInfo {
  readonly uid: string;
  readonly displayName?: string | null;
  readonly factorId: TFactorId;
  readonly enrollmentTime: string;

  protected constructor(factorId: TFactorId, response: MfaFactorResponse) {
    this.factorId = factorId;
    this.uid = requireString(response.factor_id, "factorId");
    this.displayName = response.display_name;
    this.enrollmentTime = normalizeEnrollmentTime(response.enrollment_time);
  }

  static _fromServerResponse(response: MfaFactorResponse): MultiFactorInfoImpl {
    const factorId = normalizeFactorId(response.provider);

    if (factorId === "phone") {
      return PhoneMultiFactorInfoImpl._fromServerResponse(response);
    }

    return TotpMultiFactorInfoImpl._fromServerResponse(response);
  }
}

/**
 * Internal implementation for SDK-safe phone/SMS factor metadata.
 */
export class PhoneMultiFactorInfoImpl extends MultiFactorInfoImpl<"phone"> implements PhoneMultiFactorInfo {
  readonly phoneNumber: string;

  private constructor(response: MfaFactorResponse) {
    super("phone", response);
    this.phoneNumber = requireString(
      response.masked_phone_number ?? response.display_name,
      "maskedPhoneNumber"
    );
  }

  static _fromServerResponse(response: MfaFactorResponse): PhoneMultiFactorInfoImpl {
    return new PhoneMultiFactorInfoImpl(response);
  }
}

/**
 * Internal implementation for SDK-safe TOTP factor metadata.
 */
export class TotpMultiFactorInfoImpl extends MultiFactorInfoImpl<"totp"> implements TotpMultiFactorInfo {
  private constructor(response: MfaFactorResponse) {
    super("totp", response);
  }

  static _fromServerResponse(response: MfaFactorResponse): TotpMultiFactorInfoImpl {
    return new TotpMultiFactorInfoImpl(response);
  }
}

function normalizeFactorId(value: unknown): MultiFactorFactorId {
  const normalized = requireString(value, "type").toLowerCase();

  if (normalized === "totp") {
    return "totp";
  }
  if (normalized === "idcs_totp" || normalized === "baas_totp" || normalized === "baas_totp_appid") {
    return "totp";
  }
  if (normalized === "sms" || normalized === "sms_otp" || normalized === "phone") {
    return "phone";
  }
  // SMS delivery providers identify the same phone MFA factor differently.
  if (normalized === "idcs_sms" || normalized === "twilio" || normalized === "vonage") {
    return "phone";
  }

  throwInvalidMfaResponse(`Unsupported MFA factor type: ${normalized}`);
}

function normalizeEnrollmentTime(value: unknown): string {
  if (value === undefined || value === null) {
    return new Date().toISOString();
  }

  const raw = requireString(value, "enrollment_time");
  const timestamp = Date.parse(raw);
  return Number.isNaN(timestamp) ? raw : new Date(timestamp).toISOString();
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throwInvalidMfaResponse(`Invalid ${fieldName}`);
  }

  return value;
}

function throwInvalidMfaResponse(message: string): never {
  const error = new AuthError(ErrorCodeMessage.INVALID_ARGS, { message });
  error.status = ErrorCode.INVALID_ARGS;
  throw authErrorHandler(error);
}
