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

import type { App } from "../../app/src/public-types.js";
import {
  decodeTokenClaims,
  getAuthCore,
  type AuthCoreClient,
  type AuthCoreMfaSession,
  type AuthCoreProviderCredentialInput,
  type User,
  type UserCredential,
} from "../../auth-core/src/index.js";

/** Event name delivered to an account-state listener. */
export type RelationalAuthEvent =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED"
  | "PASSWORD_RECOVERY";

/** Machine-readable category for an account-operation error. */
export type RelationalAuthErrorCode = "unsupported" | "invalid_request" | "auth_error" | "mfa_required";

/** MFA challenge returned after primary sign-in succeeds but needs a second factor. */
export type RelationalMfaRequired = {
/** Describes the public `challengeId` value. */
  challengeId: string;
/** Describes the public `mfaSessionToken` value. */
  mfaSessionToken: string;
/** Describes the public `factors` value. */
  factors: MfaFactor[];
};

/**
 * Describes an unsuccessful account operation.
 *
 * @example
 * ```ts
 * if (error instanceof RelationalAuthError) console.error(error.message);
 * ```
 */
export class RelationalAuthError extends Error {
/** Describes the public `status` value. */
  status: number;
/** Describes the public `code` value. */
  code: RelationalAuthErrorCode;
/** Describes the public `mfa` value. */
  mfa?: RelationalMfaRequired;

/**
 * Constructs a RelationalAuthError instance with the supplied configuration.
 *
 * @param message - A human-readable error message.
 * @param status - Optional HTTP status; defaults to 0.
 * @param code - The code accepted by this operation.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalAuthError } from "fusabase/relational";
 * const result = new RelationalAuthError("Account operation failed", 400, "auth_error");
 * void result;
 * ```
 */
  constructor(message: string, status = 400, code: RelationalAuthErrorCode = "auth_error") {
    super(message);
    this.name = "RelationalAuthError";
    this.status = status;
    this.code = code;
  }
}

/** Promise resolving to a data-and-error response envelope. */
export type RelationalAuthResponse<T> = Promise<{
  data: T;
  error: RelationalAuthError | null;
}>;

/** Public account profile returned by account operations. */
export type RelationalAuthUser = {
/** Describes the public `id` value. */
  id: string;
/** Describes the public `aud` value. */
  aud: string;
/** Describes the public `email` value. */
  email: string | null;
/** Describes the public `phone` value. */
  phone: string | null;
/** Describes the public `app_metadata` value. */
  app_metadata: Record<string, unknown>;
/** Describes the public `user_metadata` value. */
  user_metadata: Record<string, unknown>;
/** Describes the public `identities` value. */
  identities: RelationalUserIdentity[];
/** Describes the public `created_at` value. */
  created_at?: string;
/** Describes the public `updated_at` value. */
  updated_at?: string;
};

/** Linked identity-provider record for an account. */
export type RelationalUserIdentity = {
/** Describes the public `id` value. */
  id: string;
/** Describes the public `user_id` value. */
  user_id: string;
/** Describes the public `identity_data` value. */
  identity_data: Record<string, unknown>;
/** Describes the public `provider` value. */
  provider: string;
/** Describes the public `created_at` value. */
  created_at?: string;
/** Describes the public `updated_at` value. */
  updated_at?: string;
};

/** Authenticated session with tokens, expiry data, and account profile. */
export type RelationalAuthSession = {
/** Describes the public `access_token` value. */
  access_token: string;
/** Describes the public `refresh_token` value. */
  refresh_token: string;
/** Describes the public `expires_in` value. */
  expires_in: number;
/** Describes the public `expires_at` value. */
  expires_at?: number;
/** Describes the public `token_type` value. */
  token_type: "bearer";
/** Describes the public `user` value. */
  user: RelationalAuthUser;
};

/** Email/password account-creation input. */
export type RelationalAuthCredentials = {
/** Describes the public `email` value. */
  email: string;
/** Describes the public `password` value. */
  password: string;
/** Describes the public `options` value. */
  options?: {
    data?: Record<string, unknown>;
    emailRedirectTo?: string;
  };
};

/** Email/password sign-in input. */
export type RelationalPasswordCredentials = {
/** Describes the public `email` value. */
  email: string;
/** Describes the public `password` value. */
  password: string;
};

/** Identity providers accepted by token sign-in. */
export type RelationalIdTokenProvider = "google" | "facebook" | "github";

/** Token-based identity-provider sign-in input. */
export type RelationalIdTokenCredentials = {
/** Describes the public `provider` value. */
  provider: RelationalIdTokenProvider;
/** Describes the public `token` value. */
  token?: string;
/** Describes the public `access_token` value. */
  access_token?: string;
/** Describes the public `nonce` value. */
  nonce?: string;
};

/** Redirect or popup provider sign-in input. */
export type RelationalOAuthCredentials = {
/** Describes the public `provider` value. */
  provider: string;
/** Describes the public `options` value. */
  options?: {
    redirectTo?: string;
    scopes?: string;
    queryParams?: Record<string, string>;
    skipBrowserRedirect?: boolean;
  };
};

/** Access-token and refresh-token pair used to restore a session. */
export type RelationalSessionInput = {
/** Describes the public `access_token` value. */
  access_token: string;
/** Describes the public `refresh_token` value. */
  refresh_token: string;
};

/** Decoded token claims keyed by claim name. */
export type RelationalClaims = Record<string, unknown>;

/** Data shape returned when claims are requested. */
export type RelationalClaimsResponse = {
/** Describes the public `claims` value. */
  claims: RelationalClaims | null;
};

/** Data shape returned after account state initialization. */
export type RelationalInitializeResponse = {
/** Describes the public `session` value. */
  session: RelationalAuthSession | null;
};

/** Profile and password fields accepted by an account update. */
export type RelationalUserAttributes = {
/** Describes the public `email` value. */
  email?: string;
/** Describes the public `phone` value. */
  phone?: string;
/** Describes the public `password` value. */
  password?: string;
/** Describes the public `oldPassword` value. */
  oldPassword?: string;
/** Describes the public `data` value. */
  data?: Record<string, unknown>;
};

/** Credentials used to link an identity provider. */
export type RelationalProviderCredentials = {
/** Describes the public `provider` value. */
  provider: string;
/** Describes the public `token` value. */
  token?: string;
/** Describes the public `access_token` value. */
  access_token?: string;
/** Describes the public `options` value. */
  options?: Record<string, unknown>;
};

/** Input for resending an account-verification message. */
export type RelationalResendParams = {
/** Describes the public `type` value. */
  type: "signup" | "email_change" | "sms" | "phone_change" | string;
/** Describes the public `email` value. */
  email?: string;
/** Describes the public `phone` value. */
  phone?: string;
/** Describes the public `options` value. */
  options?: {
    emailRedirectTo?: string;
  };
};

/** Supported multi-factor kinds. */
export type MfaFactorType = "totp" | "phone";

/** Public details of an enrolled multi-factor method. */
export type MfaFactor = {
/** Describes the public `id` value. */
  id: string;
/** Describes the public `friendly_name` value. */
  friendly_name: string | null;
/** Describes the public `factor_type` value. */
  factor_type: MfaFactorType;
/** Describes the public `status` value. */
  status: "verified" | "unverified";
/** Describes the public `created_at` value. */
  created_at: string;
/** Describes the public `updated_at` value. */
  updated_at?: string;
/** Describes the public `phone` value. */
  phone?: string;
};

/** Input for starting a multi-factor enrollment. */
export type MfaEnrollParams =
  | { factorType: "totp"; friendlyName?: string; issuer?: string }
  | {
      factorType: "phone";
      /** Dialing prefix (for example, `+1` or `+91`). */
      countryCode: string;
      /** Local phone number without the country-code prefix. */
      phone: string;
      friendlyName?: string;
      channel?: "sms" | "whatsapp";
    };

/** Input for creating a multi-factor challenge. */
export type MfaChallengeParams = {
/** Describes the public `factorId` value. */
  factorId: string;
/** Describes the public `channel` value. */
  channel?: "sms" | "whatsapp";
};

/** Input for verifying a multi-factor challenge. */
export type MfaVerifyParams = {
/** Describes the public `factorId` value. */
  factorId: string;
/** Describes the public `challengeId` value. */
  challengeId: string;
/** Describes the public `code` value. */
  code: string;
};

/** Verifies a server-issued MFA challenge from a pending sign-in. */
export type MfaSignInVerifyParams = MfaVerifyParams & {
  mfaSessionToken: string;
};

/** Sends an SMS code for a server-issued pending sign-in MFA challenge. */
export type MfaSignInChallengeParams = {
/** Describes the public `factorId` value. */
  factorId: string;
/** Describes the public `challengeId` value. */
  challengeId: string;
/** Describes the public `mfaSessionToken` value. */
  mfaSessionToken: string;
};

/** Promise resolving to a multi-factor data-and-error response envelope. */
export type MfaResponse<T> = Promise<{
  data: T | null;
  error: RelationalAuthError | null;
}>;

function emptyResponse<T>(data: T): { data: T; error: null } {
  return { data, error: null };
}

function errorResponse<T>(data: T, error: unknown): { data: T; error: RelationalAuthError } {
  return { data, error: toAuthError(error) };
}

function mfaErrorResponse<T>(error: unknown): { data: T | null; error: RelationalAuthError } {
  return { data: null, error: toAuthError(error) };
}

function unsupported(message: string): RelationalAuthError {
  return new RelationalAuthError(message, 501, "unsupported");
}

function toAuthError(error: unknown): RelationalAuthError {
  if (error instanceof RelationalAuthError) return error;
  const pendingMfa = pendingSignInMfa(error);
  if (pendingMfa) {
    const authError = new RelationalAuthError("Multi-factor authentication required", 401, "mfa_required");
    authError.mfa = pendingMfa;
    return authError;
  }
  if (error instanceof Error) {
    const status = typeof (error as Error & { status?: unknown }).status === "number"
      ? (error as Error & { status: number }).status
      : 400;
    return new RelationalAuthError(error.message, status);
  }
  return new RelationalAuthError(String(error), 400);
}

function pendingSignInMfa(error: unknown): RelationalMfaRequired | null {
  const resolver = (error as {
    resolver?: {
      hints?: unknown[];
      session?: { _id?: unknown; _token?: unknown };
    };
  } | null)?.resolver;
  const challengeId = resolver?.session?._id;
  const mfaSessionToken = resolver?.session?._token;
  if (typeof challengeId !== "string" || !challengeId || typeof mfaSessionToken !== "string" || !mfaSessionToken) {
    return null;
  }
  return {
    challengeId,
    mfaSessionToken,
    factors: (resolver.hints ?? []).map(hint => toMfaFactor(hint as {
      uid: string;
      displayName?: string | null;
      factorId: MfaFactorType;
      enrollmentTime: string;
      phoneNumber?: string;
    })),
  };
}

function normalizeProvider(provider: string): string {
  return provider.trim().toLowerCase();
}

function toCoreProviderCredential(credentials: RelationalProviderCredentials): AuthCoreProviderCredentialInput {
  return {
    provider: credentials.provider,
    token: credentials.token,
    accessToken: credentials.access_token,
  };
}

function toCoreIdTokenProviderCredential(credentials: RelationalIdTokenCredentials): AuthCoreProviderCredentialInput {
  const provider = normalizeProvider(credentials.provider);

  if (provider !== "google" && provider !== "facebook" && provider !== "github") {
    throw unsupported("signInWithIdToken() only supports google, facebook, and github");
  }

  return {
    provider,
    token: credentials.token,
    accessToken: credentials.access_token,
  };
}

function toRelationalIdentity(user: User, providerData: Record<string, unknown>): RelationalUserIdentity {
  const providerId = String(providerData.providerId ?? user.providerId ?? "password");
  const uid = String(providerData.uid ?? user.uid);
  const email = typeof providerData.email === "string" ? providerData.email : user.email ?? null;

  return {
    id: uid,
    user_id: user.uid,
    provider: providerId,
    identity_data: {
      email,
      full_name: providerData.displayName ?? user.displayName ?? null,
      avatar_url: providerData.photoURL ?? user.photoURL ?? null,
      phone: providerData.phoneNumber ?? user.phoneNumber ?? null,
    },
    created_at: user.metadata?.creationTime,
    updated_at: user.metadata?.lastSignInTime,
  };
}

function toRelationalUser(user: User | null): RelationalAuthUser | null {
  if (!user) return null;

  const identities = user.providerData.length > 0
    ? user.providerData.map(providerData => toRelationalIdentity(user, providerData as unknown as Record<string, unknown>))
    : [toRelationalIdentity(user, {
        uid: user.uid,
        providerId: user.providerId,
        email: user.email,
        displayName: user.displayName,
        phoneNumber: user.phoneNumber,
        photoURL: user.photoURL,
      })];

  return {
    id: user.uid,
    aud: "authenticated",
    email: user.email ?? null,
    phone: user.phoneNumber ?? null,
    app_metadata: {
      provider: user.providerId,
      providers: identities.map(identity => identity.provider),
    },
    user_metadata: {
      full_name: user.displayName ?? null,
      avatar_url: user.photoURL ?? null,
      email_verified: user.emailVerified ?? false,
    },
    identities,
    created_at: user.metadata?.creationTime,
    updated_at: user.metadata?.lastSignInTime,
  };
}

async function toRelationalSession(user: User | null, forceRefresh = false): Promise<RelationalAuthSession | null> {
  if (!user) return null;

  const accessToken = await user.getIdToken(forceRefresh);
  if (!accessToken) return null;

  const tokenResult = await user.getIdTokenResult(false);
  const expiresAt = tokenResult?.expirationTime ?? undefined;
  const now = Math.floor(Date.now() / 1000);
  const relationalUser = toRelationalUser(user);

  if (!relationalUser) return null;

  return {
    access_token: accessToken,
    refresh_token: user.refreshToken ?? "",
    expires_in: expiresAt ? Math.max(expiresAt - now, 0) : 0,
    expires_at: expiresAt,
    token_type: "bearer",
    user: relationalUser,
  };
}

async function credentialSession(credential: UserCredential): Promise<{
  user: RelationalAuthUser | null;
  session: RelationalAuthSession | null;
}> {
  return {
    user: toRelationalUser(credential.user),
    session: await toRelationalSession(credential.user),
  };
}

type MfaOperation = {
  factorId: string;
  factorType: MfaFactorType;
  session: AuthCoreMfaSession;
  enrollment?: boolean;
  friendlyName?: string;
};

function toMfaFactor(factor: {
  uid: string;
  displayName?: string | null;
  factorId: MfaFactorType;
  enrollmentTime: string;
  phoneNumber?: string;
}): MfaFactor {
  return {
    id: factor.uid,
    friendly_name: factor.displayName ?? null,
    factor_type: factor.factorId,
    status: "verified",
    created_at: factor.enrollmentTime,
    ...(factor.phoneNumber ? { phone: factor.phoneNumber } : {}),
  };
}

/**
 * Manages multi-factor enrollment and verification for the current account.
 *
 * @example
 * ```ts
 * const enrollment = await client.auth.mfa.enroll({ factorType: "totp" });
 * ```
 */
export class MfaClient {
  private readonly operations = new Map<string, MfaOperation>();

/**
 * Constructs a MfaClient instance with the supplied configuration.
 *
 * @param auth - The Auth instance for this operation.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { MfaClient } from "fusabase/relational";
 * const result = await client.auth.mfa.enroll({ factorType: "totp" });
 * void result;
 * ```
 */
  constructor(private readonly auth: AuthCoreClient) {}

  /**
   * Starts enrollment and returns factor details, including a TOTP QR value when applicable.
   * @param params - Enrollment object. For TOTP use
   * `{ factorType: "totp", friendlyName?: string, issuer?: string }`; for a
   * phone factor use `{ factorType: "phone", countryCode: string, phone: string,
   * friendlyName?: string, channel?: "sms" | "whatsapp" }`.
   * @returns A response containing an unverified factor or an error.
   * @example `const result = await client.auth.mfa.enroll({ factorType: "totp" });`
   */
  async enroll(params: MfaEnrollParams): MfaResponse<
    MfaFactor & { totp?: { qr_code: string; secret: string; uri: string } }
  > {
    try {
      const user = this.requireUser();
      const session = await this.auth.createMfaSession(user);

      if (params.factorType === "totp") {
        const secret = await this.auth.startTotpEnrollment(session);
        this.operations.set(secret.enrollmentId, {
          factorId: secret.enrollmentId,
          factorType: "totp",
          session,
          enrollment: true,
          friendlyName: params.friendlyName,
        });
        return emptyResponse({
          id: secret.enrollmentId,
          friendly_name: params.friendlyName ?? null,
          factor_type: "totp",
          status: "unverified",
          created_at: new Date().toISOString(),
          totp: {
            qr_code: secret.qrCodeUrl,
            secret: secret.manualEntryKey,
            uri: secret.qrCodeUrl,
          },
        });
      }

      const enrollment = await this.auth.startSmsEnrollment(
        session,
        params.phone,
        params.countryCode
      );
      this.operations.set(enrollment.enrollmentId, {
        factorId: enrollment.enrollmentId,
        factorType: "phone",
        session,
        enrollment: true,
        friendlyName: params.friendlyName,
      });
      return emptyResponse({
        id: enrollment.enrollmentId,
        friendly_name: params.friendlyName ?? null,
        factor_type: "phone",
        status: "unverified",
        created_at: new Date().toISOString(),
        phone: enrollment.maskedPhoneNumber ?? params.phone,
      });
    } catch (error) {
      return mfaErrorResponse(error);
    }
  }

  /**
   * Creates a verification challenge for an enrolled or pending factor.
   * @param params - `{ factorId: string, channel?: "sms" | "whatsapp" }`.
   * @returns A response containing challenge details or an error.
   * @example `const result = await client.auth.mfa.challenge({ factorId: "factor-id" });`
   */
  async challenge(params: MfaChallengeParams): MfaResponse<{
    id: string;
    type: MfaFactorType;
    expires_at?: number;
  }> {
    try {
      if (params.channel === "whatsapp") {
        throw unsupported("MFA WhatsApp challenges are not backed by the current Fusabase auth backend");
      }
      const user = this.requireUser();
      const pendingEnrollment = this.operations.get(params.factorId);
      const factor = pendingEnrollment
        ? { factorId: pendingEnrollment.factorType }
        : await this.findFactor(params.factorId);
      const session = pendingEnrollment?.session ?? await this.auth.createMfaSession(user);
      const challengeId = session._id;
      if (!challengeId) throw new RelationalAuthError("Invalid MFA challenge", 400, "auth_error");

      if (factor.factorId === "phone" && !pendingEnrollment?.enrollment) {
        await this.auth.sendSmsMfaChallenge(challengeId, session._token ?? "", params.factorId);
      }
      this.operations.set(challengeId, {
        factorId: params.factorId,
        factorType: factor.factorId,
        session,
        enrollment: pendingEnrollment?.enrollment,
      });
      return emptyResponse({ id: challengeId, type: factor.factorId });
    } catch (error) {
      return mfaErrorResponse(error);
    }
  }

/**
 * Executes the sendSignInSmsChallenge operation for this public SDK type.
 *
 * @param params - Provider-specific OAuth parameters.
 * @returns The result produced by `sendSignInSmsChallenge`, including any requested data or handle.
 * @example
 * ```ts
 * import { MfaClient } from "fusabase/relational";
 * const result = await client.auth.mfa.sendSignInSmsChallenge({
 *   factorId: "factor-id",
 *   challengeId: "challenge-id",
 *   mfaSessionToken: "mfa-session-token",
 * });
 * void result;
 * ```
 */
  async sendSignInSmsChallenge(params: MfaSignInChallengeParams): MfaResponse<Record<string, never>> {
    try {
      await this.auth.sendSmsMfaChallenge(params.challengeId, params.mfaSessionToken, params.factorId);
      return emptyResponse({});
    } catch (error) {
      return mfaErrorResponse(error);
    }
  }

  /**
   * Verifies a challenge code and returns an updated session.
   * @param params - `{ factorId: string, challengeId: string, code: string }`.
   * @returns A response containing the updated session or an error.
   * @example `await client.auth.mfa.verify({ factorId: "factor-id", challengeId: "challenge-id", code: "123456" });`
   */
  async verify(params: MfaVerifyParams): MfaResponse<RelationalAuthSession> {
    try {
      const operation = this.operations.get(params.challengeId);
      if (!operation || operation.factorId !== params.factorId) {
        throw new RelationalAuthError("Unknown or expired MFA challenge", 400, "invalid_request");
      }

      const user = this.requireUser();
      if (operation.enrollment) {
        const factor = operation.factorType === "totp"
          ? await this.auth.verifyTotpEnrollment(
              user,
              operation.factorId,
              params.code,
              operation.session._id ?? "",
              operation.session._token ?? "",
              operation.friendlyName
            )
          : await this.auth.verifySmsEnrollment(
              user,
              operation.factorId,
              params.code,
              operation.session._id ?? "",
              operation.session._token ?? "",
              operation.friendlyName
            );
        user._replaceMfaEnrolledFactor(factor);
        this.operations.delete(params.challengeId);
        this.operations.delete(operation.factorId);
        const currentSession = await toRelationalSession(user);
        if (!currentSession) throw new RelationalAuthError("No authenticated user", 401, "invalid_request");
        return emptyResponse(currentSession);
      }

      const tokens = await this.auth.verifyMfaChallenge(
        params.challengeId,
        operation.session._token ?? "",
        params.factorId,
        params.code
      );
      this.operations.delete(params.challengeId);
      const credential = await this.auth.completeMfaSignIn(tokens);
      const session = await toRelationalSession(credential.user);
      if (!session) throw new RelationalAuthError("MFA verification did not create a session", 400, "auth_error");
      return emptyResponse(session);
    } catch (error) {
      return mfaErrorResponse(error);
    }
  }

  /**
   * Creates and verifies a challenge in one call.
   * @param params - `{ factorId: string, code: string }`.
   * @returns A response containing the updated session or an error.
   * @example `await client.auth.mfa.challengeAndVerify({ factorId: "factor-id", code: "123456" });`
   */
  async challengeAndVerify(params: { factorId: string; code: string } | MfaSignInVerifyParams): MfaResponse<RelationalAuthSession> {
    if ("challengeId" in params) {
      try {
        const tokens = await this.auth.verifyMfaChallenge(
          params.challengeId,
          params.mfaSessionToken,
          params.factorId,
          params.code,
        );
        const credential = await this.auth.completeMfaSignIn(tokens);
        const session = await toRelationalSession(credential.user);
        if (!session) throw new RelationalAuthError("MFA verification did not create a session", 400, "auth_error");
        return emptyResponse(session);
      } catch (error) {
        return mfaErrorResponse(error);
      }
    }
    const challenge = await this.challenge({ factorId: params.factorId });
    if (challenge.error || !challenge.data) return { data: null, error: challenge.error };
    return this.verify({ factorId: params.factorId, challengeId: challenge.data.id, code: params.code });
  }

  /**
   * Removes an enrolled factor from the current account.
   * @param params - `{ factorId: string }` identifying the factor to remove.
   * @returns A response containing the removed identifier or an error.
   * @example `await client.auth.mfa.unenroll({ factorId: "factor-id" });`
   */
  async unenroll(params: { factorId: string }): MfaResponse<{ id: string }> {
    try {
      const user = this.requireUser();
      await this.auth.deleteMfaFactor(user, params.factorId);
      user._removeMfaEnrolledFactor(params.factorId);
      return emptyResponse({ id: params.factorId });
    } catch (error) {
      return mfaErrorResponse(error);
    }
  }

  /**
   * Lists factors, grouped by factor type.
   * @returns A response containing all, TOTP, and phone factors or an error.
   * @example `const { data } = await client.auth.mfa.listFactors();`
   */
  async listFactors(): MfaResponse<{
    all: MfaFactor[];
    totp: MfaFactor[];
    phone: MfaFactor[];
  }> {
    try {
      const factors = (await this.auth.listMfaFactors(this.requireUser())).map(toMfaFactor);
      return emptyResponse({
        all: factors,
        totp: factors.filter(factor => factor.factor_type === "totp"),
        phone: factors.filter(factor => factor.factor_type === "phone"),
      });
    } catch (error) {
      return mfaErrorResponse(error);
    }
  }

  /**
   * Reports the current and next authentication assurance levels.
   * @param jwt - Optional token whose claims should be inspected.
   * @returns A response containing assurance levels and authentication methods.
   * @example `const { data } = await client.auth.mfa.getAuthenticatorAssuranceLevel();`
   */
  async getAuthenticatorAssuranceLevel(jwt?: string): MfaResponse<{
    currentLevel: "aal1" | "aal2" | null;
    nextLevel: "aal1" | "aal2" | null;
    currentAuthenticationMethods: unknown[];
  }> {
    try {
      const user = this.auth.currentUser;
      if (!user) return emptyResponse({ currentLevel: null, nextLevel: null, currentAuthenticationMethods: [] });
      const token = jwt ?? await user.getIdToken();
      if (!token) throw new RelationalAuthError("Unable to obtain an authentication token", 401, "auth_error");
      const claims = decodeTokenClaims(token);
      const currentLevel = claims.aal === "aal1" || claims.aal === "aal2" ? claims.aal : null;
      const factors = await this.auth.listMfaFactors(user);
      return emptyResponse({
        currentLevel,
        nextLevel: factors.length > 0 ? "aal2" : currentLevel,
        currentAuthenticationMethods: Array.isArray(claims.amr) ? claims.amr : [],
      });
    } catch (error) {
      return mfaErrorResponse(error);
    }
  }

  private requireUser(): User {
    if (!this.auth.currentUser) {
      throw new RelationalAuthError("No authenticated user", 401, "invalid_request");
    }
    return this.auth.currentUser;
  }

  private async findFactor(factorId: string) {
    const factor = (await this.auth.listMfaFactors(this.requireUser())).find(candidate => candidate.uid === factorId);
    if (!factor) throw new RelationalAuthError("MFA factor not found", 404, "invalid_request");
    return factor;
  }
}

/**
 * Provides browser-oriented account, session, identity, and MFA operations.
 * Methods resolve to `{ data, error }`; inspect `error` before using `data`.
 *
 * @example
 * ```ts
 * const { data, error } = await client.auth.signInWithPassword({
 *   email: "ada@example.com",
 *   password: "strong-password",
 * });
 * if (error) throw error;
 * ```
 */
export class RelationalAuthClient {
  private readonly auth: AuthCoreClient;
/** Describes the public `mfa` value. */
  readonly mfa: MfaClient;
  private autoRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly subscriptions = new Set<() => void>();

/**
 * Constructs a RelationalAuthClient instance with the supplied configuration.
 *
 * @param app - The app instance that owns this service.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalAuthClient } from "fusabase/relational";
 * const result = client.auth;
 * void result;
 * ```
 */
  constructor(readonly app: App) {
    this.auth = getAuthCore(app);
    this.mfa = new MfaClient(this.auth);
  }

  private clearAutoRefreshTimer(): void {
    if (this.autoRefreshTimer) {
      clearTimeout(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
  }

  private scheduleAutoRefresh(session: RelationalAuthSession | null): void {
    this.clearAutoRefreshTimer();
    if (!session || !this.auth.currentUser) return;

    const now = Math.floor(Date.now() / 1000);
    const refreshInSeconds = session.expires_at
      ? Math.max(session.expires_at - now - 60, 30)
      : Math.max(session.expires_in - 60, 30);

    this.autoRefreshTimer = setTimeout(() => {
      void this.refreshSession().then(({ data }) => {
        this.scheduleAutoRefresh(data.session);
      });
    }, refreshInSeconds * 1000);
  }

  /**
   * Waits for persisted account state and returns the initial session.
   * @returns A response containing the current session or an error.
   */
  async initialize(): RelationalAuthResponse<RelationalInitializeResponse> {
    try {
      await this.auth.authStateReady();
      return emptyResponse({ session: await toRelationalSession(this.auth.currentUser) });
    } catch (error) {
      return errorResponse({ session: null }, error);
    }
  }

/**
 * Executes the dispose operation for this public SDK type.
 *
 * @returns The result produced by `dispose`, including any requested data or handle.
 */
  async dispose(): Promise<void> {
    this.stopAutoRefresh();
    for (const unsubscribe of this.subscriptions) {
      unsubscribe();
    }
    this.subscriptions.clear();
  }

/**
 * Executes the startAutoRefresh operation for this public SDK type.
 *
 * @returns The result produced by `startAutoRefresh`, including any requested data or handle.
 */
  startAutoRefresh(): void {
    void this.initialize().then(({ data, error }) => {
      if (!error) this.scheduleAutoRefresh(data.session);
    });
  }

/**
 * Executes the stopAutoRefresh operation for this public SDK type.
 *
 * @returns The result produced by `stopAutoRefresh`, including any requested data or handle.
 */
  stopAutoRefresh(): void {
    this.clearAutoRefreshTimer();
  }

  /**
   * Creates an account with an email address and password.
   * @param credentials - `{ email: string, password: string, options?: object }`.
   * `options.data` accepts profile key/value pairs such as `full_name`, `name`,
   * and `avatar_url`; `options.emailRedirectTo` is an optional URL string.
   * @returns A response containing the account and session or an error.
   */
  async signUp(credentials: RelationalAuthCredentials): RelationalAuthResponse<{
    user: RelationalAuthUser | null;
    session: RelationalAuthSession | null;
  }> {
    try {
      const credential = await this.auth.signUpWithPassword({
        email: credentials.email,
        password: credentials.password,
      });
      if (credentials.options?.data && Object.keys(credentials.options.data).length > 0) {
        await this.auth.updateProfile(credential.user, {
          displayName: String(credentials.options.data.full_name ?? credentials.options.data.name ?? credential.user.displayName ?? ""),
          photoURL: typeof credentials.options.data.avatar_url === "string" ? credentials.options.data.avatar_url : credential.user.photoURL ?? undefined,
        });
      }
      return emptyResponse(await credentialSession(credential));
    } catch (error) {
      return errorResponse({ user: null, session: null }, error);
    }
  }

  /**
   * Signs in with an email address and password.
   * @param credentials - `{ email: string, password: string }`.
   * @returns A response containing the account and session or an error.
   */
  async signInWithPassword(credentials: RelationalPasswordCredentials): RelationalAuthResponse<{
    user: RelationalAuthUser | null;
    session: RelationalAuthSession | null;
  }> {
    try {
      const credential = await this.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });
      return emptyResponse(await credentialSession(credential));
    } catch (error) {
      return errorResponse({ user: null, session: null }, error);
    }
  }

  /**
   * Exchanges a supported identity-provider token for a session.
   * @param credentials - `{ provider: "google" | "facebook" | "github",
   * token: string, access_token?: string, nonce?: string }`.
   * @returns A response containing the account and session or an error.
   */
  async signInWithIdToken(credentials: RelationalIdTokenCredentials): RelationalAuthResponse<{
    user: RelationalAuthUser | null;
    session: RelationalAuthSession | null;
  }> {
    try {
      const credential = await this.auth.signInWithProviderCredential(toCoreIdTokenProviderCredential(credentials));
      return emptyResponse(await credentialSession(credential));
    } catch (error) {
      return errorResponse({ user: null, session: null }, error);
    }
  }

  /**
   * Starts a provider sign-in using a redirect or popup.
   * @param credentials - `{ provider: string, options?: { redirectTo?: string,
   * skipBrowserRedirect?: boolean } }`.
   * @returns A response containing provider details or an error.
   */
  async signInWithOAuth(credentials: RelationalOAuthCredentials): RelationalAuthResponse<{
    provider: string;
    url: string | null;
  }> {
    try {
      if (credentials.options?.skipBrowserRedirect) {
        await this.auth.signInWithProviderPopup({ provider: credentials.provider });
        return emptyResponse({ provider: credentials.provider, url: null });
      }
      await this.auth.signInWithProviderRedirect({ provider: credentials.provider });
      return emptyResponse({ provider: credentials.provider, url: null });
    } catch (error) {
      return errorResponse({ provider: credentials.provider, url: null }, error);
    }
  }

/**
 * Executes the getRedirectResult operation for this public SDK type.
 *
 * @returns The result produced by `getRedirectResult`, including any requested data or handle.
 */
  async getRedirectResult(): RelationalAuthResponse<{
    user: RelationalAuthUser | null;
    session: RelationalAuthSession | null;
  }> {
    try {
      const credential = await this.auth.getRedirectResult();
      if (!credential) return emptyResponse({ user: null, session: null });
      return emptyResponse(await credentialSession(credential));
    } catch (error) {
      return errorResponse({ user: null, session: null }, error);
    }
  }

  /**
   * Returns the current session, or `null` when no account is signed in.
   * @returns A response containing the session or an error.
   */
  async getSession(): RelationalAuthResponse<{ session: RelationalAuthSession | null }> {
    try {
      await this.auth.authStateReady();
      return emptyResponse({ session: await toRelationalSession(this.auth.currentUser) });
    } catch (error) {
      return errorResponse({ session: null }, error);
    }
  }

  /**
   * Reloads and returns the current account profile.
   * @param jwt - Optional token for compatibility with token-based callers.
   * @returns A response containing the account or an error.
   */
  async getUser(jwt?: string): RelationalAuthResponse<{ user: RelationalAuthUser | null }> {
    try {
      if (jwt && !this.auth.currentUser) {
        throw unsupported("getUser(jwt) requires a current Fusabase-authenticated user in this SDK facade");
      }
      if (this.auth.currentUser) {
        await this.auth.reload(this.auth.currentUser);
      }
      return emptyResponse({ user: toRelationalUser(this.auth.currentUser) });
    } catch (error) {
      return errorResponse({ user: null }, error);
    }
  }

/**
 * Executes the getClaims operation for this public SDK type.
 *
 * @param _jwt - The _jwt accepted by this operation.
 * @returns The result produced by `getClaims`, including any requested data or handle.
 */
  async getClaims(_jwt?: string): RelationalAuthResponse<RelationalClaimsResponse> {
    try {
      if (_jwt) {
        return emptyResponse({ claims: decodeTokenClaims(_jwt) });
      }
      const user = this.auth.currentUser;
      if (!user) {
        throw new RelationalAuthError("No authenticated user", 401, "invalid_request");
      }
      const tokenResult = await user.getIdTokenResult(false);
      return emptyResponse({ claims: tokenResult?.claims ?? null });
    } catch (error) {
      return errorResponse({ claims: null }, error);
    }
  }

  /**
   * Updates profile data or, with `oldPassword`, the current password.
   * @param attributes - `{ data?: { full_name?: string, name?: string,
   * avatar_url?: string, [key: string]: unknown }, password?: string,
   * oldPassword?: string }`. Supplying `password` also requires `oldPassword`.
   * @returns A response containing the updated account or an error.
   */
  async updateUser(attributes: RelationalUserAttributes): RelationalAuthResponse<{ user: RelationalAuthUser | null }> {
    try {
      const user = this.auth.currentUser;
      if (!user) throw new RelationalAuthError("No authenticated user", 401, "invalid_request");

      if (attributes.data) {
        await this.auth.updateProfile(user, {
          displayName: typeof attributes.data.full_name === "string"
            ? attributes.data.full_name
            : typeof attributes.data.name === "string"
              ? attributes.data.name
              : user.displayName ?? undefined,
          photoURL: typeof attributes.data.avatar_url === "string" ? attributes.data.avatar_url : user.photoURL ?? undefined,
        });
      }

      if (attributes.password) {
        if (!attributes.oldPassword) {
          throw unsupported("updateUser({ password }) requires oldPassword until Fusabase supports recovery-session password updates");
        }
        await this.auth.updatePassword(user, attributes.oldPassword, attributes.password);
      }

      // updateProfile() reloads and replaces auth.currentUser. Reloading the
      // original instance afterwards makes User.getIdToken() reject it as a
      // stale user. Password updates do not reload, so reload the current
      // instance only for that case.
      if (attributes.password) {
        await this.auth.reload(this.auth.currentUser ?? user);
      }
      return emptyResponse({ user: toRelationalUser(this.auth.currentUser) });
    } catch (error) {
      return errorResponse({ user: null }, error);
    }
  }

  /**
   * Refreshes credentials and returns the resulting session.
   * @param currentSession - Optional session input retained for compatibility.
   * @returns A response containing a refreshed account and session or an error.
   */
  async refreshSession(currentSession?: RelationalSessionInput): RelationalAuthResponse<{
    user: RelationalAuthUser | null;
    session: RelationalAuthSession | null;
  }> {
    try {
      void currentSession;
      const session = await toRelationalSession(this.auth.currentUser, true);
      return emptyResponse({ user: session?.user ?? null, session });
    } catch (error) {
      return errorResponse({ user: null, session: null }, error);
    }
  }

  /**
   * Restores a session from access and refresh tokens.
   * @param session - `{ access_token: string, refresh_token: string }`.
   * @returns A response containing the restored account and session or an error.
   */
  async setSession(session: RelationalSessionInput): RelationalAuthResponse<{
    user: RelationalAuthUser | null;
    session: RelationalAuthSession | null;
  }> {
    try {
      const credential = await this.auth.setSession({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
      });
      return emptyResponse(await credentialSession(credential));
    } catch (error) {
      return errorResponse({ user: null, session: null }, error);
    }
  }

  /**
   * Signs the current account out.
   * @param options - `{ scope?: "global" | "local" | "others" }`.
   * @returns A response with an empty data object or an error.
   */
  async signOut(options: { scope?: "global" | "local" | "others" } = {}): RelationalAuthResponse<Record<string, never>> {
    try {
      void options;
      await this.auth.signOut();
      return emptyResponse({});
    } catch (error) {
      return errorResponse({}, error);
    }
  }

/**
 * Executes the onAuthStateChange operation for this public SDK type.
 *
 * @param callback - The callback invoked when the operation produces a result.
 * @returns The result produced by `onAuthStateChange`, including any requested data or handle.
 */
  onAuthStateChange(callback: (event: RelationalAuthEvent, session: RelationalAuthSession | null) => void): {
    data: {
      subscription: {
        unsubscribe: () => void;
      };
    };
  } {
    let initialized = false;

    const authUnsubscribe = this.auth.onAuthStateChanged(async user => {
      const session = await toRelationalSession(user);
      if (!initialized) {
        initialized = true;
        callback("INITIAL_SESSION", session);
        return;
      }
      callback(user ? "SIGNED_IN" : "SIGNED_OUT", session);
    });
    let active = true;
    const unsubscribe = (): void => {
      if (!active) return;
      active = false;
      authUnsubscribe();
      this.subscriptions.delete(unsubscribe);
    };
    this.subscriptions.add(unsubscribe);

    return {
      data: {
        subscription: {
          unsubscribe,
        },
      },
    };
  }

  /**
   * Sends a password-reset message to an email address.
   * @param email - Destination email address.
   * @param options - Optional redirect destination.
   * @returns A response with an empty data object or an error.
   */
  async resetPasswordForEmail(email: string, options?: { redirectTo?: string }): RelationalAuthResponse<Record<string, never>> {
    try {
      await this.auth.sendPasswordResetEmail(email, options?.redirectTo ? { url: options.redirectTo } : undefined);
      return emptyResponse({});
    } catch (error) {
      return errorResponse({}, error);
    }
  }

/**
 * Executes the verifyOtp operation for this public SDK type.
 *
 * @param params - Provider-specific OAuth parameters.
 * @returns The result produced by `verifyOtp`, including any requested data or handle.
 */
  async verifyOtp(params: { token?: string; token_hash?: string; type: string }): RelationalAuthResponse<{
    user: RelationalAuthUser | null;
    session: RelationalAuthSession | null;
  }> {
    try {
      if (params.type !== "recovery") {
        throw unsupported(`verifyOtp('${params.type}') is not backed by the current Fusabase auth backend`);
      }
      await this.auth.verifyPasswordResetCode(params.token_hash ?? params.token ?? "");
      return emptyResponse({ user: toRelationalUser(this.auth.currentUser), session: await toRelationalSession(this.auth.currentUser) });
    } catch (error) {
      return errorResponse({ user: null, session: null }, error);
    }
  }

/**
 * Executes the resend operation for this public SDK type.
 *
 * @param params - Provider-specific OAuth parameters.
 * @returns The result produced by `resend`, including any requested data or handle.
 */
  async resend(params: RelationalResendParams): RelationalAuthResponse<Record<string, never>> {
    try {
      if (params.type !== "signup") {
        throw unsupported(`resend('${params.type}') is not backed by the current Fusabase auth backend`);
      }
      const user = this.auth.currentUser;
      if (!user) {
        throw unsupported("resend({ type: 'signup' }) requires the user to be signed in for Fusabase email verification");
      }
      if (params.email && user.email && params.email.toLowerCase() !== user.email.toLowerCase()) {
        throw new RelationalAuthError("resend email must match the current user", 400, "invalid_request");
      }
      await this.auth.sendEmailVerification(
        user,
        params.options?.emailRedirectTo ? { url: params.options.emailRedirectTo } : undefined
      );
      return emptyResponse({});
    } catch (error) {
      return errorResponse({}, error);
    }
  }

/**
 * Executes the getUserIdentities operation for this public SDK type.
 *
 * @returns The result produced by `getUserIdentities`, including any requested data or handle.
 */
  async getUserIdentities(): RelationalAuthResponse<{ identities: RelationalUserIdentity[] }> {
    const user = toRelationalUser(this.auth.currentUser);
    return emptyResponse({ identities: user?.identities ?? [] });
  }

/**
 * Executes the linkIdentity operation for this public SDK type.
 *
 * @param credentials - The credentials accepted by this operation.
 * @returns The result produced by `linkIdentity`, including any requested data or handle.
 */
  async linkIdentity(credentials: RelationalProviderCredentials): RelationalAuthResponse<{
    user: RelationalAuthUser | null;
    session: RelationalAuthSession | null;
  }> {
    try {
      const user = this.auth.currentUser;
      if (!user) throw new RelationalAuthError("No authenticated user", 401, "invalid_request");

      let credential: UserCredential;
      if (credentials.token || credentials.access_token) {
        credential = await this.auth.linkWithProviderCredential(user, toCoreProviderCredential(credentials));
      } else if (credentials.options?.redirectTo || credentials.options?.skipBrowserRedirect === false) {
        await this.auth.linkWithProviderRedirect(user, { provider: credentials.provider });
        return emptyResponse({ user: toRelationalUser(this.auth.currentUser), session: await toRelationalSession(this.auth.currentUser) });
      } else {
        credential = await this.auth.linkWithProviderPopup(user, { provider: credentials.provider });
      }
      return emptyResponse(await credentialSession(credential));
    } catch (error) {
      return errorResponse({ user: null, session: null }, error);
    }
  }

/**
 * Executes the unlinkIdentity operation for this public SDK type.
 *
 * @param identity - The identity accepted by this operation.
 * @returns The result produced by `unlinkIdentity`, including any requested data or handle.
 */
  async unlinkIdentity(identity: string | { provider?: string; provider_id?: string }): RelationalAuthResponse<{
    user: RelationalAuthUser | null;
  }> {
    try {
      const user = this.auth.currentUser;
      if (!user) throw new RelationalAuthError("No authenticated user", 401, "invalid_request");

      const providerId = typeof identity === "string"
        ? identity
        : identity.provider ?? identity.provider_id;
      if (!providerId) {
        throw new RelationalAuthError("Missing identity provider", 400, "invalid_request");
      }

      await this.auth.unlink(user, providerId);
      return emptyResponse({ user: toRelationalUser(this.auth.currentUser) });
    } catch (error) {
      return errorResponse({ user: null }, error);
    }
  }

/**
 * Executes the signInAnonymously operation for this public SDK type.
 *
 * @returns An unsupported-operation error response. Anonymous sign-in is not
 * supported by the current Fusabase authentication backend.
 */
  async signInAnonymously(): RelationalAuthResponse<{
    user: RelationalAuthUser | null;
    session: RelationalAuthSession | null;
  }> {
    return errorResponse({ user: null, session: null }, unsupported("signInAnonymously() is not backed by the current Fusabase auth backend"));
  }

/**
 * Executes the signInWithOtp operation for this public SDK type.
 *
 * @returns An unsupported-operation error response. OTP sign-in is not
 * supported by the current Fusabase authentication backend.
 */
  async signInWithOtp(): RelationalAuthResponse<{
    user: RelationalAuthUser | null;
    session: RelationalAuthSession | null;
  }> {
    return errorResponse({ user: null, session: null }, unsupported("signInWithOtp() is not backed by the current Fusabase auth backend"));
  }

/**
 * Executes the signInWithSSO operation for this public SDK type.
 *
 * @returns An unsupported-operation error response. SSO sign-in is not
 * supported by the current Fusabase authentication backend.
 */
  async signInWithSSO(): RelationalAuthResponse<{
    user: RelationalAuthUser | null;
    session: RelationalAuthSession | null;
  }> {
    return errorResponse({ user: null, session: null }, unsupported("signInWithSSO() is not backed by the current Fusabase auth backend"));
  }
}
