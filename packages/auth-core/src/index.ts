// Copyright (c) 2015, 2025, Oracle and/or its affiliates.

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
import { getAuth } from "./internal/core.js";
import type { AuthCredential, UserCredential } from "./internal/credential.js";
import { IdTokenResult } from "./types/idtoken.js";
import type { Auth } from "./auth.js";
import type { User } from "./user.js";
import type { AuthProvider } from "./providers/provider.js";
import { FacebookAuthProvider } from "./providers/facebook.js";
import { GithubAuthProvider } from "./providers/github.js";
import { GoogleAuthProvider } from "./providers/google.js";
import { IDCSAuthProvider } from "./providers/idcs.js";
import { OAuthProvider } from "./providers/oauth.js";
import { SAMLAuthProvider } from "./providers/saml.js";
import { MfaService, type MfaTokenResponse } from "./mfa_service.js";
import type { MultiFactorInfo, TotpSecret } from "./types/multifactor.js";

/** Stops an AuthCore state listener. */
export type AuthCoreUnsubscribe = () => void;
/** Authenticated multi-factor session used by enrollment operations. */
export type AuthCoreMfaSession = Awaited<ReturnType<typeof MfaService.createSession>>;
/** Provider identifier and tokens used to create a provider credential. */
export type AuthCoreProviderCredentialInput = {
/** Describes the public `provider` value. */
  provider: string;
/** Describes the public `token` value. */
  token?: string;
/** Describes the public `accessToken` value. */
  accessToken?: string;
};
/** Provider identifier used to start an OAuth popup or redirect flow. */
export type AuthCoreOAuthInput = {
/** Describes the public `provider` value. */
  provider: string;
};
/** Email and password submitted to a password authentication operation. */
export type AuthCorePasswordInput = {
/** Describes the public `email` value. */
  email: string;
/** Describes the public `password` value. */
  password: string;
};
/** Access and refresh tokens used to restore an authenticated session. */
export type AuthCoreSessionInput = {
/** Describes the public `accessToken` value. */
  accessToken: string;
/** Describes the public `refreshToken` value. */
  refreshToken: string;
};

function normalizeProvider(provider: string): string {
  return provider.trim().toLowerCase();
}

function createProvider(provider: string): AuthProvider {
  const normalized = normalizeProvider(provider);
  if (normalized === "google") return new GoogleAuthProvider();
  if (normalized === "github") return new GithubAuthProvider();
  if (normalized === "facebook") return new FacebookAuthProvider();
  if (normalized === "idcs") return new IDCSAuthProvider();
  if (normalized.startsWith("saml")) return new SAMLAuthProvider(provider);
  return new OAuthProvider(provider);
}

function createCredential(input: AuthCoreProviderCredentialInput): AuthCredential {
  const provider = normalizeProvider(input.provider);
  const idToken = input.token;
  const accessToken = input.accessToken;

  if (provider === "google") return GoogleAuthProvider.credential(idToken, accessToken);
  if (provider === "github") return GithubAuthProvider.credential(idToken, accessToken);
  if (provider === "facebook") return FacebookAuthProvider.credential(idToken, accessToken);
  if (provider === "idcs") return IDCSAuthProvider.credential(idToken, accessToken);
  if (provider.startsWith("saml")) return SAMLAuthProvider.credential(accessToken ?? idToken);
  return OAuthProvider.credential(idToken, accessToken);
}

/**
 * Provides a compact, service-oriented authentication API for an application.
 *
 * @example
 * ```ts
 * const client = getAuthCore(app);
 * await client.signInWithPassword({ email: "person@example.com", password: "secret" });
 * ```
 */
export class AuthCoreClient {
  private readonly auth: Auth;

  /**
   * Creates an authentication client bound to an application.
   *
   * @param app - Application that owns the authentication service.
   * @returns The authentication client.
   * @example
   * ```ts
   * const client = new AuthCoreClient(app);
   * ```
   */
  constructor(readonly app: App) {
    this.auth = getAuth(app);
  }

  get currentUser(): User | null {
    return this.auth.currentUser;
  }

  /** Waits for persisted authentication state to be loaded. @returns A promise that resolves when the state is ready.
   * @example
   * ```ts
   * await client.authStateReady();
   * ``` */
  authStateReady(): Promise<void> {
    return this.auth.authStateReady().then(() => undefined);
  }

  /** Subscribes to authentication-state changes. @param callback - Receives the signed-in user or `null`. @returns A function that removes the listener.
   * @example
   * ```ts
   * const unsubscribe = client.onAuthStateChanged((user) => console.log(user));
   * unsubscribe();
   * ``` */
  onAuthStateChanged(callback: (user: User | null) => void): AuthCoreUnsubscribe {
    return this.auth.onAuthStateChanged(callback);
  }

  /** Creates an account with an email and password. @param input - Email and password for the new account. @returns A credential for the created user. @throws {Error} If the service rejects the credentials.
   * @example
   * ```ts
   * await client.signUpWithPassword({ email: "person@example.com", password: "secret" });
   * ``` */
  signUpWithPassword(input: AuthCorePasswordInput): Promise<UserCredential> {
    return this.auth.createUserWithEmailAndPassword(input.email, input.password);
  }

  /** Signs in with an email and password. @param input - Email and password to verify. @returns A credential for the signed-in user. @throws {Error} If the credentials are invalid.
   * @example
   * ```ts
   * await client.signInWithPassword({ email: "person@example.com", password: "secret" });
   * ``` */
  signInWithPassword(input: AuthCorePasswordInput): Promise<UserCredential> {
    return this.auth.signInWithEmailAndPassword(input.email, input.password);
  }

  /** Signs in with a provider token. @param input - Provider and its ID or access token. @returns A credential for the signed-in user. @throws {Error} If the credential is rejected.
   * @example
   * ```ts
   * await client.signInWithProviderCredential({ provider: "google", token });
   * ``` */
  signInWithProviderCredential(input: AuthCoreProviderCredentialInput): Promise<UserCredential> {
    return this.auth.signInWithCredential(createCredential(input));
  }

  /** Starts provider sign-in in a popup. @param input - OAuth provider to use. @returns A credential after the popup completes. @throws {Error} If the popup flow fails.
   * @example
   * ```ts
   * await client.signInWithProviderPopup({ provider: "google" });
   * ``` */
  signInWithProviderPopup(input: AuthCoreOAuthInput): Promise<UserCredential> {
    return this.auth.signInWithPopup(createProvider(input.provider));
  }

  /** Starts provider sign-in by redirecting the browser. @param input - OAuth provider to use. @returns A promise that resolves while navigation begins. @throws {Error} If redirect setup fails.
   * @example
   * ```ts
   * await client.signInWithProviderRedirect({ provider: "google" });
   * ``` */
  signInWithProviderRedirect(input: AuthCoreOAuthInput): Promise<void> {
    return this.auth.signInWithRedirect(createProvider(input.provider));
  }

  /** Completes a browser OAuth redirect when the provider returns to the app. @returns The credential, or `null` when no redirect is pending. @throws {Error} If the provider response is invalid.
   * @example
   * ```ts
   * const result = await client.getRedirectResult();
   * ``` */
  getRedirectResult(): Promise<UserCredential | null> {
    return this.auth.getRedirectResult();
  }

  /** Signs out the current user. @returns A promise that resolves when local state is cleared. @throws {Error} If sign-out fails.
   * @example
   * ```ts
   * await client.signOut();
   * ``` */
  signOut(): Promise<void> {
    return this.auth.signOut();
  }

  /** Restores a session from tokens. @param input - Access and refresh tokens. @returns A credential for the restored user. @throws {Error} If the tokens are invalid.
   * @example
   * ```ts
   * await client.setSession({ accessToken, refreshToken });
   * ``` */
  setSession(input: AuthCoreSessionInput): Promise<UserCredential> {
    return this.auth.signInWithoutTrigger({
      access_token: new IdTokenResult(input.accessToken),
      refresh_token: input.refreshToken,
    });
  }

  /** Completes an MFA sign-in challenge. @param tokens - Tokens returned by MFA verification. @returns A credential for the signed-in user. @throws {Error} If the service rejects the MFA result.
   * @example
   * ```ts
   * await client.completeMfaSignIn(tokens);
   * ``` */
  completeMfaSignIn(tokens: MfaTokenResponse): Promise<UserCredential> {
    return this.auth._completeMfaSignIn(tokens);
  }

  /** Updates profile fields for a user. @param user - User to update. @param profile - Display name and/or photo URL. @returns A promise that resolves when the profile is saved. @throws {Error} If the update is rejected.
   * @example
   * ```ts
   * await client.updateProfile(user, { displayName: "Ada" });
   * ``` */
  updateProfile(user: User, profile: { displayName?: string; photoURL?: string }): Promise<void> {
    return user.updateProfile(profile);
  }

  /** Changes a user's password. @param user - User to update. @param oldPassword - Current password. @param newPassword - Replacement password. @returns A promise that resolves when the password changes. @throws {Error} If verification or validation fails.
   * @example
   * ```ts
   * await client.updatePassword(user, oldPassword, newPassword);
   * ``` */
  updatePassword(user: User, oldPassword: string, newPassword: string): Promise<void> {
    return user.updatePassword(oldPassword, newPassword);
  }

  /** Reloads a user's server state. @param user - User to reload. @returns A promise that resolves after refresh. @throws {Error} If the reload fails.
   * @example
   * ```ts
   * await client.reload(user);
   * ``` */
  reload(user: User): Promise<void> {
    return user.reload();
  }

  /** Sends a password-reset email. @param email - Recipient email address. @param actionCodeSettings - Optional continue URL settings. @returns A promise that resolves after the request is accepted. @throws {Error} If the request is rejected.
   * @example
   * ```ts
   * await client.sendPasswordResetEmail("person@example.com");
   * ``` */
  sendPasswordResetEmail(email: string, actionCodeSettings?: { url: string }): Promise<void> {
    return this.auth.sendPasswordResetEmail(email, actionCodeSettings);
  }

  /** Verifies a password-reset code. @param code - Code from the reset email. @returns The email address associated with the code. @throws {Error} If the code is invalid or expired.
   * @example
   * ```ts
   * const email = await client.verifyPasswordResetCode(code);
   * ``` */
  verifyPasswordResetCode(code: string): Promise<string> {
    return this.auth.verifyPasswordResetCode(code);
  }

  /** Sends a verification email. @param user - User whose email to verify. @param actionCodeSettings - Optional continue URL settings. @returns A promise that resolves after the request is accepted. @throws {Error} If the request is rejected.
   * @example
   * ```ts
   * await client.sendEmailVerification(user);
   * ``` */
  sendEmailVerification(user: User, actionCodeSettings?: { url: string }): Promise<void> {
    return user.sendEmailVerification(actionCodeSettings);
  }

  /** Links a provider credential to a user.
   * @param user - User to link.
   * @param input - Provider and token input.
   * @returns A credential for the linked user.
   * @throws {Error} If linking is rejected.
   * @example
   * ```ts
   * await client.linkWithProviderCredential(user, { provider: "google", token });
   * ``` */
  linkWithProviderCredential(user: User, input: AuthCoreProviderCredentialInput): Promise<UserCredential> {
    return user.linkWithCredential(createCredential(input));
  }

  /** Links a provider through a popup.
   * @param user - User to link.
   * @param input - OAuth provider to use.
   * @returns A credential for the linked user.
   * @throws {Error} If the popup flow fails.
   * @example
   * ```ts
   * await client.linkWithProviderPopup(user, { provider: "google" });
   * ``` */
  linkWithProviderPopup(user: User, input: AuthCoreOAuthInput): Promise<UserCredential> {
    return user.linkWithPopup(createProvider(input.provider));
  }

  /** Links a provider through a browser redirect.
   * @param user - User to link.
   * @param input - OAuth provider to use.
   * @returns A promise that resolves while navigation begins.
   * @throws {Error} If redirect setup fails.
   * @example
   * ```ts
   * await client.linkWithProviderRedirect(user, { provider: "google" });
   * ``` */
  linkWithProviderRedirect(user: User, input: AuthCoreOAuthInput): Promise<void> {
    return user.linkWithRedirect(createProvider(input.provider));
  }

  /** Unlinks a provider from a user.
   * @param user - User to update.
   * @param providerId - Provider ID to unlink.
   * @returns The updated user.
   * @throws {Error} If the provider is not linked or removal fails.
   * @example
   * ```ts
   * await client.unlink(user, "google.com");
   * ``` */
  unlink(user: User, providerId: string): Promise<User> {
    return user.unlink(providerId);
  }

  /** Creates an MFA session for enrollment.
   * @param user - Authenticated user enrolling a factor.
   * @returns A session used by MFA enrollment methods.
   * @throws {Error} If the session cannot be created.
   * @example
   * ```ts
   * const session = await client.createMfaSession(user);
   * ``` */
  createMfaSession(user: User): Promise<AuthCoreMfaSession> {
    return MfaService.createSession(user);
  }

  /** Gets MFA enrollment options for a user.
   * @param user - User whose enrollment options to retrieve.
   * @returns The service-provided enrollment options.
   * @example
   * ```ts
   * const options = await client.getMfaEnrollmentOptions(user);
   * ``` */
  getMfaEnrollmentOptions(user: User) {
    return MfaService.getEnrollmentOptions(user);
  }

  /** Lists enrolled MFA factors.
   * @param user - User whose factors to list.
   * @returns The enrolled factors.
   * @throws {Error} If factors cannot be retrieved.
   * @example
   * ```ts
   * const factors = await client.listMfaFactors(user);
   * ``` */
  listMfaFactors(user: User): Promise<MultiFactorInfo[]> {
    return MfaService.listFactors(user);
  }

  /** Starts TOTP enrollment.
   * @param session - MFA session created for the user.
   * @param displayName - Optional factor display name; omit or use `null` for no name.
   * @returns The TOTP secret and provisioning information.
   * @throws {Error} If enrollment cannot be started.
   * @example
   * ```ts
   * const secret = await client.startTotpEnrollment(session, "Authenticator");
   * ``` */
  startTotpEnrollment(session: AuthCoreMfaSession, displayName?: string | null): Promise<TotpSecret> {
    return MfaService.startTotpEnrollment(session, displayName);
  }

  /** Verifies and completes TOTP enrollment.
   * @param user - User enrolling the factor.
   * @param enrollmentId - Enrollment ID returned by the service.
   * @param code - Current authenticator code.
   * @param challengeId - Enrollment challenge ID.
   * @param mfaSessionToken - MFA session token.
   * @param displayName - Optional factor display name.
   * @returns The enrolled factor.
   * @throws {Error} If the code or session is invalid.
   * @example
   * ```ts
   * await client.verifyTotpEnrollment(user, enrollmentId, code, challengeId, mfaSessionToken);
   * ``` */
  verifyTotpEnrollment(
    user: User,
    enrollmentId: string,
    code: string,
    challengeId: string,
    mfaSessionToken: string,
    displayName?: string | null
  ): Promise<MultiFactorInfo> {
    return MfaService.verifyTotpEnrollment(user, enrollmentId, code, challengeId, mfaSessionToken, displayName);
  }

  /** Starts SMS MFA enrollment.
   * @param session - MFA session created for the user.
   * @param phoneNumber - Phone number to enroll.
   * @param countryCode - Country calling code for the number.
   * @returns The SMS enrollment challenge.
   * @throws {Error} If the phone number cannot receive a challenge.
   * @example
   * ```ts
   * const challenge = await client.startSmsEnrollment(session, phoneNumber, "US");
   * ``` */
  startSmsEnrollment(session: AuthCoreMfaSession, phoneNumber: string, countryCode: string) {
    return MfaService.startSmsEnrollment(session, phoneNumber, countryCode);
  }

  /** Verifies and completes SMS MFA enrollment.
   * @param user - User enrolling the factor.
   * @param enrollmentId - Enrollment ID returned by the service.
   * @param code - SMS verification code.
   * @param challengeId - Enrollment challenge ID.
   * @param mfaSessionToken - MFA session token.
   * @param displayName - Optional factor display name.
   * @returns The enrolled factor.
   * @throws {Error} If the code or session is invalid.
   * @example
   * ```ts
   * await client.verifySmsEnrollment(user, enrollmentId, code, challengeId, mfaSessionToken);
   * ``` */
  verifySmsEnrollment(
    user: User,
    enrollmentId: string,
    code: string,
    challengeId: string,
    mfaSessionToken: string,
    displayName?: string | null
  ): Promise<MultiFactorInfo> {
    return MfaService.verifySmsEnrollment(user, enrollmentId, code, challengeId, mfaSessionToken, displayName);
  }

  /** Removes an enrolled MFA factor.
   * @param user - User who owns the factor.
   * @param factorId - Identifier of the enrolled factor.
   * @returns A promise that resolves after removal.
   * @throws {Error} If the factor cannot be removed.
   * @example
   * ```ts
   * await client.deleteMfaFactor(user, factorId);
   * ``` */
  deleteMfaFactor(user: User, factorId: string): Promise<void> {
    return MfaService.deleteFactor(user, factorId);
  }

  /** Sends an SMS sign-in MFA challenge.
   * @param challengeId - MFA challenge ID.
   * @param mfaSessionToken - MFA session token.
   * @param factorId - Enrolled SMS factor ID.
   * @returns The service challenge result.
   * @throws {Error} If challenge delivery fails.
   * @example
   * ```ts
   * await client.sendSmsMfaChallenge(challengeId, mfaSessionToken, factorId);
   * ``` */
  sendSmsMfaChallenge(challengeId: string, mfaSessionToken: string, factorId: string) {
    return MfaService.sendSmsChallenge(this.auth, challengeId, mfaSessionToken, factorId);
  }

  /** Verifies an MFA sign-in challenge.
   * @param challengeId - MFA challenge ID.
   * @param mfaSessionToken - MFA session token.
   * @param factorId - Enrolled factor ID.
   * @param code - Code supplied by the factor.
   * @returns Tokens used to complete sign-in.
   * @throws {Error} If the challenge code is invalid.
   * @example
   * ```ts
   * const tokens = await client.verifyMfaChallenge(challengeId, mfaSessionToken, factorId, code);
   * ``` */
  verifyMfaChallenge(
    challengeId: string,
    mfaSessionToken: string,
    factorId: string,
    code: string
  ): Promise<MfaTokenResponse> {
    return MfaService.verifyMfaChallenge(this.auth, challengeId, mfaSessionToken, factorId, code);
  }
}

/**
 * Gets the compact authentication client for an application.
 *
 * @param app - Application that owns the authentication service.
 * @returns The authentication client.
 * @example
 * ```ts
 * const client = getAuthCore(app);
 * ```
 */
export function getAuthCore(app: App): AuthCoreClient {
  return new AuthCoreClient(app);
}

/**
 * Decodes the claims contained in an identity token.
 *
 * @param token - Serialized identity token.
 * @returns The decoded claim values.
 * @example
 * ```ts
 * const claims = decodeTokenClaims(token);
 * ```
 */
export function decodeTokenClaims(token: string): Record<string, unknown> {
  return new IdTokenResult(token).claims;
}

export type {
  User,
  UserCredential,
};
