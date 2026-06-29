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

import { User } from './user.js';
import { Persistence } from './persistence.js';
import PersistenceType from '../helpers/persistence/PersistenceType.js';
import { IDCSAuthHelper, ONPREMAuthHelper } from '../helpers/authHelper.js';
import { browserLocalPersistence, browserSessionPersistence, inMemoryPersistence } from './persistence.js';
import { AuthProvider } from '../providers/provider.js';
import { getConfig, IDCSConfig, ONPREMConfig } from '../helpers/config.js';
import PersistenceUserManager from '../helpers/persistence/PersistenceUserManager.js';
import BrowserLocalPersistence from '../helpers/storage/BrowserLocalPersistence.js';
import { argCheck, AuthError, authErrorHandler, ErrorCode, ErrorCodeMessage, typeStrings, getErrorMessage } from '../errors.js';
import { GoogleAuthProvider } from '../providers/google.js';
import { GithubAuthProvider } from '../providers/github.js';
import { SAMLAuthProvider } from '../providers/saml.js';
import { FacebookAuthProvider } from '../providers/facebook.js';
import { OAuthProvider } from '../providers/oauth.js';
import BrowserSessionPersistence from '../helpers/storage/BrowserSessionPersistence.js';
import { IdTokenResult } from './idtoken.js';
import { EmailAuthProvider } from '../providers/email.js';
import { IDCSUserHelper, ONPREMUserHelper } from '../helpers/userHelper.js';
import { Utils } from '../util/util.js';
import { AuthCredential, UserCredential } from '../internal/credential.js';
import { OAuthCredential } from '../internal/phone.js';
import InMemoryPersistence from '../helpers/storage/InMemoryPersistence.js';
import { IDCSAuthProvider } from '../providers/idcs.js';

/**
 * A function that unsubscribes from a listener.
 *
 * @returns {void}
 *
 * @example
 * ```ts
 * const unsubscribe = onAuthStateChanged(auth, (user) => {
 *   console.log('Auth state changed:', user);
 * });
 * // Later: unsubscribe();
 * ```
 */
export type Unsubscribe = () => void;

/**
 * Supported sign-in methods for authentication.
 *
 * @example
 * ```ts
 * import { SignInMethod } from './auth.js';
 * console.log(SignInMethod.EMAIL_PASSWORD); // "password"
 * ```
 */
export const SignInMethod = {
  /** Sign in with email and password */
  EMAIL_PASSWORD: "password",
  /** Sign in with email link */
  EMAIL_LINK: "emailLink"
}

/**
 * The dependencies that can be used to initialize an {@link Auth} instance.
 *
 * @remarks
 *
 * The modular SDK enables tree shaking by allowing explicit declarations of
 * dependencies. For example, a web app does not need to include code that
 * enables Cordova redirect sign in. That functionality is therefore split into
 * {@link browserPopupRedirectResolver} and
 * {@link cordovaPopupRedirectResolver}. The dependencies object is how Auth is
 * configured to reduce bundle sizes.
 *
 * There are two ways to initialize an {@link Auth} instance: {@link getAuth} and
 * {@link initializeAuth}. `getAuth` initializes everything using
 * platform-specific configurations, while `initializeAuth` takes a
 * `Dependencies` object directly, giving you more control over what is used.
 *
 * @public
 */
export interface Dependencies {
  /**
   * Which {@link Persistence} to use. If this is an array, the first
   * `Persistence` that the device supports is used. The SDK searches for an
   * existing account in order and, if one is found in a secondary
   * `Persistence`, the account is moved to the primary `Persistence`.
   *
   * If no persistence is provided, the SDK falls back on
   * {@link inMemoryPersistence}.
   */
  persistence?: Persistence | Persistence[];
  /**
   * The {@link PopupRedirectResolver} to use. This value depends on the
   * platform. Options are {@link browserPopupRedirectResolver} and
   * {@link cordovaPopupRedirectResolver}. This field is optional if neither
   * {@link signInWithPopup} or {@link signInWithRedirect} are being used.
   */
  popupRedirectResolver?: PopupRedirectResolver;
  /**
   * Which {@link AuthErrorMap} to use.
   */
  errorMap?: AuthErrorMap;
}

/**
 * The class for asserting ownership of a TOTP second factor. Provided by
 * {@link TotpMultiFactorGenerator.assertionForEnrollment} and
 * {@link TotpMultiFactorGenerator.assertionForSignIn}.
 *
 * @public
 */


// /**
//  * Represents Fusabase Auth service instance.
//  */
// export interface Auth {
//   app: any; // FusabaseApp
//   currentUser: User | null;
//   languageCode: string | null;
//   tenantId: string | null;
//   settings: AuthSettings;
//   emulatorConfig: EmulatorConfig | null;

//   authStateReady(): Promise<void>;
//   beforeAuthStateChanged(callback: (user: User | null) => void | Promise<void>, onAbort?: () => void): void;
//   onAuthStateChanged(nextOrObserver: (user: User | null) => void, error?: (err: Error) => void, completed?: () => void): void;
//   onIdTokenChanged(nextOrObserver: (user: User | null) => void, error?: (err: Error) => void, completed?: () => void): void;
//   signOut(): Promise<void>;
//   setPersistence(persistence: Persistence): Promise<void>;
//   updateCurrentUser(user: User): Promise<void>;
//   useDeviceLanguage(): void;
// }

/**
 * AuthConfig defines the available options for configuring the Auth instance.
 */
type AuthConfig = {
  /** Which AuthErrorMap to use. */
  errorMap?: AuthErrorMap;
  /** Which persistence strategy to use. Can be a single persistence or array. */
  persistence?: Persistence | Persistence[];
  /** Resolver for popup/redirect-based sign-in. */
  popupRedirectResolver?: PopupRedirectResolver;
  /** Custom extension for type of authentication (idcs, base_s, ldap_s, etc.). */
  authType?: string;
};

/**
 * Authentication management class.
 *
 * Handles initialization, persistence, token storage, user sessions,
 * and interaction with helper classes for different auth types.
 *
 * @example
 * ```ts
 * import { Auth } from './auth.js';
 * const auth = new Auth(app, config);
 * await auth.signInWithEmailAndPassword('user@example.com', 'password');
 * ```
 */
export class Auth {
  /** Parent application instance (can be FusabaseApp). */
  public app: any;

  /** Configuration for authentication (error maps, persistence, popup resolvers). */
  public config: AuthConfig;

  public intConfig: ONPREMConfig | IDCSConfig;

  /** Name of the app (copied from the parent app). */
  public name: string;

  /** Arbitrary runtime settings for this auth instance. */
  public settings: Record<string, unknown>;

  /** Key used for storing tokens in persistence. */
  /**
   * @internal
   */
  public TOKEN_KEY: string;

  /** Tenant ID associated with the current session. */
  public tenantId: string | null;

  /** Currently signed-in user. */
  public currentUser: User | null;

  /** Helper used for different authentication flows (IDCS, on-prem). */
  private authHelper: IDCSAuthHelper | ONPREMAuthHelper | null = null;

  /** Cached user credential object after sign-in. */
  private userCredential: UserCredential | null = null;

  /** Event listener for auth lifecycle events. */
  private eventListener: EventTarget | null = null;

  /** Manages persistence of user session across tabs/windows. */
  private persistenceUserManager: PersistenceUserManager | null = null;

  /** Listener for broadcasting persistence events across tabs/windows. */
  /**
   * @internal
   */
  public persistenceListener: BroadcastChannel | null = null;

  /** Available persistence types (static utility). */
  public static Persistence: typeof PersistenceType = PersistenceType;

  /** Callback to be executed before auth state changes. */
  private beforeAuthStateChangedCallback: ((user: User | null) => void) | null = null;

  /** Abort callback for before-auth-state-changed handling. */
  private beforeAuthStateChangedCallbackAbort: (() => void) | null = null;

  private promise: Promise<void> | null = null;
  private resolve: (() => void) | null = null;
  private reject: ((reason?: unknown) => void) | null = null;


  /**
   * Construct a new Auth instance.
   *
   * @param app - The parent application instance.
   * @param config - The configuration for authentication.
   */
  constructor(app: any, config?: AuthConfig) {
    this.app = app;
    this.intConfig = getConfig(app); // overwrite passed config with resolved config
    this.config = config ?? {};
    this.name = app.name;
    this.settings = {}; // default settings

    // Create an initialization promise for auth state.
    this.promise = new Promise<void>((resolve, reject) => {
    this.resolve = resolve;
    this.reject = reject;
  });

    this.TOKEN_KEY = this.app.options.appID + "TOKENS";
    this.tenantId = null;
    this.currentUser = null;

    // else if (this.intConfig.authType === "base_s" || this.intConfig.authType === "ldap_s") {
    //   this.authHelper = new ONPREMSRPAuthHelper(this.intConfig as ONPREMSRPConfig, app.logLevel);
    // } 
    this.authHelper = this.intConfig.authType === "idcs"
      ? new IDCSAuthHelper(this.intConfig as IDCSConfig, app.logLevel, new URL(this.app.options.ordsHost).origin)
      : new ONPREMAuthHelper(this.intConfig as ONPREMConfig, app.logLevel, new URL(this.app.options.ordsHost).origin);
    // wire app into helper so requests use the shared Fusabase fetch path.
    (this.authHelper as any)?._setApp?.(app);

    this.eventListener = new EventTarget();

    // Browser-only logic.
    if (typeof window !== "undefined") {
      this.persistenceListener = new window.BroadcastChannel(
        this.app.options.appID + "auth_event"
      );

      this.persistenceUserManager = new PersistenceUserManager(
        this.persistenceListener,
        this.TOKEN_KEY
      );

      /**
       * Handle login events where persistence is set to local storage.
       */
      const handleLocalLogin = async (event: MessageEvent<any>) => {
        if (this.persistenceUserManager && this.persistenceUserManager.persistence.type === PersistenceType.SESSION) {
          await this.persistenceUserManager.persistence._remove(this.TOKEN_KEY);
        }
        if (this.currentUser) {
          await this.signOutWithoutTrigger();
        }
        if (this.persistenceUserManager) {
          this.persistenceUserManager.persistence = new BrowserLocalPersistence();
        }
        
        let tokens = event.data.tokens;
        if (!tokens) return;
        tokens = this.tokensParse(tokens);
        await this.signInWithoutTrigger(tokens);
      };

      /**
       * Handle login events with session/none persistence.
       */
      const handleSessionNoneLogin = async (event: MessageEvent<any>) => {
        if (this.persistenceUserManager && this.persistenceUserManager.persistence.type === PersistenceType.LOCAL) {
          await this.persistenceUserManager.persistence._remove(this.TOKEN_KEY);
        }
        if (this.currentUser) {
          await this.signOutWithoutTrigger();
        }
      };

      /**
       * Handle logout events.
       */
      const handleLocalLogout = async (_event: MessageEvent<any>) => {
        if (this.currentUser) {
          await this.signOutWithoutTrigger();
        }
      };

      // Load tokens from persistence.
      if (this.persistenceUserManager) {
        this.persistenceUserManager.persistence = new BrowserLocalPersistence();
      }
      
      let tokens: any = window.localStorage.getItem(this.TOKEN_KEY);
      if (!tokens) {
        if (this.persistenceUserManager) {
          this.persistenceUserManager.persistence = new BrowserSessionPersistence();
        }
        
        tokens = window.sessionStorage.getItem(this.TOKEN_KEY);
      }
      if (tokens != null) {
        tokens = this.tokensParse(tokens);
      }

      // Handle persistence preference configuration.
      let persistArr: Persistence[] | undefined;
      let initializedFromTokens = false;

      if (this.config.persistence != null) {
        const persistenceConfig = this.config.persistence;
        persistArr = Array.isArray(persistenceConfig) ? persistenceConfig : [persistenceConfig];
        if (tokens && this.persistenceUserManager && this.persistenceUserManager.persistence._isAvailable()) {
          this.initialSignIn(tokens);
          initializedFromTokens = true;
        }
      } else {
        persistArr = [inMemoryPersistence];
      }

      for (let j = 0; j < persistArr.length && !initializedFromTokens; j++) {
        let p;
        if (persistArr[j].type === PersistenceType.LOCAL) {
          p = new BrowserLocalPersistence();
        } else if (persistArr[j].type === PersistenceType.SESSION) {
          p = new BrowserSessionPersistence();
        } else {
          p = new InMemoryPersistence();
        }
        if (this.persistenceUserManager) {
          this.persistenceUserManager.persistence = p;
        }
        
        if (this.persistenceUserManager && this.persistenceUserManager.persistence._isAvailable()) break;
      }

      if (tokens) {
        this.initialSignIn(tokens);
      } else if (!initializedFromTokens) {
        this.resolve!();
      }

      // Listen for persistence events from other tabs/windows.
      this.persistenceListener.onmessage = async (event: MessageEvent<any>) => {
        Utils.baasLogger(this.app.logLevel, event.data);
        if (event.data.name === `login_local`) {
          handleLocalLogin(event);
        } else if (
          event.data.name === `login_session_none` && this.persistenceUserManager && 
          this.persistenceUserManager.persistence.type === PersistenceType.LOCAL
        ) {
          handleSessionNoneLogin(event);
        } else if (
          event.data.name === `logout_local` && this.persistenceUserManager && 
          this.persistenceUserManager.persistence.type === PersistenceType.LOCAL
        ) {
          handleLocalLogout(event);
        }
      };
    }
  }

  /**
   * Wait until the authentication state is ready.
   *
   * @returns {Promise<unknown> | null} Promise that resolves when auth state is ready.
   */
  async authStateReady(): Promise<unknown> {
    return this.promise;
  }

  /**
   * Internal function to parse the stringified tokens object from storage.
   *
   * @param {string} tokens - The stringified tokens JSON.
   * @returns {Record<string, any>} Parsed tokens object with access_token parsed.
   * @private
   */
  private tokensParse(tokens: string): Record<string, any> {
    const parsed = JSON.parse(tokens);
    parsed.access_token = JSON.parse(parsed.access_token);
    return parsed;
  }

  /**
   * Internal function to stringify the tokens for storing in storage.
   *
   * @param {Record<string, any>} tokens - Tokens object containing at least `access_token`.
   * @returns {string} Stringified tokens suitable for storage.
   * @private
   */
  private tokensStringify(tokens: Record<string, any>): string {
    tokens.access_token = tokens.access_token.stringify();
    return JSON.stringify(tokens);
  }

  /**
   * Internal method to set token data in persistence storage and post corresponding events.
   *
   * @async
   * @param {string} key - Storage key under which tokens are stored.
   * @param {any} value - Value containing at least `access_token` and `refresh_token`.
   * @returns {Promise<any>} Resolves with the stored value after posting events.
   * @throws Will throw an error if persistence write fails.
   */
  /**
   * @internal
   */
  async _setTokenDataOnStorage(key: string, value: any): Promise<any> {
    const token = new IdTokenResult(value.access_token.token);
    value.access_token = token;

    const tokenStore = {
      access_token: new IdTokenResult(value.access_token.token),
      refresh_token: value.refresh_token,
    };
    if (this.persistenceUserManager) {
      return this.persistenceUserManager.persistence
      ._set(key, value)
      .then(() => {
        let tempToken: any = tokenStore;
        tempToken = this.tokensStringify(tempToken);

        if (
          this.persistenceUserManager && this.persistenceUserManager.persistence.type ===
          PersistenceType.LOCAL
        ) {
          this.persistenceListener?.postMessage({
            name: `login_local`,
            tokens: tempToken,
          });
        } else {
          this.persistenceListener?.postMessage({
            name: `login_session_none`,
            tokens: tempToken,
          });
        }

        return value;
      })
      .catch((err: unknown) => {
        throw authErrorHandler(err);
      });
    }

    
  }

  /**
   * Get the current log level of the application.
   *
   * @returns {number} The app's log level.
   */
  /**
   * @internal
   */
  _getLogLevel(): number {
    return this.app.logLevel;
  }

  /**
   * Async method to create a user with email and password in IDCS.
   *
   * - Returns the newly created User Credentials and signs in the user.
   * - For `ldap_s` and `base_s` auth types, it directly creates credentials without sign-in.
   * - Throws exception if registration fails.
   *
   * @async
   * @param {string} email - User's email address.
   * @param {string} password - User's password.
   * @returns {Promise<UserCredential>} Created user's credentials.
   * @throws Will throw an error if user creation or sign-in fails.
   */
  /**
   * @internal
   */
  async createUserWithEmailAndPassword(
    email: string,
    password: string
  ): Promise<UserCredential> {
    argCheck(email, "Invalid email", true, [typeStrings.STRING]);
    argCheck(password, "Invalid password", true, [typeStrings.STRING]);

    let response: UserCredential | null = null;

    try {
      if (!this.authHelper) {
        throw new Error("Uninitialized auth");
      }
      
      await this.authHelper.registerUser(email, password, "");

      response = await this.signInWithEmailAndPassword(email, password);
    } catch (err) {
      throw authErrorHandler(err);
    }

    return response!;
  }

  /**
   * Internal Method to sync the login activity across tabs.
   *
   * @async
   * @param {Record<string, any>} tokens - Token object containing at least `access_token` and `refresh_token`.
   * @returns {Promise<void>} Resolves when token persistence is synchronized.
   * @throws Will throw if persistence sync fails.
   * @private
   */
  private async syncLoginPersistence(tokens: Record<string, any>): Promise<void> {
    if (this.persistenceListener == null || !(typeof window !== "undefined")) {
      return;
    }

    this._setTokenDataOnStorage(this.TOKEN_KEY, tokens)
      .then(() => {
        // token sync success
      })
      .catch((err) => {
        throw authErrorHandler(err);
      });
  }

  /**
   * Async Method to sign in a user with email and password.
   *
   * @async
   * @param {string} email - User's email address.
   * @param {string} password - User's password.
   * @returns {Promise<UserCredential>} User's credential object after successful sign-in.
   * @throws Will throw if authentication fails.
   */
  /**
   * @internal
   */
  async signInWithEmailAndPassword(email: string, password: string): Promise<UserCredential> {
    argCheck(email, "Invalid email", true, [typeStrings.STRING]);
    argCheck(password, "Invalid password", true, [typeStrings.STRING]);

    let userData: any;

    try {
      if (!this.authHelper) {
        throw new Error("Uninitialized auth");
      }
      userData = await this.authHelper.authenticateAndGetDetails(email, password);
    } catch (err) {
      throw authErrorHandler(err);
    }

    return this.createCredentials(userData);
  }

  /**
   * Internal Method to create user credentials from authentication data.
   *
   * @async
   * @param {any} userData - Object containing `userDetails`, `authnToken`, `access_token`, and `refresh_token`.
   * @returns {Promise<UserCredential>} The constructed user credential object.
   * @private
   */
  private async createCredentials(userData: any): Promise<UserCredential> {
    const user = new User(
      userData.userDetails,
      userData.authnToken,
      userData.access_token,
      userData.refresh_token,
      this
    );
    await user.getFUSABASEToken();
    const credential = EmailAuthProvider.credential(user.email ?? "", "");
    const userCred = new UserCredential(user, credential);

    this.userCredential = userCred;

    await this.syncLoginPersistence({
      access_token: userData.access_token,
      refresh_token: userData.refresh_token,
    });

    await this.updateCurrentUser(user);
    return userCred;
  }


  /** Sets the persistence type for this Auth instance */
  async setPersistence(persistence: Persistence): Promise<void> {
    if (!(persistence.type == PersistenceType.LOCAL ||
      persistence.type == PersistenceType.SESSION ||
      persistence.type == PersistenceType.NONE
    )) {
      let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid persistence passed");
      error.status = 400;
      throw authErrorHandler(error);
    }
    await this.persistenceUserManager?.setPersistence(persistence.type);
  }

  /**
   * Internal Method to sign in without triggering events
   */
  /**
   * @internal
   */
  async signInWithoutTrigger(tokens:any) {
    if (!tokens) {
      let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid tokens!");
      error.status = ErrorCode.INVALID_ARGS;
      Utils.baasTrace(this.app.logLevel);
      throw authErrorHandler(error);
    }
    const userDetails = await this.authHelper?.getUserDetails(
      tokens.access_token
    );
    const user = new User(
      userDetails,
      null,
      tokens.access_token,
      tokens.refresh_token,
      this
    );
    await user.getFUSABASEToken();
    let credential;
    if (userDetails["idp_name"] === "UserNamePassword") {
      credential = EmailAuthProvider.credential(user.email ?? "", "");
    } else {
     if (userDetails["idp_name"].startsWith("google")) {
      credential = GoogleAuthProvider.credential(undefined, tokens.access_token.token);
     } else if (userDetails["idp_name"].startsWith("github")) {
      credential = GithubAuthProvider.credential(undefined, tokens.access_token.token);
     } else if (userDetails["idp_name"].startsWith("facebook")) {
      credential = FacebookAuthProvider.credential(undefined, tokens.access_token.token);
     } else if (userDetails["idp_name"].startsWith("oidc_")) {
           credential = OAuthProvider.credential(undefined, tokens.access_token.token);
     } else if (userDetails["idp_name"].startsWith("saml_")) {
           credential = SAMLAuthProvider.credential(tokens.access_token.token);
     } else if (userDetails["idp_name"].startsWith("idcs")) {
       credential = IDCSAuthProvider.credential(undefined, tokens.access_token.token);   
     }
    }
    //const credential = EmailAuthProvider.credential();
    const userCred = new UserCredential(user, credential ?? EmailAuthProvider.credential("", ""));

    this.executeBeforeAuthStateChanged(user);

    this.userCredential = userCred;
    await this.updateCurrentUser(user);
    return userCred;
  }

  /**
   * Internal Method to sign in on auth initialization.
   */
  /**
   * @internal
   */
  async initialSignIn(tokens:any) {
    if (!tokens) {
      if (this.resolve) {
        this.resolve();
      }
      return null;
    }
    if (!tokens.access_token) {
      if (this.resolve) {
        this.resolve();
      }
      return null;
    }
    if (!tokens.access_token.token && !tokens.access_token.intToken) {
      if (this.resolve) {
        this.resolve();
      }
      return null;
    }
    tokens.access_token = new IdTokenResult(tokens.access_token.intToken);
    var _userHelper = null;
    // else if (this.intConfig.authType === 'base_s' || this.intConfig.authType === 'ldap_s') {
    //   _userHelper = new ONPREMSRPUserHelper(this.intConfig, null, tokens.access_token, this.app.logLevel);
    // }
    _userHelper = this.intConfig.authType === 'idcs'
      ? new IDCSUserHelper(this.intConfig, null, tokens.access_token, this.app.logLevel)
      : new ONPREMUserHelper(this.intConfig, null, tokens.access_token, this.app.logLevel);
    _userHelper.user = this;
    (_userHelper as any)?._setApp?.(this.app);
    var forcerefresh = false;
    if (!_userHelper.validateAccessToken()) {
      forcerefresh = true;
      try {
        const temp_token =
          await _userHelper.refreshAccessToken(
            tokens.refresh_token);
        tokens.refresh_token = temp_token;
        tokens.access_token = _userHelper.acc_tok;
      }
      catch (e) {
        Utils.baasLogger(this.app.logLevel, e);
        if (this.resolve) {
          this.resolve();
        }
        return null;
      }
    }
    let userDetails = null;
    try {
      userDetails = await this.authHelper?.getUserDetails(
        tokens.access_token
      );
    } catch (e) {
      Utils.baasLogger(this.app.logLevel, e);
      if (this.resolve) {
        this.resolve();
      }
      return null;
    }
    if (userDetails == null) {
      if (this.resolve) {
        this.resolve();
      }
      return null;
    }
    const user = new User(
      userDetails,
      null,
      tokens.access_token,
      tokens.refresh_token,
      this
    );
    await user.getFUSABASEToken();
    let credential;
    if (userDetails["idp_name"] === "UserNamePassword") {
      credential = EmailAuthProvider.credential(user.email ?? "", "");
    } else {
     if (userDetails["idp_name"].startsWith("google")) {
      credential = GoogleAuthProvider.credential(undefined, tokens.access_token.token);
     } else if (userDetails["idp_name"].startsWith("github")) {
      credential = GithubAuthProvider.credential(undefined, tokens.access_token.token);
     } else if (userDetails["idp_name"].startsWith("facebook")) {
      credential = FacebookAuthProvider.credential(undefined, tokens.access_token.token);
     } else if (userDetails["idp_name"].startsWith("oidc_")) {
           credential = OAuthProvider.credential(undefined, tokens.access_token.token);
     } else if (userDetails["idp_name"].startsWith("saml_")) {
           credential = SAMLAuthProvider.credential(tokens.access_token.token);
     } else if (userDetails["idp_name"].startsWith("idcs")) {
       credential = IDCSAuthProvider.credential(undefined, tokens.access_token.token);   
     }
    }
    const userCred = new UserCredential(user, credential ?? EmailAuthProvider.credential("", ""));

    this.executeBeforeAuthStateChanged(user);

    this.userCredential = userCred;
    if (forcerefresh) {
      try {
        await this.syncLoginPersistence({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token
        });
      } catch (e) {
        Utils.baasLogger(this.app.logLevel, e);
        if (this.resolve) {
          this.resolve();
        }
        
        return null;
      }
    }
    await this.updateCurrentUser(user);
    if (this.resolve) {
      this.resolve();
    }
    
    return userCred;
  }

  /**
   * @async
   * @property {Function} signInWithPopup
   * async method to sign in using popup.
   * @param {object} provider
   * @returns {Promise<UserCredential>} 
   */
  /**
   * @internal
   */
  async signInWithPopup(provider: AuthProvider): Promise<UserCredential> {
    if (!(provider instanceof GoogleAuthProvider || 
      provider instanceof FacebookAuthProvider ||
      provider instanceof GithubAuthProvider || 
      provider instanceof SAMLAuthProvider ||
      provider instanceof OAuthProvider ||
      provider instanceof IDCSAuthProvider
    )) {
      let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,`Invalid provider specified`);
      error.status = 400;
      throw authErrorHandler(error);
    }
    try {
      let url = "";
      const contextUri = `${window.location.origin}${window.location.pathname}`;
      if (this.intConfig.authType === 'idcs') {
        //idcs social login url
        const method = provider.providerName + "-idcs";
        const popupUrl = new URL(`${this.app.options.ordsHost}_/baas-services/idm/idcs/${this.intConfig.projectID}/social`);
        popupUrl.searchParams.set('method', method);
        popupUrl.searchParams.set('appID', this.app.options.appID);
        popupUrl.searchParams.set('device', 'web');
        popupUrl.searchParams.set('apiKey', this.app.options.appID);
        popupUrl.searchParams.set('context_uri', contextUri);
        url = popupUrl.toString();
      } else {
        //onprem social login url
        const method = provider.providerName;
        const auth_id = this.intConfig.authID;

        const popupUrl = new URL(`${this.app.options.ordsHost}_/baas-services/idm/onprem/${this.intConfig.projectID}/socialidp`);
        popupUrl.searchParams.set('auth_id', auth_id);
        popupUrl.searchParams.set('method', method);
        popupUrl.searchParams.set('device', 'web');
        popupUrl.searchParams.set('apiKey', this.app.options.appID);
        popupUrl.searchParams.set('app_id', this.app.options.appID);
        popupUrl.searchParams.set('link', '0');
        popupUrl.searchParams.set('context_uri', contextUri);
        url = popupUrl.toString();
      }

      const tokensObj = await this.authHelper?.socialLogin(url);

      const tokens = tokensObj?.tokens;
      const authnToken = tokensObj?.authnToken;

      const userDetails = await this.authHelper?.getUserDetails(
        tokens?.access_token
      );

      const user = new User(
        userDetails,
        authnToken,
        tokens?.access_token,
        tokens?.refresh_token,
        this.app.auth()
      );
      await user.getFUSABASEToken();
      let credential;
      if (provider instanceof GoogleAuthProvider) {
        credential = GoogleAuthProvider.credential(
        authnToken ? authnToken.token : undefined,
        tokens?.access_token.token
      )
      }
      if (provider instanceof FacebookAuthProvider) {
        credential = FacebookAuthProvider.credential(
        authnToken ? authnToken.token : undefined,
        tokens?.access_token.token
      )
      }
      if (provider instanceof GithubAuthProvider) {
        credential = GithubAuthProvider.credential(
        authnToken ? authnToken.token : undefined,
        tokens?.access_token.token
      )
      }
      if (provider instanceof SAMLAuthProvider) {
        credential = SAMLAuthProvider.credential(tokens?.access_token.token)
      }
      if (provider instanceof OAuthProvider) {
        credential = OAuthProvider.credential(
        authnToken ? authnToken.token : undefined,
        tokens?.access_token.token
      )
      }
      const userCred = new UserCredential(user, credential ?? new AuthCredential("",""));
      this.userCredential = userCred;
      await this.syncLoginPersistence({
        access_token: tokens?.access_token,
        refresh_token: tokens?.refresh_token
      });

      await this.updateCurrentUser(user);
      return userCred;
    }
    catch (err) {
      throw authErrorHandler(err);
    }
  }

  /**
   * @internal
   */
  async signInWithCredential(credential: OAuthCredential): Promise<UserCredential> {
    if (!(credential instanceof OAuthCredential)) {
      let error = new AuthError(ErrorCodeMessage.INVALID_ARGS, `Invalid credential`);
      error.status = 400;
      throw authErrorHandler(error);
    }
    let authnToken:any = null;
    try {
      if (this.authHelper) {
        const tokens = await this.authHelper.signInWithCredentialHelper(credential);
        tokens["access_token"] = new IdTokenResult(tokens["access_token"]);
        const userDetails = await this.authHelper.getUserDetails(tokens.access_token);

        const user = new User(
          userDetails,
          credential.idToken,
          tokens.access_token,
          tokens.refresh_token,
          this.app.auth()
        );
        await user.getFUSABASEToken();
        let newCreds;
        if (credential.providerId === GoogleAuthProvider.PROVIDER_ID) {
          newCreds = GoogleAuthProvider.credential(
          authnToken == null ? null : authnToken.token,
          tokens.access_token.token
        );
        }
        if (credential.providerId === FacebookAuthProvider.PROVIDER_ID) {
          newCreds = FacebookAuthProvider.credential(
          authnToken == null ? null : authnToken.token,
          tokens.access_token.token
        );
        }
        if (credential.providerId === GithubAuthProvider.PROVIDER_ID) {
          newCreds = GithubAuthProvider.credential(
          authnToken == null ? null : authnToken.token,
          tokens.access_token.token
        );
        }

        const userCred = new UserCredential(user, newCreds ?? new AuthCredential("", ""));
        this.userCredential = userCred;
        await this.syncLoginPersistence({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token
        });

        await this.updateCurrentUser(user);
        return userCred;
      } else {
        throw new AuthError(ErrorCodeMessage.SERVER_ERROR, getErrorMessage('INVALID_AUTH_INSTANCE'));
      }
    } catch (err) {
      throw authErrorHandler(err);
    }
  }


  /**
 * @async
 * @property {Function} signInWithRedirect
 * Async method to sign in via redirect.
 * @param {AuthProvider} provider
 * @returns {Promise<never>}
 */
  /**
   * @internal
   */
async signInWithRedirect(provider: AuthProvider): Promise<never> {
  if (!(provider instanceof GoogleAuthProvider ||
        provider instanceof FacebookAuthProvider ||
        provider instanceof GithubAuthProvider ||
        provider instanceof SAMLAuthProvider ||
        provider instanceof IDCSAuthProvider ||
        provider instanceof OAuthProvider)) {
    const error = new AuthError(ErrorCodeMessage.INVALID_ARGS, `Invalid provider specified`);
    error.status = 400;
    throw authErrorHandler(error);
  }

  try {
    const codeVerifier = this.authHelper?.generateCodeVerifier();
    const codeChallenge = await this.authHelper?.generateCodeChallenge(codeVerifier ?? "");

    localStorage.setItem("redirectState", "LoginInitiated");
    localStorage.setItem("codeVerifier", codeVerifier ?? "");
    localStorage.setItem("providerId", provider.providerName);

    // Build base URL safely
      const baseUrl =
        this.intConfig.authType === 'idcs'
          ? `${this.app.options.ordsHost}_/baas-services/idm/idcs/${this.intConfig.projectID}/social`
          : `${this.app.options.ordsHost}_/baas-services/idm/onprem/${this.intConfig.projectID}/socialidp`;

      // Create URL object (Fortify-safe)
      const redirectUrl = new URL(baseUrl);

      // Allow-listed query parameters only
      redirectUrl.searchParams.set('device', 'web');
      redirectUrl.searchParams.set('apiKey', this.app.options.appID);
      redirectUrl.searchParams.set('code_challenge', codeChallenge ?? "");
      redirectUrl.searchParams.set('code_challenge_method', 'S256');
      redirectUrl.searchParams.set(
        'context_uri',
        `${window.location.origin}${window.location.pathname}` // 🔐 no user-controlled query
      );
      redirectUrl.searchParams.set('link', '0');

      // Only add method for on-prem
      if (this.intConfig.authType !== 'idcs') {
        redirectUrl.searchParams.set('method', provider.providerName);
      }

      // Final redirect (validated sink)
      window.location.assign(redirectUrl.toString());

    // This line ensures the function never resolves
    return new Promise<never>(() => {});
  } catch (err) {
    throw authErrorHandler(err);
  }
}

  /**
   * @internal
   */
  getProvider(): GoogleAuthProvider | GithubAuthProvider | FacebookAuthProvider | SAMLAuthProvider | OAuthProvider | IDCSAuthProvider {
    if (typeof window !== "undefined") {
      const providerId = localStorage.getItem("providerId");
      
      if (providerId == "google") {
        return new GoogleAuthProvider();
      } else if (providerId == "github") {
        return new GithubAuthProvider();
      } else if (providerId == "facebook") {
        return new FacebookAuthProvider();
      } else if (providerId?.startsWith("saml_")) {
        return new SAMLAuthProvider(providerId);
      } else if (providerId?.startsWith("oidc_")) {
        return new OAuthProvider(providerId);
      } else if (providerId == 'idcs') {
        return new IDCSAuthProvider();
      } else {
        throw new AuthError(ErrorCodeMessage.INVALID_ARGS, getErrorMessage('UNKNOWN_PROVIDER_ID'));
      }
    } else {
      throw new AuthError(ErrorCodeMessage.SERVER_ERROR, getErrorMessage('INVALID_PARAM', 'window (not defined)'));
    }
  }

  /**
   * Handles the redirect result for the authentication flow.
   */
  /**
   * @internal
   */
  async getRedirectResult(): Promise<UserCredential | null> {
    if (typeof window !== "undefined") {
      const status = localStorage.getItem("redirectState");
      
      if (status == null || status !== "LoginInitiated")
        return null; 
      
      try {
        if (!this.authHelper) {
          throw new Error("Auth helper is not initialized");
        }
        
        const provider = this.getProvider();
          
        const parsedUrl = new URL(window.location.href);
        const params = parsedUrl.searchParams;
    
        const code = params.get("code");
    
        if (code && this.authHelper) {
          const data = await this.authHelper.getRedirectCredentials(code, "");
          if (data && data.id_token && !data.access_token) {
            let newCreds;
            if (!this.currentUser) {
              return null;
            }
            if (provider.providerId === GoogleAuthProvider.PROVIDER_ID) {
              newCreds = GoogleAuthProvider.credential(
              data.id_token
            );
            }
            if (provider.providerId === FacebookAuthProvider.PROVIDER_ID) {
              newCreds = FacebookAuthProvider.credential(
              data.id_token
            );
            }
            if (provider.providerId === GithubAuthProvider.PROVIDER_ID) {
              newCreds = GithubAuthProvider.credential(
              data.id_token
            );
          }
          if (newCreds) {
            return await this.currentUser.linkWithCredential(newCreds);
          }
          }
          
          const tokensObj = {
            authnToken: null,
            tokens: {
              access_token: new IdTokenResult(data.access_token),
              refresh_token: data.refresh_token
            }
          }
          const tokens = tokensObj.tokens;
          const authnToken = tokensObj.authnToken;
      
          const userDetails = await this.authHelper.getUserDetails(
            tokens.access_token
          );
          const user = new User(
            userDetails,
            authnToken,
            tokens.access_token,
            tokens.refresh_token,
            this.app.auth()
          );
          await user.getFUSABASEToken();
          let credential;
          if (provider instanceof GoogleAuthProvider) {
            credential = GoogleAuthProvider.credential(undefined, tokens.access_token.token);
          } else if (provider instanceof GithubAuthProvider) {
            credential = GithubAuthProvider.credential(undefined, tokens.access_token.token);
          } else if (provider instanceof FacebookAuthProvider) {
            credential = FacebookAuthProvider.credential(undefined, tokens.access_token.token);
          } else if (provider instanceof OAuthProvider) {
            credential = OAuthProvider.credential(undefined, tokens.access_token.token);
          } else if (provider instanceof SAMLAuthProvider) {
            credential = SAMLAuthProvider.credential(tokens.access_token.token);
          }
            const userCred = new UserCredential(user, credential ?? new AuthCredential("",""));
            this.userCredential = userCred;
            await this.syncLoginPersistence({
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token
            });
            
            localStorage.setItem("redirectState", "ResultProcessed");
    
            await this.updateCurrentUser(user);
            return userCred;
            }
            return null;
          } catch (err) {
            localStorage.setItem("redirectState", "ErrorEncountered");
            throw authErrorHandler(err);
          }
          finally {
            
            // Clear local storage in case of successful/failed login
        localStorage.removeItem("redirectKey");
        localStorage.removeItem("codeVerifier");
        localStorage.removeItem("providerId");
        
        // Clean the URL
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        window.history.replaceState({}, document.title, url.toString());
    
      }
    } else {
      throw new AuthError(ErrorCodeMessage.SERVER_ERROR, getErrorMessage('INVALID_PARAM', 'window (not defined)'));
    }
  }
  

//   // check this (not implemented)
//   /**
//    * @internal
//    */
// async signInAnonymously(): Promise<UserCredential> {
//   let error = new AuthError(ErrorCodeMessage.NOT_IMPLEMENT, "Not implemented");
//   error.status = 501;
//   throw authErrorHandler(error);
// }


  /**
   * @property {Function} onIdTokenChanged
   * Adds an observer for changes to the signed-in user's ID token, 
   * which includes sign-in, sign-out, and token refresh events. 
   * Returns a function to unsubscribe from listening the state.
   * @param {(user: User | null) => void} observer
   * @returns {Unsubscribe} unsubscribe function
   */
  onIdTokenChanged(observer: ((user: User | null) => void),
    error?: (error: Error) => void,
    completed?: () => void): Unsubscribe {
    argCheck(observer, "Invalid callback", true, [typeStrings.FUNCTION]);
    const listener = (): void => {
      observer(this.currentUser);
    };
    this.eventListener?.addEventListener("IdTokenChange", listener);
    observer(this.currentUser);

    const unsubscribe = (): void => {
      this.eventListener?.removeEventListener("IdTokenChange", listener);
    };
    return unsubscribe;
  }

  /**
   * Internal Method to sync logout activity across tabs.
   */
  private async syncLogoutPersistence(): Promise<void> {
    if (this.persistenceListener == null || !(typeof window !== "undefined")) {
      return;
    }
    try {
      await this.persistenceUserManager?.persistence._remove(this.TOKEN_KEY);
      if (this.persistenceUserManager?.persistence.type === PersistenceType.LOCAL) {
        this.persistenceListener?.postMessage({
          name: `logout_local`,
          tokens: null,
        });
      }
    } catch (err) {
      throw authErrorHandler(err);
    }
  }

  /**
   * Internal Method to sign out a logged in user without triggering the sync events of persistence.
   */
  /**
   * @internal
   */
  async signOutWithoutTrigger(): Promise<void> {
    try {
      await this.updateCurrentUser(null);
    }
    catch (err) {
      throw authErrorHandler(err);
    }
  }


  /**
 * @internal
 */
  async __updateCurrentToken(user: User): Promise<User | null> {
    this.currentUser = user;
    if (this.userCredential) {
      this.userCredential.user = user;
    }
    setTimeout(() => {
      this.eventListener?.dispatchEvent(new Event("IdTokenChange"));
    });
    return this.currentUser;
  }

  executeBeforeAuthStateChanged(user: User | null): void {
    if (this.beforeAuthStateChangedCallback != null) {
      try {
        this.beforeAuthStateChangedCallback(user);
      } catch (e) {
        if (this.beforeAuthStateChangedCallbackAbort != null) {
          this.beforeAuthStateChangedCallbackAbort();
          return;
        }
      }
    }
  }

  /**
   * @async
   * @property {Function} sendPasswordResetEmail
   * Async method to send password reset email.
   * @param {String} email
   * @return {Promise<void>}
   */
  /**
   * @internal
   */
  async sendPasswordResetEmail(email: string, actionCodeSettings?: any): Promise<void> {
    argCheck(email, "Invalid email", true, [typeStrings.STRING]);
    if (this.authHelper) {
      await this.authHelper.sendPasswordResetEmailHelper(email);
    }
  }

  /**
   * @async
   * @property {Function} verifyPasswordResetCode
   * Verifies the password reset code sent on email.
   * @param {String} code
   * @return {Promise<String>}
   */
  /**
   * @internal
   */
  async verifyPasswordResetCode(code: string): Promise<string> {
    argCheck(code, "Invalid code", true, [typeStrings.STRING]);
    let response = null;
    try {
      if (this.authHelper) {
        response = await this.authHelper.verifyPasswordResetCodeHelper(code);
      }
      if (response) {
        return response;
      } else {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS, "Request failed");
        error.status = ErrorCode.SERVER_ERROR;
        error.authType = this.intConfig.authType;
        Utils.baasTrace(this.app.logLevel);
        throw error;
      }
    } catch (err) {
      throw authErrorHandler(err);
    }
  }

  /**
   * @async
   * @property {Function} confirmPasswordReset
   * Completes the password reset process.
   * @param {String} code
   * @param {String} newPassword
   * @return {Promise<void>}
   */
  /**
   * @internal
   */
  async confirmPasswordReset(code: string, newPassword: string, email:string = ""): Promise<void> {
    argCheck(code, "Invalid code", true, [typeStrings.STRING]);
    argCheck(newPassword, "Invalid newPassword", true, [typeStrings.STRING]);
    try {
      if (this.authHelper) {
        await this.authHelper.confirmPasswordResetHelper(code, newPassword, email);
      }
    } catch (err) {
      throw authErrorHandler(err);
    }
  }

  /** Signs out the current user */
  async signOut(): Promise<void> {
    try {
      if (this.currentUser && this.authHelper && this.currentUser.refreshToken) {
        await this.authHelper.performSignOut(this.currentUser.refreshToken);
      }
    } catch (e) {

    }
    try {
      this.executeBeforeAuthStateChanged(null);
      await this.syncLogoutPersistence();
    } catch (err) {
    }
    try {
      await this.updateCurrentUser(null);
    } catch (err) {
      throw authErrorHandler(err);
    }
  }

  /** Updates the current user */
  async updateCurrentUser(user: User | null): Promise<void> {
    if (user && !(user instanceof User)) {
      let error = new AuthError(ErrorCodeMessage.INVALID_ARGS, "Invalid user instance passed");
      error.status = 400;
      throw authErrorHandler(error);
    }
    this.currentUser = user;
    if (this.userCredential && user) {
      this.userCredential.user = user;
    }
    setTimeout(() => {
      if (this.eventListener) {
        this.eventListener.dispatchEvent(new Event("StateChange"));
        this.eventListener.dispatchEvent(new Event("IdTokenChange"));
      }
    });
    return Promise.resolve();
  }

  /** Sets language to the device/browser default */
  useDeviceLanguage(): void {
    throw new AuthError(ErrorCodeMessage.NOT_IMPLEMENT, getErrorMessage('METHOD_NOT_IMPLEMENTED'));
  }

  /** Adds a blocking callback before auth state changes */
  beforeAuthStateChanged(
    callback: (user: User | null) => void,
    onAbort?: () => void
  ): Unsubscribe {
    this.beforeAuthStateChangedCallback = callback;
    this.beforeAuthStateChangedCallbackAbort = onAbort ? onAbort : null;

    const unsubscribe = (): void => {
      this.beforeAuthStateChangedCallback = null;
      this.beforeAuthStateChangedCallbackAbort = null;
    };
    return unsubscribe;
  }

  /** Observes changes to user's sign-in state */
  onAuthStateChanged(
    observer: ((user: User | null) => void),
    error?: (error: Error) => void,
    completed?: () => void
  ): Unsubscribe {
    argCheck(observer, "Invalid callback", true, [typeStrings.FUNCTION]);
    const listener = (): void => {
      observer(this.currentUser);
    };
    this.eventListener?.addEventListener("StateChange", listener);
    observer(this.currentUser);

    const unsubscribe = (): void => {
      this.eventListener?.removeEventListener("StateChange", listener);
    };
    return unsubscribe;
  }
}


/**
 * Configuration settings for an Auth instance.
 *
 * @example
 * ```ts
 * const settings: AuthSettings = {
 *   appVerificationDisabledForTesting: true
 * };
 * ```
 */
export interface AuthSettings {
  /** Whether to disable app verification for testing purposes */
  appVerificationDisabledForTesting?: boolean;
}

// /**
//  * Auth initialization configuration.
//  */
// export interface Config {
//   apiKey: string;
//   authDomain?: string;
//   [key: string]: any;
// }

/**
 * Configuration
 *
 * @example
 * ```ts
 * const emulatorConfig: EmulatorConfig = {
 *   url: 'http://localhost:9099',
 *   options: { disableWarnings: false }
 * };
 * ```
 */
export interface EmulatorConfig {
  /** The URL of the Auth emulator */
  url: string;
  /** Additional options for the emulator connection */
  options?: { disableWarnings?: boolean };
}

// /**
//  * Represents an Auth error.
//  */
// export interface AuthError {
//   code: string;
//   message: string;
// }

/**
 * Maps error codes to localized error messages.
 *
 * @example
 * ```ts
 * const errorMap: AuthErrorMap = {
 *   'auth/invalid-email': 'The email address is not valid.',
 *   'auth/user-not-found': 'No user found with this email.'
 * };
 * ```
 */
export interface AuthErrorMap {
  /** Error code mapped to localized message */
  [key: string]: string;
}


/**
 * Additional information from federated identity providers.
 *
 * @example
 * const info: AdditionalUserInfo = { providerId: 'google.com', isNewUser: true, profile: { name: 'John' } };
 */
export interface AdditionalUserInfo {
  providerId?: string;
  isNewUser?: boolean;
  profile?: Record<string, any>;
  username?: string | null;
}

/**
 * Represents an application verifier like reCAPTCHA.
 *
 * @example
 * const verifier: ApplicationVerifier = { type: 'recaptcha', verify: async () => 'token' };
 */
export interface ApplicationVerifier {
  type: string;
  verify(): Promise<string>;
}

/**
 * Resolver for handling popup and redirect authentication flows in browsers.
 */
export interface PopupRedirectResolver {
  /** @internal */
  /** Opens a popup window for authentication */
  _openPopup(auth: Auth, provider: AuthProvider, authType: string): Promise<Window>;
  /** @internal */
  /** Redirects the current window for authentication */
  _redirect(auth: Auth, provider: AuthProvider, authType: string): Promise<void>;
}
