
import { LogLevel } from '../../../logger/LogLevel.js';
import { QueryFieldFilterConstraint,QueryCompositeFilterConstraint } from '../collection/constraint.js';
import {App} from '../../../app/src/public-types.js';
import endpoints from './const.js';
import { IdTokenResult } from '../../../auth/src/types/idtoken.js';
import { DocumentReference } from '../document/reference.js';
import { SetOptions } from '../types/common.js';
import { Query } from '../collection/reference.js';
import { CollectionReference } from '../collection/reference.js';
import { getErrorMessage } from '../errors.js';
import { fusabaseFetch } from '../../../app/src/fusabase-fetch.js';
import { SparseEmbedding, VectorSearchQuery } from '../types/vector.js';

// Error code mapping for Oracledb errors
export const OracledbErrorCode = Object.freeze({
  INVALID_ARGUMENT: 'invalid-argument',
  UNAUTHENTICATED: 'unauthenticated',
  UNAUTHORIZED: 'permission-denied',
  INTERNAL_ERROR: 'internal',
  OBJECT_NOT_FOUND: 'not-found',
  NETWORK_ISSUE: 'network-error',
  UNKNOWN: 'unknown'
} as const);

export type OracledbErrorCode =
  | 'invalid-argument'
  | 'unauthenticated'
  | 'permission-denied'
  | 'internal'
  | 'not-found'
  | 'network-error'
  | 'unknown';
  

export class OracledbError extends Error {
  /** Oracledb error code, e.g., "oracledb/invalid-argument" */
  code: string = 'oracledb/';
  status: number = 200;

  constructor(code: OracledbErrorCode, message?: string, stack?: string) {
    super(message);
    this.code = this.code + code;
    this.name = 'OracledbError';
    if (stack) {
      this.stack = stack;
    }
  }
}

/**
 * Converts and standardizes errors thrown by Oracledb operations.
 */
export function oracledbErrorHandler(err: any): OracledbError {
  if (err instanceof OracledbError) {
    return err;
  }
  let code: OracledbErrorCode;
  if (err.status === 400) code = OracledbErrorCode.INVALID_ARGUMENT;
  else if (err.status === 401) code = OracledbErrorCode.UNAUTHENTICATED;
  else if (err.status === 404) code = OracledbErrorCode.OBJECT_NOT_FOUND;
  else if (err.status === 403) code = OracledbErrorCode.UNAUTHORIZED;
  else if (err.status === 500) code = OracledbErrorCode.INTERNAL_ERROR;
  else if (err.status === 500) code = OracledbErrorCode.INTERNAL_ERROR;
  else if (err.status === 408) code = OracledbErrorCode.NETWORK_ISSUE;
  else code = OracledbErrorCode.UNKNOWN;
  return new OracledbError(code, err.message, err.stack);
}

/** Oracledb supported API versions */
export const OracledbVersion = Object.freeze({
  VER_1: 1,
  VER_2: 2
} as const);

export type OracledbVersion = typeof OracledbVersion[keyof typeof OracledbVersion];

/**
 * Throws if the provided value is null or undefined.
 * @param value - Value to check
 * @param message - Error message for null/undefined value
 */
export function nullCheck(value: unknown, message: string): void {
  if (value == null) {
    const error = new Error(message) as Error & { status?: number };
    error.status = 400;
    throw oracledbErrorHandler(error);
  }
}

/** String representations for common types */
export const typeStrings = Object.freeze({
  NULL: "null",
  ARRAY: "array",
  DATE: "date",
  REGEXP: "regexp",
  NUMBER: "number",
  INT: "int",
  FLOAT: "float",
  OBJECT: "object",
  STRING: "string",
  BOOL: "boolean",
  BIGINT: "bigint",
  SYMBOL: "symbol",
  FUNCTION: "function"
} as const);

export type TypeStrings = typeof typeStrings[keyof typeof typeStrings];

/**
 * Checks argument for null/undefined and (optionally) for expected types.
 * Throws if `throwNullError` is true and the value is null/undefined or type mismatch.
 */
export function argCheck(
  value: any,
  message?: string,
  throwNullError?: boolean,
  expectedTypes: string[] = []
): any {
  if (value === null || value === undefined) {
    if (!throwNullError) return;
    const error = new Error(message || getErrorMessage('valueCannotBeNull')) as Error & { status?: number };
    error.status = 400;
    throw oracledbErrorHandler(error);
  }
  if (!Array.isArray(expectedTypes) || expectedTypes.length === 0) {
    return value;
  }
  function detectType(val: any): string {
    if (val === null) return typeStrings.NULL;
    if (Array.isArray(val)) return typeStrings.ARRAY;
    if (val instanceof Date) return typeStrings.DATE;
    if (val instanceof RegExp) return typeStrings.REGEXP;
    if (typeof val === typeStrings.NUMBER) {
      return Number.isInteger(val) ? typeStrings.INT : typeStrings.FLOAT;
    }
    if (typeof val === "object") return typeStrings.OBJECT;
    return typeof val;
  }
  const actualType = detectType(value);
  if (!expectedTypes.map(t => t.toLowerCase()).includes(actualType)) {
    const error = new Error(
      message ||
        getErrorMessage('expectedType', expectedTypes.join(", "), actualType)
    ) as Error & { status?: number };
    error.status = 400;
    throw oracledbErrorHandler(error);
  }
  return value;
}

/**
 * Builds a host connection URL string for websocket connections.
 */
export function getHostString(
  ssl: boolean,
  host: string,
  token?: string
): string {
  if (token && token !== "") {
    host = host.slice(0, host.length - 1) + "?authToken=" + token;
  }
  return ssl ? "wss://" + host : "ws://" + host;
}

/**
 * Gets an auth token from the current user.
 */
export function getToken(app: any): any {
  
  // Typing of .auth and .currentUser may be improved to match your SDK better.
  const user = app.auth().currentUser;
  if (!user) {
    return null;
  }
  return user && user.__getToken ? user.__getToken() : null;
}

export function snapHashcode (str:string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return hash;
};


export function rearrangeBodyOfVersion2(body: any) :any {
    let res:any = [];
    for (let i = 0; i < body.length; i++) {
        if (body[i]['op'] == 'servertimestamp') {
            res.push(body[i]);
        }
    }

    for (let i = 0; i < body.length; i++) {
        if (body[i]['op'] != 'servertimestamp' && body[i]['op'] != 'arrayUnion' && body[i]['op'] != 'arrayRemove') {
            res.push(body[i]);
        }
    }

    for (let i = 0; i < body.length; i++) {
        if (body[i]['op'] == 'arrayUnion' || body[i]['op'] == 'arrayRemove') {
            res.push(body[i]);
        }
    }
    return res;
}

/**
 * Converts an ISO date string to a Date object (with microsecond truncation).
 */
export function convertToDateObject(dateStr: string): Date {
  const truncatedDateStr = dateStr.slice(0, 23) + "Z";
  return new Date(truncatedDateStr);
}

/**
 * Returns the currentUser's access token (asynchronous).
 */
export async function getAccessToken(app: any): Promise<string | null> {
  const user = app.auth().currentUser;
  return user && user.getFUSABASEToken ? await user.getFUSABASEToken() : null;
}

/**
 * Checks if an object is an instance of a class (not just a plain object).
 */
export function isInstanceOfAnyClass(variable: any): boolean {
  return (
    typeof variable === "object" &&
    variable !== null &&
    Object.getPrototypeOf(variable) !== Object.prototype
  );
}

// Unique name generator (removes hyphens from UUID)
export function createUniqueName(): string {
  const name = crypto.randomUUID();
  let trans_name = "";
  for (let i = 0; i < name.length; i++) {
    if (name[i] !== "-") {
      trans_name += name[i];
    }
  }
  return trans_name;
}

/** Type guard for duality view queries/refs */
export function isDualityView(query: { type: string }): boolean {
  return (
    query.type === "dualityviewdocument" ||
    query.type === "dualityviewcollection"
  );
}

/** Escapes a field name for use in dot-notation paths */
export function escapeFieldName(field: string): string {
  if (field.startsWith('"') && field.endsWith('"')) {
    return field; // already escaped
  }
  if (field.includes(".")) {
    return `"${field}"`; // wrap in quotes
  }
  return field;
}

/** Adds quotes to fields in an array of field descriptors */
export function updateFieldsWithQuotes(
  arr: Array<{ field: string } & Record<string, any>>
): Array<{ field: string } & Record<string, any>> {
  return arr.map(item => {
    if (item && typeof item === "object" && "field" in item) {
      return { ...item, field: escapeFieldName(item.field) };
    }
    return item;
  });
}

/**
 * Parses input (buffer, stream, or string) as JSON and returns the object and total bytes.
 */
export async function parseAndGetTotalBytes(
  data: ArrayBuffer | ReadableStream<Uint8Array> | string
): Promise<{ data: any; totalBytes: number }> {
  let jsonObject: any;
  let jsonString: string;
  if (data instanceof ArrayBuffer) {
    jsonString = new TextDecoder("utf-8").decode(data);
    jsonObject = JSON.parse(jsonString);
  } else if (typeof ReadableStream !== "undefined" && data instanceof ReadableStream) {
    const reader = data.getReader();
    const chunks: Uint8Array[] = [];
    let done = false, value: Uint8Array | undefined;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      value = result.value;
      if (value) {
        chunks.push(value);
      }
    }
    const length = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const concatenated = new Uint8Array(length);
    let position = 0;
    for (const chunk of chunks) {
      concatenated.set(chunk, position);
      position += chunk.length;
    }
    jsonString = new TextDecoder("utf-8").decode(concatenated);
    jsonObject = JSON.parse(jsonString);
  } else if (typeof data === "string") {
    jsonString = data;
    jsonObject = JSON.parse(jsonString);
  } else {
    throw new Error(getErrorMessage('unsupportedDataType'));
  }
  const encoder = new TextEncoder();
  const encodedJson = encoder.encode(JSON.stringify(jsonObject));
  const totalBytes = encodedJson.length;
  return { data: jsonObject, totalBytes };
}

/** Returns the UTF-8 byte length of a data object as JSON */
export function getTotalBytes(data: any): number {
  if (data == null) {
    return 0;
  }
  const jsonString = JSON.stringify(data);
  const encoder = new TextEncoder();
  const byteArray = encoder.encode(jsonString);
  return byteArray.length;
}

/**
 * Checks if the current oracledb api version matches.
 */
export function checkOracledbApiVersion(options: any, version: number): boolean {
  return options["version"] === version;
}

/**
 * Identifies the type of a value in Oracledb/OracleDB serialization format.
 */
export function identifyValueType(value: any): string {
  if (value === null) {
    return "nullValue";
  } else if (typeof value === "boolean") {
    return "booleanValue";
  } else if (typeof value === "number") {
    return Number.isInteger(value) ? "integerValue" : "doubleValue";
  } else if (typeof value === "string") {
    const isoTimestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/;
    return isoTimestampRegex.test(value) ? "timestampValue" : "stringValue";
  } else if (Array.isArray(value)) {
    return "arrayValue";
  } else if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
    return "bytesValue";
  } else if (typeof value === "object") {
    return "mapValue";
  } else {
    return "unknownValue";
  }
}

export function validateDenseVector(values: unknown, message = "Dense vector must be a numeric array."): asserts values is number[] {
  if (!Array.isArray(values) || values.some(v => typeof v !== "number" || Number.isNaN(v))) {
    const error: any = new Error(message);
    error.status = 400;
    throw oracledbErrorHandler(error);
  }
}

export function validateSparseEmbedding(sparse: SparseEmbedding): void {
  if (!Number.isInteger(sparse.dimension) || sparse.dimension <= 0) {
    const error: any = new Error("Sparse embedding dimension must be an integer greater than 0.");
    error.status = 400;
    throw oracledbErrorHandler(error);
  }
  validateDenseVector(sparse.indices, "Sparse embedding indices must be a numeric array.");
  validateDenseVector(sparse.values, "Sparse embedding values must be a numeric array.");
  if (sparse.indices.length !== sparse.values.length) {
    const error: any = new Error("Sparse embedding indices and values must have the same length.");
    error.status = 400;
    throw oracledbErrorHandler(error);
  }
}

export function validateVectorSearchQuery(query: VectorSearchQuery): void {
  const hasDense = Array.isArray((query as any).vector);
  const hasSparse = !!(query as any).sparse;
  if ((hasDense && hasSparse) || (!hasDense && !hasSparse)) {
    const error: any = new Error("Vector search query must contain exactly one of query.vector or query.sparse.");
    error.status = 400;
    throw oracledbErrorHandler(error);
  }
  if (hasDense) {
    validateDenseVector((query as any).vector, "Vector search query.vector must be a numeric array.");
  }
  if (hasSparse) {
    validateSparseEmbedding((query as any).sparse);
  }
}

/**
 * Gets a snapshot token for real-time websocket connections.
 */
export async function getSnapshotToken(
  app: App,
  reqURL: string,
  token: string
): Promise<any> {
  const params = {
    method: "GET",
    headers: {"Authorization":`Bearer ${token}`}
  };
  let response: Response | null = null;
  let result: any = null;
  try {
    response = await fusabaseFetch(app, reqURL, params);
    Utils.checkResponse(response);
    result = await response.json();
  } catch (err: any) {
    if (response) err.status = response.status;
    try {
      const newMessage = await response?.json();
      if (Utils.memberExists(newMessage, "error")) {
        err.message = newMessage["error"];
      } else if (Utils.memberExists(newMessage, "message")) {
        err.message = newMessage["message"];
      }
    } catch {
      err.message = "Unknown";
    }
    throw err;
  }
  return result;
}

/**
 * Flattens (serializes) a composite query filter into an array of filter objects.
 */
export function serializeCompositeFilter(
  filter: any
): Array<{ field: string | null; op: string; value: any }> {
  let res: Array<{ field: string | null; op: string; value: any }> = [];
  res.push({ field: null, op: "(", value: null });
  for (let i = 0; i < filter.__query_cons.length; i++) {
    if (filter.__query_cons[i] instanceof QueryCompositeFilterConstraint) {
      let child_res = serializeCompositeFilter(filter.__query_cons[i]);
      for (let j = 0; j < child_res.length; j++) {
        res.push(child_res[j]);
      }
    } else if (filter.__query_cons[i] instanceof QueryFieldFilterConstraint) {
      res.push({
        field: filter.__query_cons[i].__cons["path"],
        op: filter.__query_cons[i].__cons["opStr"],
        value: filter.__query_cons[i].__cons["value"]
      });
    }
    if (i != filter.__query_cons.length - 1) {
      res.push({ field: null, op: filter.type, value: null });
    }
  }
  res.push({ field: null, op: ")", value: null });
  return res;
}


export class DBConn {
  private _host: string;
  private _schema: string;
  private _module: string;
  private _appID: string;
  private _projectID: string;

  constructor(app: App) {
    this._host = app.options.ordsHost ?? '';
    this._schema = app.options.schema ?? '';
    this._module = 'database';
    this._appID = app.options.appID ?? '';
    this._projectID = app.options.projectID ?? '';
  }

  get url(): string {
    return `${this._host}_/baas-services/${this._module}/${this._projectID}/`;
  }
}

export class QueryHelper {
  #app: any;

  constructor(app: any) {
    this.#app = app;
  }

  /**
   * Helper function to fetch documents.
   */
  async fetchDocuments(
    query: Query,
    access_token?: string,
    trans_obj?: any
  ): Promise<any> {
    const _db = query.oracledb;
    const memberExists = (obj: any, member: string) =>
      Object.prototype.hasOwnProperty.call(obj, member);

    const jCon = memberExists(query, "_joins") && query._joins!.length > 0;
    const body: any = {
      conditions: memberExists(query, "_conditions") ? query._conditions : [],
      explicitOrder: memberExists(query, "_explicitOrder")
        ? query._explicitOrder
        : [],
      aggregate: memberExists(query, "_aggregate") ? query._aggregate : [],
      column: memberExists(query, "_column") ? query._column : [],
      joins: jCon ? query._joins![0] : [],
      limit: memberExists(query, "_limit") ? query._limit : 0,
      col_group: memberExists(query, "_col_group") ? query._col_group : "",
      snapshot: memberExists(query, "_rt") ? query._rt : 0,
      options: {},
    };

    if (
      checkOracledbApiVersion(query.oracledb.app.options, OracledbVersion.VER_2) &&
      (query as any)._vectorSearch
    ) {
      body.vectorSearch = (query as any)._vectorSearch;
    }

    const isAggregate = body.aggregate.length !== 0;

    if (isDualityView(query)) {
      const tokens = query._path || [];
      body.dv_name = tokens[0];
      if (tokens.length > 1) body.oid = tokens[1];
    } else {
      body.path = query._path;
    }

    if (jCon) body.path = [];

    let reqURL =
      _db.url + endpoints.GET_DOCS_V1 + `?apiKey=${this.#app.options.appID}`;
    if (
      checkOracledbApiVersion(
        query.oracledb.app.options,
        OracledbVersion.VER_2
      )
    ) {
      reqURL =
        _db.url + endpoints.GET_DOCS_V2 + `?apiKey=${this.#app.options.appID}`;
    }

    let params: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-transaction": JSON.stringify({
          begin_trans: trans_obj?.start ?? 0,
          end_trans: trans_obj?.end ?? 0,
          trans_name: trans_obj?.name ?? "",
        }),
      },
      body: JSON.stringify(body),
    };

    if (access_token) {
      (params.headers as Record<string, string>)["Authorization"] = `Bearer ${access_token}`;
    }

    let response: Response | null = null;
    let result: any = null;

    try {
      response = await fusabaseFetch(this.#app, reqURL, params);
      Utils.checkResponse(response);
      result = await response.json();
    } catch (err: any) {
      Utils.baasTrace(this.#app.logLevel, params, reqURL, response, result);
      err.status = response? response.status : 408;
      try {
        const newMessage = await response?.json();
        if (Utils.memberExists(newMessage, "error")) err.message = newMessage.error;
        else if (Utils.memberExists(newMessage, "message")) err.message = newMessage.message;
      } catch {
        err.message = "Unknown";
      }
      throw err;
    }

    // Transform result data for joins / non-aggregates
    if (jCon) {
      for (const item of result.ret ?? []) {
        const relResult: Record<string, any> = {};
        for (const key in item.data) {
          if (key !== "OID") relResult[key] = item.data[key];
        }
        item.osons = {
          DOCUMENT: relResult,
          CREATED: null,
          LAST_MODIFIED: null,
          VERSION: null,
          SUBCOLLECTION: null,
          PARENT_OID: null,
        };
      }
    } else if (!isAggregate) {
      for (const item of result.ret ?? []) {
        if (!("DOCUMENT" in item.osons) && item.osons) {
          const relResult: Record<string, any> = {};
          for (const key in item.osons) {
            if (!["OID", "parent_oid", "_metadata"].includes(key)) {
              relResult[key] = item.osons[key];
            }
          }
          const meta = item.osons._metadata ?? {};
          item.osons.DOCUMENT = relResult;
          item.osons.CREATED = null;
          item.osons.LAST_MODIFIED = null;
          item.osons.VERSION = meta.etag;
          item.osons.ASOF = meta.asof;
          item.osons.SUBCOLLECTION = item.osons.subcollection;
          item.osons.PARENT_OID = item.osons.parent_oid;
        }
      }
    }

    if (body.snapshot === 1) {
      for (const item of result.ret ?? []) {
        item.osons.ROWID = item.rid;
      }
    }

    return result;
  }

  /**
   * Create document.
   */
  async createDocument(
    colRef: CollectionReference,
    document: any,
    access_token?: string
  ): Promise<any> {
    const _db = colRef.oracledb;
    let reqURL = colRef.oracledb.url;
    if (checkOracledbApiVersion(colRef.oracledb.app.options, OracledbVersion.VER_2)) {
        reqURL += "v2/";
    } else {
        reqURL += "v1/";
    }

    reqURL += endpoints.ADD_DOC +
        `?apiKey=${this.#app.options.appID}`;

    const body: any = {
      data: document,
      servertimestamp: colRef._serverTimestamp,
    };

    if (isDualityView(colRef)) {
      const tokens = colRef._path;
      body.dv_name = tokens[0];
      if (tokens.length > 1) body.oid = tokens[1];
    } else {
      body.path = colRef._path;
    }

    if (
      checkOracledbApiVersion(colRef.oracledb.app.options, OracledbVersion.VER_2)
    ) {
      body.apiversion = 2;
    }

    let params: RequestInit = {
      method: "POST",
      headers: {
        "x-transaction": JSON.stringify({
          begin_trans: 0,
          end_trans: 0,
          trans_name: "",
        }),
      },
      body: JSON.stringify(body),
    };

    if (access_token) {
      (params.headers as Record<string, string>)["Authorization"] = `Bearer ${access_token}`;
    }

    let response: Response | null = null;
    let result: any = null;
    try {
      response = await fusabaseFetch(this.#app, reqURL, params);
      Utils.checkResponse(response);
      result = await response.json();
    } catch (err: any) {
      Utils.baasTrace(this.#app.logLevel, params, reqURL, response, result);
      err.status = response? response.status : 408;
      try {
        const newMessage = await response?.json();
        if (Utils.memberExists(newMessage, "error")) err.message = newMessage.error;
        else if (Utils.memberExists(newMessage, "message")) err.message = newMessage.message;
      } catch {
        err.message = "Unknown";
      }
      throw err;
    }

    return result;
  }

  /**
   * Update document.
   */
  async updateDocument(
    docRef: any,
    document: any,
    access_token?: string,
    trans_obj?: any
  ): Promise<any> {
    let url = docRef.oracledb.url;
    if (
      checkOracledbApiVersion(docRef.oracledb.app.options, OracledbVersion.VER_2)
    ) {
      url += "v2/";
    } else {
      url += "v1/";
    }
    url += endpoints.UPDATE_DOC + `?apiKey=${this.#app.options.appID}`;
    
    const memberExists = (obj: any, member: string) =>
      Object.prototype.hasOwnProperty.call(obj, member);

    const body: any = { 
      data: document,
      conditions: (memberExists(docRef, '_conditions') ?
                docRef._conditions : []),
    };

    if (isDualityView(docRef)) {
      const tokens = docRef._path;
      body.dv_name = tokens[0];
      if (tokens.length > 1) body.oid = tokens[1];
    } else {
      body.path = docRef._path;
    }
    if (!isDualityView(docRef) && body["path"].length%2==1) {
      body["path"].push("*")
    }

    if (trans_obj != null && trans_obj.version != null) {
        body["version"] = trans_obj.version;
    }

    let req_par: RequestInit = {
      method: "PUT",
      headers: {
        "x-transaction": JSON.stringify({
          begin_trans: trans_obj?.start ?? 0,
          end_trans: trans_obj?.end ?? 0,
          trans_name: trans_obj?.name ?? "",
        }),
      },
      body: JSON.stringify(body),
    };

    if (access_token) {
      (req_par.headers as Record<string, string>)["Authorization"] = `Bearer ${access_token}`;
    }

    let response: Response | null = null;
    let result: any = null;
    try {
      response = await fusabaseFetch(this.#app, url, req_par);
      Utils.checkResponse(response);
      result = await response.json();
      if (!result.OID  && result["count"] == null) throw new Error(getErrorMessage('unknownError'));
    } catch (err: any) {
      Utils.baasTrace(this.#app.logLevel, req_par, url, response, result);
      err.status = response? response.status : 408;
      try {
        const newMessage = await response?.json();
        if (Utils.memberExists(newMessage, "error")) err.message = newMessage.error;
        else if (Utils.memberExists(newMessage, "message")) err.message = newMessage.message;
      } catch {
        err.message = "Unknown";
      }
      throw err;
    }

    if (trans_obj?.version) {
      trans_obj.version = result.VERSION;
    }

    return result;
  }

  /**
   * Delete document.
   */
  async deleteDocument(
    docRef: DocumentReference,
    access_token?: string,
    trans_obj?: any
  ): Promise<void> {

    let url = docRef.oracledb.url;
    // if (
    //   checkOracledbApiVersion(docRef.oracledb.app.options, OracledbVersion.VER_2)
    // ) {
    //   url += "v2/";
    // } else {
    //   url += "v1/";
    // }
    url += endpoints.DELETE_DOC + `?apiKey=${this.#app.options.appID}`;

    const body: any = {};

    if (isDualityView(docRef)) {
      const tokens = docRef._path;
      body.dv_name = tokens[0];
      if (tokens.length > 1) body.oid = tokens[1];
    } else {
      body.path = docRef._path;
    }
    if (trans_obj != null && trans_obj.version != null) {
        body["version"] = trans_obj.version;
    }

    let req_par: RequestInit = {
      method: "PUT",
      headers: {
        "x-transaction": JSON.stringify({
          begin_trans: trans_obj?.start ?? 0,
          end_trans: trans_obj?.end ?? 0,
          trans_name: trans_obj?.name ?? "",
        }),
      },
      body: JSON.stringify(body),
    };

    if (access_token) {
      (req_par.headers as Record<string, string>)["Authorization"] = `Bearer ${access_token}`;
    }

    let response: Response | null = null;

    try {
      response = await fusabaseFetch(this.#app, url, req_par);
      Utils.checkResponse(response);
    } catch (err: any) {
      Utils.baasTrace(this.#app.logLevel, req_par, url, response);
      err.status = response? response.status : 408;
      try {
        const newMessage = await response?.json();
        if (Utils.memberExists(newMessage, "error")) err.message = newMessage.error;
        else if (Utils.memberExists(newMessage, "message")) err.message = newMessage.message;
      } catch {
        err.message = "Unknown";
      }
      throw err;
    }
  }

  /**
   * Set document.
   */
  async setDocument(
    docRef: DocumentReference,
    data: any,
    options: SetOptions,
    access_token?: string,
    trans_obj?: any
  ): Promise<any> {
    if (options.mergeFields && options.mergeFields?.length > 0) {
      options.merge = true;
    }

    const path_arr = [...docRef._path];
    const _oid = path_arr.pop();
    if (_oid !== "$_random_$") path_arr.push(_oid!);

    let url = docRef.oracledb.url;
    if (
      checkOracledbApiVersion(docRef.oracledb.app.options, OracledbVersion.VER_2)
    ) {
      url += "v2/";
    } else {
      url += "v1/";
    }
    url += endpoints.SET_DOC + `?apiKey=${this.#app.options.appID}`;

    const body: any = {
      options: { merge: options.merge },
      data,
      servertimestamp:docRef._serverTimestamp
    };

    if (isDualityView(docRef)) {
      const tokens = path_arr;
      body.dv_name = tokens[0];
      if (tokens.length > 1) body.oid = tokens[1];
    } else {
      body.path = path_arr;
    }

    if (
      checkOracledbApiVersion(docRef.oracledb.app.options, OracledbVersion.VER_2)
    ) {
      body.apiversion = 2;
    }
    if (trans_obj != null && trans_obj.version != null) {
        body["version"] = trans_obj.version;
    }

    let req_par: RequestInit = {
      method: "POST",
      headers: {
        "x-transaction": JSON.stringify({
          begin_trans: trans_obj?.start ?? 0,
          end_trans: trans_obj?.end ?? 0,
          trans_name: trans_obj?.name ?? "",
        }),
      },
      body: JSON.stringify(body),
    };

    if (access_token) {
      (req_par.headers as Record<string, string>)["Authorization"] = `Bearer ${access_token}`;
    }

    let response: Response | null = null;
    let result: any = null;

    try {
      response = await fusabaseFetch(this.#app, url, req_par);
      Utils.checkResponse(response);
      result = await response.json();
      if (!result || !result.OID) throw new Error(getErrorMessage('unknownError'));
    } catch (err: any) {
      Utils.baasTrace(this.#app.logLevel, req_par, url, response, result);
      err.status = response? response.status : 408;
      try {
        const newMessage = await response?.json();
        if (Utils.memberExists(newMessage, "error")) err.message = newMessage.error;
        else if (Utils.memberExists(newMessage, "message")) err.message = newMessage.message;
      } catch {
        err.message = "Unknown";
      }
      throw err;
    }

    if (trans_obj?.version) {
      trans_obj.version = result.VERSION;
    }

    return result;
  }
}

export class Utils {
  /** @internal */
  private static readonly _MAX_TRACE_BODY_CHARS = 8_192;
  private static readonly LOG_REDACTION = "[REDACTED]";
  private static readonly MAX_LOG_DEPTH = 6;

  private static isSensitiveLogKey(key: string): boolean {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    return [
      "accesstoken",
      "refreshtoken",
      "idtoken",
      "inttoken",
      "authntoken",
      "fusabasetoken",
      "authtoken",
      "snapshottoken",
      "token",
      "password",
      "oldpassword",
      "newpassword",
      "secret",
      "clientsecret",
      "credential",
      "credentials",
      "authorization",
      "xauthz",
      "xauthtoken",
      "cookie",
      "setcookie",
      "assertion",
      "signature",
      "codeverifier",
      "apikey",
      "appchecktoken",
    ].includes(normalizedKey);
  }

  private static redactLogString(value: string): string {
    const trimmed = value.trim();

    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        return JSON.stringify(Utils.redactLogValue(JSON.parse(value)));
      } catch {
        // Fall through to pattern based redaction for non-JSON strings.
      }
    }

    return value
      .replace(/(authorization\s*[:=]\s*)(bearer|basic)\s+[^&\s,"'}]+/gi, `$1$2 ${Utils.LOG_REDACTION}`)
      .replace(/(\b(?:access_token|refresh_token|id_token|idToken|authnToken|authToken|token|assertion|password|client_secret|clientSecret|apiKey|appCheckToken|code_verifier|codeVerifier)\b\s*[:=]\s*)[^&\s,"'}]+/gi, `$1${Utils.LOG_REDACTION}`)
      .replace(/([?&](?:access_token|refresh_token|id_token|authToken|token|assertion|password|client_secret|apiKey|appCheckToken|code|code_verifier)=)[^&#\s]+/gi, `$1${Utils.LOG_REDACTION}`)
      .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, Utils.LOG_REDACTION);
  }

  private static redactLogValue(value: any, seen = new WeakSet<object>(), depth = 0): any {
    if (value == null) return value;
    if (typeof value === "string") return Utils.redactLogString(value);
    if (typeof value !== "object") return value;
    if (seen.has(value)) return "[Circular]";
    if (depth >= Utils.MAX_LOG_DEPTH) return "[MaxDepth]";

    seen.add(value);

    if (value instanceof Error) {
      const errorResult: Record<string, any> = {
        name: value.name,
        message: Utils.redactLogString(value.message),
      };
      if ((value as any).status != null) errorResult.status = (value as any).status;
      if ((value as any).code != null) errorResult.code = Utils.redactLogValue((value as any).code, seen, depth + 1);
      return errorResult;
    }

    if (typeof Response !== "undefined" && value instanceof Response) {
      return {
        type: value.type,
        url: Utils.redactLogString(value.url),
        status: value.status,
        ok: value.ok,
        statusText: value.statusText,
        redirected: value.redirected,
      };
    }

    if (typeof Request !== "undefined" && value instanceof Request) {
      return {
        method: value.method,
        url: Utils.redactLogString(value.url),
        credentials: value.credentials,
        mode: value.mode,
      };
    }

    if (typeof Headers !== "undefined" && value instanceof Headers) {
      const headers: Record<string, any> = {};
      value.forEach((headerValue, headerKey) => {
        headers[headerKey] = Utils.isSensitiveLogKey(headerKey)
          ? Utils.LOG_REDACTION
          : Utils.redactLogString(headerValue);
      });
      return headers;
    }

    if (Array.isArray(value)) {
      return value.map((item) => Utils.redactLogValue(item, seen, depth + 1));
    }

    const result: Record<string, any> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      result[key] = Utils.isSensitiveLogKey(key)
        ? Utils.LOG_REDACTION
        : Utils.redactLogValue(nestedValue, seen, depth + 1);
    }
    return result;
  }

  /**
   * Checks if the returned response has status code >= 200 & <= 299.
   * Throws error if the status code isn't in the specified range.
   * @param response - A Response-like object.
   */
  static checkResponse(response: { ok: boolean; statusText: string; status: number }): void {
    if (!response) {
      const error: any = new Error("Request failed");
      error.status = 408;
      throw error;
    }
    if (!response.ok) {
      const error = new Error(response.statusText) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
  }

  /**
   * Get the trace of the request and the function stack if at ERROR log level.
   */
  static baasTrace(logLevel: LogLevel, ...data: any[]): void {
    if (logLevel !== LogLevel.ERROR) return;

    for (const item of data) {
      console.trace(Utils.redactLogValue(item));
    }

    // Best-effort: if a Response was provided and it represents an error,
    // dump its body to help with debugging 4xx/5xx issues.
    //
    // NOTE: We intentionally do not await here (baasTrace is used in many
    // synchronous catch blocks). We still read using `clone()` so we don't
    // consume the original response body.
    const maybeResponse = data.find(
      (x: any) => x && typeof x === 'object' && typeof x.status === 'number' && typeof x.ok === 'boolean' && typeof x.clone === 'function'
    ) as Response | undefined;

    if (!maybeResponse || maybeResponse.ok) return;

    void Utils._traceResponseBody(maybeResponse);
  }

  /** @internal */
  private static async _traceResponseBody(res: Response): Promise<void> {
    try {
      const cloned = res.clone();
      const contentType = (cloned.headers?.get('content-type') ?? '').toLowerCase();

      let bodyText = '';
      if (contentType.includes('application/json')) {
        // JSON pretty print if possible; fall back to raw text.
        try {
          const json = await cloned.json();
          bodyText = JSON.stringify(json);
        } catch {
          bodyText = await cloned.text();
        }
      } else {
        bodyText = await cloned.text();
      }

      if (typeof bodyText !== 'string' || !bodyText) return;

      if (bodyText.length > Utils._MAX_TRACE_BODY_CHARS) {
        bodyText = bodyText.slice(0, Utils._MAX_TRACE_BODY_CHARS) + '… <truncated>';
      }

      console.trace('Response body:', Utils.redactLogString(bodyText));
    } catch {
      // Ignore any parsing/stream errors.
    }
  }

  /**
   * Log redacted data to the console if ERROR.
   */
  static baasLogger(logLevel: LogLevel, ...data: any[]): void {
    if (logLevel === LogLevel.ERROR) {
      for (const item of data) {
        console.log(Utils.redactLogValue(item));
      }
    }
  }

  /**
   * Gets an object's deep property using a path with #FieldPath# as separator.
   */
  static getObjectProperty(object: any, path: string): any {
    if (object == null) {
      return object;
    }
    const parts = path.split('#FieldPath#');
    for (let i = 0; i < parts.length; ++i) {
      if (object == null) {
        return undefined;
      }
      let key: string | number = parts[i];
      if (key.length > 14 && key.startsWith("__fusabaseindex__")) {
        key = key.substring(14);
        key = parseInt(key);
      }
      object = object[key];
    }
    return object;
  }

  /**
   * Checks if a member exists on an object.
   */
  static memberExists(obj: object, member: string | number | symbol): boolean {
    return Object.prototype.hasOwnProperty.call(obj, member);
  }

  /**
   * Checks if an object is an instance of a given class (constructor function).
   */
  static isTypeOf(obj: any, typeConstructor: any): boolean {
    return obj instanceof typeConstructor;
  }

  /**
   * Checks if a value is a number (string that can be coerced to a number).
   */
  static isNumber(value: any): boolean {
    if (typeof value === "string") {
      return !isNaN(Number(value));
    }
    return typeof value === "number" && !isNaN(value);
  }
}
