
import { App } from "../../../app/src/public-types.js";
import { LogLevel } from "../../../logger/LogLevel.js";

import { argCheck, typeStrings, StorageError, StorageErrorCode, getStorageErrorMessage } from "../errors.js";
import { StorageHelper } from "../helpers/storageHelper.js";
import { TaskEvent, TaskState } from "../types.js";
import { StorageReference } from "./reference.js";

/**
 * Class representing the Storage service.
 */
export class Storage {
  private _app: App;
  /** The maximum number of retry attempts for operations. */
  maxOperationRetryTime: number;
  /** The maximum number of retry attempts for uploads. */
  maxUploadRetryTime: number;
  private storageHelper: StorageHelper;
  /** Static reference to TaskState enum. */
  static TaskState = TaskState;
  /** Static reference to TaskEvent enum. */
  static TaskEvent = TaskEvent;

  /** @internal */
  /**
   * Constructs the storage instance.
   * @param {App} app fusabase App
   */
  constructor(app: App) {
    argCheck(app, 'Invalid app object', true, [typeStrings.OBJECT]);


    if (app.config) {
      const config = {
        host: app.options.ordsHost,
        schema: app.options.schema,
        projectID: app.options.projectID,
        chunkSize: app.options.chunkSize,
        maxUploadBytes: app.options.maxUploadBytes,
        appID: app.options.appID,
        module: (app.config.objsType === 'dbfs' ? 'dbfs' : 'oci-objs')
      };

      const bucket = app.config.storageBucket;
      this.maxOperationRetryTime = 10000;
      this.maxUploadRetryTime = 10000;
      this.storageHelper = new StorageHelper(
        config,
        bucket,
        app,
        app.logLevel,
        this.maxOperationRetryTime,
        this.maxUploadRetryTime
      );
      this._app = app;
    } else {
      throw new StorageError(StorageErrorCode.INVALID_ARGUMENT, getStorageErrorMessage('VALUE_CANNOT_BE_NULL'));
    }
  }

  /**
   * @property 
   * @returns {App} fusabase App
   */
  get app(): App {
    return this._app;
  }

  /**
   * @property 
   */
  /**
   * @internal
   */
  get logLevel(): LogLevel {
    return this._app.logLevel;
  }

  /**
   * @property
   * @returns {string} Storage Bucket
   */
  /**
   * @internal
   */
  get bucket(): string {
    return this.storageHelper.bucket;
  }

  /**
   * @property
   * @returns {any} Storage Config
   */
  /**
   * @internal
   */
  get config(): any {
    return this.storageHelper.config;
  }

  /**
   * Sets the maximum retry time for operations.
   * @param t - The retry time in milliseconds.
   */
  setMaxOperationRetryTime(t: number): void {
    argCheck(t, "Time should be a valid number", true, [typeStrings.INT]);
    this.maxOperationRetryTime = t;
    this.storageHelper.maxOperationRetryTime = t;
  }

  /**
   * Sets the maximum retry time for uploads.
   * @param t - The retry time in milliseconds.
   */
  setMaxUploadRetryTime(t: number): void {
    argCheck(t, "Time should be a valid number", true, [typeStrings.INT]);
    this.maxUploadRetryTime = t;
    this.storageHelper.maxUploadRetryTime = t;
  }

  /**
   * Internal method to initialize upload controller.
   */
  /**
   * @internal
   */
  __initUploadController(metadata: any): any {
    return this.storageHelper.initUploadController(metadata);
  }

  /**
   * Internal method to list the files.
   */
  /**
   * @internal
   */
  __getLists(recurse: boolean, path: string = "", listOptions: any, access_token: string | null): any {
    return this.storageHelper.getLists(recurse, path, listOptions, access_token);
  }

  /**
   * Internal method to fetch download url.
   */
  /**
   * @internal
   */
  __fetchDownloadUrl(path: string, access_token: string | null): any {
    return this.storageHelper.fetchDownloadUrl(path, access_token);
  }

  /**
   * Internal method to fetch metadata.
   */
  /**
   * @internal
   */
  __fetchMetadata(ref: StorageReference, access_token: string | null): any {
    return this.storageHelper.fetchMetadata(ref, access_token);
  }

  /**
   * @internal
   */
  __downloadData(path:string, maxSize: number | null, access_token: string | null): any {
    return this.storageHelper.downloadData(path, maxSize, access_token);
  }

  /**
   * @internal
   */
  __deleteObject(path: string, access_token: string | null): any {
    return this.storageHelper.deleteObject(path, access_token);
  }

  /**
   * @function
   * @returns {StorageReference} Returns reference for a path.
   */
  /**
   * @internal
   */
  ref(path: string = ""): StorageReference {
    argCheck(path, "Invalid reference path", false, [typeStrings.STRING]);
    return new StorageReference(this, path);
  }

  private invalidReferenceUrl(): never {
    const error = new StorageError(StorageErrorCode.INVALID_ARGUMENT, getStorageErrorMessage('INVALID_REFERENCE_URL'));
    error.status = 400;
    throw error;
  }

  private decodeReferenceUrlSegment(segment: string): string {
    try {
      return decodeURIComponent(segment);
    } catch {
      this.invalidReferenceUrl();
    }
  }

  private decodeReferenceUrlPath(pathSegments: string[], objectMarkerIndex: number): string {
    if (objectMarkerIndex === -1 || objectMarkerIndex + 1 >= pathSegments.length) {
      this.invalidReferenceUrl();
    }

    const decodedPath = pathSegments
      .slice(objectMarkerIndex + 1)
      .map((segment) => this.decodeReferenceUrlSegment(segment))
      .join('/');

    if (!decodedPath || decodedPath.startsWith('/') || decodedPath.endsWith('/')) {
      this.invalidReferenceUrl();
    }

    return decodedPath;
  }

  private configuredHostURL(): URL {
    try {
      return new URL(String(this.config.host ?? ''));
    } catch {
      this.invalidReferenceUrl();
    }
  }

  private pathSegmentsAfterConfiguredHost(parsed: URL): string[] | null {
    const configuredHost = this.configuredHostURL();
    const configuredPath = configuredHost.pathname.endsWith('/') ?
      configuredHost.pathname : `${configuredHost.pathname}/`;

    if (parsed.origin !== configuredHost.origin || !parsed.pathname.startsWith(configuredPath)) {
      return null;
    }

    return parsed.pathname
      .slice(configuredPath.length)
      .split('/')
      .filter((segment) => segment.length > 0);
  }

  private pathFromDbfsReferenceUrl(parsed: URL): string | null {
    if (this.config.module !== 'dbfs') {
      return null;
    }

    const pathSegments = this.pathSegmentsAfterConfiguredHost(parsed);
    if (!pathSegments) {
      return null;
    }

    if (
      pathSegments.length < 12 ||
      pathSegments[0] !== '_' ||
      pathSegments[1] !== 'baas-services' ||
      pathSegments[2] !== 'dbfs' ||
      pathSegments[3] !== 'par' ||
      this.decodeReferenceUrlSegment(pathSegments[4]) !== String(this.config.projectID ?? '') ||
      pathSegments[5] !== 'accessuri' ||
      !pathSegments[6] ||
      pathSegments[7] !== 'r' ||
      pathSegments[8] !== 'b' ||
      this.decodeReferenceUrlSegment(pathSegments[9]) !== this.bucket ||
      pathSegments[10] !== 'o'
    ) {
      return null;
    }

    return this.decodeReferenceUrlPath(pathSegments, 10);
  }

  private isOciObjectStorageHost(hostname: string): boolean {
    const normalizedHostname = hostname.toLowerCase();
    return (
      normalizedHostname.startsWith('objectstorage.') &&
      normalizedHostname.endsWith('.oraclecloud.com')
    ) || (
      normalizedHostname.includes('.objectstorage.') &&
      normalizedHostname.endsWith('.oci.customer-oci.com')
    );
  }

  private pathFromOciReferenceUrl(parsed: URL): string | null {
    if (this.config.module === 'dbfs' || parsed.protocol !== 'https:' ||
      !this.isOciObjectStorageHost(parsed.hostname)) {
      return null;
    }

    const pathSegments = parsed.pathname.split('/').filter((segment) => segment.length > 0);
    const bucketMarkerIndex = pathSegments.findIndex((segment) => segment === 'b');
    const objectMarkerIndex = pathSegments.findIndex(
      (segment, index) => index > bucketMarkerIndex && segment === 'o'
    );

    if (
      bucketMarkerIndex === -1 ||
      objectMarkerIndex === -1 ||
      bucketMarkerIndex + 1 >= objectMarkerIndex ||
      this.decodeReferenceUrlSegment(pathSegments[bucketMarkerIndex + 1]) !== this.bucket
    ) {
      return null;
    }

    return this.decodeReferenceUrlPath(pathSegments, objectMarkerIndex);
  }

  private pathFromReferenceUrl(parsed: URL): string {
    const decodedPath =
      this.pathFromDbfsReferenceUrl(parsed) ??
      this.pathFromOciReferenceUrl(parsed);

    if (!decodedPath) {
      this.invalidReferenceUrl();
    }

    return decodedPath;
  }

  /**
   * @function
   * @returns {StorageReference} Returns reference for a url.
   */
  /**
   * @internal
   */
  refFromURL(url: string): StorageReference {
    argCheck(url, "Invalid reference url", true, [typeStrings.STRING]);

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      this.invalidReferenceUrl();
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      this.invalidReferenceUrl();
    }

    const decodedPath = this.pathFromReferenceUrl(parsed);

    return new StorageReference(this, decodedPath);
  }
}
