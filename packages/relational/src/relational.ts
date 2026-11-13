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

import type { App } from "../../app/src/public-types.js";
import { fusabaseFetch } from "../../app/src/fusabase-fetch.js";
import { getAuthCore } from "../../auth-core/src/index.js";
import { RelationalAuthClient } from "./auth.js";
import { AppTrustClient } from "./app-trust.js";
import {
  createColumnPredicate,
  createFilterPredicate,
  parseColumnReference,
  parseFilter,
} from "./parser.js";
import { parseProjection, type Projection } from "./projection.js";
import { executeOfflineRequest, isOfflineEnabledForApp, setOfflineRemoteExecutor } from "./offline/offline.js";
import type { RelationalOfflineRequest } from "./offline/types.js";

/** Strategy used when a request asks the service to calculate a row count. */
export type CountPreference = "exact" | "planned" | "estimated";
/** Data, error, status, and optional count returned by a data request. */
export type RelationalResponse<T = unknown> = {
/** Describes the public `data` value. */
  data: T | null;
/** Describes the public `error` value. */
  error: RelationalDatabaseError | null;
/** Describes the public `count` value. */
  count: number | null;
/** Describes the public `status` value. */
  status: number;
/** Describes the public `statusText` value. */
  statusText: string;
/** Offline execution metadata when relational offline support is enabled. */
  offline?: {
    fromCache: boolean;
    hasPendingWrites: boolean;
  };
};

type IsAny<T> = 0 extends (1 & T) ? true : false;
type IsUnknown<T> = IsAny<T> extends true
  ? false
  : unknown extends T
    ? [keyof T] extends [never]
      ? true
      : false
    : false;

type MergeResultObjects<Current extends object, Override extends object> =
  Omit<Current, keyof Override> & {
    [Key in keyof Override]: Key extends keyof Current
      ? MergeResultTypes<Current[Key], Override[Key]>
      : Override[Key];
  };

type MergeResultTypes<Current, Override> = IsUnknown<Current> extends true
  ? Override
  : Current extends readonly (infer CurrentItem)[]
    ? Override extends readonly (infer OverrideItem)[]
      ? Array<MergeResultTypes<CurrentItem, OverrideItem>>
      : Override
    : Current extends object
      ? Override extends object
        ? MergeResultObjects<Current, Override>
        : Override
      : Override;

type OverrideResult<
  Current,
  Override,
  Options extends { merge?: boolean },
> = Options["merge"] extends false ? Override : MergeResultTypes<Current, Override>;

/**
 * Describes an unsuccessful data request, including its HTTP status and details.
 *
 * @example
 * ```ts
 * if (error instanceof RelationalDatabaseError) console.error(error.status);
 * ```
 */
export class RelationalDatabaseError extends Error {
/** Describes the public `code` value. */
  code?: string;
/** Describes the public `details` value. */
  details?: string;
/** Describes the public `hint` value. */
  hint?: string;
/** Describes the public `status` value. */
  status: number;

/**
 * Constructs a RelationalDatabaseError instance with the supplied configuration.
 *
 * @param message - A human-readable error message.
 * @param status - Optional HTTP status; defaults to 0.
 * @param details - Optional structured details for the error.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalDatabaseError } from "fusabase/relational";
 * const result = new RelationalDatabaseError(value, 0, { title: "Example" });
 * void result;
 * ```
 */
  constructor(message: string, status = 0, details?: Partial<RelationalDatabaseError>) {
    super(message);
    this.name = "RelationalDatabaseError";
    this.status = status;
    this.code = details?.code;
    this.details = details?.details;
    this.hint = details?.hint;
  }
}

/** Data-and-error response envelope returned by a file operation. */
export type RelationalStorageResponse<T = unknown> = {
/** Describes the public `data` value. */
  data: T | null;
/** Describes the public `error` value. */
  error: RelationalStorageError | null;
};

/** Options for uploading or replacing an object. */
export type RelationalUploadOptions = {
/** Describes the public `cacheControl` value. */
  cacheControl?: string;
/** Describes the public `contentType` value. */
  contentType?: string;
/** Describes the public `duplex` value. */
  duplex?: string;
/** Describes the public `upsert` value. */
  upsert?: boolean;
/** Describes the public `metadata` value. */
  metadata?: Record<string, unknown>;
/** Describes the public `headers` value. */
  headers?: Record<string, string>;
};

/** Content and header options used by signed upload operations. */
export type RelationalFileOptions = {
/** Describes the public `cacheControl` value. */
  cacheControl?: string;
/** Describes the public `contentType` value. */
  contentType?: string;
/** Describes the public `duplex` value. */
  duplex?: string;
/** Describes the public `metadata` value. */
  metadata?: Record<string, unknown>;
/** Describes the public `headers` value. */
  headers?: Record<string, string>;
};

/** Pagination, search, and sorting options for object listing. */
export type RelationalSearchOptions = {
/** Describes the public `limit` value. */
  limit?: number;
/** Describes the public `offset` value. */
  offset?: number;
/** Describes the public `sortBy` value. */
  sortBy?: {
    column?: string;
    order?: "asc" | "desc";
  };
/** Describes the public `search` value. */
  search?: string;
};

/** Metadata describing an object in a bucket. */
export type RelationalFileObject = {
/** Describes the public `name` value. */
  name: string;
/** Describes the public `id` value. */
  id: string | null;
/** Describes the public `updated_at` value. */
  updated_at: string | null;
/** Describes the public `created_at` value. */
  created_at: string | null;
/** Describes the public `last_accessed_at` value. */
  last_accessed_at: string | null;
/** Describes the public `metadata` value. */
  metadata: Record<string, unknown> | null;
};

/** Metadata returned after a successful object upload. */
export type RelationalUploadData = {
/** Describes the public `path` value. */
  path: string;
/** Describes the public `id` value. */
  id: string;
/** Describes the public `fullPath` value. */
  fullPath: string;
};

/** Temporary download URL and its expiry information. */
export type RelationalSignedUrlData = {
/** Describes the public `signedUrl` value. */
  signedUrl: string;
/** Describes the public `path` value. */
  path: string;
};

/** Temporary upload token and its target path. */
export type RelationalSignedUploadUrlData = {
/** Describes the public `signedUrl` value. */
  signedUrl: string;
/** Describes the public `path` value. */
  path: string;
/** Describes the public `token` value. */
  token: string;
};

/** Public-style URL for an object. */
export type RelationalPublicUrlData = {
/** Describes the public `publicUrl` value. */
  publicUrl: string;
};

/** Binary body accepted by multipart upload operations. */
export type RelationalResumableUploadBody = Blob | ArrayBuffer | Uint8Array;

/** Retry count and delay settings for an individual request. */
export type RelationalRetryOptions = {
/** Describes the public `enabled` value. */
  enabled?: boolean;
/** Describes the public `maxRetries` value. */
  maxRetries?: number;
/** Describes the public `initialDelayMs` value. */
  initialDelayMs?: number;
/** Describes the public `maxDelayMs` value. */
  maxDelayMs?: number;
};

/** Options used to create, continue, or complete a multipart upload. */
export type RelationalResumableUploadOptions = RelationalUploadOptions & {
  chunkSize?: number;
  retryDelays?: number[];
  signal?: AbortSignal;
  uploadId?: string;
  startPart?: number;
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void;
  onError?: (error: RelationalStorageError) => void;
  onSuccess?: (data: RelationalResumableUploadData) => void;
};

/** Lifecycle states emitted by a multipart upload task. */
export type RelationalResumableUploadTaskState =
  | "idle"
  | "running"
  | "paused"
  | "success"
  | "error"
  | "aborted";

/** Options and callbacks used to construct a multipart upload task. */
export type RelationalResumableUploadTaskOptions = Omit<RelationalResumableUploadOptions, "signal"> & {
  onStateChange?: (state: RelationalResumableUploadTaskState) => void;
};

/** Upload metadata augmented with multipart-session details. */
export type RelationalResumableUploadData = RelationalUploadData & {
  /** Storage bucket that owns the resumable upload. */
  bucket: string;
  uploadId: string;
  parts: number;
  size: number;
};

/** Serializable multipart-session data used to resume an upload later. */
export type RelationalResumableUploadSession = {
  bucket: string;
/** Describes the public `path` value. */
  path: string;
/** Describes the public `uploadId` value. */
  uploadId: string;
/** Describes the public `expiresAt` value. */
  expiresAt: string | null;
};

/**
 * Describes an unsuccessful file operation, including its HTTP status and details.
 *
 * @example
 * ```ts
 * if (error instanceof RelationalStorageError) console.error(error.status);
 * ```
 */
export class RelationalStorageError extends Error {
/** Describes the public `status` value. */
  status: number;
/** Describes the public `code` value. */
  code?: string;
/** Describes the public `details` value. */
  details?: string;
/** Describes the public `hint` value. */
  hint?: string;

/**
 * Constructs a RelationalStorageError instance with the supplied configuration.
 *
 * @param message - A human-readable error message.
 * @param status - Optional HTTP status; defaults to 0.
 * @param details - Optional structured details for the error.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalStorageError } from "fusabase/relational";
 * const result = new RelationalStorageError(value, 0, { title: "Example" });
 * void result;
 * ```
 */
  constructor(message: string, status = 0, details?: Partial<RelationalStorageError>) {
    super(message);
    this.name = "RelationalStorageError";
    this.status = status;
    this.code = details?.code;
    this.details = details?.details;
    this.hint = details?.hint;
  }
}

type Method = "POST" | "PUT";
type Operation = "select" | "insert" | "upsert" | "update" | "delete" | "rpc";
type QueryPredicate = Record<string, unknown>;
type ResolvedRetryOptions = Required<RelationalRetryOptions>;
type OrderByItem = {
  column: string;
  path?: string;
  direction?: "ASC" | "DESC";
  nulls?: "FIRST" | "LAST";
  datatype?: string;
  maxLength?: number;
  sortByMinMax?: boolean;
};
type Qbe = {
  $query?: QueryPredicate;
  $orderby?: OrderByItem[];
  $limit?: number;
  $offset?: number;
  $asof?: Record<string, unknown>;
};

type RequestState = {
  app: App;
  object: string;
  schema?: string;
  headers: Headers;
  operation: Operation;
  columns: string[];
  projection: Projection;
  qbe: Qbe;
  rows?: unknown[];
  set?: unknown;
  args?: Record<string, unknown>;
  overload?: string;
  onConflict?: string;
  returnRows: boolean;
  maybeSingle?: boolean;
  throwOnError?: boolean;
  signal?: AbortSignal;
  retry?: ResolvedRetryOptions;
  cacheSource?: "default" | "cache";
  requireComplete?: boolean;
  mutationId?: string;
};

/** Represents a date value serialized for relational requests. */
export type BaasDateValue = { $date: string };

const DATE_TIME_STRING =
  /^\d{4}-\d{2}-\d{2}(?:(?:T|\s)\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

const DEFAULT_RETRY_OPTIONS: ResolvedRetryOptions = {
  enabled: true,
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
};

const RETRYABLE_DATABASE_STATUSES = new Set([408, 409, 503, 504, 520]);

function getApiVersion(app: App): "v1" | "v2" {
  return app.options.version === 1 ? "v1" : "v2";
}

function getBaseUrl(app: App): string {
  const host = app.options.ordsHost ?? "";
  const projectID = encodeURIComponent(app.options.projectID ?? "");
  return `${host}_/baas-services/database/${projectID}/${getApiVersion(app)}`;
}

function executionUrl(app: App, object: string): URL {
  return new URL(`${getBaseUrl(app)}/executions/${encodeURIComponent(object)}?apiKey=${app.options.appID}`);
}

function objectUrl(app: App, object: string): URL {
  return new URL(`${getBaseUrl(app)}/objects/${encodeURIComponent(object)}?apiKey=${app.options.appID}`);
}

async function getAccessToken(app: App): Promise<string | null> {
  try {
    const user = getAuthCore(app).currentUser;
    if (!user) return null;
    if (typeof user.getFUSABASEToken === "function") {
      return await user.getFUSABASEToken();
    }
    if (typeof user.getIdToken === "function") {
      return await user.getIdToken();
    }
  } catch {
    return null;
  }
  return null;
}

function cleanSelectColumns(columns = "*"): string[] {
  let quoted = false;
  const cleaned = columns
    .split("")
    .map((char) => {
      if (/\s/.test(char) && !quoted) return "";
      if (char === '"') quoted = !quoted;
      return char;
    })
    .join("");
  return cleaned.split(",").filter(Boolean);
}

function projectionFor(columns = "*"): Projection {
  return parseProjection(columns);
}

function toRows(values: unknown): unknown[] {
  return Array.isArray(values) ? values : [values];
}

function ensureQuery(state: RequestState): QueryPredicate {
  if (!state.qbe.$query) state.qbe.$query = {};
  return state.qbe.$query;
}

function appendPredicate(state: RequestState, predicate: QueryPredicate): void {
  const query = ensureQuery(state);
  if (Object.keys(query).length === 0) {
    Object.assign(query, predicate);
    return;
  }
  state.qbe.$query = { $and: [query, predicate] };
}

function operatorPredicate(column: string, operator: string, value: unknown): QueryPredicate {
  return createColumnPredicate(column, { [operator]: value });
}

const RANGE_NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

function unescapeRangeBound(value: string): string {
  let decoded = "";
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "\\" && index + 1 < value.length) {
      decoded += value[index + 1];
      index += 1;
    } else if (char === '"' && value[index + 1] === '"') {
      decoded += '"';
      index += 1;
    } else {
      decoded += char;
    }
  }
  return decoded;
}

function rangeBoundValue(value: string): string | number {
  const trimmed = value.trim();
  const startsQuoted = trimmed.startsWith('"');
  const endsQuoted = trimmed.endsWith('"');
  if (startsQuoted !== endsQuoted || (startsQuoted && trimmed.length < 2)) {
    throw new RelationalDatabaseError(`Invalid quoted range bound '${value}'`, 400);
  }
  const quoted = startsQuoted && endsQuoted;
  const decoded = unescapeRangeBound(quoted ? trimmed.slice(1, -1) : trimmed);

  if (!quoted && RANGE_NUMBER.test(decoded)) {
    const numeric = Number(decoded);
    if (Number.isFinite(numeric) && (!Number.isInteger(numeric) || Number.isSafeInteger(numeric))) {
      return numeric;
    }
  }
  return decoded;
}

/**
 * Converts a Postgres-style range literal to the bounded predicate supported
 * by BAAS QBE. The database payload serializer wraps date endpoints in $date.
 */
function rangeLiteralPredicate(column: string, range: string): QueryPredicate {
  const source = range.trim();
  if (source === "empty") {
    throw new RelationalDatabaseError(
      "The PostgreSQL 'empty' range cannot be represented as a BAAS bounded predicate",
      400
    );
  }
  const opening = source[0];
  const closing = source[source.length - 1];

  if ((opening !== "[" && opening !== "(") || (closing !== "]" && closing !== ")")) {
    throw new RelationalDatabaseError(
      `Invalid range '${range}'. Expected a value such as '[start,end)'`,
      400
    );
  }

  const contents = source.slice(1, -1);
  let separator = -1;
  let quoted = false;
  for (let index = 0; index < contents.length; index += 1) {
    if (contents[index] === "\\") {
      index += 1;
      continue;
    }
    if (contents[index] === '"') {
      if (quoted && contents[index + 1] === '"') {
        index += 1;
        continue;
      }
      quoted = !quoted;
      continue;
    }
    if (contents[index] === "," && !quoted) {
      separator = index;
      break;
    }
  }

  if (separator < 0 || quoted) {
    throw new RelationalDatabaseError(`Invalid range '${range}'`, 400);
  }

  const lower = contents.slice(0, separator).trim();
  const upper = contents.slice(separator + 1).trim();
  const operators: Record<string, unknown> = {};

  if (lower) {
    operators[opening === "[" ? "$gte" : "$gt"] = rangeBoundValue(lower);
  }
  if (upper) {
    operators[closing === "]" ? "$lte" : "$lt"] = rangeBoundValue(upper);
  }
  return Object.keys(operators).length === 0
    ? {}
    : createColumnPredicate(column, operators);
}

function appendRangePredicate(state: RequestState, column: string, range: string): void {
  const predicate = rangeLiteralPredicate(column, range);
  if (Object.keys(predicate).length > 0) appendPredicate(state, predicate);
}

function isDateTimeString(value: string): boolean {
  return DATE_TIME_STRING.test(value) && !Number.isNaN(Date.parse(value));
}

/** Converts database date values to the BAAS JSON date representation. */
function encodeDatabaseDates(value: unknown, ancestors = new WeakSet<object>()): unknown {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new RelationalDatabaseError("Invalid Date value", 400);
    }
    return { $date: value.toISOString() } satisfies BaasDateValue;
  }

  if (typeof value === "string") {
    return isDateTimeString(value) ? { $date: value } satisfies BaasDateValue : value;
  }

  if (!value || typeof value !== "object") return value;

  if (ancestors.has(value)) {
    throw new RelationalDatabaseError("Database payload cannot contain circular values", 400);
  }

  if (Array.isArray(value)) {
    ancestors.add(value);
    const encoded = value.map((item) => encodeDatabaseDates(item, ancestors));
    ancestors.delete(value);
    return encoded;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;

  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length === 1 &&
    typeof record.$date === "string"
  ) {
    return value;
  }

  ancestors.add(value);
  const encoded = Object.fromEntries(
    Object.entries(record).map(([key, item]) => [key, encodeDatabaseDates(item, ancestors)])
  );
  ancestors.delete(value);
  return encoded;
}

function resolveDatabaseRetryOptions(
  options: boolean | RelationalRetryOptions
): ResolvedRetryOptions {
  if (typeof options === "boolean") {
    return { ...DEFAULT_RETRY_OPTIONS, enabled: options };
  }

  const resolved = { ...DEFAULT_RETRY_OPTIONS, ...options };
  if (!Number.isSafeInteger(resolved.maxRetries) || resolved.maxRetries < 0) {
    throw new RelationalDatabaseError("maxRetries must be a non-negative integer", 400);
  }
  if (!Number.isFinite(resolved.initialDelayMs) || resolved.initialDelayMs < 0) {
    throw new RelationalDatabaseError("initialDelayMs must be a non-negative number", 400);
  }
  if (!Number.isFinite(resolved.maxDelayMs) || resolved.maxDelayMs < 0) {
    throw new RelationalDatabaseError("maxDelayMs must be a non-negative number", 400);
  }
  return resolved;
}

function retryDelayMs(attempt: number, options: ResolvedRetryOptions): number {
  const exponential = Math.min(
    options.initialDelayMs * 2 ** Math.max(0, attempt - 1),
    options.maxDelayMs
  );
  return exponential * (0.5 + Math.random() * 0.5);
}

function waitForDatabaseRetry(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException("Request aborted", "AbortError"));
  }
  if (ms <= 0) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeout);
      reject(new DOMException("Request aborted", "AbortError"));
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function cloneState(state: RequestState): RequestState {
  return {
    ...state,
    headers: new Headers(state.headers),
    columns: [...state.columns],
    projection: structuredClone(state.projection),
    qbe: {
      ...state.qbe,
      $query: state.qbe.$query ? structuredClone(state.qbe.$query) : undefined,
      $orderby: state.qbe.$orderby ? [...state.qbe.$orderby] : undefined,
      $asof: state.qbe.$asof ? { ...state.qbe.$asof } : undefined,
    },
    retry: state.retry ? { ...state.retry } : undefined,
    rows: state.rows ? [...state.rows] : undefined,
    args: state.args ? { ...state.args } : undefined,
  };
}

function compactQbe(qbe: Qbe): Qbe | undefined {
  const out: Qbe = {};
  if (qbe.$query && Object.keys(qbe.$query).length > 0) out.$query = qbe.$query;
  if (qbe.$orderby && qbe.$orderby.length > 0) out.$orderby = qbe.$orderby;
  if (qbe.$limit !== undefined) out.$limit = qbe.$limit;
  if (qbe.$offset !== undefined) out.$offset = qbe.$offset;
  if (qbe.$asof) out.$asof = qbe.$asof;
  return Object.keys(out).length > 0 ? out : undefined;
}

async function parseError(res: Response): Promise<RelationalDatabaseError> {
  const body = await res.text();
  if (!body) return new RelationalDatabaseError(res.statusText, res.status);

  try {
    const parsed = JSON.parse(body);
    return new RelationalDatabaseError(parsed.error ?? parsed.message ?? body, res.status, {
      code: parsed.code,
      details: parsed.details,
      hint: parsed.hint,
    });
  } catch {
    return new RelationalDatabaseError(body, res.status);
  }
}

async function parseStorageError(res: Response): Promise<RelationalStorageError> {
  const body = await res.text();
  if (!body) return new RelationalStorageError(res.statusText, res.status);

  try {
    const parsed = JSON.parse(body);
    return new RelationalStorageError(parsed.error ?? parsed.message ?? body, res.status, {
      code: parsed.code,
      details: parsed.details,
      hint: parsed.hint,
    });
  } catch {
    return new RelationalStorageError(body, res.status);
  }
}

function normalizeStorageError(error: unknown): RelationalStorageError {
  if (error instanceof RelationalStorageError) return error;
  if (error instanceof Error) {
    const status = typeof (error as Error & { status?: unknown }).status === "number"
      ? (error as Error & { status: number }).status
      : 0;
    return new RelationalStorageError(error.message, status);
  }
  return new RelationalStorageError(String(error));
}

function ensureStorageName(value: string, label: string): void {
  if (!value || value.trim() === "") {
    throw new RelationalStorageError(`Invalid ${label}`, 400);
  }
}

function encodeStoragePath(path: string): string {
  const segments = path
    .split("/")
    .filter((part) => part.length > 0);
  if (segments.some((part) => part === "." || part === "..")) {
    throw new RelationalStorageError("Invalid storage path", 400);
  }
  return segments.map((part) => encodeURIComponent(part)).join("/");
}

function normalizeStoragePath(path: string): string {
  return path.replace(/^\/+/, "").replace(/\/+$/, "");
}

function getStorageBaseUrl(app: App, bucket: string): URL {
  const host = app.options.ordsHost ?? "";
  const projectID = encodeURIComponent(app.options.projectID ?? "");
  return new URL(`${host}_/baas-services/storage/${projectID}/b/${encodeURIComponent(bucket)}/`);
}

function storageObjectUrl(app: App, bucket: string, path: string): URL {
  const url = getStorageBaseUrl(app, bucket);
  url.pathname = `${url.pathname}o/${encodeStoragePath(path)}`;
  url.searchParams.set("apiKey", app.options.appID ?? "");
  return url;
}

function storageDirUrl(app: App, bucket: string, path: string): URL {
  const url = getStorageBaseUrl(app, bucket);
  const normalizedPath = normalizeStoragePath(path);
  url.pathname = normalizedPath
    ? `${url.pathname}dir/${encodeStoragePath(normalizedPath)}`
    : `${url.pathname}dir/`;
  url.searchParams.set("apiKey", app.options.appID ?? "");
  return url;
}

function storageParUrl(app: App, bucket: string): URL {
  const url = getStorageBaseUrl(app, bucket);
  url.pathname = `${url.pathname}par`;
  url.searchParams.set("apiKey", app.options.appID ?? "");
  return url;
}

function storageMultipartUrl(app: App, bucket: string, path: string): URL {
  const url = getStorageBaseUrl(app, bucket);
  url.pathname = `${url.pathname}u/${encodeStoragePath(path)}`;
  url.searchParams.set("apiKey", app.options.appID ?? "");
  return url;
}

function storageParObjectUrl(app: App, bucket: string, parId: string, path: string): URL {
  const url = getStorageBaseUrl(app, bucket);
  url.pathname = `${url.pathname}par/${encodeURIComponent(parId)}/o/${encodeStoragePath(path)}`;
  url.searchParams.set("apiKey", app.options.appID ?? "");
  return url;
}

async function storageHeaders(
  app: App,
  init: Record<string, string> = {},
  json = false
): Promise<Headers> {
  const headers = new Headers(init);
  headers.set("apikey", app.options.appID ?? "");
  if (json) headers.set("Content-Type", "application/json");

  const token = await getAccessToken(app);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

async function parseJsonResponse<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  return text ? JSON.parse(text) as T : null;
}

function basename(path: string): string {
  const normalized = normalizeStoragePath(path);
  const tokens = normalized.split("/");
  return tokens[tokens.length - 1] ?? normalized;
}

function lowerField(source: Record<string, unknown>, lower: string, upper: string): unknown {
  return source[lower] ?? source[upper];
}

function toFileObject(item: unknown, directory = ""): RelationalFileObject {
  if (typeof item === "string") {
    return {
      name: basename(item),
      id: null,
      updated_at: null,
      created_at: null,
      last_accessed_at: null,
      metadata: null,
    };
  }

  const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
  const objectName = String(lowerField(row, "object_name", "OBJECT_NAME") ?? "");
  const fullName = objectName || directory;
  const updated = lowerField(row, "oci_time_modified", "OCI_TIME_MODIFIED");
  const created = lowerField(row, "oci_time_created", "OCI_TIME_CREATED");
  const metadata = lowerField(row, "metadata_json", "METADATA_JSON");

  return {
    name: basename(fullName),
    id: String(lowerField(row, "etag", "ETAG") ?? fullName),
    updated_at: typeof updated === "string" ? updated : null,
    created_at: typeof created === "string" ? created : null,
    last_accessed_at: null,
    metadata: {
      size: lowerField(row, "object_size", "OBJECT_SIZE") ?? null,
      mimetype: lowerField(row, "content_type", "CONTENT_TYPE") ?? null,
      cacheControl: lowerField(row, "cache_control", "CACHE_CONTROL") ?? null,
      eTag: lowerField(row, "etag", "ETAG") ?? null,
      md5Hash: lowerField(row, "content_md5_hash", "CONTENT_MD5_HASH") ?? null,
      customMetadata: metadata && typeof metadata === "object" ? metadata : {},
    },
  };
}

function toUploadData(bucket: string, path: string, body: Record<string, unknown> | null): RelationalUploadData {
  const responsePath = typeof body?.name === "string" ? body.name : path;
  return {
    path: responsePath,
    id: responsePath,
    fullPath: `${bucket}/${responsePath}`,
  };
}

function isBlobLike(value: unknown): value is Blob {
  return typeof Blob !== "undefined" && value instanceof Blob;
}

function resumableBodySize(body: RelationalResumableUploadBody): number {
  if (isBlobLike(body)) return body.size;
  if (body instanceof ArrayBuffer || body instanceof Uint8Array) {
    return body.byteLength;
  }
  throw new RelationalStorageError(
    "Invalid resumable upload body. Expected a Blob, ArrayBuffer, or Uint8Array; fetch imported asset URLs before uploading",
    400
  );
}

function resumableBodyChunk(
  body: RelationalResumableUploadBody,
  start: number,
  end: number
): BodyInit {
  if (isBlobLike(body)) return body.slice(start, end);
  if (body instanceof Uint8Array) {
    return body.buffer.slice(body.byteOffset + start, body.byteOffset + end) as ArrayBuffer;
  }
  return body.slice(start, end);
}

function resolveResumableChunkSize(app: App, chunkSize?: number): number {
  const resolved = chunkSize ?? app.options.chunkSize ?? 6 * 1024 * 1024;
  if (!Number.isSafeInteger(resolved) || resolved <= 0) {
    throw new RelationalStorageError("Invalid resumable upload chunk size", 400);
  }
  return resolved;
}

function resolveRetryDelays(retryDelays?: number[]): number[] {
  return retryDelays ?? [0, 3000, 5000, 10000, 20000];
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new RelationalStorageError("Upload aborted", 0));
      return;
    }
    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timeout);
      reject(new RelationalStorageError("Upload aborted", 0));
    }, { once: true });
  });
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new RelationalStorageError("Upload aborted", 0);
  }
}

/**
 * Controls a multipart upload that can be paused, resumed, or aborted.
 *
 * @example
 * ```ts
 * const task = client.storage.from("media").createResumableUploadTask("clip.mp4", file);
 * const result = await task.start();
 * ```
 */
export class RelationalResumableUploadTask {
  private controller: AbortController | null = null;
  private uploadPromise: Promise<RelationalStorageResponse<RelationalResumableUploadData>> | null = null;
  private uploadIdValue: string | null = null;
  private bytesTransferredValue = 0;
  private totalBytesValue: number;
  private stateValue: RelationalResumableUploadTaskState = "idle";
  private readonly chunkSizeValue: number;

/**
 * Constructs a RelationalResumableUploadTask instance with the supplied configuration.
 *
 * @param storage - The Storage instance to use.
 * @param path - The relative resource path.
 * @param fileBody - The fileBody accepted by this operation.
 * @param options - Optional settings that change this operation.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalResumableUploadTask } from "fusabase/relational";
 * const result = new RelationalResumableUploadTask(value, "example", value, value);
 * void result;
 * ```
 */
  constructor(
    private readonly storage: RelationalStorageFileApi,
    readonly path: string,
    private readonly fileBody: RelationalResumableUploadBody,
    private readonly options: RelationalResumableUploadTaskOptions = {}
  ) {
    this.totalBytesValue = resumableBodySize(fileBody);
    this.chunkSizeValue = resolveResumableChunkSize(storage.app, options.chunkSize);
    this.uploadIdValue = options.uploadId ?? null;
  }

  /** The current task lifecycle state. */
  get state(): RelationalResumableUploadTaskState {
    return this.stateValue;
  }

  /** The server upload identifier after a session is created. */
  get uploadId(): string | null {
    return this.uploadIdValue;
  }

  /** Number of bytes transferred so far. */
  get bytesTransferred(): number {
    return this.bytesTransferredValue;
  }

  /** Total number of bytes in the source body. */
  get totalBytes(): number {
    return this.totalBytesValue;
  }

  private setState(state: RelationalResumableUploadTaskState): void {
    this.stateValue = state;
    this.options.onStateChange?.(state);
  }

  private nextPart(): number {
    return Math.floor(this.bytesTransferredValue / this.chunkSizeValue) + 1;
  }

/**
 * Executes the start operation for this public SDK type.
 *
 * @returns The result produced by `start`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalResumableUploadTask } from "fusabase/relational";
 * const result = client.start();
 * void result;
 * ```
 */
  async start(): Promise<RelationalStorageResponse<RelationalResumableUploadData>> {
    if (this.stateValue === "running") {
      return this.uploadPromise ?? {
        data: null,
        error: new RelationalStorageError("Resumable upload is already running", 400),
      };
    }

    if (this.stateValue === "success") {
      return {
        data: null,
        error: new RelationalStorageError("Resumable upload already completed", 400),
      };
    }

    if (!this.uploadIdValue) {
      const session = await this.storage.createResumableUpload(this.path, this.options);
      if (session.error || !session.data) {
        this.setState("error");
        return { data: null, error: session.error ?? new RelationalStorageError("Unable to create upload session", 500) };
      }
      this.uploadIdValue = session.data.uploadId;
    }

    this.controller = new AbortController();
    this.setState("running");

    const runOptions: RelationalResumableUploadOptions = {
      ...this.options,
      uploadId: this.uploadIdValue,
      startPart: this.nextPart(),
      signal: this.controller.signal,
      onProgress: (uploaded, total) => {
        this.bytesTransferredValue = uploaded;
        this.totalBytesValue = total;
        this.options.onProgress?.(uploaded, total);
      },
      onError: (error) => {
        if (this.stateValue !== "paused" && this.stateValue !== "aborted") {
          this.options.onError?.(error);
        }
      },
      onSuccess: (data) => {
        this.setState("success");
        this.options.onSuccess?.(data);
      },
    };

    this.uploadPromise = this.storage.uploadResumable(this.path, this.fileBody, runOptions)
      .then((result) => {
        if (result.error && this.stateValue !== "paused" && this.stateValue !== "aborted") {
          this.setState("error");
        }
        return result;
      });

    return this.uploadPromise;
  }

/**
 * Executes the pause operation for this public SDK type.
 *
 * @returns The result produced by `pause`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalResumableUploadTask } from "fusabase/relational";
 * const result = client.pause();
 * void result;
 * ```
 */
  pause(): RelationalResumableUploadSession | null {
    if (this.stateValue !== "running") return this.snapshot();
    this.setState("paused");
    this.controller?.abort();
    return this.snapshot();
  }

/**
 * Executes the resume operation for this public SDK type.
 *
 * @returns The result produced by `resume`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalResumableUploadTask } from "fusabase/relational";
 * const result = client.resume();
 * void result;
 * ```
 */
  resume(): Promise<RelationalStorageResponse<RelationalResumableUploadData>> {
    if (this.stateValue !== "paused" && this.stateValue !== "error" && this.stateValue !== "idle") {
      return Promise.resolve({
        data: null,
        error: new RelationalStorageError(`Cannot resume upload from ${this.stateValue} state`, 400),
      });
    }
    return this.start();
  }

/**
 * Executes the abort operation for this public SDK type.
 *
 * @returns The result produced by `abort`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalResumableUploadTask } from "fusabase/relational";
 * const result = client.abort();
 * void result;
 * ```
 */
  async abort(): Promise<RelationalStorageResponse<{ path: string; uploadId: string }>> {
    this.setState("aborted");
    this.controller?.abort();
    if (!this.uploadIdValue) {
      return {
        data: null,
        error: new RelationalStorageError("Resumable upload session has not been created", 400),
      };
    }
    return this.storage.abortResumableUpload(this.path, this.uploadIdValue);
  }

/**
 * Executes the snapshot operation for this public SDK type.
 *
 * @returns The result produced by `snapshot`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalResumableUploadTask } from "fusabase/relational";
 * const result = client.snapshot();
 * void result;
 * ```
 */
  snapshot(): RelationalResumableUploadSession | null {
    if (!this.uploadIdValue) return null;
    return {
      bucket: this.storage.bucketId,
      path: normalizeStoragePath(this.path),
      uploadId: this.uploadIdValue,
      expiresAt: null,
    };
  }
}

/**
 * Performs file operations within one storage bucket.
 *
 * @example
 * ```ts
 * const files = client.storage.from("avatars");
 * await files.upload("profile.png", file, { contentType: file.type });
 * ```
 */
export class RelationalStorageFileApi {
/**
 * Constructs a RelationalStorageFileApi instance with the supplied configuration.
 *
 * @param app - The app instance that owns this service.
 * @param bucketId - The bucketId accepted by this operation.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalStorageFileApi } from "fusabase/relational";
 * const result = new RelationalStorageFileApi(value, value);
 * void result;
 * ```
 */
  constructor(
    readonly app: App,
    readonly bucketId: string
  ) {}

  private async request<T>(
    run: () => Promise<T>
  ): Promise<RelationalStorageResponse<T>> {
    try {
      return { data: await run(), error: null };
    } catch (error) {
      return { data: null, error: normalizeStorageError(error) };
    }
  }

  private async checkedFetch(url: URL, init: RequestInit): Promise<Response> {
    const response = await fusabaseFetch(this.app, url.toString(), init);
    if (!response.ok) throw await parseStorageError(response);
    return response;
  }

  private async retryingFetch(
    url: URL,
    initFactory: () => RequestInit | Promise<RequestInit>,
    retryDelays: number[],
    signal?: AbortSignal
  ): Promise<Response> {
    let lastError: unknown = null;
    const attempts = Math.max(1, retryDelays.length);
    for (let attempt = 0; attempt < attempts; attempt++) {
      assertNotAborted(signal);
      if (attempt > 0) await sleep(retryDelays[attempt], signal);

      try {
        return await this.checkedFetch(url, await initFactory());
      } catch (error) {
        lastError = error;
        const normalized = normalizeStorageError(error);
        if (normalized.status > 0 && normalized.status < 500 && normalized.status !== 408 && normalized.status !== 429) {
          throw normalized;
        }
      }
    }
    throw normalizeStorageError(lastError);
  }

  /**
   * Uploads a new object at `path`.
   * @param path - Object path relative to this bucket.
   * @param fileBody - `BodyInit` value such as `Blob`, `File`, `FormData`,
   * `ArrayBuffer`, `Uint8Array`, or string.
   * @param fileOptions - `RelationalUploadOptions` object:
   * `{ contentType?: string, cacheControl?: string, upsert?: boolean,
   * metadata?: Record<string, string>, headers?: HeadersInit }`.
   * @returns A response containing object metadata or an operation error.
   * @example
   * ```ts
   * const result = await client.storage.from("avatars").upload("ada.png", file);
   * ```
   */
  upload(
    path: string,
    fileBody: BodyInit,
    fileOptions: RelationalUploadOptions = {}
  ): Promise<RelationalStorageResponse<RelationalUploadData>> {
    return this.request(async () => {
      const objectPath = normalizeStoragePath(path);
      ensureStorageName(objectPath, "storage path");

      const headers = await storageHeaders(this.app, fileOptions.headers);
      if (fileOptions.contentType) headers.set("Content-Type", fileOptions.contentType);
      if (fileOptions.cacheControl) headers.set("Cache-Control", fileOptions.cacheControl);

      const response = await this.checkedFetch(storageObjectUrl(this.app, this.bucketId, objectPath), {
        method: "POST",
        headers,
        body: fileBody,
      });
      const body = await parseJsonResponse<Record<string, unknown>>(response);
      return toUploadData(this.bucketId, objectPath, body);
    });
  }

/**
 * Executes the update operation for this public SDK type.
 *
 * @param path - The relative resource path.
 * @param fileBody - The fileBody accepted by this operation.
 * @param fileOptions - The fileOptions accepted by this operation.
 * @returns The result produced by `update`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalStorageFileApi } from "fusabase/relational";
 * const result = client.update("example", value, value);
 * void result;
 * ```
 */
  update(
    path: string,
    fileBody: BodyInit,
    fileOptions: RelationalFileOptions = {}
  ): Promise<RelationalStorageResponse<RelationalUploadData>> {
    return this.upload(path, fileBody, fileOptions);
  }

  /**
   * Downloads an object as a `Blob`.
   * @param path - Object path relative to this bucket.
   * @returns A response containing the downloaded bytes or an operation error.
   * @example
   * ```ts
   * const { data } = await client.storage.from("avatars").download("ada.png");
   * ```
   */
  download(path: string): Promise<RelationalStorageResponse<Blob>> {
    return this.request(async () => {
      const objectPath = normalizeStoragePath(path);
      ensureStorageName(objectPath, "storage path");
      const headers = await storageHeaders(this.app);
      const response = await this.checkedFetch(storageObjectUrl(this.app, this.bucketId, objectPath), {
        method: "GET",
        headers,
      });
      return response.blob();
    });
  }

/**
 * Executes the list operation for this public SDK type.
 *
 * @param path - The relative resource path.
 * @param options - Optional settings that change this operation.
 * @returns The result produced by `list`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalStorageFileApi } from "fusabase/relational";
 * const result = client.list("example", value);
 * void result;
 * ```
 */
  async list(
    path = "",
    options: RelationalSearchOptions = {}
  ): Promise<RelationalStorageResponse<RelationalFileObject[]>> {
    return this.request(async () => {
      const url = storageDirUrl(this.app, this.bucketId, path);
      if (options.limit !== undefined) url.searchParams.set("limit", String(options.limit));
      if (options.offset !== undefined) url.searchParams.set("pageToken", String(options.offset));
      const headers = await storageHeaders(this.app);
      const response = await this.checkedFetch(url, { method: "GET", headers });
      const body = await parseJsonResponse<{
        items?: unknown[];
        prefixes?: unknown[];
        nextPageToken?: string;
      }>(response);

      const files = (body?.items ?? []).map((item) => toFileObject(item, path));
      const prefixes = (body?.prefixes ?? []).map((prefix) => toFileObject(prefix, path));
      let result = [...prefixes, ...files];

      if (options.search) {
        result = result.filter((item) => item.name.includes(options.search as string));
      }
      if (options.sortBy?.column === "name") {
        const direction = options.sortBy.order === "desc" ? -1 : 1;
        result = [...result].sort((a, b) => a.name.localeCompare(b.name) * direction);
      }
      return result;
    });
  }

  /**
   * Deletes the objects at the supplied paths.
   * @param paths - `string[]` of paths relative to this bucket.
   * @returns A response containing removed-object metadata or an operation error.
   * @example
   * ```ts
   * await client.storage.from("avatars").remove(["old.png"]);
   * ```
   */
  remove(paths: string[]): Promise<RelationalStorageResponse<RelationalFileObject[]>> {
    return this.request(async () => {
      const removed: RelationalFileObject[] = [];
      for (const path of paths) {
        const objectPath = normalizeStoragePath(path);
        ensureStorageName(objectPath, "storage path");
        const headers = await storageHeaders(this.app);
        await this.checkedFetch(storageObjectUrl(this.app, this.bucketId, objectPath), {
          method: "DELETE",
          headers,
        });
        removed.push(toFileObject(objectPath));
      }
      return removed;
    });
  }

/**
 * Executes the createSignedUrl operation for this public SDK type.
 *
 * @param path - The relative resource path.
 * @param expiresIn - The expiresIn accepted by this operation.
 * @param options - Optional settings that change this operation.
 * @returns The result produced by `createSignedUrl`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalStorageFileApi } from "fusabase/relational";
 * const result = client.createSignedUrl("example", value, value);
 * void result;
 * ```
 */
  createSignedUrl(
    path: string,
    expiresIn: number,
    options: { download?: boolean | string } = {}
  ): Promise<RelationalStorageResponse<RelationalSignedUrlData>> {
    return this.request(async () => {
      const objectPath = normalizeStoragePath(path);
      ensureStorageName(objectPath, "storage path");
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
      const headers = await storageHeaders(this.app, {}, true);
      const response = await this.checkedFetch(storageParUrl(this.app, this.bucketId), {
        method: "POST",
        headers,
        body: JSON.stringify({
          path: objectPath,
          access_type: "ObjectRead",
          metadata: {},
          timeExpires: expiresAt,
        }),
      });
      const body = await parseJsonResponse<Record<string, unknown>>(response);
      const signedUrl = String(body?.URL ?? body?.url ?? "");
      if (!signedUrl) {
        throw new RelationalStorageError("Signed URL was not returned by the storage service", 500);
      }
      return {
        signedUrl,
        path: objectPath,
      };
    });
  }

/**
 * Executes the createSignedUrls operation for this public SDK type.
 *
 * @param paths - The paths accepted by this operation.
 * @param expiresIn - The expiresIn accepted by this operation.
 * @param options - Optional settings that change this operation.
 * @returns The result produced by `createSignedUrls`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalStorageFileApi } from "fusabase/relational";
 * const result = client.createSignedUrls("example", value, value);
 * void result;
 * ```
 */
  async createSignedUrls(
    paths: string[],
    expiresIn: number,
    options: { download?: boolean | string } = {}
  ): Promise<RelationalStorageResponse<RelationalSignedUrlData[]>> {
    return this.request(async () => {
      const urls: RelationalSignedUrlData[] = [];
      for (const path of paths) {
        const result = await this.createSignedUrl(path, expiresIn, options);
        if (result.error) throw result.error;
        if (result.data) urls.push(result.data);
      }
      return urls;
    });
  }

/**
 * Executes the createSignedUploadUrl operation for this public SDK type.
 *
 * @param path - The relative resource path.
 * @param options - Optional settings that change this operation.
 * @returns The result produced by `createSignedUploadUrl`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalStorageFileApi } from "fusabase/relational";
 * const result = client.createSignedUploadUrl("example", value);
 * void result;
 * ```
 */
  createSignedUploadUrl(
    path: string,
    options: { upsert?: boolean; metadata?: Record<string, unknown> } = {}
  ): Promise<RelationalStorageResponse<RelationalSignedUploadUrlData>> {
    return this.request(async () => {
      const objectPath = normalizeStoragePath(path);
      ensureStorageName(objectPath, "storage path");
      const headers = await storageHeaders(this.app, {}, true);
      const response = await this.checkedFetch(storageParUrl(this.app, this.bucketId), {
        method: "POST",
        headers,
        body: JSON.stringify({
          path: objectPath,
          access_type: "ObjectWrite",
          metadata: options.metadata ?? {},
        }),
      });
      const body = await parseJsonResponse<Record<string, unknown>>(response);
      const token = String(body?.PAR_ID ?? body?.parId ?? "");
      const signedUrl = String(body?.URL ?? body?.url ?? "");
      if (!token) {
        throw new RelationalStorageError("Signed upload token was not returned by the storage service", 500);
      }
      if (!signedUrl) {
        throw new RelationalStorageError("Signed upload URL was not returned by the storage service", 500);
      }
      return {
        signedUrl,
        path: objectPath,
        token,
      };
    });
  }

/**
 * Executes the uploadToSignedUrl operation for this public SDK type.
 *
 * @param path - The relative resource path.
 * @param token - The token accepted by this operation.
 * @param fileBody - The fileBody accepted by this operation.
 * @param fileOptions - The fileOptions accepted by this operation.
 * @returns The result produced by `uploadToSignedUrl`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalStorageFileApi } from "fusabase/relational";
 * const result = client.uploadToSignedUrl("example", value, value, value);
 * void result;
 * ```
 */
  uploadToSignedUrl(
    path: string,
    token: string,
    fileBody: BodyInit,
    fileOptions: RelationalFileOptions = {}
  ): Promise<RelationalStorageResponse<RelationalUploadData>> {
    return this.request(async () => {
      const objectPath = normalizeStoragePath(path);
      ensureStorageName(objectPath, "storage path");
      ensureStorageName(token, "signed upload token");

      const uploadUrl = storageParObjectUrl(this.app, this.bucketId, token, objectPath);

      const headers = await storageHeaders(this.app, fileOptions.headers);
      if (fileOptions.contentType) headers.set("Content-Type", fileOptions.contentType);
      if (fileOptions.cacheControl) headers.set("Cache-Control", fileOptions.cacheControl);

      await this.checkedFetch(uploadUrl, {
        method: "POST",
        headers,
        body: fileBody,
      });

      return toUploadData(this.bucketId, objectPath, { name: objectPath });
    });
  }

/**
 * Executes the createResumableUpload operation for this public SDK type.
 *
 * @param path - The relative resource path.
 * @param options - Optional settings that change this operation.
 * @returns The result produced by `createResumableUpload`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalStorageFileApi } from "fusabase/relational";
 * const result = client.createResumableUpload("example", value);
 * void result;
 * ```
 */
  createResumableUpload(
    path: string,
    options: RelationalUploadOptions = {}
  ): Promise<RelationalStorageResponse<RelationalResumableUploadSession>> {
    return this.request(async () => {
      const objectPath = normalizeStoragePath(path);
      ensureStorageName(objectPath, "storage path");

      const headers = await storageHeaders(this.app, options.headers);
      headers.set("opc-multipart", "true");
      if (options.contentType) headers.set("Content-Type", options.contentType);
      if (options.cacheControl) headers.set("Cache-Control", options.cacheControl);
      for (const [key, value] of Object.entries(options.metadata ?? {})) {
        headers.set(`opc-meta-${key}`, String(value));
      }
      if (options.upsert) headers.set("x-upsert", "true");

      const response = await this.checkedFetch(storageObjectUrl(this.app, this.bucketId, objectPath), {
        method: "POST",
        headers,
      });
      const body = await parseJsonResponse<Record<string, unknown>>(response);
      const uploadId = String(body?.uploadId ?? "");
      if (!uploadId) {
        throw new RelationalStorageError("Resumable upload id was not returned by the storage service", 500);
      }

      return {
        bucket: this.bucketId,
        path: objectPath,
        uploadId,
        expiresAt: null,
      };
    });
  }

/**
 * Executes the uploadResumable operation for this public SDK type.
 *
 * @param path - The relative resource path.
 * @param fileBody - The fileBody accepted by this operation.
 * @param options - Optional settings that change this operation.
 * @returns The result produced by `uploadResumable`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalStorageFileApi } from "fusabase/relational";
 * const result = client.uploadResumable("example", value, value);
 * void result;
 * ```
 */
  uploadResumable(
    path: string,
    fileBody: RelationalResumableUploadBody,
    options: RelationalResumableUploadOptions = {}
  ): Promise<RelationalStorageResponse<RelationalResumableUploadData>> {
    return this.request(async () => {
      const objectPath = normalizeStoragePath(path);
      ensureStorageName(objectPath, "storage path");

      const size = resumableBodySize(fileBody);
      if (size <= 0) throw new RelationalStorageError("Cannot upload an empty file", 400);

      const chunkSize = resolveResumableChunkSize(this.app, options.chunkSize);
      const totalParts = Math.ceil(size / chunkSize);
      const startPart = options.startPart ?? 1;
      if (!Number.isSafeInteger(startPart) || startPart < 1 || startPart > totalParts) {
        throw new RelationalStorageError("Invalid resumable upload start part", 400);
      }

      let session: RelationalResumableUploadSession | null;
      if (options.uploadId) {
        session = {
          bucket: this.bucketId,
          path: objectPath,
          uploadId: options.uploadId,
          expiresAt: null,
        };
      } else {
        const created = await this.createResumableUpload(objectPath, options);
        if (created.error) throw created.error;
        session = created.data;
      }

      if (!session) {
        throw new RelationalStorageError("Unable to create resumable upload session", 500);
      }

      const retryDelays = resolveRetryDelays(options.retryDelays);
      let bytesUploaded = Math.min((startPart - 1) * chunkSize, size);
      options.onProgress?.(bytesUploaded, size);

      try {
        for (let partNumber = startPart; partNumber <= totalParts; partNumber++) {
          assertNotAborted(options.signal);
          const start = (partNumber - 1) * chunkSize;
          const end = Math.min(start + chunkSize, size);
          const partUrl = storageMultipartUrl(this.app, this.bucketId, objectPath);
          partUrl.searchParams.set("uploadId", session.uploadId);
          partUrl.searchParams.set("part", String(partNumber));

          await this.retryingFetch(partUrl, async () => {
            const headers = await storageHeaders(this.app, options.headers);
            if (options.contentType) headers.set("Content-Type", options.contentType);
            if (options.cacheControl) headers.set("Cache-Control", options.cacheControl);
            if (options.upsert) headers.set("x-upsert", "true");
            return {
              method: "PUT",
              headers,
              signal: options.signal,
              body: resumableBodyChunk(fileBody, start, end),
            };
          }, retryDelays, options.signal);

          bytesUploaded = end;
          options.onProgress?.(bytesUploaded, size);
        }

        const committed = await this.commitResumableUpload(objectPath, session.uploadId);
        if (committed.error) throw committed.error;
      } catch (error) {
        const normalized = normalizeStorageError(error);
        options.onError?.(normalized);
        throw normalized;
      }

      const data: RelationalResumableUploadData = {
        ...toUploadData(this.bucketId, objectPath, { name: objectPath }),
        bucket: this.bucketId,
        uploadId: session.uploadId,
        parts: totalParts,
        size,
      };
      options.onSuccess?.(data);
      return data;
    });
  }

/**
 * Executes the resumeUpload operation for this public SDK type.
 *
 * @param path - The relative resource path.
 * @param uploadId - The uploadId accepted by this operation.
 * @param fileBody - The fileBody accepted by this operation.
 * @param options - Optional settings that change this operation.
 * @returns The result produced by `resumeUpload`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalStorageFileApi } from "fusabase/relational";
 * const result = client.resumeUpload("example", value, value, value);
 * void result;
 * ```
 */
  resumeUpload(
    path: string,
    uploadId: string,
    fileBody: RelationalResumableUploadBody,
    options: Omit<RelationalResumableUploadOptions, "uploadId"> = {}
  ): Promise<RelationalStorageResponse<RelationalResumableUploadData>> {
    return this.uploadResumable(path, fileBody, { ...options, uploadId });
  }

/**
 * Executes the createResumableUploadTask operation for this public SDK type.
 *
 * @param path - The relative resource path.
 * @param fileBody - The fileBody accepted by this operation.
 * @param options - Optional settings that change this operation.
 * @returns The result produced by `createResumableUploadTask`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalStorageFileApi } from "fusabase/relational";
 * const result = client.createResumableUploadTask("example", value, value);
 * void result;
 * ```
 */
  createResumableUploadTask(
    path: string,
    fileBody: RelationalResumableUploadBody,
    options: RelationalResumableUploadTaskOptions = {}
  ): RelationalResumableUploadTask {
    return new RelationalResumableUploadTask(this, path, fileBody, options);
  }

/**
 * Executes the commitResumableUpload operation for this public SDK type.
 *
 * @param path - The relative resource path.
 * @param uploadId - The uploadId accepted by this operation.
 * @returns The result produced by `commitResumableUpload`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalStorageFileApi } from "fusabase/relational";
 * const result = client.commitResumableUpload("example", value);
 * void result;
 * ```
 */
  commitResumableUpload(
    path: string,
    uploadId: string
  ): Promise<RelationalStorageResponse<RelationalUploadData>> {
    return this.request(async () => {
      const objectPath = normalizeStoragePath(path);
      ensureStorageName(objectPath, "storage path");
      ensureStorageName(uploadId, "resumable upload id");

      const url = storageMultipartUrl(this.app, this.bucketId, objectPath);
      url.searchParams.set("uploadId", uploadId);
      await this.checkedFetch(url, {
        method: "POST",
        headers: await storageHeaders(this.app),
      });

      return toUploadData(this.bucketId, objectPath, { name: objectPath });
    });
  }

/**
 * Executes the abortResumableUpload operation for this public SDK type.
 *
 * @param path - The relative resource path.
 * @param uploadId - The uploadId accepted by this operation.
 * @returns The result produced by `abortResumableUpload`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalStorageFileApi } from "fusabase/relational";
 * const result = client.abortResumableUpload("example", value);
 * void result;
 * ```
 */
  abortResumableUpload(
    path: string,
    uploadId: string
  ): Promise<RelationalStorageResponse<{ path: string; uploadId: string }>> {
    return this.request(async () => {
      const objectPath = normalizeStoragePath(path);
      ensureStorageName(objectPath, "storage path");
      ensureStorageName(uploadId, "resumable upload id");

      const url = storageMultipartUrl(this.app, this.bucketId, objectPath);
      url.searchParams.set("uploadId", uploadId);
      await this.checkedFetch(url, {
        method: "DELETE",
        headers: await storageHeaders(this.app),
      });

      return { path: objectPath, uploadId };
    });
  }

/**
 * Executes the getPublicUrl operation for this public SDK type.
 *
 * @param path - The relative resource path.
 * @param expiresIn - The expiresIn accepted by this operation.
 * @returns The result produced by `getPublicUrl`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalStorageFileApi } from "fusabase/relational";
 * const result = client.getPublicUrl("example", value);
 * void result;
 * ```
 */
  async getPublicUrl(
    path: string,
    expiresIn = 60 * 60
  ): Promise<RelationalStorageResponse<RelationalPublicUrlData>> {
    const result = await this.createSignedUrl(path, expiresIn);
    if (result.error || !result.data) {
      return { data: null, error: result.error };
    }
    return { data: { publicUrl: result.data.signedUrl }, error: null };
  }

/**
 * Executes the exists operation for this public SDK type.
 *
 * @param path - The relative resource path.
 * @returns The result produced by `exists`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalStorageFileApi } from "fusabase/relational";
 * const result = client.exists("example");
 * void result;
 * ```
 */
  exists(path: string): Promise<RelationalStorageResponse<boolean>> {
    return this.request(async () => {
      const objectPath = normalizeStoragePath(path);
      ensureStorageName(objectPath, "storage path");
      const url = storageObjectUrl(this.app, this.bucketId, objectPath);
      url.searchParams.set("metadata_only", "true");
      const headers = await storageHeaders(this.app);
      const response = await fusabaseFetch(this.app, url.toString(), {
        method: "GET",
        headers,
      });
      if (response.status === 404) return false;
      if (!response.ok) throw await parseStorageError(response);
      return true;
    });
  }

/**
 * Executes the info operation for this public SDK type.
 *
 * @param path - The relative resource path.
 * @returns The result produced by `info`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalStorageFileApi } from "fusabase/relational";
 * const result = client.info("example");
 * void result;
 * ```
 */
  info(path: string): Promise<RelationalStorageResponse<RelationalFileObject>> {
    return this.getMetadata(path);
  }

/**
 * Executes the getMetadata operation for this public SDK type.
 *
 * @param path - The relative resource path.
 * @returns The result produced by `getMetadata`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalStorageFileApi } from "fusabase/relational";
 * const result = client.getMetadata("example");
 * void result;
 * ```
 */
  getMetadata(path: string): Promise<RelationalStorageResponse<RelationalFileObject>> {
    return this.request(async () => {
      const objectPath = normalizeStoragePath(path);
      ensureStorageName(objectPath, "storage path");
      const url = storageObjectUrl(this.app, this.bucketId, objectPath);
      url.searchParams.set("metadata_only", "true");
      const headers = await storageHeaders(this.app);
      const response = await this.checkedFetch(url, { method: "GET", headers });
      const body = await parseJsonResponse<Record<string, unknown>>(response);
      return toFileObject(body, objectPath);
    });
  }
}

/**
 * Provides access to bucket-scoped file APIs.
 *
 * @example
 * ```ts
 * const files = client.storage.from("media");
 * ```
 */
export class RelationalStorageClient {
/**
 * Constructs a RelationalStorageClient instance with the supplied configuration.
 *
 * @param app - The app instance that owns this service.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalStorageClient } from "fusabase/relational";
 * const result = new RelationalStorageClient(value);
 * void result;
 * ```
 */
  constructor(private readonly app: App) {}

  /**
   * Returns a file API scoped to `bucketId`.
   * @param bucketId - Name of the target bucket.
   * @returns A bucket-scoped file API.
   * @example
   * ```ts
   * const files = client.storage.from("avatars");
   * ```
   */
  from(bucketId: string): RelationalStorageFileApi {
    ensureStorageName(bucketId, "bucket");
    return new RelationalStorageFileApi(this.app, bucketId);
  }
}

function normalizeData(body: unknown): unknown {
  if (body && typeof body === "object") {
    const response = body as { items?: unknown; data?: unknown; Data?: unknown };
    // Object endpoints return `items`; relational execution endpoints may use
    // either `data` or `Data`, depending on the ORDS response contract.
    if ("items" in response) return response.items;
    if ("data" in response) return response.data;
    if ("Data" in response) return response.Data;
  }
  return body;
}

/**
 * Builds an awaitable filtered data request. Each modifier returns this builder,
 * allowing calls to be chained until it is awaited.
 *
 * @example
 * ```ts
 * const { data, error } = await client.from("tasks").select().eq("done", false);
 * ```
 */
export class RelationalFilterBuilder<Result = unknown> implements PromiseLike<RelationalResponse<Result>> {
  protected state: RequestState;

/**
 * Constructs a RelationalFilterBuilder instance with the supplied configuration.
 *
 * @param state - The state accepted by this operation.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = new RelationalFilterBuilder(value);
 * void result;
 * ```
 */
  constructor(state: RequestState) {
    this.state = state;
  }

  /**
   * Selects the returned columns.
   * @param columns - Comma-separated projection string, or `"*"` for all columns.
   * @param options - `{ head?: boolean, count?: "exact" | "planned" |
   * "estimated" }` request preferences.
   * @returns This builder for further filtering or awaiting.
   * @example
   * ```ts
   * const result = await client.from("tasks").select("id,title").eq("done", false);
   * ```
   */
  select(columns = "*", options: { head?: boolean; count?: CountPreference } = {}): this {
    void options;
    this.state.columns = cleanSelectColumns(columns);
    this.state.projection = projectionFor(columns);
    if (this.state.operation !== "select") {
      this.state.returnRows = true;
    }
    return this;
  }

  /**
   * Keeps rows whose column equals `value`.
   * @param column - Column name or nested path.
   * @param value - String, number, boolean, `null`, date, array, or object to compare.
   * @returns This builder.
   * @example
   * ```ts
   * const result = await client.from("tasks").select().eq("id", 1);
   * ```
   */
  eq(column: string, value: unknown): this {
    appendPredicate(this.state, operatorPredicate(column, "$eq", value));
    return this;
  }

/**
 * Executes the neq operation for this public SDK type.
 *
 * @param column - The column accepted by this operation.
 * @param value - The value to store or transform.
 * @returns The result produced by `neq`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.neq(value, { title: "Example" });
 * void result;
 * ```
 */
  neq(column: string, value: unknown): this {
    appendPredicate(this.state, operatorPredicate(column, "$ne", value));
    return this;
  }

/**
 * Executes the gt operation for this public SDK type.
 *
 * @param column - The column accepted by this operation.
 * @param value - The value to store or transform.
 * @returns The result produced by `gt`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.gt(value, { title: "Example" });
 * void result;
 * ```
 */
  gt(column: string, value: unknown): this {
    appendPredicate(this.state, operatorPredicate(column, "$gt", value));
    return this;
  }

/**
 * Executes the gte operation for this public SDK type.
 *
 * @param column - The column accepted by this operation.
 * @param value - The value to store or transform.
 * @returns The result produced by `gte`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.gte(value, { title: "Example" });
 * void result;
 * ```
 */
  gte(column: string, value: unknown): this {
    appendPredicate(this.state, operatorPredicate(column, "$gte", value));
    return this;
  }

/**
 * Executes the lt operation for this public SDK type.
 *
 * @param column - The column accepted by this operation.
 * @param value - The value to store or transform.
 * @returns The result produced by `lt`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.lt(value, { title: "Example" });
 * void result;
 * ```
 */
  lt(column: string, value: unknown): this {
    appendPredicate(this.state, operatorPredicate(column, "$lt", value));
    return this;
  }

/**
 * Executes the lte operation for this public SDK type.
 *
 * @param column - The column accepted by this operation.
 * @param value - The value to store or transform.
 * @returns The result produced by `lte`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.lte(value, { title: "Example" });
 * void result;
 * ```
 */
  lte(column: string, value: unknown): this {
    appendPredicate(this.state, operatorPredicate(column, "$lte", value));
    return this;
  }

/**
 * Executes the like operation for this public SDK type.
 *
 * @param column - The column accepted by this operation.
 * @param pattern - The pattern accepted by this operation.
 * @returns The result produced by `like`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.like(value, value);
 * void result;
 * ```
 */
  like(column: string, pattern: string): this {
    appendPredicate(this.state, operatorPredicate(column, "$like", pattern));
    return this;
  }

/**
 * Executes the ilike operation for this public SDK type.
 *
 * @param column - The column accepted by this operation.
 * @param pattern - The pattern accepted by this operation.
 * @returns The result produced by `ilike`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.ilike(value, value);
 * void result;
 * ```
 */
  ilike(column: string, pattern: string): this {
    appendPredicate(this.state, operatorPredicate(column, "$ilike", pattern));
    return this;
  }

  /** Matches a column case-insensitively against every supplied pattern. */
/**
 * Executes the ilikeAllOf operation for this public SDK type.
 *
 * @param column - The column accepted by this operation.
 * @param patterns - The patterns accepted by this operation.
 * @returns The result produced by `ilikeAllOf`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.ilikeAllOf(value, value);
 * void result;
 * ```
 */
  ilikeAllOf(column: string, patterns: readonly string[]): this {
    appendPredicate(this.state, {
      $and: patterns.map((pattern) => operatorPredicate(column, "$ilike", pattern)),
    });
    return this;
  }

  /** Matches a column case-insensitively against at least one supplied pattern. */
/**
 * Executes the ilikeAnyOf operation for this public SDK type.
 *
 * @param column - The column accepted by this operation.
 * @param patterns - The patterns accepted by this operation.
 * @returns The result produced by `ilikeAnyOf`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.ilikeAnyOf(value, value);
 * void result;
 * ```
 */
  ilikeAnyOf(column: string, patterns: readonly string[]): this {
    appendPredicate(this.state, {
      $or: patterns.map((pattern) => operatorPredicate(column, "$ilike", pattern)),
    });
    return this;
  }

/**
 * Executes the is operation for this public SDK type.
 *
 * @param column - The column accepted by this operation.
 * @param value - The value to store or transform.
 * @returns The result produced by `is`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.is(value, { title: "Example" });
 * void result;
 * ```
 */
  is(column: string, value: boolean | null): this {
    const op = value === null ? "$exists" : "$eq";
    // ORDS interprets `$exists: false` as a SQL NULL check.
    appendPredicate(this.state, operatorPredicate(column, op, value === null ? false : value));
    return this;
  }

/**
 * Executes the in operation for this public SDK type.
 *
 * @param column - The column accepted by this operation.
 * @param values - The values to store or transform.
 * @returns The result produced by `in`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.in(value, { title: "Example" });
 * void result;
 * ```
 */
  in(column: string, values: readonly unknown[]): this {
    appendPredicate(this.state, operatorPredicate(column, "$in", [...values]));
    return this;
  }

/**
 * Executes the contains operation for this public SDK type.
 *
 * @param column - The column accepted by this operation.
 * @param value - The value to store or transform.
 * @returns The result produced by `contains`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.contains("tags", ["oracle", "database"]);
 * void result;
 * ```
 */
  contains(column: string, value: readonly unknown[]): this {
    appendPredicate(this.state, operatorPredicate(column, "$all", [...value]));
    return this;
  }

/**
 * Executes the containedBy operation for this public SDK type.
 *
 * @param column - The column accepted by this operation.
 * @param value - The value to store or transform.
 * @returns Nothing; this method throws because the current backend does not
 * support contained-by filters.
 */
  containedBy(column: string, value: string | readonly unknown[] | Record<string, unknown>): this {
    throw new RelationalDatabaseError("containedBy() is not supported", 400, { code: "unsupported" });
  }

/**
 * Executes the overlaps operation for this public SDK type.
 *
 * @param column - The column accepted by this operation.
 * @param value - The value to store or transform.
 * @returns The result produced by `overlaps`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.overlaps("tags", ["oracle", "database"]);
 * void result;
 * ```
 */
  overlaps(column: string, value: string | readonly unknown[]): this {
    if (typeof value === "string") {
      throw new RelationalDatabaseError("overlaps() does not support range values", 400, { code: "unsupported" });
    }
    appendPredicate(this.state, operatorPredicate(column, "$in", [...value]));
    return this;
  }

/**
 * Executes the rangeAdjacent operation for this public SDK type.
 *
 * @param column - The column accepted by this operation.
 * @param range - The range accepted by this operation.
 * @returns Nothing; this method throws because the current backend does not
 * support range-adjacent filters.
 */
  rangeAdjacent(column: string, range: string): this {
    throw new RelationalDatabaseError("rangeAdjacent() is not supported", 400, { code: "unsupported" });
  }

/**
 * Executes the rangeGt operation for this public SDK type.
 *
 * @param column - The column accepted by this operation.
 * @param range - The range accepted by this operation.
 * @returns Nothing; this method throws because the current backend does not
 * support range-greater-than filters.
 */
  rangeGt(column: string, range: string): this {
    throw new RelationalDatabaseError("rangeGt() is not supported", 400, { code: "unsupported" });
  }

/**
 * Executes the rangeGte operation for this public SDK type.
 *
 * @param column - The column accepted by this operation.
 * @param range - The range accepted by this operation.
 * @returns Nothing; this method throws because the current backend does not
 * support range-greater-than-or-equal filters.
 */
  rangeGte(column: string, range: string): this {
    throw new RelationalDatabaseError("rangeGte() is not supported", 400, { code: "unsupported" });
  }

/**
 * Executes the rangeLt operation for this public SDK type.
 *
 * @param column - The column accepted by this operation.
 * @param range - The range accepted by this operation.
 * @returns Nothing; this method throws because the current backend does not
 * support range-less-than filters.
 */
  rangeLt(column: string, range: string): this {
    throw new RelationalDatabaseError("rangeLt() is not supported", 400, { code: "unsupported" });
  }

/**
 * Executes the rangeLte operation for this public SDK type.
 *
 * @param column - The column accepted by this operation.
 * @param range - The range accepted by this operation.
 * @returns Nothing; this method throws because the current backend does not
 * support range-less-than-or-equal filters.
 */
  rangeLte(column: string, range: string): this {
    throw new RelationalDatabaseError("rangeLte() is not supported", 400, { code: "unsupported" });
  }

/**
 * Executes the textSearch operation for this public SDK type.
 *
 * @param column - The column accepted by this operation.
 * @param query - The query whose results are requested.
 * @returns The result produced by `textSearch`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.textSearch("title", "oracle");
 * void result;
 * ```
 */
  textSearch(column: string, query: string): this {
    appendPredicate(this.state, operatorPredicate(column, "$instr", query));
    return this;
  }

/**
 * Executes the match operation for this public SDK type.
 *
 * @param query - The query whose results are requested.
 * @returns The result produced by `match`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.match({ status: "open" });
 * void result;
 * ```
 */
  match(query: Record<string, unknown>): this {
    for (const [column, value] of Object.entries(query)) {
      this.eq(column, value);
    }
    return this;
  }

/**
 * Executes the not operation for this public SDK type.
 *
 * @param column - The column accepted by this operation.
 * @param operator - The operator accepted by this operation.
 * @param value - The value to store or transform.
 * @returns The result produced by `not`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.not("status", "eq", "archived");
 * void result;
 * ```
 */
  not(column: string, operator: string, value: unknown): this {
    appendPredicate(this.state, createFilterPredicate(column, operator, value, true));
    return this;
  }

/**
 * Executes the or operation for this public SDK type.
 *
 * @param filters - The filters accepted by this operation.
 * @returns The result produced by `or`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.or("status.eq.open,status.eq.pending");
 * void result;
 * ```
 */
  or(filters: string): this {
    appendPredicate(this.state, parseFilter(`or(${filters})`));
    return this;
  }

  /** Groups PostgREST-style filter expressions with logical AND. */
/**
 * Executes the and operation for this public SDK type.
 *
 * @param filters - The filters accepted by this operation.
 * @returns The result produced by `and`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.and("priority.gte.2,status.eq.open");
 * void result;
 * ```
 */
  and(filters: string): this {
    appendPredicate(this.state, parseFilter(`and(${filters})`));
    return this;
  }

/**
 * Executes the filter operation for this public SDK type.
 *
 * @param column - The column accepted by this operation.
 * @param operator - The operator accepted by this operation.
 * @param value - The value to store or transform.
 * @returns The result produced by `filter`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.filter("priority", "gte", 2);
 * void result;
 * ```
 */
  filter(column: string, operator: string, value: unknown): this {
    appendPredicate(this.state, createFilterPredicate(column, operator, value));
    return this;
  }

/**
 * Executes the order operation for this public SDK type.
 *
 * @param column - The column accepted by this operation.
 * @param options - Optional settings that change this operation.
 * @returns The result produced by `order`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.order("created_at", { ascending: false });
 * void result;
 * ```
 */
  order(
    column: string,
    options: {
      ascending?: boolean;
      nullsFirst?: boolean;
      referencedTable?: string;
      path?: string;
      datatype?: string;
      maxLength?: number;
      sortByMinMax?: boolean;
    } = {}
  ): this {
    const reference = parseColumnReference(column);
    if (reference.path.length > 0 && options.path) {
      throw new RelationalDatabaseError(
        "Specify a JSON order path either in the column reference or in options.path, not both",
        400
      );
    }
    const item: OrderByItem = {
      column: reference.column,
      direction: options.ascending === false ? "DESC" : "ASC",
    };
    if (options.nullsFirst !== undefined) item.nulls = options.nullsFirst ? "FIRST" : "LAST";
    const jsonPath = options.path
      ? parseColumnReference(`${reference.column}.${options.path}`).path.join(".")
      : reference.path.length > 0
        ? reference.path.join(".")
        : undefined;
    if (jsonPath) item.path = jsonPath;
    if (options.datatype) item.datatype = options.datatype;
    if (options.maxLength) item.maxLength = options.maxLength;
    if (options.sortByMinMax !== undefined) item.sortByMinMax = options.sortByMinMax;
    this.state.qbe.$orderby = [...(this.state.qbe.$orderby ?? []), item];
    return this;
  }

/**
 * Executes the limit operation for this public SDK type.
 *
 * @param count - The count accepted by this operation.
 * @returns The result produced by `limit`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.limit(10);
 * void result;
 * ```
 */
  limit(count: number): this {
    this.state.qbe.$limit = count;
    return this;
  }

/**
 * Executes the range operation for this public SDK type.
 *
 * @param from - The from accepted by this operation.
 * @param to - The to accepted by this operation.
 * @returns The result produced by `range`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.range(0, 9);
 * void result;
 * ```
 */
  range(from: number, to: number): this {
    this.state.qbe.$offset = from;
    this.state.qbe.$limit = to - from + 1;
    return this;
  }

/**
 * Executes the single operation for this public SDK type.
 *
 * @returns The result produced by `single`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.single();
 * void result;
 * ```
 */
  single(): this {
    this.state.maybeSingle = true;
    return this;
  }

/**
 * Executes the maybeSingle operation for this public SDK type.
 *
 * @returns The result produced by `maybeSingle`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.maybeSingle();
 * void result;
 * ```
 */
  maybeSingle(): this {
    this.state.maybeSingle = true;
    return this;
  }

/**
 * Executes the abortSignal operation for this public SDK type.
 *
 * @param signal - The signal accepted by this operation.
 * @returns The result produced by `abortSignal`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const controller = new AbortController();
 * const result = client.abortSignal(controller.signal);
 * void result;
 * ```
 */
  abortSignal(signal: AbortSignal): this {
    this.state.signal = signal;
    return this;
  }

/**
 * Executes the retry operation for this public SDK type.
 *
 * @param options - Optional settings that change this operation.
 * @returns The result produced by `retry`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.retry({ maxRetries: 3 });
 * void result;
 * ```
 */
  retry(options: boolean | RelationalRetryOptions = true): this {
    this.state.retry = resolveDatabaseRetryOptions(options);
    return this;
  }

/**
 * Overrides the inferred successful response type without changing the request.
 *
 * @returns A builder whose successful response has the specified type.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.overrideTypes<{ id: string; title: string }>();
 * void result;
 * ```
 */
  overrideTypes<
    NewResult,
    Options extends { merge?: boolean } = { merge: true },
  >(): RelationalFilterBuilder<OverrideResult<Result, NewResult, Options>> {
    return this as unknown as RelationalFilterBuilder<
      OverrideResult<Result, NewResult, Options>
    >;
  }

/**
 * Replaces the inferred successful response type without changing the request.
 *
 * @returns A builder whose successful response has the specified type.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.returns<{ id: string; title: string }>();
 * void result;
 * ```
 */
  returns<NewResult>(): RelationalFilterBuilder<NewResult> {
    return this as unknown as RelationalFilterBuilder<NewResult>;
  }

/**
 * Executes the throwOnError operation for this public SDK type.
 *
 * @returns The result produced by `throwOnError`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.throwOnError();
 * void result;
 * ```
 */
  throwOnError(): this {
    this.state.throwOnError = true;
    return this;
  }

/**
 * Executes the setHeader operation for this public SDK type.
 *
 * @param name - Optional name used to identify the resource.
 * @param value - The value to store or transform.
 * @returns The result produced by `setHeader`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.setHeader("x-request-id", "request-123");
 * void result;
 * ```
 */
  setHeader(name: string, value: string): this {
    this.state.headers.set(name, value);
    return this;
  }

  /**
   * Executes this select against the relational offline cache only.
   * @param options - Require a complete previously cached query result.
   * @returns This builder.
   */
  fromCache(options: { requireComplete?: boolean } = {}): this {
    if (this.state.operation !== "select") {
      throw new RelationalDatabaseError("fromCache() is supported only for select()", 400, { code: "offline-query-unsupported" });
    }
    this.state.cacheSource = "cache";
    this.state.requireComplete = options.requireComplete === true;
    return this;
  }

/**
 * Executes the then operation for this public SDK type.
 *
 * @param onfulfilled - The onfulfilled accepted by this operation.
 * @param onrejected - The onrejected accepted by this operation.
 * @returns The result produced by `then`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalFilterBuilder } from "fusabase/relational";
 * const result = client.then((response) => response.data);
 * void result;
 * ```
 */
  then<TResult1 = RelationalResponse<Result>, TResult2 = never>(
    onfulfilled?: ((value: RelationalResponse<Result>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled ?? undefined, onrejected ?? undefined);
  }

  private buildRequest(): { method: Method; url: URL; body: unknown } {
    if (this.state.operation === "select") {
      const body: Record<string, unknown> = {
        projection: this.state.projection,
      };
      const qbe = compactQbe(this.state.qbe);
      if (qbe) body.qbe = qbe;
      return { method: "POST", url: executionUrl(this.state.app, this.state.object), body };
    }

    if (this.state.operation === "rpc") {
      const body: Record<string, unknown> = { args: this.state.args ?? {} };
      if (this.state.overload) body.overload = this.state.overload;
      return { method: "PUT", url: executionUrl(this.state.app, this.state.object), body };
    }

    if (this.state.operation === "insert" || this.state.operation === "upsert") {
      const url = objectUrl(this.state.app, this.state.object);
      const body: Record<string, unknown> = {
        rows: this.state.rows ?? [],
        returnRows: this.state.returnRows,
      };
      if (this.state.returnRows) body.columns = this.state.columns;
      if (this.state.operation === "upsert") {
        url.searchParams.set("upsert", "true");
        if (this.state.onConflict) body.onConflict = this.state.onConflict;
      }
      return { method: "POST", url, body };
    }

    if (this.state.operation === "update") {
      const body: Record<string, unknown> = {
        set: this.state.set,
        qbe: compactQbe(this.state.qbe) ?? { $query: {} },
        returnRows: this.state.returnRows,
      };
      if (this.state.returnRows) body.columns = this.state.columns;
      return {
        method: "PUT",
        url: objectUrl(this.state.app, this.state.object),
        body,
      };
    }

    const url = objectUrl(this.state.app, this.state.object);
    url.searchParams.set("delete", "true");
    const body: Record<string, unknown> = {
      qbe: compactQbe(this.state.qbe) ?? { $query: {} },
      returnRows: this.state.returnRows,
    };
    if (this.state.returnRows) body.columns = this.state.columns;
    return {
      method: "PUT",
      url,
      body,
    };
  }

  private async fetchWithRetry(url: URL, init: RequestInit): Promise<Response> {
    const options = this.state.retry ?? DEFAULT_RETRY_OPTIONS;
    const retryEnabled = options.enabled && this.state.operation === "select";
    let attempt = 0;

    while (true) {
      if (this.state.signal?.aborted) {
        throw new DOMException("Request aborted", "AbortError");
      }

      const headers = new Headers(init.headers);
      if (attempt > 0) headers.set("X-Retry-Count", String(attempt));

      try {
        const response = await fusabaseFetch(this.state.app, url.toString(), {
          ...init,
          headers,
        });

        const canRetry =
          retryEnabled &&
          attempt < options.maxRetries &&
          RETRYABLE_DATABASE_STATUSES.has(response.status);
        if (!canRetry) return response;
      } catch (error) {
        if (
          !retryEnabled ||
          attempt >= options.maxRetries ||
          this.state.signal?.aborted
        ) {
          throw error;
        }
      }

      attempt += 1;
      await waitForDatabaseRetry(retryDelayMs(attempt, options), this.state.signal);
    }
  }

  private async execute(): Promise<RelationalResponse<Result>> {
    if (isOfflineEnabledForApp(this.state.app)) {
      return executeOfflineRequest(
        this.toOfflineRequest(),
        request => RelationalFilterBuilder.executeRemoteRequest(request)
      ) as Promise<RelationalResponse<Result>>;
    }
    return this.executeRemote();
  }

  private toOfflineRequest(): RelationalOfflineRequest {
    const requestHeaders: Array<[string, string]> = [];
    this.state.headers.forEach((value, key) => requestHeaders.push([key, value]));
    return {
      app: this.state.app,
      schema: this.state.schema,
      object: this.state.object,
      operation: this.state.operation,
      projection: structuredClone(this.state.projection),
      qbe: structuredClone(this.state.qbe),
      rows: this.state.rows ? structuredClone(this.state.rows) : undefined,
      set: this.state.set == null ? undefined : structuredClone(this.state.set),
      args: this.state.args ? structuredClone(this.state.args) : undefined,
      overload: this.state.overload,
      onConflict: this.state.onConflict,
      columns: [...this.state.columns],
      headers: requestHeaders,
      throwOnError: this.state.throwOnError,
      signal: this.state.signal,
      retry: this.state.retry ? { ...this.state.retry } : undefined,
      returnRows: this.state.returnRows,
      maybeSingle: this.state.maybeSingle,
      cacheSource: this.state.cacheSource,
      requireComplete: this.state.requireComplete,
    };
  }

  static executeRemoteRequest(request: RelationalOfflineRequest): Promise<RelationalResponse<any>> {
    const state: RequestState = {
      app: request.app!,
      object: request.object,
      schema: request.schema,
      headers: new Headers(request.headers),
      operation: request.operation,
      columns: request.columns ? [...request.columns] : ["*"],
      projection: structuredClone(request.projection),
      qbe: structuredClone(request.qbe),
      rows: request.rows ? structuredClone(request.rows) : undefined,
      set: request.set == null ? undefined : structuredClone(request.set),
      args: request.args ? structuredClone(request.args) : undefined,
      overload: request.overload,
      onConflict: request.onConflict,
      returnRows: request.returnRows,
      maybeSingle: request.maybeSingle,
      mutationId: request.mutationId,
      throwOnError: request.throwOnError,
      signal: request.signal,
      retry: request.retry ? { ...request.retry } : undefined,
    };
    return new RelationalFilterBuilder(state).executeRemote();
  }

  private async executeRemote(): Promise<RelationalResponse<Result>> {
    const { method, url, body } = this.buildRequest();
    const headers = new Headers(this.state.headers);
    headers.set("Content-Type", "application/json");
    headers.set("accept", "application/json");
    headers.set("apikey", this.state.app.options.appID ?? "");
    if (this.state.mutationId) headers.set("X-Fusabase-Mutation-Id", this.state.mutationId);

    const token = await getAccessToken(this.state.app);
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await this.fetchWithRetry(url, {
      method,
      headers,
      body: JSON.stringify(encodeDatabaseDates(body)),
      signal: this.state.signal,
    });

    if (!response.ok) {
      const error = await parseError(response);
      if (this.state.throwOnError) throw error;
      return {
        data: null,
        error,
        count: null,
        status: response.status,
        statusText: response.statusText,
      };
    }

    const text = await response.text();
    const parsed = text ? JSON.parse(text) : null;
    let data = normalizeData(parsed);

    if (this.state.maybeSingle && Array.isArray(data)) {
      data = data.length === 1 ? data[0] : null;
    }

    return {
      data: data as Result,
      error: null,
      count: null,
      status: response.status,
      statusText: response.statusText,
    };
  }
}

/**
 * Starts read and write operations for one relation.
 *
 * @example
 * ```ts
 * const query = client.from("tasks");
 * ```
 */
export class RelationalQueryBuilder {
/**
 * Constructs a RelationalQueryBuilder instance with the supplied configuration.
 *
 * @param state - The state accepted by this operation.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalQueryBuilder } from "fusabase/relational";
 * const result = new RelationalQueryBuilder(value);
 * void result;
 * ```
 */
  constructor(private readonly state: RequestState) {}

/**
 * Executes the select operation for this public SDK type.
 *
 * @param columns - The columns accepted by this operation.
 * @param options - Optional settings that change this operation.
 * @returns The result produced by `select`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalQueryBuilder } from "fusabase/relational";
 * const result = client.select(value, value);
 * void result;
 * ```
 */
  select(columns = "*", options: { head?: boolean; count?: CountPreference } = {}): RelationalFilterBuilder {
    const state = cloneState({
      ...this.state,
      operation: "select",
      columns: cleanSelectColumns(columns),
      projection: projectionFor(columns),
    });
    return new RelationalFilterBuilder(state).select(columns, options);
  }

  /**
   * Starts an insert operation.
   * @param values - Row object or array of row objects. Each object maps column
   * names to JSON-compatible values, for example `{ title: string, done: boolean }`.
   * @returns A builder that accepts filters, modifiers, and `select()`.
   * @example
   * ```ts
   * await client.from("tasks").insert({ title: "Write docs" });
   * ```
   */
  insert(values: unknown): RelationalFilterBuilder {
    const state = cloneState({
      ...this.state,
      operation: "insert",
      rows: toRows(values),
      returnRows: false,
    });
    return new RelationalFilterBuilder(state);
  }

/**
 * Executes the upsert operation for this public SDK type.
 *
 * @param values - The values to store or transform.
 * @param options - Optional settings that change this operation.
 * @returns The result produced by `upsert`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalQueryBuilder } from "fusabase/relational";
 * const result = client.upsert({ title: "Example" }, value);
 * void result;
 * ```
 */
  upsert(values: unknown, options: { onConflict?: string } = {}): RelationalFilterBuilder {
    const state = cloneState({
      ...this.state,
      operation: "upsert",
      rows: toRows(values),
      onConflict: options.onConflict,
      returnRows: false,
    });
    return new RelationalFilterBuilder(state);
  }

/**
 * Executes the update operation for this public SDK type.
 *
 * @param values - The values to store or transform.
 * @returns The result produced by `update`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalQueryBuilder } from "fusabase/relational";
 * const result = client.update({ title: "Example" });
 * void result;
 * ```
 */
  update(values: unknown): RelationalFilterBuilder {
    const state = cloneState({
      ...this.state,
      operation: "update",
      set: values,
      returnRows: false,
    });
    return new RelationalFilterBuilder(state);
  }

  /**
   * Starts a delete operation.
   * @returns A builder; add filters before awaiting to limit affected rows.
   * @example
   * ```ts
   * await client.from("tasks").delete().eq("id", 1);
   * ```
   */
  delete(): RelationalFilterBuilder {
    const state = cloneState({
      ...this.state,
      operation: "delete",
      returnRows: false,
    });
    return new RelationalFilterBuilder(state);
  }
}

/**
 * Root data client. It exposes relation queries, stored-function calls,
 * account operations, file operations, and application attestation.
 *
 * @example
 * ```ts
 * const client = createClient("https://example.com/ords/schema/", config);
 * ```
 */
export class RelationalDb {
/** Describes the public `auth` value. */
  readonly auth: RelationalAuthClient;
/** Describes the public `appTrust` value. */
  readonly appTrust: AppTrustClient;
/** Describes the public `storage` value. */
  readonly storage: RelationalStorageClient;

/**
 * Constructs a RelationalDb instance with the supplied configuration.
 *
 * @param app - The app instance that owns this service.
 * @param schemaName - The schemaName accepted by this operation.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalDb } from "fusabase/relational";
 * const result = new RelationalDb(value, "example");
 * void result;
 * ```
 */
  constructor(readonly app: App, readonly schemaName = app.options.schema) {
    this.auth = new RelationalAuthClient(app);
    this.appTrust = new AppTrustClient(app);
    this.storage = new RelationalStorageClient(app);
  }

  /**
   * Returns a query builder for a table, view, or other relation.
   * @param relation - Relation name in the active schema.
   * @returns A builder for read and write operations.
   * @example
   * ```ts
   * const { data } = await client.from("tasks").select();
   * ```
   */
  from(relation: string): RelationalQueryBuilder {
    if (!relation || relation.trim() === "") {
      throw new RelationalDatabaseError("Invalid relation name", 400);
    }
    return new RelationalQueryBuilder({
      app: this.app,
      object: relation,
      headers: new Headers(),
      schema: this.schemaName,
      operation: "select",
      columns: ["*"],
      projection: projectionFor(),
      qbe: {},
      returnRows: false,
    });
  }

/**
 * Executes the schema operation for this public SDK type.
 *
 * @param schema - The schema accepted by this operation.
 * @returns The result produced by `schema`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalDb } from "fusabase/relational";
 * const result = client.schema(value);
 * void result;
 * ```
 */
  schema(schema: string): RelationalDb {
    return new RelationalDb(this.app, schema);
  }

/**
 * Executes the rpc operation for this public SDK type.
 *
 * @param fn - The fn accepted by this operation.
 * @param args - The args accepted by this operation.
 * @param options - Optional settings that change this operation.
 * @returns The result produced by `rpc`, including any requested data or handle.
 * @example
 * ```ts
 * import { RelationalDb } from "fusabase/relational";
 * const result = client.rpc(value, value, value);
 * void result;
 * ```
 */
  rpc(
    fn: string,
    args: Record<string, unknown> = {},
    options: { overload?: string } = {}
  ): RelationalFilterBuilder {
    return new RelationalFilterBuilder({
      app: this.app,
      object: fn,
      headers: new Headers(),
      schema: this.schemaName,
      operation: "rpc",
      columns: ["*"],
      projection: projectionFor(),
      qbe: {},
      args,
      overload: options.overload,
      returnRows: true,
    });
  }
}

// The offline module owns persistence and deliberately has no dependency on
// another service package. Register this package's existing REST executor for
// durable replay after module initialization.
setOfflineRemoteExecutor(request => RelationalFilterBuilder.executeRemoteRequest(request));
