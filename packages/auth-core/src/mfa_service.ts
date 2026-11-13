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

import { fusabaseFetch } from "../../app/src/fusabase-fetch.js";
import { authErrorHandler } from "./errors.js";
import { MfaFactorResponse, MultiFactorInfoImpl } from "./internal/multifactor.js";
import { Auth } from "./auth.js";
import { MultiFactorInfo, TotpSecret } from "./types/multifactor.js";
import { User } from "./user.js";
import { Utils } from "./util/util.js";
import { MultiFactorSessionImpl } from "./internal/multifactor_session.js";

type MfaRequestOwner = Auth | User;

type MfaRoutes = {
  factorList: string;
  factorDelete: string;
  smsChallenge: string;
  smsChallengeFactorField: "factor" | "factorId";
};

const ONPREM_MFA_ROUTES: MfaRoutes = {
  factorList: "mfa/enrollment-options",
  factorDelete: "mfa/factors",
  smsChallenge: "mfa/challenge/sms/send",
  smsChallengeFactorField: "factorId"
};

const IDCS_MFA_ROUTES: MfaRoutes = {
  factorList: "authenticate/mfa/factors",
  factorDelete: "authenticate/mfa/factors",
  smsChallenge: "authenticate/mfa/challenge/sms/send",
  smsChallengeFactorField: "factor"
};

export interface MfaEnrollmentOptionsResponse {
  availableFactors: Array<{
    type: string;
    displayName?: string | null;
  }>;
  existingFactors: MfaFactorResponse[];
  factors?: MfaFactorResponse[];
}

export interface SmsStartResponse {
  enrollmentId: string;
  maskedPhoneNumber?: string;
  expiresInSeconds?: number;
  resendCooldownSeconds?: number;
  message?: string;
}

export interface SmsChallengeResponse {
  challengeId: string;
  factorId: string;
  maskedPhoneNumber: string;
  expiresInSeconds?: number;
  resendCooldownSeconds?: number;
  message?: string;
}

export interface MfaTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
}

export class MfaService {
  static async createSession(user: User): Promise<MultiFactorSessionImpl> {
    const response = await mfaRequest(user, "mfa/createSession", {
      method: "GET"
    }, true);

    return MultiFactorSessionImpl._fromEnrollment(
      user,
      requireString(response.challengeId, "challengeId"),
      requireString(response.mfaSessionToken, "mfaSessionToken")
    );
  }

  static async getEnrollmentOptions(user: User): Promise<MfaEnrollmentOptionsResponse> {
    const response = await mfaRequest(user, mfaRoutes(user).factorList, {
      method: "GET"
    }, true);
    const factors = factorsFromResponse(response);

    return {
      availableFactors: Array.isArray(response.availableFactors) ? response.availableFactors : [],
      existingFactors: factors,
      factors
    };
  }

  static async listFactors(user: User): Promise<MultiFactorInfo[]> {
    const response = await mfaRequest(user, mfaRoutes(user).factorList, {
      method: "GET"
    }, true);

    return factorsFromResponse(response).map((factor: MfaFactorResponse) =>
      MultiFactorInfoImpl._fromServerResponse(factor)
    );
  }

  static async startTotpEnrollment(
    session: MultiFactorSessionImpl,
    displayName?: string | null
  ): Promise<TotpSecret> {
    const user = session._user;
    if (!user) {
      throw new Error("Invalid MFA enrollment user");
    }

    const response = await mfaRequest(user, "authenticate/mfa/enroll/start", {
      method: "POST",
      body: JSON.stringify({
        factor: "TOTP",
        challengeId: requireString(session._id, "challengeId"),
        mfaSessionToken: requireString(session._token, "mfaSessionToken"),
        ...(displayName ? { displayName } : {})
      })
    }, true);

    const secretCode = requireString(
      response.sharedSecret ?? response.secretCode ?? response.manualEntryKey,
      "sharedSecret"
    );
    const issuer = optionalString(response.issuer) ?? "Fusabase";

    return {
      enrollmentId: requireString(response.factorId ?? response.factor_id ?? response.enrollmentId, "factorId"),
      qrCodeUrl: optionalString(response.qrCodeUrl) ?? buildTotpUri(issuer, user.email, secretCode),
      manualEntryKey: secretCode,
      digits: optionalNumber(response.digits),
      periodSeconds: optionalNumber(response.periodSeconds),
      issuer,
      expiresInSeconds: optionalNumber(response.enrollmentTtlSeconds ?? response.expiresInSeconds),
      ...(session._id ? { challengeId: session._id } : {}),
      ...(session._token ? { mfaSessionToken: session._token } : {})
    };
  }

  static async verifyTotpEnrollment(
    user: User,
    enrollmentId: string,
    code: string,
    challengeId: string,
    mfaSessionToken: string,
    displayName?: string | null
  ): Promise<MultiFactorInfo> {
    const response = await mfaRequest(user, "authenticate/mfa/enroll/verify", {
      method: "POST",
      body: JSON.stringify({
        factorId: enrollmentId,
        otpCode: code,
        challengeId,
        mfaSessionToken
      })
    }, true);

    return MultiFactorInfoImpl._fromServerResponse(
      normalizeMfaFactor(response, enrollmentId, "totp", displayName ?? "Authenticator App")
    );
  }

  static async startSmsEnrollment(
    session: MultiFactorSessionImpl,
    phoneNumber: string,
    countryCode: string
  ): Promise<SmsStartResponse> {
    const user = session._user;
    if (!user) {
      throw new Error("Invalid MFA enrollment user");
    }

    const response = await mfaRequest(user, "authenticate/mfa/enroll/start", {
      method: "POST",
      body: JSON.stringify({
        factor: "SMS",
        countryCode,
        mobileNumber: phoneNumber,
        challengeId: requireString(session._id, "challengeId"),
        mfaSessionToken: requireString(session._token, "mfaSessionToken")
      })
    }, true);

    return {
      enrollmentId: requireString(
        response.factorId ?? response.verification_id ?? response.enrollmentId,
        "factorId"
      ),
      maskedPhoneNumber: optionalString(response.maskedPhoneNumber ?? response.masked_phone_number),
      expiresInSeconds: optionalNumber(response.verificationTtlSeconds ?? response.expiresInSeconds),
      resendCooldownSeconds: optionalNumber(response.resendCooldownSeconds),
      message: optionalString(response.message)
    };
  }

  static async verifySmsEnrollment(
    user: User,
    enrollmentId: string,
    code: string,
    challengeId: string,
    mfaSessionToken: string,
    displayName?: string | null
  ): Promise<MultiFactorInfo> {
    const response = await mfaRequest(user, "authenticate/mfa/enroll/verify", {
      method: "POST",
      body: JSON.stringify({
        factorId: enrollmentId,
        otpCode: code,
        challengeId,
        mfaSessionToken
      })
    }, true);

    return MultiFactorInfoImpl._fromServerResponse(
      normalizeMfaFactor(response, enrollmentId, "SMS", displayName ?? "Personal phone")
    );
  }

  static async deleteFactor(user: User, factorId: string): Promise<void> {
    await mfaRequest(user, `${mfaRoutes(user).factorDelete}/${encodeURIComponent(factorId)}`, {
      method: "DELETE"
    }, true);
  }

  static async sendSmsChallenge(auth: Auth, challengeId: string, mfaSessionToken: string, factorId: string): Promise<SmsChallengeResponse> {
    const routes = mfaRoutes(auth);
    const response = await mfaRequest(auth, routes.smsChallenge, {
      method: "POST",
      body: JSON.stringify({
        [routes.smsChallengeFactorField]: factorId,
        challengeId,
        mfaSessionToken
      })
    }, false);

    return {
      challengeId,
      factorId,
      maskedPhoneNumber: optionalString(response.maskedPhoneNumber) ?? "",
      expiresInSeconds: optionalNumber(response.verificationTtlSeconds ?? response.expiresInSeconds),
      resendCooldownSeconds: optionalNumber(response.resendCooldownSeconds),
      message: optionalString(response.message)
    };
  }

  static async verifyMfaChallenge(
    auth: Auth,
    challengeId: string,
    mfaSessionToken: string,
    factorId: string,
    code: string
  ): Promise<MfaTokenResponse> {
    const response = await mfaRequest(auth, "authenticate/mfa/verify", {
      method: "POST",
      body: JSON.stringify({
        factor: factorId,
        otpCode: code,
        challengeId,
        mfaSessionToken
      })
    }, false);

    return {
      access_token: requireString(response.access_token, "access_token"),
      refresh_token: optionalString(response.refresh_token),
      token_type: optionalString(response.token_type),
      expires_in: optionalNumber(response.expires_in)
    };
  }
}

async function mfaRequest(owner: MfaRequestOwner, path: string, init: RequestInit, includeAuth: boolean): Promise<any> {
  let response: Response | null = null;
  let result: any = null;
  const reqURL = buildMfaRequestUrl(owner, path);
  const app = getApp(owner);
  const headers: Record<string, string> = normalizeHeaders(init.headers);

  if (init.body != null && !hasHeader(headers, "content-type")) {
    headers["Content-Type"] = "application/json";
  }

  if (includeAuth) {
    const idToken = await getUser(owner).getIdToken();
    headers.Authorization = `Bearer ${idToken ?? ""}`;
  }

  const params: RequestInit = {
    ...init,
    headers
  };

  try {
    response = await fusabaseFetch(app, reqURL, params);
    Utils.checkResponse(response);
    result = await parseJson(response);
    return result;
  } catch (err: any) {
    // MFA request bodies can contain session tokens, OTPs, and phone data.
    // Keep failure diagnostics useful without passing request/response payloads
    // through a generic logger.
    Utils.baasTrace(getLogLevel(owner), {
      method: params.method ?? 'GET',
      authType: getAuthType(owner),
      status: response?.status ?? err?.status ?? 408,
    });
    err.status = response ? response.status : err.status ?? 408;
    err.authType = getAuthType(owner);
    if (response) {
      try {
        const errorBody = await response.clone().json();
        err.message = errorBody.detail || errorBody.error || errorBody.message || err.message;
      } catch {
        // Keep the original error message.
      }
    }
    throw authErrorHandler(err);
  }
}

async function parseJson(response: Response): Promise<any> {
  if (response.status === 204) {
    return {};
  }

  const text = await response.text();
  return text.length > 0 ? JSON.parse(text) : {};
}

function getBaseUrl(owner: MfaRequestOwner): string {
  const config = owner instanceof User ? owner.config : owner.intConfig;
  return String(config.domainURL).replace(/\/?$/, "/");
}

function buildMfaRequestUrl(owner: MfaRequestOwner, path: string): string {
  const config = owner instanceof User ? owner.config : owner.intConfig;
  const url = new URL(path, getBaseUrl(owner));
  const appId = String(config.appID ?? "");
  if (appId) {
    url.searchParams.set("apiKey", appId);
  }
  return url.toString();
}

function factorsFromResponse(response: any): MfaFactorResponse[] {
  const factors = Array.isArray(response.factors)
    ? response.factors
    : Array.isArray(response.existingFactors)
      ? response.existingFactors
      : [];

  return factors.map((factor: any) =>
    normalizeMfaFactor(factor, factor.factorId, factor.method, factor.factorId)
  );
}

function normalizeMfaFactor(
  response: any,
  fallbackFactorId: string,
  fallbackProvider: string,
  fallbackDisplayName: string
): MfaFactorResponse {
  return {
    ...response,
    factor_id: requireString(response.factor_id ?? response.factorId ?? fallbackFactorId, "factorId"),
    display_name: optionalString(response.display_name ?? response.displayName) ?? fallbackDisplayName,
    provider: requireString(response.provider ?? response.method ?? fallbackProvider, "provider")
  };
}

function mfaRoutes(owner: MfaRequestOwner): MfaRoutes {
  return isIdcsAuth(owner) ? IDCS_MFA_ROUTES : ONPREM_MFA_ROUTES;
}

function isIdcsAuth(owner: MfaRequestOwner): boolean {
  return getAuthType(owner).toLowerCase() === "idcs";
}

function getApp(owner: MfaRequestOwner): any {
  return owner instanceof User ? owner.auth?.app : owner.app;
}

function getLogLevel(owner: MfaRequestOwner): number {
  return owner instanceof User ? owner.auth?.app?.logLevel : owner.app?.logLevel;
}

function getAuthType(owner: MfaRequestOwner): string {
  const config = owner instanceof User ? owner.config : owner.intConfig;
  return String(config.authType ?? "").toUpperCase();
}

function getUser(owner: MfaRequestOwner): User {
  if (owner instanceof User) {
    return owner;
  }

  return owner.currentUser as User;
}

function normalizeHeaders(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) {
    return {};
  }

  if (headers instanceof Headers) {
    const normalized: Record<string, string> = {};
    headers.forEach((value, key) => {
      normalized[key] = value;
    });
    return normalized;
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  return headers as Record<string, string>;
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  return Object.keys(headers).some((headerName) => headerName.toLowerCase() === name.toLowerCase());
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid ${fieldName}`);
  }

  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function buildTotpUri(issuer: string, email: string | null | undefined, secret: string): string {
  const label = `${issuer}:${email || "user"}`;
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}`;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}
