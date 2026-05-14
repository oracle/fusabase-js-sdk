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

import { EmailAuthCredential, UserCredential } from '../internal/credential.js';
import { AuthError, ErrorCode, ErrorCodeMessage } from '../errors.js';
import { AuthProvider } from './provider.js';
import { OAuthCredential } from '../internal/phone.js';
import { authErrorHandler,argCheck,typeStrings } from '../errors.js';

/**
 * The FacebookAuthProvider class allows you to generate credentials for Facebook sign-in.
 * It provides methods for obtaining credentials, adding scopes, and setting custom parameters.
 *
 * @example
 * ```ts
 * // Example usage to generate OAuthCredential using Facebook access token
 * const facebookCredential = FacebookAuthProvider.credential('FACEBOOK_ACCESS_TOKEN');
 * ```
 */
export class FacebookAuthProvider extends AuthProvider {
  private _providerType = "";
  private scopes: string[];
  private customParameters: Record<string, unknown>;

  /** Provider ID for Facebook sign-in */
    static PROVIDER_ID: string = 'facebook';

    /** Sign-in method for Facebook authentication */
    static FACEBOOK_SIGN_IN_METHOD: string = 'facebook';

  constructor() {
    super(FacebookAuthProvider.PROVIDER_ID);
    this.scopes = [];
    this.customParameters = {};
  }

  /**
  * @property 
  */
  get providerName() {
    return FacebookAuthProvider.FACEBOOK_SIGN_IN_METHOD;
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
  * @property 
  */
  static credential(idToken?: string, accessToken?: string) {
    if (!accessToken && !idToken) {
      let err = new AuthError(ErrorCodeMessage.INVALID_ARGS,"No Token provided");
      err.status = ErrorCode.INVALID_USER_TOK;
      throw authErrorHandler(err);
    }
    argCheck(idToken, "Invalid id token", false, [typeStrings.STRING]);
    argCheck(accessToken, "Invalid access token", false, [typeStrings.STRING]);
    let oauthCreds = new OAuthCredential(FacebookAuthProvider.PROVIDER_ID,
      FacebookAuthProvider.FACEBOOK_SIGN_IN_METHOD);
    oauthCreds.accessToken = accessToken;
    oauthCreds.idToken = idToken;
    return oauthCreds;
  }

  /**
     * Extracts an OAuthCredential from the user credential object.
     * This method allows you to extract the credentials that were used during the sign-in or link operation.
     *
     * @param userCredential The UserCredential object returned after a successful sign-in or link operation.
     * @returns An OAuthCredential or null if not available.
     *
     * @example
     * ```ts
     * const userCredential: UserCredential = await signInWithFacebook('FACEBOOK_ACCESS_TOKEN');
     * const facebookCredential = FacebookAuthProvider.credentialFromResult(userCredential);
     * console.log(facebookCredential);
     * ```
     */
    static credentialFromResult(userCredential: UserCredential): OAuthCredential | null {
    if (!(userCredential instanceof UserCredential)) {
      let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,`Invalid credentials`);
      error.status = 400;
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
     *   const facebookCredential = FacebookAuthProvider.credentialFromError(error);
     *   console.log(facebookCredential);
     * }
     * ```
     */
    static credentialFromError(error: AuthError): OAuthCredential | null {
        if (!(error instanceof AuthError)) {
            return null;
        }
        // Implement logic to handle AuthError and extract credential if possible
        // For now, return null as the default implementation
        return null;
    }

    /**
     * Adds additional scope to the Facebook OAuth provider.
     * Scopes allow you to request additional user data from Facebook.
     *
     * @param scope The scope to add to the Facebook OAuth request.
     * @returns The current instance of FacebookAuthProvider for method chaining.
     *
     * @example
     * ```ts
     * const provider = new FacebookAuthProvider();
     * provider.addScope('email').addScope('user_friends');
     * ```
     */
    addScope(scope: string): this {
        // Implement logic to add Facebook-specific scope
        // For example, you can store the scopes in an array and append new scopes
        if (!this.scopes) {
            this.scopes = [];
        }
        this.scopes.push(scope);
        return this;
    }

    /**
     * Sets custom parameters for the Facebook OAuth provider.
     * Custom parameters allow you to control the behavior of the Facebook OAuth flow.
     *
     * @param params A record of key-value pairs for the custom parameters.
     * @returns The current instance of FacebookAuthProvider for method chaining.
     *
     * @example
     * ```ts
     * const provider = new FacebookAuthProvider();
     * provider.setCustomParameters({ redirect_uri: 'https://example.com/callback' });
     * ```
     */
    setCustomParameters(params: Record<string, unknown>): this {
        // Implement logic to set custom parameters for the Facebook OAuth request
        this.customParameters = params;
        return this;
    }
}
