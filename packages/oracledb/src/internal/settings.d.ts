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
// 

/**
 * Interface representing Oracledb custom settings.
 * These settings can be applied when initializing a Oracledb instance.
 */
export interface OracledbSettings {
  /** The hostname to connect to (useful for emulator). */
  host?: string;

  /** Whether to use SSL when connecting to Oracledb. Defaults to true. */
  ssl?: boolean;

  /** Whether timestamps should be returned as Timestamp objects. */
  timestampsInSnapshots?: boolean;

  /** Cache size in bytes. Can use CACHE_SIZE_UNLIMITED. */
  cacheSizeBytes?: number;
}

// /**
//  * Connects the Oracledb instance to a local emulator.
//  *
//  * @param Oracledb - The Oracledb instance.
//  * @param host - Hostname of the emulator (e.g., 'localhost').
//  * @param port - Port number of the emulator (e.g., 8080).
//  * @param options - Optional additional configuration.
//  *
//  * @example
//  * ```ts
//  * connectOracledbEmulator(Oracledb, 'localhost', 8080);
//  * ```
//  */
// export declare function connectOracledbEmulator(
//   oracledb: any,
//   host: string,
//   port: number,
//   options?: object
// ): void;

// /**
//  * Enables IndexedDB persistence for offline Oracledb usage.
//  *
//  * @param Oracledb - The Oracledb instance.
//  * @param settings - Optional persistence configuration.
//  *
//  * @example
//  * ```ts
//  * await enableIndexedDbPersistence(Oracledb);
//  * ```
//  */
// export declare function enableIndexedDbPersistence(
//   oracledb: any,
//   settings?: object
// ): Promise<void>;

// /**
//  * Enables multi-tab IndexedDB persistence. Synchronizes queries/mutations across tabs.
//  *
//  * @param Oracledb - The Oracledb instance.
//  * @param settings - Optional persistence configuration.
//  *
//  * @example
//  * ```ts
//  * await enableMultiTabIndexedDbPersistence(Oracledb);
//  * ```
//  */
// export declare function enableMultiTabIndexedDbPersistence(
//   oracledb: any,
//   settings?: object
// ): Promise<void>;

// /**
//  * Clears all persistent IndexedDB persistence for the Oracledb instance.
//  *
//  * @param Oracledb - The Oracledb instance.
//  *
//  * @example
//  * ```ts
//  * await clearIndexedDbPersistence(Oracledb);
//  * ```
//  */
// export declare function clearIndexedDbPersistence(
//   oracledb: any
// ): Promise<void>;

// /**
//  * Waits for all pending writes in the Oracledb instance to be acknowledged by the backend.
//  *
//  * @param Oracledb - The Oracledb instance.
//  *
//  * @example
//  * ```ts
//  * await waitForPendingWrites(Oracledb);
//  * ```
//  */
// export declare function waitForPendingWrites(oracledb: any): Promise<void>;
