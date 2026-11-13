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

import {LogLevel} from "../../logger/LogLevel.js";
import { Component, ComponentContainer } from "./component.js";

/** Backend families accepted by public initialization APIs. */
export type BackendType = 'COLLECTION' | 'RELATIONAL';
type ResolvedBackendType = 'collection' | 'relational';

/** Backend family declared by console-generated initialization configuration. */
export type ConfigBackendType = 'COLLECTION' | 'RELATIONAL';

interface AppConfig {
  backendType?: ResolvedBackendType;
  objsType?: string;
  storageBucket?: string;
  authType?: string;
  authID?: string;
  idcsDomainURL?: string;
}


/**
 * An {@link App} holds the initialization information for a collection of
 * services.
 *
 * Do not call this constructor directly. Instead, use
 * {@link initializeApp} to create an app.
 *
 * @public
 * @example
 * ```ts
 * const app = initializeApp({ project_id: "project-id" });
 * ```
 */
export class App {

  /**
   * The (read-only) configuration options for this app. These are the original
   * parameters given in {@link initializeApp}.
   *
   * @example
   * ```javascript
   * const app = initializeApp(config);
   * // Input config uses snake_case; the exposed options use camelCase.
   * console.log(app.options.ordsHost === config.ords_host); // true
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

  private logLevelValue: LogLevel = LogLevel.SILENT;
  private configValue: AppConfig | null = null;
  private readonly componentContainer: ComponentContainer;

  get config(): AppConfig | null {
    return this.configValue;
  }

  /**
   * Creates an application instance.
   *
   * @param options - Immutable application configuration.
   * @param name - Unique application name.
   * @returns The application instance.
   * @example
   * ```ts
   * const app = initializeApp({ project_id: "project-id" }, "secondary");
   * ```
   */
  constructor(options: FusabaseOptions, name: string) {
    this.options = options;
    this.name = name;
    this.automaticDataCollectionEnabled = false;
    this.componentContainer = new ComponentContainer(name);
    this.componentContainer.addComponent(
      new Component('app', () => this, 'PUBLIC')
    );
  }

  get container(): ComponentContainer {
    return this.componentContainer;
  }

  get isDeleted(): boolean {
    return this.componentContainer.isDeleted;
  }

  /**
   * Gets the authentication service for this application.
   *
   * @returns The authentication service instance.
   * @example
   * ```ts
   * const auth = app.auth();
   * ```
   */
  auth(): any {
    return this.componentContainer.getProvider('auth').getImmediate();
  }

  /**
   * Gets the document-data service for this application.
   *
   * @returns The document-data service instance.
   * @example
   * ```ts
   * const database = app.oracledb();
   * ```
   */
  oracledb(): any {
    return this.componentContainer.getProvider('oracledb').getImmediate();
  }

  /**
   * Gets a relational-data service instance.
   *
   * @param databaseId - Optional service-instance identifier.
   * @returns The relational-data service instance.
   * @example
   * ```ts
   * const database = app.relational();
   * ```
   */
  relational(databaseId?: string): any {
    return this.componentContainer.getProvider('relational').getImmediate({
      identifier: databaseId
    });
  }

  /**
   * Gets a file-storage service instance.
   *
   * @param url - Optional storage endpoint identifier.
   * @returns The file-storage service instance.
   * @example
   * ```ts
   * const storage = app.storage();
   * ```
   */
  storage(url: string = ""): any {
    return this.componentContainer.getProvider('storage').getImmediate({
      identifier: url
    });
  }

  /**
   * Deletes this application and its registered services.
   *
   * @returns A promise that resolves when deletion completes.
   * @example
   * ```ts
   * await app.delete();
   * ```
   */
  async delete(): Promise<void> {
    await this.componentContainer.delete();
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
      backendType: this.options.backendType,
      objsType: this.options.objsType,
      storageBucket: this.options.storageBucket,
      authType: this.options.authType,
      authID: this.options.authID,
      idcsDomainURL: this.options.idcsDomainURL
    };

    this.configValue = config;
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
//    * console.log(app.options.ordsHost === config.ords_host);  // true
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
 * Normalized options retained by an initialized app. All property names use
 * camelCase after the console's snake_case configuration is normalized.
 */
export interface FusabaseOptions {
  /** Normalized backend selected by `initializeApp()`. */
  backendType: ResolvedBackendType;

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

/** Describes the public `appName` value. */
  appName?: string;

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

  /** Optional IDCS identity domain URL. */
  idcsDomainURL?: string;

  /** Whether realtime listeners use sockets. Defaults to `true`. */
  useSocket?: boolean;

/** Describes the public `longPollingInterval` value. */
  longPollingInterval?: number;

/** Describes the public `version` value. */
  version?: number;

/** Describes the public `chunkSize` value. */
  chunkSize?: number;

  /**
   * Maximum number of bytes accepted by Storage upload helpers.
   */
  maxUploadBytes?: number;

  /** @internal */
  appTrustToken?: string;
}

/**
 * Input accepted by {@link initializeApp}. This is the console configuration
 * shape, so fields use snake_case. Initialized `app.options` is represented by
 * {@link FusabaseOptions} and always uses camelCase.
 */
export interface FusabaseConfig {
/** Database schema used by database requests. Required. */
  schema?: string;
/** Base service URL, including the ORDS path and trailing slash. Required. */
  ords_host?: string;
/** Application display/name value registered with the service. Optional. */
  app_name?: string;
/** Application platform/type identifier, for example `WEB`. Required. */
  app_type?: string;
/** Application identifier issued during registration. Required. */
  app_id?: string;
/** Project identifier that scopes service requests. Required. */
  project_id?: string;
/** Object/file storage implementation identifier. Required. */
  objs_type?: string;
/** Default file-storage bucket name. Required. */
  storage_bucket?: string;
/** Authentication provider/type identifier. Required. */
  auth_type?: string;
/** Authentication application or tenant identifier. Required. */
  auth_id?: string;
  /** Backend family for this configuration. `COLLECTION` and `RELATIONAL` are supported. */
  backend_type?: ConfigBackendType;
  /** Whether realtime listeners use sockets. Defaults to `true`. */
  use_socket?: boolean;
/** Long-poll interval in seconds when sockets are disabled. Defaults to `29`. */
  long_polling_interval?: number;
/** Resumable-upload chunk size in bytes. Defaults to `16 MiB`. */
  upload_chunk_size?: number;
/** Maximum allowed upload size in bytes. Optional. */
  max_upload_bytes?: number;
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
   * An optional App Trust token. If provided, the Fusabase SDKs that use App Trust will utilize
   * this App Trust token in place of requiring an instance of App Trust to be initialized.
   *
   * If the token fails local verification due to expiration or parsing errors, then a console error
   * is logged at the time of initialization of the `FusabaseServerApp` instance.
   */
  appTrustToken?: string;

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
