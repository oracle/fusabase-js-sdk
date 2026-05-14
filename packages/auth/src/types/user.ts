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

import { IDCSAuthHelper, ONPREMAuthHelper } from '../helpers/authHelper.js';
import { argCheck, AuthError, authErrorHandler, ErrorCode, ErrorCodeMessage, typeStrings } from '../errors.js';
import { IDCSUserHelper, ONPREMUserHelper } from '../helpers/userHelper.js';
import { Utils } from '../util/util.js';
import { IdTokenResult } from './idtoken.js';
import { AuthCredential, UserCredential } from '../internal/credential.js';
import { AuthProvider } from '../providers/provider.js';
import { GoogleAuthProvider } from '../providers/google.js';
import { FacebookAuthProvider } from '../providers/facebook.js';
import { GithubAuthProvider } from '../providers/github.js';
import { OAuthProvider } from '../providers/oauth.js';
import { IDCSConfig } from '../helpers/config.js';

/**
 * Represents a Fusabase user account.
 *
 * @example
 * ```ts
 * import { User } from './user.js';
 * const user: User = {
 *   uid: 'abc123',
 *   displayName: 'John Doe',
 *   email: 'john@example.com',
 *   providerId: 'fusabase',
 * };
 * ```
 */
export class User {
  /** The unique identifier for the user. */
  uid: string;
  /** The display name of the user. */
  displayName?: string | null;
  /** The email address of the user. */
  email?: string | null;
  /** The phone number of the user. */
  phoneNumber?: string | null;
  /** The photo URL of the user. */
  photoURL?: string | null;
  /** Whether the user's email is verified. */
  emailVerified?: boolean;
  /** The provider ID for the user. */
  providerId: string;
  /** Whether the user is anonymous. */
  isAnonymous: boolean;
  /** The metadata associated with the user account. */
  metadata: UserMetadata | null = null;
  /** The OCID of the user. */
  ocid: string | null = null;
  /** The refresh token for the user. */
  refreshToken: string | null = null;
  /** The provider data for the user. */
  providerData: UserInfo[] = [];
  /** The tenant ID for the user. */
  tenantId: string | null = null;
  private userHelper: IDCSUserHelper | ONPREMUserHelper | null = null;
  config: any = null;
  private authHelper: IDCSAuthHelper | ONPREMAuthHelper | null = null;
  schemas: any = null;
  auth: any = null;

  /**
   * Constructs the instance of a user.
   * @param {Object} user
   * @param {IdTokenResult} authnToken
   * @param {IdTokenResult} access_token
   * @param {String} refreshToken
   * @param {Auth} auth
   *
   */
  constructor(user: any, authnToken: any = null, accessToken: any, refreshToken: any, auth: any) {
    this.displayName = user.displayName;
    this.email = user.emails?.[0]?.value; 
    this.emailVerified = user.emailVerified;
    this.uid = user.id;
    this.ocid = user.ocid;
    this.isAnonymous = false;
    this.config = auth.intConfig;
    this.refreshToken = refreshToken;
    this.phoneNumber = user.phoneNumbers ? user.phoneNumbers[0].value : null;
    this.photoURL = user.photos ? user.photos[0].value : null;

    if (this.config.authType === 'idcs') {
      this.userHelper = new IDCSUserHelper(auth.intConfig, authnToken, accessToken, auth._getLogLevel);
      this.userHelper.user = this;
    }
    // else if (this.config.authType === 'base_s' || this.config.authType === 'ldap_s') {
    //   this.userHelper = new ONPREMSRPUserHelper(auth.intConfig, authnToken, accessToken, auth._getLogLevel);
    // }
    else {
      this.userHelper = new ONPREMUserHelper(auth.intConfig, authnToken, accessToken, auth._getLogLevel);
      this.userHelper.user = this;
      (this.userHelper as any)?._setApp?.(auth.app);
    }

    this.auth = auth;
    this.schemas = user.schemas;
    this.providerId = user.idp_name;
    this.providerData.push({
      displayName: user.displayName,
      email: user.emails?.[0]?.value,
      phoneNumber: this.phoneNumber,
      photoURL: this.photoURL,
      uid: user.id,
      providerId: user.idp_name
    } as UserInfo);
    this.metadata = {
      creationTime: user.meta.created,
      lastSignInTime: user.meta.lastSignIn
    } as UserMetadata;

    if (this.config.authType === 'idcs') {
      this.authHelper = new IDCSAuthHelper(
        auth.intConfig,
        auth._getLogLevel,
        new URL(auth.app.options.ordsHost).origin
      );
    }
    // else if (this.config.authType === 'base_s' || this.config.authType === 'ldap_s') {
    //   this.authHelper = new ONPREMSRPAuthHelper(auth.intConfig, auth._getLogLevel);
    // }
    else {
      this.authHelper = new ONPREMAuthHelper(
        auth.intConfig,
        auth._getLogLevel,
        new URL(auth.app.options.ordsHost).origin
      );
    }

  }

  /**
   * Returns a JSON representation of the user.
   * @returns {string} The JSON string representation of the user.
   */
  toJSON() : any {
    const user = {
      displayName: this.displayName,
      email: this.email,
      phoneNumber: this.phoneNumber,
      metadata: this.metadata,
      photoURL: this.photoURL,
      refreshToken: this.refreshToken,
      providerId: this.providerId,
      providerData: this.providerData,
      tenantId: this.tenantId,
      isAnonymous: this.isAnonymous,
      uid: this.uid
    }
    return JSON.stringify(user);
  }

  /**
   * @internal
   * Gets the current access token.
   * @returns {IdTokenResult | null} The access token result or null.
   */
  /**
   * @internal
   */
  __getToken(): string | null {
    if (!this.userHelper?.validateFUSABASEAccessToken()) {
      let err = new AuthError(ErrorCodeMessage.NOT_IMPLEMENT, "Please reauthenticate!");
      err.status = 400;
      throw authErrorHandler(err);
    }
    if (this.userHelper.fusabase_token) {
      return this.userHelper.fusabase_token.token;
    }
    return null;
  }

  /**
   * @async
   * @property {Function} getIdToken
   * Method to get Id token for the authenticated user.
   * @param {boolean} forceRefresh
   * @returns {Promise<String>} JWT accessToken
   */
  async getIdToken(forceRefresh = false) : Promise<string | null>  {
    argCheck(forceRefresh, "Invalid value", true, [typeStrings.BOOL]);
    if (forceRefresh || !this.userHelper?.validateAccessToken()) {
      try {
        Utils.baasLogger(this.auth.app.logLevel,"before refresh");
        let rToken = await this.userHelper?.refreshAccessToken(
          this.refreshToken ?? ""
        );
        if (rToken) {
          this.refreshToken = rToken;
        }

        const tokens = {
          access_token: this.userHelper?.acc_tok,
          refresh_token: this.refreshToken,
        }
        Utils.baasLogger(this.auth.app.logLevel,"after refresh");
        if (typeof window !== "undefined") {
          await this.auth._setTokenDataOnStorage(this.auth.TOKEN_KEY, tokens);
        }
        await this.auth.__updateCurrentToken(this);
      } catch (err:any) {
        if (err.status === ErrorCode.INVALID_ARGS) {
          this.auth.signOut();
        } else throw authErrorHandler(err);
      }
    }
    if (this.userHelper?.acc_tok) {
      return this.userHelper?.acc_tok.token;
    }
    return null;
  }

  /**
   * @internal
   */
  async getFUSABASEToken(forceRefresh = false) : Promise<string | null> {
    argCheck(forceRefresh, "Invalid value", true, [typeStrings.BOOL]);
    if (forceRefresh || !this.userHelper?.validateFUSABASEAccessToken()) {
      try {
        await this.getIdToken();
        Utils.baasLogger(this.auth.app.logLevel,"before refresh");
      } catch (err:any) {
        if (err.status === ErrorCode.INVALID_ARGS) {
          this.auth.signOut();
        } else throw authErrorHandler(err);
      }
      
      try {
        let token = await this.userHelper?.fetchFusabaseToken(`${this.auth.app.options.ordsHost}_/baas-services/idm/idcs/${this.config.projectID}/${IDCSConfig.FETCH_FUSABASE_TOKEN}?apiKey=${this.config.appID}`, this.auth.app);
        this.userHelper!.fusabase_token = new IdTokenResult(token ?? "");
      } catch (err:any) {
        Utils.baasLogger(this.auth.app.logLevel,"could not fetch token");
      }
    }
    if (this.userHelper?.fusabase_token) {
      return this.userHelper?.fusabase_token.token;
    }
    return null;
  }

  /**
   * @async
   * @property {Function} getIdTokenResult
   * Method to get the parsed IdToken.
   * @param {boolean} forceRefresh
   * @returns {Promise<IdTokenResult>}
   */
  async getIdTokenResult(forceRefresh = false) : Promise<IdTokenResult | null>  {
    argCheck(forceRefresh, "Invalid value", true, [typeStrings.BOOL]);
    await this.getIdToken(forceRefresh);
    if (this.userHelper?.acc_tok) {
      return new IdTokenResult(this.userHelper?.acc_tok.token);
    }
    return null;
  }

  /**
   * @async
   * @property {Function} updateProfile
   * Method to update the profile of the User.
   * @param {{displayName: String, phoneNumber: String}} userProfile
   * @returns {Promise<void>}
   */
  /**
   * @internal
   */
async updateProfile(userProfile: any) : Promise<void> {
  argCheck(userProfile, "Invalid profile object", true, [typeStrings.OBJECT]);
  if (this.userHelper) {
    (this.userHelper as any).user = this;
    await this.userHelper.updateProfile(userProfile);
  }
  await this.reload();
}

  /**
   * @async
   * @property {Function} delete
   * Method to delete the current signed in user and signOut the user.
   * @returns {Promise<void>}
   */
  async delete() : Promise<void> {
    let err = new AuthError(ErrorCodeMessage.NOT_IMPLEMENT, 'Method not implemented!');
    err.status = ErrorCode.NOT_IMPLEMENT;
    throw authErrorHandler(err);
  }

  /**
   * @async
   * @property {Function} reload
   * Refreshes the current user, if signed in.
   * @returns {Promise<void>}
   */
  async reload() : Promise<void> {
    try {
      if (this.authHelper == null || !this.userHelper) {
        return ;
      }
      const userDetails = await this.authHelper.reloadUser(this);

      const user = new User(
            userDetails,
            null,
            this.userHelper.acc_tok,
            this.refreshToken,
            this.auth
          );
      await user.getFUSABASEToken();
      this.auth.executeBeforeAuthStateChanged(user);
      await this.auth.updateCurrentUser(user);
    }
    catch (err) {
      throw authErrorHandler(err);
    }
  }

  /**
   * @async
   * @property {Function} updatePassword
   * Updates the user's password.
   * @param {String} oldPassword
   * @param {String} newPassword
   * @return {Promise<void>}
   */
  /**
   * @internal
   */
  async updatePassword(oldPassword: string, newPassword: string) : Promise<void>  {
    argCheck(oldPassword, "Invalid old password", true, [typeStrings.STRING]);
    argCheck(newPassword, "Invalid new password", true, [typeStrings.STRING]);
    try {
      await this.getIdToken();

      if (this.email != null && this.userHelper != null) {
        await (this.userHelper as any).updatePasswordHelper(
          this.email, newPassword, oldPassword);
      }
    }
    catch (err) {
      if (err instanceof Error && 'status' in err) {
        throw authErrorHandler(err);
      } else {
        throw err;
      }
    }
  }

  /**
   * Sends an email verification to the user.
   * @param {any} settings - The settings for email verification.
   * @returns {Promise<void>}
   */
  /**
   * @internal
   */
  async sendEmailVerification(settings: any) : Promise<void> {
    await this.getIdToken();
    if (this.email != null && this.uid != null && this.userHelper != null) {
      await (this.userHelper as any).sendEmailVerificationHelper(this.email, this.uid);
    }
  }

  /**
   * Links the provided credential to the current user account.
   * @async
   * @param {AuthCredential} credential - The auth credential to link with.
   * @returns {Promise<UserCredential>} A promise that resolves with the user credential.
   */
  /**
   * @internal
   */
  async linkWithCredential(credential: AuthCredential): Promise<UserCredential> {
    await this.getIdToken();
    await this.userHelper?.linkWithCredentialHelper(credential);
    await this.reload();
    return this.auth.userCredential!;
  }

  /**
   * Links the user account with the given provider using a popup window.
   * @async
   * @param {any} provider - The auth provider instance (e.g., GoogleAuthProvider).
   * @returns {Promise<UserCredential | null>} A promise that resolves with the user credential or null.
   */
  /**
   * @internal
   */
  async linkWithPopup(provider: AuthProvider): Promise<UserCredential> {
    if (this.auth.config.authType === "idcs") {
      const err: any = new Error(
        "Method is not supported in IDCS authentication"
      );
      err.status = ErrorCode.NOT_IMPLEMENT;
      err.authType = "IDCS";
      throw authErrorHandler(err);
    }
     if (!(provider instanceof GoogleAuthProvider || 
          provider instanceof FacebookAuthProvider ||
          provider instanceof GithubAuthProvider
    )) {
      let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,`Invalid provider specified`);
      error.status = 400;
      throw authErrorHandler(error);
    }

    try {
      let url = "";
      const method = provider.providerName as string;
      const contextUri = `${window.location.origin}${window.location.pathname}`;

      if (this.auth.app.options.authType === "idcs") {
        const popupUrl = new URL(`${this.auth.app.options.ordsHost}_/baas-services/idm/idcs/${this.auth.intConfig.projectID}/socialLink`);
        popupUrl.searchParams.set('method', method);
        popupUrl.searchParams.set('apiKey', this.auth.app.options.appID);
        popupUrl.searchParams.set('context_uri', contextUri);
        url = popupUrl.toString();

      } else {
        const popupUrl = new URL(`${this.auth.app.options.ordsHost}_/baas-services/idm/onprem/${this.auth.intConfig.projectID}/socialidp`);
        popupUrl.searchParams.set('method', method);
        popupUrl.searchParams.set('device', 'web');
        popupUrl.searchParams.set('apiKey', this.auth.app.options.appID);
        popupUrl.searchParams.set('link', '1');
        popupUrl.searchParams.set('context_uri', contextUri);
        url = popupUrl.toString();
      }

      const tokensObj: any = await this.userHelper?.socialLink(url);

      if (this.auth.app.options.authType === "idcs") {
        if (tokensObj && tokensObj.success === 1) {
          await this.reload();
          return this.auth.userCredential!;
        }
      }

      const idToken = tokensObj.idToken!;
      const providerMap: Record<string, any> = {
        google: GoogleAuthProvider,
        facebook: FacebookAuthProvider,
        github: GithubAuthProvider,
      };

      const ProviderClass = providerMap[method];

      if (!ProviderClass) {
        throw new Error(`Unsupported provider: ${method}`);
      }

      const credential = ProviderClass.credential(idToken);
      return await this.linkWithCredential(credential);

    } catch (err) {
      throw authErrorHandler(err);
    }
  }

  /**
   * Links the user account with the given provider using a redirect.
   * @async
   * @param {any} provider - The auth provider instance (e.g., GoogleAuthProvider).
   * @returns {Promise<void>}
   */
  /**
   * @internal
   */
  async linkWithRedirect(provider: AuthProvider): Promise<never> {

    if (this.auth.config.authType === "idcs") {
      const err: any = new Error(
        "Method is not supported in IDCS authentication"
      );
      err.status = ErrorCode.NOT_IMPLEMENT;
      err.authType = "IDCS";
      throw authErrorHandler(err);
    }

    const invalid =
      !(
        provider instanceof GoogleAuthProvider ||
        provider instanceof FacebookAuthProvider ||
        provider instanceof GithubAuthProvider ||
        provider instanceof OAuthProvider
      );

    if (invalid) {
      const error = new Error("Invalid provider");
      (error as any).status = 400;
      throw authErrorHandler(error);
    }

    try {
      const codeVerifier = this.userHelper?.generateCodeVerifier() ?? "";
      const codeChallenge = await this.userHelper?.generateCodeChallenge(codeVerifier);

      localStorage.setItem("redirectState", "LoginInitiated");
      localStorage.setItem("codeVerifier", codeVerifier);
      localStorage.setItem("providerId", provider.providerName);

      // Build base URL safely
      const baseUrl = `${this.auth.app.options.ordsHost}_/baas-services/idm/onprem/${this.auth.intConfig.projectID}/socialidp`;

      // Create URL object (prevents string-based injection)
      const redirectUrl = new URL(baseUrl);

      // Explicit allow-listed parameters only
      redirectUrl.searchParams.set('method', provider.providerName);
      redirectUrl.searchParams.set('device', 'web');
      redirectUrl.searchParams.set('apiKey', this.auth.app.options.appID);
      redirectUrl.searchParams.set('code_challenge', codeChallenge ?? "");
      redirectUrl.searchParams.set('code_challenge_method', 'S256');
      redirectUrl.searchParams.set(
        'context_uri',
        `${window.location.origin}${window.location.pathname}` // 🔐 no tainted query
      );
      redirectUrl.searchParams.set('link', '1');

      // Safe redirect sink (Fortify-recognized)
      window.location.assign(redirectUrl.toString());
      return new Promise<never>(() => {});

    } catch (err) {
      throw authErrorHandler(err);
    }
  }

  /**
   * Unlinks a provider from the user's account.
   * @async
   * @param {string} providerId - The ID of the provider to unlink.
   * @returns {Promise<User>} The updated user object.
   */
  /**
   * @internal
   */
  async unlink(providerId: string): Promise<this> {
    await this.getIdToken();
    await this.userHelper?.unlinkHelper(providerId);
    await this.reload();
    return this;
  }
}

/**
 * Result from phone number sign-in confirmation.
 */
export interface ConfirmationResult {
  verificationId: string;
  /** Confirm with the verification code to get UserCredential */
  confirm(verificationCode: string): Promise<UserCredential>;
}

/**
 * Metadata for a user account.
 *
 * @example
 * ```ts
 * import { UserMetadata } from './user.js';
 * const metadata: UserMetadata = {
 *   creationTime: '2025-09-28T12:00:00Z',
 *   lastSignInTime: '2025-09-28T14:00:00Z',
 * };
 * ```
 */
export interface UserMetadata {
  creationTime?: string;
  lastSignInTime?: string;
}

/**
 * Basic user profile info from a federated provider.
 */
export interface UserInfo {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  photoURL?: string | null;
  providerId: string;
  emailVerified?: boolean;
}
