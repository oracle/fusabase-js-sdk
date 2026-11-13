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
import { Persistence } from './types/persistence.js';
import PersistenceType from './helpers/persistence/PersistenceType.js';
import { IDCSAuthHelper, ONPREMAuthHelper } from './helpers/authHelper.js';
import { browserLocalPersistence, browserSessionPersistence, inMemoryPersistence } from './types/persistence.js';
import { AuthProvider } from './providers/provider.js';
import { getConfig, IDCSConfig, ONPREMConfig } from './helpers/config.js';
import PersistenceUserManager from './helpers/persistence/PersistenceUserManager.js';
import BrowserLocalPersistence from './helpers/storage/BrowserLocalPersistence.js';
import { argCheck, AuthError, authErrorHandler, ErrorCode, ErrorCodeMessage, typeStrings, getErrorMessage } from './errors.js';
import { GoogleAuthProvider } from './providers/google.js';
import { GithubAuthProvider } from './providers/github.js';
import { SAMLAuthProvider } from './providers/saml.js';
import { FacebookAuthProvider } from './providers/facebook.js';
import { OAuthProvider } from './providers/oauth.js';
import BrowserSessionPersistence from './helpers/storage/BrowserSessionPersistence.js';
import { IdTokenResult } from './types/idtoken.js';
import { EmailAuthProvider } from './providers/email.js';
import { IDCSUserHelper, ONPREMUserHelper } from './helpers/userHelper.js';
import { Utils } from './util/util.js';
import { AuthCredential, UserCredential } from './internal/credential.js';
import { MfaFactorResponse, MultiFactorInfoImpl } from './internal/multifactor.js';
import { MultiFactorResolverImpl } from './internal/multifactor_resolver.js';
import { MultiFactorSessionImpl } from './internal/multifactor_session.js';
import { OAuthCredential } from './internal/phone.js';
import InMemoryPersistence from './helpers/storage/InMemoryPersistence.js';
import { IDCSAuthProvider } from './providers/idcs.js';
import {
  clearRedirectFlow,
  getAuthEventChannelName,
  getTokenStorageKey,
  loadRedirectFlow,
  saveRedirectFlow,
} from './helpers/appIdentity.js';
import { _getProvider } from '../../app/src/index.js';

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
 * // `SignInMethod` is an internal implementation detail. Use the public
 * // email/password sign-in API instead.
 * import { signInWithEmailAndPassword } from "fusabase/auth";
 * await signInWithEmailAndPassword(auth, "person@example.com", "password");
 * ```
 */
export const SignInMethod = {
  /** Sign in with email and password */
  EMAIL_PASSWORD: "password",
  /** Sign in with email link */
  EMAIL_LINK: "emailLink"
}

type MfaRequiredResponse = {
  mfaRequired?: true;
  code?: number;
  error?: string | MfaFactorResponse[];
  challengeId: string;
  mfaSessionToken?: string;
  availableFactors?: MfaFactorResponse[];
  factors?: MfaFactorResponse[];
  expiresInSeconds?: number;
};

function isMfaRequiredResponse(value: unknown): value is MfaRequiredResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    (
      (value as MfaRequiredResponse).mfaRequired === true ||
      (value as MfaRequiredResponse).error === "MFA_REQUIRED" ||
      ((value as MfaRequiredResponse).code === 503 && Array.isArray((value as MfaRequiredResponse).error))
    ) &&
    typeof (value as MfaRequiredResponse).challengeId === "string" &&
    (
      Array.isArray((value as MfaRequiredResponse).availableFactors) ||
      Array.isArray((value as MfaRequiredResponse).factors) ||
      Array.isArray((value as MfaRequiredResponse).error)
    )
  );
}

function hasMfaRequiredFlag(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { mfaRequired?: unknown }).mfaRequired === true
  );
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
 * import { getAuth, signInWithEmailAndPassword } from "fusabase/auth";
 * const auth = getAuth(app);
 * await signInWithEmailAndPassword(auth, "user@example.com", "password");
 * ```
 */
/** Authentication service for an application. @example `const auth = getAuth(app);` */
export class Auth {
  /** Parent application instance (can be FusabaseApp). */
  public app: any;

  /** Configuration for authentication (error maps, persistence, popup resolvers). */
  public config: AuthConfig;

/** Describes the public `intConfig` value. */
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

  /** IDCS ID token retained internally for the ORDS logout handoff. */
  private idTokenHint: string | null = null;

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
  private beforeAuthStateChangedCallback: ((user: User | null) => void | Promise<void>) | null = null;

  /** Abort callback for before-auth-state-changed handling. */
  private beforeAuthStateChangedCallbackAbort: (() => void) | null = null;

  private promise: Promise<void> | null = null;
  private resolve: (() => void) | null = null;
  private reject: ((reason?: unknown) => void) | null = null;


/**
 * Constructs a Auth instance with the supplied configuration.
 *
 * @param app - The app instance that owns this service.
 * @param config - The config accepted by this operation.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { Auth } from "fusabase/auth";
 * const result = new Auth(value, value);
 * void result;
 * ```
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

    this.TOKEN_KEY = getTokenStorageKey(this.app);
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
        getAuthEventChannelName(this.app)
      );

      this.persistenceUserManager = new PersistenceUserManager(
        this.persistenceListener,
        this.TOKEN_KEY
      );

      /**
       * Handle login events where persistence is set to local storage.
       */
      const handleLocalLogin = async (event: MessageEvent<any>) => {
        const persistenceManager = this.persistenceUserManager;
        if (!persistenceManager) return;
        if (persistenceManager.persistence.type === PersistenceType.SESSION) {
          await persistenceManager.persistence._remove(this.TOKEN_KEY);
        }
        if (this.currentUser) {
          await this.signOutWithoutTrigger();
        }
        persistenceManager.persistence = new BrowserLocalPersistence();
        
        let tokens = await persistenceManager.persistence._get(this.TOKEN_KEY);
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
        const eventName = event.data?.name;
        if (typeof eventName !== 'string') return;
        Utils.baasLogger(this.app.logLevel, eventName);
        if (eventName === `login_local`) {
          handleLocalLogin(event);
        } else if (
          eventName === `login_session_none` && this.persistenceUserManager &&
          this.persistenceUserManager.persistence.type === PersistenceType.LOCAL
        ) {
          handleSessionNoneLogin(event);
        } else if (
          eventName === `logout_local` && this.persistenceUserManager &&
          this.persistenceUserManager.persistence.type === PersistenceType.LOCAL
        ) {
          handleLocalLogout(event);
        }
      };
    } else {
      // Node has no browser persistence to restore. Mark the initial empty
      // auth state as ready so callers such as relational.auth.initialize()
      // and getSession() do not wait indefinitely.
      this.resolve!();
    }
  }

/**
 * Executes the authStateReady operation for this public SDK type.
 *
 * @returns The result produced by `authStateReady`, including any requested data or handle.
 * @example
 * ```ts
 * import { Auth } from "fusabase/auth";
 * const result = client.authStateReady();
 * void result;
 * ```
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
  private tokensParse(tokens: string | Record<string, any>): Record<string, any> {
    const parsed = typeof tokens === 'string' ? JSON.parse(tokens) : { ...tokens };
    if (typeof parsed.access_token === 'string') {
      parsed.access_token = JSON.parse(parsed.access_token);
    }
    const rawAccessToken = parsed.access_token?.token ?? parsed.access_token?.intToken;
    if (typeof rawAccessToken !== 'string' || rawAccessToken.length === 0) {
      throw new Error('Invalid persisted access token');
    }
    parsed.access_token = new IdTokenResult(rawAccessToken);
    return parsed;
  }

  /** Restores the IDCS logout hint from the current auth token payload. */
  private setIdTokenHint(tokens?: Record<string, any>): void {
    this.idTokenHint = this.intConfig.authType === 'idcs' &&
      typeof tokens?.id_token === 'string' && tokens.id_token.length > 0
      ? tokens.id_token
      : null;
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
    // IDCS refresh responses do not include a new ID token. Retain the
    // existing token so a later browser reload can still perform the IDCS
    // form-post logout handoff.
    if (
      this.intConfig.authType === 'idcs' &&
      (typeof value.id_token !== 'string' || value.id_token.length === 0) &&
      this.persistenceUserManager
    ) {
      const persistedTokens = await this.persistenceUserManager.persistence._get(key);
      if (typeof persistedTokens?.id_token === 'string' && persistedTokens.id_token.length > 0) {
        value = { ...value, id_token: persistedTokens.id_token };
      }
    }
    const token = new IdTokenResult(value.access_token.token);
    value.access_token = token;

    if (this.persistenceUserManager) {
      return this.persistenceUserManager.persistence
      ._set(key, value)
      .then(() => {
        if (
          this.persistenceUserManager && this.persistenceUserManager.persistence.type ===
          PersistenceType.LOCAL
        ) {
          this.persistenceListener?.postMessage({
            name: `login_local`,
          });
        } else {
          this.persistenceListener?.postMessage({
            name: `login_session_none`,
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
      if (isMfaRequiredResponse(userData)) {
        throw this.createMfaRequiredError(userData);
      }
      if (hasMfaRequiredFlag(userData)) {
        const error = new AuthError(ErrorCodeMessage.SERVER_ERROR, { message: "Invalid multi-factor sign-in response" });
        error.status = ErrorCode.SERVER_ERROR;
        throw error;
      }
    } catch (err) {
      throw authErrorHandler(err);
    }

    return this.createCredentials(userData);
  }

  /**
   * Completes sign-in after MFA challenge verification returns final tokens.
   * @internal
   */
  async _completeMfaSignIn(tokens: { access_token: string; refresh_token?: string }): Promise<UserCredential> {
    if (!this.authHelper) {
      throw new Error("Uninitialized auth");
    }

    const accessToken = new IdTokenResult(tokens.access_token);
    const userDetails = await this.authHelper.getUserDetails(accessToken);
    return this.createCredentials({
      userDetails,
      authnToken: null,
      access_token: accessToken,
      refresh_token: tokens.refresh_token ?? null
    });
  }

  private createMfaRequiredError(response: MfaRequiredResponse): AuthError {
    const factors = response.availableFactors
      ?? response.factors
      ?? (Array.isArray(response.error) ? response.error : []);
    const hints = factors.map((factor) => MultiFactorInfoImpl._fromServerResponse(factor));
    const resolver = new MultiFactorResolverImpl(
      hints,
      MultiFactorSessionImpl._fromSignIn(response.challengeId, response.mfaSessionToken),
      this
    );
    const error = new AuthError(ErrorCodeMessage.MFA_REQUIRED, { message: "Multi-factor authentication required" });
    error.status = ErrorCode.MFA_REQUIRED;
    (error as AuthError & { resolver: MultiFactorResolverImpl }).resolver = resolver;
    return error;
  }

  /**
   * Internal Method to create user credentials from authentication data.
   *
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

    await this.commitAuthState(user, userCred, {
      access_token: userData.access_token,
      refresh_token: userData.refresh_token,
    });
    return userCred;
  }


/**
 * Executes the setPersistence operation for this public SDK type.
 *
 * @param persistence - The persistence accepted by this operation.
 * @returns The result produced by `setPersistence`, including any requested data or handle.
 * @example
 * ```ts
 * import { Auth } from "fusabase/auth";
 * const result = client.setPersistence(value);
 * void result;
 * ```
 */
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
    this.setIdTokenHint(tokens);
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

    await this.commitAuthState(user, userCred);
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
    this.setIdTokenHint(tokens);
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

    if (forcerefresh) {
      try {
        await this.commitAuthState(user, userCred, {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          // An IDCS refresh response does not issue a new ID token. Keep the
          // persisted hint when committing the refreshed access token so this
          // browser session can still complete the IDCS logout handoff.
          id_token: tokens.id_token
        });
      } catch (e) {
        Utils.baasLogger(this.app.logLevel, e);
        if (this.resolve) {
          this.resolve();
        }
        
        return null;
      }
    } else {
      await this.commitAuthState(user, userCred);
    }
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
      if (isMfaRequiredResponse(tokensObj)) {
        throw this.createMfaRequiredError(tokensObj);
      }
      if (hasMfaRequiredFlag(tokensObj)) {
        const error = new AuthError(ErrorCodeMessage.SERVER_ERROR, { message: "Invalid multi-factor sign-in response" });
        error.status = ErrorCode.SERVER_ERROR;
        throw error;
      }

      const tokens = tokensObj?.tokens;
      const authnToken = tokensObj?.authnToken;
      const idToken = this.intConfig.authType === 'idcs' ? tokensObj?.id_token : undefined;

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
      if (provider instanceof IDCSAuthProvider) {
        credential = IDCSAuthProvider.credential(idToken, tokens?.access_token.token);
      }
      const userCred = new UserCredential(user, credential ?? new AuthCredential("",""));
      await this.commitAuthState(user, userCred, {
        access_token: tokens?.access_token,
        refresh_token: tokens?.refresh_token,
        id_token: idToken
      });
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
        if (isMfaRequiredResponse(tokens)) {
          throw this.createMfaRequiredError(tokens);
        }
        if (hasMfaRequiredFlag(tokens)) {
          const error = new AuthError(ErrorCodeMessage.SERVER_ERROR, { message: "Invalid multi-factor sign-in response" });
          error.status = ErrorCode.SERVER_ERROR;
          throw error;
        }
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
        if (credential.providerId === IDCSAuthProvider.PROVIDER_ID) {
          newCreds = IDCSAuthProvider.credential(credential.idToken, tokens.access_token.token);
        }

        const userCred = new UserCredential(user, newCreds ?? new AuthCredential("", ""));
        await this.commitAuthState(user, userCred, {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          id_token: credential.providerId === IDCSAuthProvider.PROVIDER_ID ? credential.idToken : undefined
        });
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

    saveRedirectFlow(this.app, codeVerifier ?? "", provider.providerName);

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
  getProvider(providerId: string): GoogleAuthProvider | GithubAuthProvider | FacebookAuthProvider | SAMLAuthProvider | OAuthProvider | IDCSAuthProvider {
    if (typeof window !== "undefined") {
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
      const flow = loadRedirectFlow(this.app);
      if (!flow) return null;
      
      try {
        if (!this.authHelper) {
          throw new Error("Auth helper is not initialized");
        }
        
        const provider = this.getProvider(flow.providerId);
          
        const parsedUrl = new URL(window.location.href);
        const params = parsedUrl.searchParams;
    
        const code = params.get("code");
    
        if (code && this.authHelper) {
          const data = await this.authHelper.getRedirectCredentials(code, "", flow.codeVerifier);
          if (isMfaRequiredResponse(data)) {
            throw this.createMfaRequiredError(data);
          }
          if (hasMfaRequiredFlag(data)) {
            const error = new AuthError(ErrorCodeMessage.SERVER_ERROR, { message: "Invalid multi-factor sign-in response" });
            error.status = ErrorCode.SERVER_ERROR;
            throw error;
          }
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
              refresh_token: data.refresh_token,
              id_token: this.intConfig.authType === 'idcs' ? data.id_token : undefined
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
          } else if (provider instanceof IDCSAuthProvider) {
            credential = IDCSAuthProvider.credential(tokens.id_token, tokens.access_token.token);
          }
            const userCred = new UserCredential(user, credential ?? new AuthCredential("",""));
            await this.commitAuthState(user, userCred, {
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
              id_token: tokens.id_token
            });
            return userCred;
            }
            return null;
          } catch (err) {
            throw authErrorHandler(err);
          }
          finally {
        clearRedirectFlow(this.app);
        
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
 * Executes the onIdTokenChanged operation for this public SDK type.
 *
 * @param observer - Observer callbacks for next, error, and completion events.
 * @param error - The authentication or service error to inspect.
 * @param completed - The completed accepted by this operation.
 * @returns The result produced by `onIdTokenChanged`, including any requested data or handle.
 * @example
 * ```ts
 * import { Auth } from "fusabase/auth";
 * const result = client.onIdTokenChanged(value, new Error("example"), value);
 * void result;
 * ```
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
      this.idTokenHint = null;
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

  private async commitAuthState(
    user: User | null,
    credential: UserCredential | null,
    tokens?: Record<string, any>
  ): Promise<void> {
    await this.executeBeforeAuthStateChanged(user);
    if (tokens) {
      this.setIdTokenHint(tokens);
      await this.syncLoginPersistence(tokens);
    }
    this.userCredential = credential;
    await this.updateCurrentUser(user, true);
  }

/**
 * Executes the executeBeforeAuthStateChanged operation for this public SDK type.
 *
 * @param user - The user accepted by this operation.
 * @returns The result produced by `executeBeforeAuthStateChanged`, including any requested data or handle.
 * @example
 * ```ts
 * import { Auth } from "fusabase/auth";
 * const result = client.executeBeforeAuthStateChanged(value);
 * void result;
 * ```
 */
  async executeBeforeAuthStateChanged(user: User | null): Promise<void> {
    const callback = this.beforeAuthStateChangedCallback;
    if (callback == null) return;

    try {
      await callback(user);
    } catch (error) {
      try {
        this.beforeAuthStateChangedCallbackAbort?.();
      } catch {
        // Preserve the guard failure even when its abort handler fails.
      }
      throw error;
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

/**
 * Executes the signOut operation for this public SDK type.
 *
 * @returns The result produced by `signOut`, including any requested data or handle.
 * @example
 * ```ts
 * import { Auth } from "fusabase/auth";
 * const result = client.signOut();
 * void result;
 * ```
 */
  async signOut(): Promise<void> {
    const idTokenHint = this.idTokenHint;
    const refreshToken = this.currentUser?.refreshToken ?? null;
    const isIdcsLogout = this.intConfig.authType === 'idcs';
    const shouldSubmitIdcsLogout = isIdcsLogout &&
      typeof window !== 'undefined' && idTokenHint != null;

    await this.executeBeforeAuthStateChanged(null);
    if (refreshToken && this.authHelper) {
      try {
        await this.authHelper.performSignOut(refreshToken);
      } catch (error) {
        if (!this.isAlreadyInvalidRefreshTokenError(error)) {
          throw authErrorHandler(error);
        }
      }
    }
    try {
      await this.syncLogoutPersistence();
      await this.updateCurrentUser(null, true);
      this.idTokenHint = null;

      const oracledbProvider = _getProvider<any>(this.app, 'oracledb');
      for (const oracledb of oracledbProvider.getInitializedInstances()) {
        oracledb.__closeRealtimeForSignOut?.();
      }

      if (shouldSubmitIdcsLogout) {
        this.submitIdcsLogoutForm(idTokenHint);
      }
    } catch (err) {
      throw authErrorHandler(err);
    }
  }

  /** Returns whether refresh-token revocation confirms the token is already unusable. */
  private isAlreadyInvalidRefreshTokenError(error: unknown): boolean {
    const candidate = error as { status?: unknown; code?: unknown; message?: unknown } | null;
    if (!candidate) return false;
    if (candidate.status === ErrorCode.INVALID_USER_TOK ||
        candidate.code === `auth/${ErrorCodeMessage.INVALID_USER_TOK}`) {
      return true;
    }
    return typeof candidate.message === 'string' &&
      /\b(?:invalid[_ -]?token|token[_ -]?expired|expired[_ -]?token|already[_ -]?(?:revoked|invalid))\b/i
        .test(candidate.message);
  }

  /** Submits the IDCS logout handoff without exposing tokens in the URL. */
  private submitIdcsLogoutForm(idTokenHint: string): void {
    const logoutUrl = new URL('logout', (this.intConfig as IDCSConfig).domainURL);
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = logoutUrl.toString();
    form.style.display = 'none';

    const fields: Record<string, string> = {
      apiKey: this.app.options.appID,
      context_uri: `${window.location.origin}${window.location.pathname}`,
      id_token_hint: idTokenHint,
    };
    for (const [name, value] of Object.entries(fields)) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }

    document.body.appendChild(form);
    form.submit();
  }

/**
 * Executes the updateCurrentUser operation for this public SDK type.
 *
 * @param user - The user accepted by this operation.
 * @param guardAlreadyRun - The guardAlreadyRun accepted by this operation.
 * @returns The result produced by `updateCurrentUser`, including any requested data or handle.
 * @example
 * ```ts
 * import { Auth } from "fusabase/auth";
 * const result = client.updateCurrentUser(value, value);
 * void result;
 * ```
 */
  async updateCurrentUser(user: User | null, guardAlreadyRun = false): Promise<void> {
    if (user && !(user instanceof User)) {
      let error = new AuthError(ErrorCodeMessage.INVALID_ARGS, "Invalid user instance passed");
      error.status = 400;
      throw authErrorHandler(error);
    }
    if (user && !hasEquivalentAuthAppConfig(user.auth, this)) {
      const error = new AuthError(
        ErrorCodeMessage.INVALID_ARGS,
        new Error("User belongs to an Auth instance with a different app configuration")
      );
      error.status = 400;
      throw authErrorHandler(error);
    }
    if (!guardAlreadyRun) {
      await this.executeBeforeAuthStateChanged(user);
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

/**
 * Executes the useDeviceLanguage operation for this public SDK type.
 *
 * @returns The result produced by `useDeviceLanguage`, including any requested data or handle.
 * @example
 * ```ts
 * import { Auth } from "fusabase/auth";
 * const result = client.useDeviceLanguage();
 * void result;
 * ```
 */
  useDeviceLanguage(): void {
    throw new AuthError(ErrorCodeMessage.NOT_IMPLEMENT, getErrorMessage('METHOD_NOT_IMPLEMENTED'));
  }

/**
 * Executes the beforeAuthStateChanged operation for this public SDK type.
 *
 * @param callback - The callback invoked when the operation produces a result.
 * @param onAbort - The onAbort accepted by this operation.
 * @returns The result produced by `beforeAuthStateChanged`, including any requested data or handle.
 * @example
 * ```ts
 * import { Auth } from "fusabase/auth";
 * const result = client.beforeAuthStateChanged(value, value);
 * void result;
 * ```
 */
  beforeAuthStateChanged(
    callback: (user: User | null) => void | Promise<void>,
    onAbort?: () => void
  ): Unsubscribe {
    this.beforeAuthStateChangedCallback = callback;
    this.beforeAuthStateChangedCallbackAbort = onAbort ? onAbort : null;

    const unsubscribe = (): void => {
      if (this.beforeAuthStateChangedCallback === callback) {
        this.beforeAuthStateChangedCallback = null;
        this.beforeAuthStateChangedCallbackAbort = null;
      }
    };
    return unsubscribe;
  }

/**
 * Executes the onAuthStateChanged operation for this public SDK type.
 *
 * @param observer - Observer callbacks for next, error, and completion events.
 * @param error - The authentication or service error to inspect.
 * @param completed - The completed accepted by this operation.
 * @returns The result produced by `onAuthStateChanged`, including any requested data or handle.
 * @example
 * ```ts
 * import { Auth } from "fusabase/auth";
 * const result = client.onAuthStateChanged(value, new Error("example"), value);
 * void result;
 * ```
 */
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

  /** @internal Releases browser listeners and sensitive in-memory state. */
  async _delete(): Promise<void> {
    if (this.persistenceListener) {
      this.persistenceListener.onmessage = null;
      this.persistenceListener.close();
      this.persistenceListener = null;
    }
    this.eventListener = null;
    this.persistenceUserManager = null;
    this.beforeAuthStateChangedCallback = null;
    this.beforeAuthStateChangedCallbackAbort = null;
    this.currentUser = null;
    this.userCredential = null;
    this.authHelper = null;
    this.resolve = null;
    this.reject = null;
    this.promise = null;
  }
}

function canonicalizeAppConfig(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value == null || typeof value !== 'object') {
    return value;
  }
  if (seen.has(value)) {
    throw new Error('Circular app configuration');
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map(item => canonicalizeAppConfig(item, seen));
  }
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    result[key] = canonicalizeAppConfig((value as Record<string, unknown>)[key], seen);
  }
  return result;
}

/** @internal */
export function hasEquivalentAuthAppConfig(left: Auth | null | undefined, right: Auth): boolean {
  if (!left || !right) {
    return false;
  }
  try {
    return JSON.stringify(canonicalizeAppConfig({
      name: left.app?.name,
      options: left.app?.options,
      config: left.app?.config,
    })) === JSON.stringify(canonicalizeAppConfig({
      name: right.app?.name,
      options: right.app?.options,
      config: right.app?.config,
    }));
  } catch {
    // An uncanonicalizable configuration must not permit a cross-Auth user transfer.
    return false;
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
