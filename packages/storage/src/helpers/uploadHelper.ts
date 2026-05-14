import { LogLevel } from "../../../logger/LogLevel.js";
import { getStorageErrorMessage } from "../errors.js";
import { UploadTaskSnapshot } from "../internal/uploadTask.js";
import { Utils } from "../internal/utils.js";
import { StorageError, StorageErrorCode, storageErrorHandler } from "../errors.js";
import { fetchWithRetry } from "../internal/utils.js";
import { TaskState } from "../types.js";
import { put_REST_EP, getpreauth_REST_EP } from "../internal/endpoints/endpoints.js";
import { DEFAULT_MAX_UPLOAD_BYTES } from "../internal/const.js";

type UploadSource = Blob | ArrayBuffer | Uint8Array;

function isBlob(data: unknown): data is Blob {
  return typeof Blob !== "undefined" && data instanceof Blob;
}

function isArrayBuffer(data: unknown): data is ArrayBuffer {
  return data instanceof ArrayBuffer;
}

function isUint8Array(data: unknown): data is Uint8Array {
  return data instanceof Uint8Array;
}

function resolveByteLimit(value: unknown, fallback: number): number {
  return Number.isSafeInteger(value) && (value as number) > 0 ? value as number : fallback;
}

/**
 * Internal controller class for UploadTask.
 */
/**
 * @internal
 */
export class UploadTaskController {
  private storageHelper: any = null;
  private abortController: AbortController = new AbortController();
  private eventListener: EventTarget = new EventTarget();
  private signal: AbortSignal = this.abortController.signal;

  private dataToSend: UploadSource | null = null;
  /**
   * @internal
   */
  uploadMetadata: any = null;
  /**
   * @internal
   */
  logLevel: LogLevel = LogLevel.SILENT;
  /**
   * @internal
   */
  isMultipart: { totalSize: number; totalChunks: number; toSend: number; baseURL: string } | null = null;

  constructor(metadata: any, storageHelper: any) {
    this.storageHelper = storageHelper;
    this.uploadMetadata = metadata;
    this.logLevel = storageHelper.logLevel;
  }

  private uploadSize(data: unknown): number {
    if (isBlob(data)) return data.size;
    if (isArrayBuffer(data) || isUint8Array(data)) return data.byteLength;

    const error = new StorageError(StorageErrorCode.INVALID_ARGUMENT, getStorageErrorMessage('INVALID_UPLOAD_FORMAT'));
    error.status = 400;
    throw storageErrorHandler(error);
  }

  private maxUploadBytes(): number {
    return resolveByteLimit(this.storageHelper?.config?.maxUploadBytes, DEFAULT_MAX_UPLOAD_BYTES);
  }

  private assertUploadWithinLimit(size: number): void {
    if (size <= 0) {
      const error = new StorageError(
        StorageErrorCode.INVALID_ARGUMENT,
        getStorageErrorMessage('EMPTY_UPLOAD')
      );
      error.status = 400;
      throw storageErrorHandler(error);
    }

    const maxBytes = this.maxUploadBytes();
    if (size > maxBytes) {
      const error = new StorageError(
        StorageErrorCode.INVALID_ARGUMENT,
        getStorageErrorMessage('UPLOAD_EXCEEDS_LIMIT', String(maxBytes))
      );
      error.status = 400;
      throw storageErrorHandler(error);
    }
  }

  private uploadBody(): any {
    if (!this.dataToSend) {
      const error = new StorageError(StorageErrorCode.INVALID_ARGUMENT, getStorageErrorMessage('VALUE_CANNOT_BE_NULL'));
      error.status = 400;
      throw storageErrorHandler(error);
    }
    return this.dataToSend;
  }

  private uploadChunk(start: number, end?: number): any {
    if (!this.dataToSend) {
      const error = new StorageError(StorageErrorCode.INVALID_ARGUMENT, getStorageErrorMessage('VALUE_CANNOT_BE_NULL'));
      error.status = 400;
      throw storageErrorHandler(error);
    }

    if (isBlob(this.dataToSend)) {
      return this.dataToSend.slice(start, end);
    }

    if (isUint8Array(this.dataToSend)) {
      return this.dataToSend.subarray(start, end);
    }

    const length = (end ?? this.dataToSend.byteLength) - start;
    return new Uint8Array(this.dataToSend, start, length);
  }

  /**
   * @async
   * @property {Function} initUpload
   * Set necessary config for the upload process.
   * @param {UploadTaskSnapshot} snapshot
   * @param {Blob | any} data
   * @returns {Promise<void>}
   */
  /**
   * @internal
   */
  async initUpload(snapshot: UploadTaskSnapshot, data: Blob | any): Promise<void> {
    try {
      const size = this.uploadSize(data);
      this.assertUploadWithinLimit(size);
      this.dataToSend = data;
      snapshot.totalBytes = size;
      if (snapshot && snapshot.metadata && snapshot.metadata.size) {
        console.assert(snapshot.metadata.size === snapshot.totalBytes,
          "Size given in metadata is different than the one calculated.");
      } else {
        snapshot.metadata.size = snapshot.totalBytes;
      }
      if (size > 2 * this.storageHelper.config.chunkSize) {
        this.isMultipart = {
          totalSize: snapshot.totalBytes,
          totalChunks: Math.floor((size + this.storageHelper.config.chunkSize - 1) / this.storageHelper.config.chunkSize),
          toSend: 0,
          baseURL: ""
        };
      }
    } catch (err) {
      Utils.baasTrace(this.logLevel);
      throw storageErrorHandler(err);
    }
  }

  /**
   * @async
   * @property {Function} abortUpload
   * Abort the upload process.
   * @returns {Promise<void>}
   */
  /**
   * @internal
   */
  async abortUpload(): Promise<void> {
    this.abortController.abort();
    let response: Response | null = null;
    // delete uncommitted uploads
    if (this.isMultipart) {
      let reqURL = this.isMultipart.baseURL;
      if (reqURL === "") {
        return;
      }
      let params = { method: "DELETE" };

      try {
        response = await fetchWithRetry(reqURL, params, this.storageHelper.maxUploadRetryTime, this.storageHelper?.app);
        Utils.checkResponse(response);
      } catch (err) {
        Utils.baasTrace(this.logLevel, params, reqURL, response);
        throw storageErrorHandler(err);
      }
    }
  }

  /**
   * @internal
   */
  get eventTarget(): EventTarget {
    return this.eventListener;
  }

  /**
   * @property {Function} setCallBacks
   * Set callbacks for the task.
   * @returns {void}
   */
  /**
   * @internal
   */
  setCallBacks(event: string, callbacks: any, abortController: AbortController):  () => void {
    this.eventTarget.addEventListener(event, (e: any) => {
      let snapshot = e.detail.snapshot;
      if (callbacks.next) {
        callbacks.next(snapshot);
      }

      if (callbacks.error &&
        (snapshot.state === TaskState.ERROR
          || snapshot.state === TaskState.CANCELED)) {
        callbacks.error(e.detail.error);
      }

      if (snapshot.state === TaskState.SUCCESS) {
        if (callbacks.complete) {
          callbacks.complete();
        }
        abortController.abort();
      }

      if (snapshot.state === TaskState.CANCELED) {
        abortController.abort();
      }

    }, { signal: abortController.signal });
    return () => abortController.abort();
  }

  /**
   * @property {Function} fireEvent
   * Dispatches an event.
   * @returns {void}
   */
  /**
   * @internal
   */
  fireEvent(event: Event): void { this.eventTarget.dispatchEvent(event); }

  // Use PUT_OBJECT method to upload data
  /*
   * REQUEST:
   * --------
   * METHOD: POST
   * HEADERS: {
   *              "bucket": <>,
   *              "path": <>
   *          }
   * BODY:  <raw Filedata>
   *
   * RESPONSE:
   * ---------
   * status: <HTTP status code>
   * METADATA: {
   *              MD5: <md5 hash>,
   *              NAME: <>,
   *              SIZE: <>
   *           }
   */

  /**
   * Internal method to upload data as a whole.
   */
  /**
   * @internal
   */
  async #putData(ref: any, access_token?: string | null): Promise<any> {
    let response: Response | null = null;
    let result: any = null;
    const reqURL = `${this.storageHelper.URL}${put_REST_EP}` +
      `?apiKey=${this.storageHelper.config.appID}`;
    let payload = {
      "x-object-path": `${JSON.stringify({
        bucket: ref.bucket,
        path: ref.fullPath
      })}`,
      "Content-Type": this.uploadMetadata["contentType"]
    };

    const params: any = {
      method: "POST",
      signal: this.signal,
      headers: { ...payload },
      body: this.uploadBody(),
    };

    if (access_token) {
      params.headers["Authorization"] = `Bearer ${access_token}`;
    }

    try {
      response = await fetchWithRetry(reqURL, params,
        this.storageHelper.maxUploadRetryTime, this.storageHelper?.app);
      Utils.checkResponse(response);
      
      result = await response.json();
    } catch (err:any) {
      Utils.baasTrace(this.logLevel, params, reqURL, response, result);

      let error = new StorageError(StorageErrorCode.INTERNAL_ERROR, err.message);
      if (err.status) {
          error.status = err.status;
      }

      try {
        let errjson = await response?.json();
        error.server = true;
        error.message = (this.storageHelper.isPrem) ? errjson.error :
          errjson.message;
      }
      catch (jsonErr) {
        /* response is not JSON text */
        error.server = false;
        error.message = 'Unknown';
      }

      throw storageErrorHandler(error);
    }

    return result;
  }

  /**
   * Internal method to upload chunk as a whole.
   */
  /**
   * @internal
   */
  async #indexedUpload(toSend: any, chunk: any): Promise<void> {
    let response: Response | null = null;
    const reqURL = `${this.isMultipart?.baseURL}${toSend}`;
    const params = {
      method: "PUT",
      body: chunk
    };

    try {
      response = await fetchWithRetry(reqURL, params,
        this.storageHelper.maxUploadRetryTime, this.storageHelper?.app);
      Utils.checkResponse(response);
    } catch (err:any) {
      // decrease the toSend index in case of Error
      if (this.isMultipart) {
        this.isMultipart.toSend--;
      }
      Utils.baasTrace(this.logLevel, params, reqURL, response);

      let error = new StorageError(StorageErrorCode.INTERNAL_ERROR, err.message);
      if (err.status) {
        error.status = err.status;
      }

      try {
        let errjson = await response?.json();
        error.server = true;
        error.message = (this.storageHelper.isPrem) ? errjson.error :
          errjson.message;
      }
      catch (jsonErr) {
        /* response is not JSON text */
        error.server = false;
        error.message = 'Unknown';
      }

      throw storageErrorHandler(error);
    }
  }

  /**
   * @async
   * @property {Function} continueUpload
   * Continue the upload process.
   * @param {UploadTaskSnapshot} snapshot
   * @returns {Promise<Object>}
   */
  /**
   * @internal
   */
  async continueUpload(snapshot: UploadTaskSnapshot, access_token?: string|null): Promise<any> {
    if (!snapshot.ref) {
      throw new StorageError(StorageErrorCode.INVALID_ARGUMENT, getStorageErrorMessage('VALUE_CANNOT_BE_NULL'));
    }
    const ref = snapshot.ref;
    let result: any = null;
    if (!this.isMultipart) {
      // put_object directly
      try {
        result = await this.#putData(ref, access_token);
        let timeC = result.metadata.timeCreated;
        if (!timeC) {
          timeC = result.metadata.updated;
        }
        return {
          state: TaskState.SUCCESS,
          bytesTransferred: snapshot.totalBytes,
          md5sum: result.metadata.md5sum,
          size: result.metadata.size,
          contentType: result.metadata.contentType,
          updated: result.metadata.updated,
          timeCreated: timeC
        };
      }
      catch (err: any) {
        if (err.status === 408) {
          Utils.baasLogger(this.logLevel, "PUT_OBJECT: Network Slow! Trying Multipart!!");
          // If Timeout occured, fallback to multipart upload
          this.isMultipart = {
            totalSize: snapshot.totalBytes,
            totalChunks: Math.floor((snapshot.totalBytes +
              this.storageHelper.config.chunkSize - 1) /
              this.storageHelper.config.chunkSize),
            toSend: 0,
            baseURL: ""
          };
        }
        else
          throw storageErrorHandler(err);
      }
    }

    /*
     * For Multipart Uploads, upload chunks through #indexedUpload(idx)
     * Once the final chunk is successfully sent,
     * send the Commit Request to the Storage server.
     * Also, set the Snapshot state to SUCCESS.
     */

    if (!this.isMultipart) {
      let error = new StorageError(StorageErrorCode.UNKNOWN, getStorageErrorMessage('UNKNOWN'));
      error.status = 500;
      throw storageErrorHandler(error);
    }

    let response: Response | null = null;
    let reqURL: string | null = null;
let params: { method: string; headers?: any; signal?: AbortSignal; body?: string } = {
      method: "POST"
    };
    if (this.isMultipart.toSend === 0) {
      // Step 1: Create ObjectWrite PAR
      reqURL = `${this.storageHelper.URL}${getpreauth_REST_EP}` +
        `?apiKey=${this.storageHelper.config.appID}`;
      params = {
        method: "POST",
        headers: {},
        signal: this.signal,
        body: JSON.stringify({
          bucket: ref.bucket,
          path: `${ref.fullPath}`, //fullPath
          access_type: "ObjectWrite", //for multipartUpload
          metadata: {
            contentType: this.uploadMetadata["contentType"]
          }
        }),
      };
      if (access_token) {
        params = { ...params, headers: { ...params.headers, Authorization: `Bearer ${access_token}` } };
      }

      let objectStoreURL = "";

      try {
        response = await fetchWithRetry(reqURL, params, this.storageHelper.maxUploadRetryTime, this.storageHelper?.app);
        Utils.checkResponse(response);
        result = await response.json();
        objectStoreURL = (this.storageHelper.isPrem) ?
          this.storageHelper.PARequestURL : "";
      } catch (err) {
        Utils.baasTrace(this.logLevel, params, reqURL, response, result);

      try {
          if (response && 'json' in response) {
            let errjson = await (response as any).json();
            if (errjson) {
              (err as any).message = (this.storageHelper.isPrem) ? errjson.error :
                errjson.message;
            }
          }
        }
        catch (jsonErr) {
          /* response is not JSON text */
          (err as any).message = `PAR URL creation failed!`;
        }
        throw storageErrorHandler(err as any);
      }

      if (result && result.accessUri) {
        this.isMultipart.baseURL = objectStoreURL + result.accessUri;
      } else {
        throw new StorageError(StorageErrorCode.UNKNOWN, getStorageErrorMessage('UNKNOWN'));
      }
    }

    this.isMultipart.toSend++;
    Utils.baasLogger(this.logLevel, this.isMultipart.toSend);

    // call #indexedUpload to upload chunk
    let chunkIdx = this.isMultipart.toSend;
    // get chunk to upload
    const offBegin = (chunkIdx - 1) * this.storageHelper.config.chunkSize;
    const offEnd = (chunkIdx !== this.isMultipart.totalChunks) ?
      offBegin + this.storageHelper.config.chunkSize : undefined;
    const chunkToSend = this.uploadChunk(offBegin, offEnd);

    await this.#indexedUpload(chunkIdx, chunkToSend);

    if (chunkIdx === this.isMultipart.totalChunks) {
      // send the commit request
      reqURL = this.isMultipart.baseURL;
      params = {
        method: "POST",
        signal: this.signal
      };

      let respHeaders: any = null;
      let multipartMd5: string | null = null;
      let lastMod: string | null = null;
      let timeCreated: string | null = null;

      try {
      response = await fetchWithRetry(reqURL, params,
        this.storageHelper.maxUploadRetryTime, this.storageHelper?.app);
        Utils.baasLogger(this.logLevel, "commit request");
        if (response) {
          Utils.checkResponse(response);

if (response.headers && 'entries' in response.headers) {
            for (const [key, value] of (response.headers as any).entries()) {
              if (key == "opc-multipart-md5") {
                multipartMd5 = value;
              }
              if (key == "last-modified") {
                lastMod = value;
              }
              if (key == "time-created") {
                timeCreated = value;
              }
            }
            if (!timeCreated) {
              timeCreated = lastMod;
            }
          }
        }
      } catch (err: any) {
        Utils.baasTrace(this.logLevel, params, reqURL, response);

        try {
          if (response && 'json' in response) {
            let errjson = await (response as any).json();
            if (errjson) {
              err.message = (this.storageHelper.isPrem) ? errjson.error :
                errjson.message;
            }
          }
        }
        catch (jsonErr) {
          /* response is not JSON text */
          err.message = `Commit failed!`;
        }
        throw storageErrorHandler(err);
      }

      return {
        state: TaskState.SUCCESS,
        bytesTransferred: snapshot.totalBytes,
        md5sum: multipartMd5,
        updated: lastMod,
        timeCreated: timeCreated,
        contentType: snapshot.metadata.contentType,
        size: snapshot.totalBytes
      };
    }

    return {
      state: snapshot.state,
      bytesTransferred: Math.min(chunkIdx * this.storageHelper.config.chunkSize, snapshot.totalBytes)
    };
  }
}
