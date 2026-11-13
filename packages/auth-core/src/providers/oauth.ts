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

import { UserCredential } from '../internal/credential.js';
import { AuthError, ErrorCode, ErrorCodeMessage } from '../errors.js';
import { AuthProvider } from './provider.js';
import { OAuthCredential } from '../internal/phone.js';
import { authErrorHandler } from '../errors.js';

/**
 * The OAuthProvider class provides a generic implementation for OAuth-based authentication providers.
 * It allows you to configure OAuth flows with custom provider IDs, scopes, and parameters.
 *
 * @example
 * ```ts
 * // Example usage to create an OAuth provider for a custom OAuth service
 * const oauthProvider = new OAuthProvider('custom-oauth-provider');
 * oauthProvider.addScope('read').setCustomParameters({ prompt: 'consent' });
 * ```
 */
/** Configurable OAuth authentication provider. @example `const provider = new OAuthProvider("provider-id");` */
export class OAuthProvider extends AuthProvider {
  private scopes: string[];
  private customParameters: Record<string, unknown>;

/** Describes the public `PROVIDER_ID` value. */
  static PROVIDER_ID: string = 'oidc';
/** Describes the public `OAUTH_SIGN_IN_METHOD` value. */
  static OAUTH_SIGN_IN_METHOD = "oidc";    // OIDC for now, since we are supporting it only

/**
 * Constructs a OAuthProvider instance with the supplied configuration.
 *
 * @param providerId - The provider identifier.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { OAuthProvider } from "fusabase/auth";
 * const result = new OAuthProvider("example-provider");
 * void result;
 * ```
 */
  constructor(providerId: string) {
    // Input Sanitation
    if (typeof providerId === "string" && providerId !== "") {
      super(providerId);
      this.providerId = providerId;
      this.scopes = [];
      this.customParameters = {};
    }
    else
      throw authErrorHandler(new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid providerId provided to OAuthProvider"));
  }

  /**
  * @property 
  */
  get providerName() {
    return this.providerId;
  }

/**
 * Executes the credential operation for this public SDK type.
 *
 * @param idToken - Optional identity token supplied by the provider.
 * @param accessToken - Optional OAuth access token supplied by the provider.
 * @returns The result produced by `credential`, including any requested data or handle.
 * @example
 * ```ts
 * import { OAuthProvider } from "fusabase/auth";
 * const result = OAuthProvider.credential("token", "token");
 * void result;
 * ```
 */
  static credential(idToken?: string, accessToken?: string): OAuthCredential {
    if (!idToken && !accessToken) {
      throw authErrorHandler(new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid credentials provided to credential()"));
    }

    let oauthCreds = new OAuthCredential(OAuthProvider.PROVIDER_ID, OAuthProvider.OAUTH_SIGN_IN_METHOD);
    oauthCreds.accessToken = accessToken;
    oauthCreds.idToken = idToken;

    return oauthCreds;
  }

/**
 * Executes the credentialFromError operation for this public SDK type.
 *
 * @param error - The authentication or service error to inspect.
 * @returns The result produced by `credentialFromError`, including any requested data or handle.
 * @example
 * ```ts
 * import { OAuthProvider } from "fusabase/auth";
 * const result = OAuthProvider.credentialFromError(new Error("example"));
 * void result;
 * ```
 */
  static credentialFromError(error: AuthError): OAuthCredential | null {
    if (!(error instanceof AuthError)) {
      return null;
    }
    return null;
  }

/**
 * Executes the credentialFromResult operation for this public SDK type.
 *
 * @param userCredential - The credential result returned by a completed sign-in flow.
 * @returns The result produced by `credentialFromResult`, including any requested data or handle.
 * @example
 * ```ts
 * import { OAuthProvider } from "fusabase/auth";
 * const result = OAuthProvider.credentialFromResult(value);
 * void result;
 * ```
 */
  static credentialFromResult(userCredential: UserCredential): OAuthCredential | null {
    if (!(userCredential instanceof UserCredential)) {
      let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,`Invalid credentials`);
      throw authErrorHandler(error);
    }
    return userCredential.credential;
  }

/**
 * Executes the addScope operation for this public SDK type.
 *
 * @param scope - An OAuth scope to request.
 * @returns The result produced by `addScope`, including any requested data or handle.
 * @example
 * ```ts
 * import { OAuthProvider } from "fusabase/auth";
 * const result = client.addScope("profile");
 * void result;
 * ```
 */
  addScope(scope: string): this {
    this.scopes.push(scope);
    return this;
  }

/**
 * Executes the setCustomParameters operation for this public SDK type.
 *
 * @param params - Provider-specific OAuth parameters.
 * @returns The result produced by `setCustomParameters`, including any requested data or handle.
 * @example
 * ```ts
 * import { OAuthProvider } from "fusabase/auth";
 * const result = client.setCustomParameters({ prompt: "consent" });
 * void result;
 * ```
 */
  setCustomParameters(params: Record<string, unknown>): this {
    this.customParameters = params;
    return this;
  }
}
