import type { App } from '../../../app/src/public-types.js';
import { MAX_OPERATION_RETRY_TIME, MAX_UPLOAD_RETRY_TIME } from '../internal/const.js';
import { list_REST_EP, DOWNLOAD_REST_EP, getpreauth_REST_EP, deleteObj_REST_EP, getMetadata_REST_EP } from '../internal/endpoints/endpoints.js';
import { Utils } from '../internal/utils.js';
import { UploadTaskController } from './uploadHelper.js';
import { LogLevel } from '../../../logger/LogLevel.js';
import { fetchWithRetry } from '../internal/utils.js';
import { StorageError, StorageErrorCode, storageErrorHandler, getStorageErrorMessage } from '../errors.js';
import { StorageReference } from '../internal/reference.js';

/**
 * Internal Helper class for Storage.
 */
export class StorageHelper {
  /**
   * @internal
   */
  loglevel: LogLevel;
  /**
   * @internal
   */
  private _app: App;
  /**
   * @internal
   */
  config: any;
  /**
   * @internal
   */
  bucket: any;
  maxOperationRetryTime: number;
  maxUploadRetryTime: number;

  constructor(config: any, bucket: any, app: App, logLevel: LogLevel, maxOperationRetryTime: number = MAX_OPERATION_RETRY_TIME, maxUploadRetryTime: number = MAX_UPLOAD_RETRY_TIME) {
    this.config = config;
    this.bucket = bucket;
    this._app = app;
    this.loglevel = logLevel;
    this.maxOperationRetryTime = maxOperationRetryTime;
    this.maxUploadRetryTime = maxUploadRetryTime;
  }

  /**
   * @internal
   */
  get isPrem(): boolean {
    return (this.config.module === 'dbfs');
  }

  /**
   * @internal
   */
  get logLevel(): LogLevel {
    return this.loglevel;
  }

  /**
   * @internal
   */
  get app(): App {
    return this._app;
  }

  /**
   * @internal
   */
  get URL(): string {
    return `${this.config.host}_/baas-services/${this.config.module}/${this.config.projectID}/`;
  }

  /**
   * @internal
   */
  get PARequestURL(): string {
    return `${this.config.host}_/baas-services/${this.config.module}/par/${this.config.projectID}/`;
  }

  /**
   * @async
   * @property {Function} getLists
   * @param {bool} recurse
   * @param {String} path
   * @returns {Promise<Object>} 
   */
  /**
   * @internal
   */
async getLists(recurse: boolean, path: string = "", listOptions: any, access_token: string | null) {
    let response = null;
    let result = null;
    const reqURL = `${this.URL}${list_REST_EP}/b/${this.bucket}` +
      `?apiKey=${this.config.appID}`;

    const custom_header: { [key: string]: any } = {
      path: path,
      recurse: recurse
    };

    if (listOptions != null && listOptions.pageToken != null) {
      custom_header["pageToken"] = listOptions.pageToken;
    }
    if (listOptions != null && listOptions.maxResults != null) {
      custom_header["maxResults"] = listOptions.maxResults;
    }

    const headers: Record<string, string> = {
        "x-dbfs-list-opts": JSON.stringify(custom_header),
    };

    const params = {
      method: "GET",
      headers: headers
    };
    if (access_token) {
      params.headers["Authorization"] = `Bearer ${access_token}`;
    }

    try {
      response = await fetchWithRetry(reqURL, params, this.maxOperationRetryTime, this.app);
      Utils.checkResponse(response);
      result = await response.json();
    } catch (err:any) {
      let error = new StorageError(StorageErrorCode.INTERNAL_ERROR, err.message);
      if (err.status) {
        error.status = err.status;
      }
      Utils.baasTrace(this.loglevel, params, reqURL, response, result);


if (response) {
  try {
    let errjson = await response.json();
    error.server = true;
    error.message = (this.isPrem) ? errjson.error : errjson.message;
  }
  catch (jsonErr) {
    /* response is not JSON text */
    error.server = false;
    error.message = getStorageErrorMessage('UNKNOWN');
  }
} else {
  error.server = false;
  error.message = getStorageErrorMessage('UNKNOWN');
}

      throw storageErrorHandler(error);
    }

    let final_res = result;

    // Check if onPrem DBFS is being used, if yes
    // the returned response is with '/' prefix
    if (this.isPrem) {
      final_res = {
        items: [],
        prefixes: [],
        nextPageToken: null
      }
      const processPath = (toarray:any, pathjson:any) => {
        let path;
        if (toarray === "items") {
          path = pathjson['name'].slice(1);
        } else {
          path = pathjson['name'].slice(1);
        }
        final_res[toarray].push(path);
      }
      result.items.forEach((pathjson:any) => processPath('items', pathjson))
      result.prefixes.forEach((pathjson:any) => processPath('prefixes', pathjson))
      if (result.nextPageToken != null && result.nextPageToken != "" && result.nextPageToken != -1) {
        final_res.nextPageToken = result.nextPageToken;
      }
    } else {
      final_res = {
        items: [],
        prefixes: [],
        nextPageToken: null
      }
      const processPath = (toarray:any, pathjson:any) => {
        let path;
        if (toarray === "items") {
          path = pathjson['name'];
        } else {
          path = pathjson.slice(0, pathjson.length-1);
        }
        final_res[toarray].push(path);
      }
      
      result.items.forEach((pathjson:any) => processPath('items', pathjson))
      result.prefixes.forEach((pathjson:any) => processPath('prefixes', pathjson))
      if (result.nextPageToken != null && result.nextPageToken != "" && result.nextPageToken != -1) {
        final_res.nextPageToken = result.nextPageToken;
      }
    }
    return final_res;
  }

  /**
   * @internal
   */
  async downloadData(path: string, maxSize: number | null, access_token: string | null) {
    let response = null;
    const reqURL = `${this.URL}${DOWNLOAD_REST_EP}` +
      `?apiKey=${this.config.appID}`;

    const headers: Record<string, string> = {
      "x-object-path": JSON.stringify({
          "path":path,
          "bucket":this.bucket
        })
    };

    const params = {
      method: "GET",
      headers: headers
    };

    if (access_token) {
      params.headers["Authorization"] = `Bearer ${access_token}`;
    }

    if (maxSize != null) {
      params.headers["Range"] = `bytes=0-${Math.max(0, maxSize - 1)}`;
    }

    try {
      response = await fetchWithRetry(reqURL, params, this.maxOperationRetryTime, this.app);
      Utils.checkResponse(response);
    } catch (err:any) {
      Utils.baasTrace(this.loglevel, params, reqURL, response);

      let error = new StorageError(StorageErrorCode.INTERNAL_ERROR, err.message);
      if (err.status) {
        error.status = err.status;
      }

      try {
        if (response) {
          let errjson = await response.json();
          error.server = true;
          error.message = (this.isPrem) ? errjson.error : errjson.message;
        }
      }
      catch (jsonErr) {
        /* response is not JSON text */
        error.server = false;
        error.message = getStorageErrorMessage('UNKNOWN');
      }

      throw storageErrorHandler(error);
    }

    return response;
  }

  /**
   * @internal
   */
  initUploadController(metadata: any) {
    return new UploadTaskController(metadata, this);
  }


  /**
   * @async
   * @property {Function} fetchDownloadUrl
   * Fetch download URL for the path.
   * @param {String} path
   * @returns {Promise<Object>} 
   */
  /**
   * @internal
   */
  async fetchDownloadUrl(path: string, access_token: string | null) {
    let response = null;
    let result = null;
    const reqURL =
      `${this.URL}${getpreauth_REST_EP}?apiKey=${this.config.appID}`;

    const headers: Record<string, string> = {};
    const params = {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        bucket: this.bucket,
        path: path, //fullPath
        metadata: {},
        access_type: "ObjectRead" //for getDownloadURL
      }),
    };

    if (access_token) {
      params.headers["Authorization"] = `Bearer ${access_token}`;
    }

    try {
      response = await fetchWithRetry(reqURL, params,
        this.maxOperationRetryTime, this.app);
      Utils.checkResponse(response);
      result = await response.json();
    } catch (err:any) {
      Utils.baasTrace(this.loglevel, params, reqURL, response, result);

      let error = new StorageError(StorageErrorCode.INTERNAL_ERROR, err.message);
      if (err.status) {
        error.status = err.status;
      }


if (response) {
  try {
    let errjson = await response.json();
    error.server = true;
    error.message = (this.isPrem) ? errjson.error : errjson.message;
  }
  catch (jsonErr) {
    /* response is not JSON text */
    error.server = false;
    error.message = getStorageErrorMessage('FAILED_DOWNLOAD_URL', path);
  }
} else {
  error.server = false;
  error.message = getStorageErrorMessage('FAILED_DOWNLOAD_URL', path);
}

      throw storageErrorHandler(error);
    }

    if (!result.URL.startsWith('https://') && this.isPrem) //OCI object store URL
      result.URL = this.PARequestURL + result.URL;
    return result;
  }

  /**
   * @internal
   */
  async deleteObject(path: string, access_token: string | null) {
    let response = null;
    const reqURL = `${this.URL}${deleteObj_REST_EP}?apiKey=${this.config.appID}`;
    const headers: Record<string, string> = {"x-object-path": JSON.stringify({
          bucket: this.bucket,
          path: path
        })};
    const params = {
      method: "DELETE",
      headers: headers
    };

    if (access_token) {
      params.headers["Authorization"] = `Bearer ${access_token}`;
    }

    try {
      response = await fetchWithRetry(reqURL, params, this.maxOperationRetryTime, this.app);
      Utils.checkResponse(response);
    } catch (err:any) {
      Utils.baasTrace(this.loglevel, params, reqURL, response);

      let error = new StorageError(StorageErrorCode.INTERNAL_ERROR, err.message);
      if (err.status) {
        error.status = err.status;
      }

      try {
        let errjson = await response?.json();
        error.server = true;
        error.message = (this.isPrem) ? errjson.error : errjson.message;
      }
      catch (jsonErr) {
        /* response is not JSON text */
        error.server = false;
        error.message = getStorageErrorMessage('FAILED_DELETE', path);
      }

      throw storageErrorHandler(error);
    }
  }

  /**
   * @async
   * @property {Function} fetchMetadata
   * Fetch meta data for the reference.
   * @param {StorageReference} ref
   * @returns {Promise<Object>} 
   */
  /**
   * @internal
   */
  async fetchMetadata(ref: StorageReference, access_token: string | null) {

    const attributeList : Record<string, string> = {
      "cache-control": "cacheControl",
      "content-disposition": "contentDisposition",
      "content-encoding": "contentEncoding",
      "content-language": "contentLanguage",
      "content-length": "size",
      "last-modified": "updated",
    }


    let response = null;
    let result:any = null;
    const reqURL = this.URL + getMetadata_REST_EP +
      `/b/${this.bucket}?apiKey=${this.config.appID}`;

    // For OnPrem endpoint, getmetadata endpoint and request-response formats
    // are different altogether.

    const headers: Record<string, string> = {"x-object-path": JSON.stringify({
            bucket: this.bucket,
            path: ref.fullPath
          })};

    if (this.isPrem) {
      const params = {
        method: "GET",
        headers: headers
      }

      if (access_token) {
        params.headers["Authorization"] = `Bearer ${access_token}`;
      }

      try {
        response = await fetchWithRetry(reqURL, params, this.maxOperationRetryTime, this.app);
        Utils.checkResponse(response);
        result = await response.json();

        response.headers.forEach((value:any, key:any) => {
          if (key in attributeList) {
            const field = attributeList[key];
            result[field] = value;
          }

        });
      } catch (err:any) {
        Utils.baasTrace(this.loglevel, params, reqURL, response, result);

        let error = new StorageError(StorageErrorCode.INTERNAL_ERROR, err.message);
        if (err.status) {
          error.status = err.status;
        }


if (response) {
  try {
    let errjson = await response.json();
    error.server = true;
    error.message = (this.isPrem) ? errjson.error : errjson.message;
  }
  catch (jsonErr) {
    /* response is not JSON text */
    error.server = false;
    error.message = getStorageErrorMessage('FAILED_FETCH_METADATA', ref.fullPath);
  }
} else {
  error.server = false;
  error.message = getStorageErrorMessage('FAILED_FETCH_METADATA', ref.fullPath);
}

        throw storageErrorHandler(error);
      }

      result['name'] = ref.name;
      result['customMetadata'] = {};
      result['ref'] = ref;
      if (Object.prototype.hasOwnProperty.call(result, "opc-multipart-md5")) {
        result["md5Hash"] = result["opc-multipart-md5"];
        delete result["opc-multipart-md5"];
      }
      return result
    }


    let fullMetadata : Record<string, any> = {
      bucket: this.bucket,
      fullPath: ref.fullPath,
      name: ref.name,
      customMetadata: {}
    }

    const addToMetadata = (value: string, key: string) => {
      if (key in attributeList) {
        const field = attributeList[key];
        fullMetadata[field] = value;
      }
      /* user-defined metadata */
      else if (key.startsWith("opc-meta-")) {
        const field = key.substr(8);
        fullMetadata.customMetadata[field] = value;
      }
    }

    const ociHeaders: Record<string, string> = {"x-object-path": JSON.stringify({
          bucket: this.bucket,
          path: ref.fullPath
        })};

    const params = {
      method: "GET",
      headers: ociHeaders
    }

    if (access_token) {
      params.headers["Authorization"] = `Bearer ${access_token}`;
    }

    try {
      response = await fetchWithRetry(reqURL, params,
        this.maxOperationRetryTime, this.app);
      Utils.checkResponse(response);
      result = await response.json();
    } catch (err:any) {
      Utils.baasTrace(this.loglevel, params, reqURL, response, result);

      let error = new StorageError(StorageErrorCode.INTERNAL_ERROR, err.message);
      if (err.status) {
        error.status = err.status;
      }

      try {
        let errjson = await response?.json();
        error.server = true;
        error.message = (this.isPrem) ? errjson.error : errjson.message;
      }
      catch (jsonErr) {
        /* response is not JSON text */
        error.server = false;
        error.message = getStorageErrorMessage('UNKNOWN');
      }

      throw storageErrorHandler(error);
    }

    fullMetadata["bucket"] = result.bucket;
    fullMetadata["size"] = result.size;
    fullMetadata["fullPath"] = ref.fullPath;
    fullMetadata["timeCreated"] = result.updated;
    fullMetadata["contentType"] = result.contentType;
    fullMetadata["updated"] = result.updated;
    fullMetadata["md5Hash"] = result.md5Hash;
    fullMetadata["ref"] = ref;
    fullMetadata["storage"] = ref.storage;

    if (response) {
      response.headers.forEach(addToMetadata);
    }

    return fullMetadata;
  }
}
