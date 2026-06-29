// Copyright (c) 2015, 2025, Oracle and/or its affiliates.

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

export const MIN_LONG_POLLING_TIMEOUT_SECONDS = 5;
export const MAX_LONG_POLLING_TIMEOUT_SECONDS = 300;
export const DEFAULT_LONG_POLLING_TIMEOUT_SECONDS = 29;
export const MAX_REALTIME_MESSAGE_QUEUE_COUNT = 1000;
export const MAX_REALTIME_MESSAGE_QUEUE_BYTES = 1024 * 1024;

export interface LongPollingOptions {
  timeoutSeconds?: number;
}

function createInvalidLongPollingTimeoutError(): Error & { status?: number } {
  const error = new Error(
    `Long polling interval must be an integer between ${MIN_LONG_POLLING_TIMEOUT_SECONDS} and ${MAX_LONG_POLLING_TIMEOUT_SECONDS} seconds.`
  ) as Error & { status?: number };
  error.status = 400;
  return error;
}

export function validateLongPollingTimeoutSeconds(timeoutSeconds: unknown): number {
  if (
    typeof timeoutSeconds !== "number" ||
    !Number.isFinite(timeoutSeconds) ||
    !Number.isInteger(timeoutSeconds) ||
    timeoutSeconds < MIN_LONG_POLLING_TIMEOUT_SECONDS ||
    timeoutSeconds > MAX_LONG_POLLING_TIMEOUT_SECONDS
  ) {
    throw createInvalidLongPollingTimeoutError();
  }

  return timeoutSeconds;
}

export function normalizeLongPollingOptions(
  options?: LongPollingOptions,
  fallbackTimeoutSeconds = DEFAULT_LONG_POLLING_TIMEOUT_SECONDS
): { timeoutSeconds: number } {
  if (options !== undefined && (options === null || typeof options !== "object" || Array.isArray(options))) {
    throw createInvalidLongPollingTimeoutError();
  }

  const hasTimeoutSeconds =
    options !== undefined &&
    Object.prototype.hasOwnProperty.call(options, "timeoutSeconds");
  const timeoutSeconds = hasTimeoutSeconds
    ? options!.timeoutSeconds
    : fallbackTimeoutSeconds;

  return {
    timeoutSeconds: validateLongPollingTimeoutSeconds(timeoutSeconds)
  };
}

/**
 * Interface representing Oracledb custom settings.
 * These settings can be applied when initializing a Oracledb instance.
 */
export interface OracledbSettings {
  /** Whether to auto-detect long polling for snapshot listeners. */
  experimentalAutoDetectLongPolling?: boolean;

  /** Whether to force long polling for snapshot listeners. */
  experimentalForceLongPolling?: boolean;

  /** Options for long-polling snapshot listeners. */
  experimentalLongPollingOptions?: LongPollingOptions;

  /** Whether set operations merge document fields. */
  merge?: boolean;

  /** Whether undefined values should be ignored. */
  ignoreUndefinedProperties?: boolean;

  /** Whether timestamps should be returned as Timestamp objects. */
  timestampsInSnapshots?: boolean;

  /** Cache size in bytes. Can use CACHE_SIZE_UNLIMITED. */
  cacheSizeBytes?: number;
}
