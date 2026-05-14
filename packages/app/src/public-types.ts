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

import { Auth } from "../../auth/src/types/auth.js";
import { Oracledb } from "../../oracledb/src/internal/core.js";
import { Storage } from "../../storage/src/internal/storage.js";
import {LogLevel} from "../../logger/LogLevel.js";
import { browserLocalPersistence, browserSessionPersistence, inMemoryPersistence, Persistence } from "../../auth/src/types/persistence.js";

interface AppConfig {
  objsType?: string;
  storageBucket?: string;
  authType?: string;
  authID?: string;
}


/**
 * A {@link @fusabase/app#App} holds the initialization information for a collection of
 * services.
 *
 * Do not call this constructor directly. Instead, use
 * {@link initializeApp} to create an app.
 *
 * @public
 */
export class App {

  /**
   * The (read-only) configuration options for this app. These are the original
   * parameters given in {@link initializeApp}.
   *
   * @example
   * ```javascript
   * const app = initializeApp(config);
   * console.log(app.options.databaseURL === config.databaseURL);  // true
   * ```
   */
  readonly options: FusabaseOptions;

  /**
   * The (read-only) name for this app.
   *
   * The default app's name is `"[DEFAULT]"`.
   *
   * @example
   * ```javascript
   * // The default app's name is "[DEFAULT]"
   * const app = initializeApp(defaultAppConfig);
   * console.log(app.name);  // "[DEFAULT]"
   * ```
   *
   * @example
   * ```javascript
   * // A named app's name is what you provide to initializeApp()
   * const otherApp = initializeApp(otherAppConfig, "other");
   * console.log(otherApp.name);  // "other"
   * ```
   */
  readonly name: string;

  /**
   * The settable config flag for GDPR opt-in/opt-out
   */
  automaticDataCollectionEnabled: boolean;

  private authInstance: Auth | null = null;
  private oracledbInstance: Oracledb | null = null;
  private storageInstance: Storage | null = null;
  private logLevelValue: LogLevel = LogLevel.SILENT;
  private configValue: AppConfig | null = null;

  get config(): AppConfig | null {
    return this.configValue;
  }

  constructor(options: FusabaseOptions, name: string) {
    this.options = options;
    this.name = name;
    this.automaticDataCollectionEnabled = false;
  }

  auth(persArr?: Persistence[]): Auth | null {
    if (persArr) {
      this.authInstance = new Auth(this, {persistence:persArr});
      return this.authInstance;
    }
    return this.authInstance;
  }

  oracledb(): Oracledb | null {
    return this.oracledbInstance;
  }

  storage(url: string = ""): Storage | null {
    return this.storageInstance;
  }

  async delete(): Promise<void> {
    this.authInstance = null;
    this.oracledbInstance = null;
    this.storageInstance = null;
    // fusabase._apps[this.name] = null;
  }

  get logLevel(): LogLevel {
    return this.logLevelValue;
  }
  set logLevel(log: LogLevel) {
    this.logLevelValue = log;
  }

  /** @internal */
  _intializeAfterConfig(): void {
    if (!this.options) return;

    const config: AppConfig = {
      objsType: this.options.objsType,
      storageBucket: this.options.storageBucket,
      authType: this.options.authType,
      authID: this.options.authID
    };

    this.configValue = config;
    this.authInstance = new Auth(this, {
      persistence:[browserLocalPersistence,browserSessionPersistence, inMemoryPersistence]});
    this.oracledbInstance = new Oracledb(this);
    this.storageInstance = new Storage(this);
  }
}

// /**
//  * A {@link @fusabase/app#FusabaseApp} holds the initialization information for a collection of
//  * services.
//  *
//  * Do not call this constructor directly. Instead, use
//  * {@link (initializeApp:1) | initializeApp()} to create an app.
//  *
//  * @public
//  */
// export interface FusabaseApp {
//   /**
//    * The (read-only) name for this app.
//    *
//    * The default app's name is `"[DEFAULT]"`.
//    *
//    * @example
//    * ```javascript
//    * // The default app's name is "[DEFAULT]"
//    * const app = initializeApp(defaultAppConfig);
//    * console.log(app.name);  // "[DEFAULT]"
//    * ```
//    *
//    * @example
//    * ```javascript
//    * // A named app's name is what you provide to initializeApp()
//    * const otherApp = initializeApp(otherAppConfig, "other");
//    * console.log(otherApp.name);  // "other"
//    * ```
//    */
//   readonly name: string;

//   /**
//    * The (read-only) configuration options for this app. These are the original
//    * parameters given in {@link (initializeApp:1) | initializeApp()}.
//    *
//    * @example
//    * ```javascript
//    * const app = initializeApp(config);
//    * console.log(app.options.databaseURL === config.databaseURL);  // true
//    * ```
//    */
//   readonly options: FusabaseOptions;

//   /**
//    * The settable config flag for GDPR opt-in/opt-out
//    */
//   automaticDataCollectionEnabled: boolean;
// }

/**
 * A {@link @fusabase/app#FusabaseServerApp} holds the initialization information
 * for a collection of services running in server environments.
 *
 * Do not call this constructor directly. Instead, use
 * {@link (initializeServerApp:1) | initializeServerApp()} to create
 * an app.
 *
 * @public
 */
// export interface FusabaseServerApp extends FusabaseApp {
//   /**
//    * There is no `getApp()` operation for `FusabaseServerApp`, so the name is not relevant for
//    * applications. However, it may be used internally, and is declared here so that
//    * `FusabaseServerApp` conforms to the `FusabaseApp` interface.
//    */
//   name: string;

//   /**
//    * The (read-only) configuration settings for this server app. These are the original
//    * parameters given in {@link (initializeServerApp:1) | initializeServerApp()}.
//    *
//    * @example
//    * ```javascript
//    * const app = initializeServerApp(settings);
//    * console.log(app.settings.authIdToken === options.authIdToken);  // true
//    * ```
//    */
//   readonly settings: FusabaseServerAppSettings;
// }

/**
 * @public
 *
 * Fusabase configuration object. Contains a set of parameters required by
 * services in order to successfully communicate with Fusabase server APIs
 * and to associate client data with your Fusabase project and
 * Fusabase application. Typically this object is populated by the Fusabase
 * console at project setup.
 */
export interface FusabaseOptions {
  /**
   * An encrypted string used when calling certain APIs that don't need to
   * access private user data
   * (example value: `AIzaSyDOCAbC123dEf456GhI789jKl012-MnO`).
   */
  ordsHost?: string;
  /**
   * Auth domain for the project ID.
   */
  schema?: string;

  /**
   * Platform / app type identifier from config (e.g. config `app_type`).
   */
  appType?: string;
  /**
   * Application id.
   */
  appID?: string;
  /**
   * The unique identifier for the project across all of Fusabase.
   */
  projectID?: string;
  /**
   * The default Cloud Storage bucket name.
   */
  objsType?: string;
  /**
   * Unique numerical value used to identify each sender that can send
   * Fusabase Cloud Messaging messages to client apps.
   */
  storageBucket?: string;
  /**
   * Unique identifier for the app.
   */
  authType?: string;
  /**
   * An ID automatically created when you enable Analytics in your
   * Fusabase project and register a web app. In versions 7.20.0
   * and higher, this parameter is optional.
   */
  authID?: string;

  useSocket?: boolean;

  longPollingInterval?: number;

  version?: number;

  chunkSize?: number;

  /**
   * Maximum number of bytes accepted by Storage upload helpers.
   */
  maxUploadBytes?: number;

  idcsConfig?: IDCSDomainConfig;

  /** @internal */
  appCheckToken?: string;
}

/**
 * @public
 *
 * Configuration options given to {@link initializeApp}
 */
export interface IDCSDomainConfig {
  /**
   * custom name for the Fusabase App.
   * The default value is `"[DEFAULT]"`.
   */
  domainURL?: string;
  /**
   * The settable config flag for GDPR opt-in/opt-out. Defaults to true.
   */
  clientId?: string;

  clientSecret?: string;

  selfRegistrationProfile?: string;
}

/**
 * @public
 *
 * Configuration options given to {@link initializeApp}
 */
export interface FusabaseAppSettings {
  /**
   * custom name for the Fusabase App.
   * The default value is `"[DEFAULT]"`.
   */
  name?: string;
  /**
   * The settable config flag for GDPR opt-in/opt-out. Defaults to true.
   */
  automaticDataCollectionEnabled?: boolean;
}

/**
 * @public
 *
 * Configuration options given to {@link (initializeServerApp:1) | initializeServerApp()}
 */
export interface FusabaseServerAppSettings
  extends Omit<FusabaseAppSettings, 'name'> {
  /**
   * An optional Auth ID token used to resume a signed in user session from a client
   * runtime environment.
   *
   * Invoking `getAuth` with a `FusabaseServerApp` configured with a validated `authIdToken`
   * causes an automatic attempt to sign in the user that the `authIdToken` represents. The token
   * needs to have been recently minted for this operation to succeed.
   *
   * If the token fails local verification due to expiration or parsing errors, then a console error
   * is logged at the time of initialization of the `FusabaseServerApp` instance.
   *
   * If the Auth service has failed to validate the token when the Auth SDK is initialized, then an
   * warning is logged to the console and the Auth SDK will not sign in a user on initialization.
   *
   * If a user is successfully signed in, then the Auth instance's `onAuthStateChanged` callback
   * is invoked with the `User` object as per standard Auth flows. However, `User` objects
   * created via an `authIdToken` do not have a refresh token. Attempted `refreshToken`
   * operations fail.
   */
  authIdToken?: string;

  /**
   * An optional App Check token. If provided, the Fusabase SDKs that use App Check will utilize
   * this App Check token in place of requiring an instance of App Check to be initialized.
   *
   * If the token fails local verification due to expiration or parsing errors, then a console error
   * is logged at the time of initialization of the `FusabaseServerApp` instance.
   */
  appCheckToken?: string;

  /**
   * An optional object. If provided, the Fusabase SDK uses a `FinalizationRegistry`
   * object to monitor the garbage collection status of the provided object. The
   * Fusabase SDK releases its reference on the `FusabaseServerApp` instance when the
   * provided `releaseOnDeref` object is garbage collected.
   *
   * You can use this field to reduce memory management overhead for your application.
   * If provided, an app running in a SSR pass does not need to perform
   * `FusabaseServerApp` cleanup, so long as the reference object is deleted (by falling out of
   * SSR scope, for instance.)
   *
   * If an object is not provided then the application must clean up the `FusabaseServerApp`
   * instance by invoking `deleteApp`.
   *
   * If the application provides an object in this parameter, but the application is
   * executed in a JavaScript engine that predates the support of `FinalizationRegistry`
   * (introduced in node v14.6.0, for instance), then an error is thrown at `FusabaseServerApp`
   * initialization.
   */
  releaseOnDeref?: object;
}
