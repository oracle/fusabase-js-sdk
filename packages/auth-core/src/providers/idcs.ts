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
import { AuthError, ErrorCodeMessage } from '../errors.js';
import { AuthProvider } from './provider.js';
import { OAuthCredential } from '../internal/phone.js';
import { authErrorHandler,argCheck,typeStrings } from '../errors.js';

/**
 * The IDCSAuthProvider class allows you to generate credentials for IDCS sign-in.
 * It provides methods for obtaining credentials, adding scopes, and setting custom parameters.
 *
 * @example
 * ```ts
 * // Example usage to generate OAuthCredential using IDCS ID token and access token
 * const idcsCredential = IDCSAuthProvider.credential('GOOGLE_ID_TOKEN', 'GOOGLE_ACCESS_TOKEN');
 * ```
 */
/** Identity-domain authentication provider. @example `const provider = new IDCSAuthProvider();` */
export class IDCSAuthProvider extends AuthProvider {
  private _providerType = "";
  private scopes: string[];
  private customParameters: Record<string, unknown>;

  /** Provider ID for IDCS sign-in */
    static PROVIDER_ID: string = 'idcs';

    /** Sign-in method for IDCS authentication */
    static IDCS_SIGN_IN_METHOD: string = 'idcs';

/**
 * Constructs a IDCSAuthProvider instance with the supplied configuration.
 *
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { IDCSAuthProvider } from "fusabase/auth";
 * const result = new IDCSAuthProvider();
 * void result;
 * ```
 */
  constructor() {
    super(IDCSAuthProvider.PROVIDER_ID);
    this.scopes = [];
    this.customParameters = {};
  }

  /**
  * @property
  */
  get providerName() {
    return IDCSAuthProvider.IDCS_SIGN_IN_METHOD;
  }

  /**
  * @property
  */
  get providerType() {
    return this._providerType;
  }

  /**
  * @property
  */
  set providerType(type) {
    argCheck(type, "Invalid type", true, [typeStrings.STRING]);
    this._providerType = type;
  }

/**
 * Executes the credential operation for this public SDK type.
 *
 * @param idToken - Optional identity token supplied by the provider.
 * @param accessToken - Optional OAuth access token supplied by the provider.
 * @returns The result produced by `credential`, including any requested data or handle.
 * @example
 * ```ts
 * import { IDCSAuthProvider } from "fusabase/auth";
 * const result = IDCSAuthProvider.credential("token", "token");
 * void result;
 * ```
 */
  static credential(idToken?: string, accessToken?: string): OAuthCredential {
    if (!accessToken && !idToken) {
      let err = new AuthError(ErrorCodeMessage.INVALID_ARGS,"No Token provided");
      throw authErrorHandler(err);
    }
    argCheck(idToken, "Invalid id token", false, [typeStrings.STRING]);
    argCheck(accessToken, "Invalid access token", false, [typeStrings.STRING]);

    let oauthCreds = new OAuthCredential(IDCSAuthProvider.PROVIDER_ID,
      IDCSAuthProvider.IDCS_SIGN_IN_METHOD);
    oauthCreds.accessToken = accessToken;
    oauthCreds.idToken = idToken;
    return oauthCreds;
  }

/**
 * Executes the credentialFromResult operation for this public SDK type.
 *
 * @param userCredential - The credential result returned by a completed sign-in flow.
 * @returns The result produced by `credentialFromResult`, including any requested data or handle.
 * @example
 * ```ts
 * import { IDCSAuthProvider } from "fusabase/auth";
 * const result = IDCSAuthProvider.credentialFromResult(value);
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
     * Extracts an OAuthCredential from an AuthError.
     * This method helps to extract credentials from an AuthError if available.
     *
     * @param error The error object that occurred during the sign-in or link process.
     * @returns An OAuthCredential or null if not available from the error.
     *
     * @example
     * ```ts
     * try {
     *   // Attempt some auth operation that might throw an error
     * } catch (error) {
     *   const idcsCredential = IDCSAuthProvider.credentialFromError(error);
     *   console.log(idcsCredential);
     * }
     * ```
     */
    static credentialFromError(error: AuthError): OAuthCredential | null {
        if (!(error instanceof AuthError)) {
          return null;
        }
        return null;
    }

  /**
     * Adds additional scope to the IDCS OAuth provider.
     * Scopes allow you to request additional user data from IDCS, such as profile or email.
     *
     * @param scope The scope to add to the IDCS OAuth request.
     * @returns The current instance of IDCSAuthProvider for method chaining.
     *
     * @example
     * ```ts
     * const provider = new IDCSAuthProvider();
     * provider.addScope('email').addScope('profile');
     * ```
     */
    addScope(scope: string): this {
      if (!this.scopes) {
        this.scopes = [];
      }
      this.scopes.push(scope);
      return this;
    }

    /**
     * Sets custom parameters for the IDCS OAuth provider.
     * Custom parameters allow you to control the behavior of the IDCS OAuth flow.
     *
     * @param params A record of key-value pairs for the custom parameters.
     * @returns The current instance of IDCSAuthProvider for method chaining.
     *
     * @example
     * ```ts
     * const provider = new IDCSAuthProvider();
     * provider.setCustomParameters({ prompt: 'select_account' });
     * ```
     */
    setCustomParameters(params: Record<string, unknown>): this {
      this.customParameters = params;
      return this;
    }
}
