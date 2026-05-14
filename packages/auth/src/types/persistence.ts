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

import PersistenceType from "../helpers/persistence/PersistenceType.js";

/**
 * Interface for persistence mechanisms used to store authentication state.
 */
export interface Persistence {
  /** The type identifier for this persistence mechanism (e.g., "LOCAL", "SESSION", "NONE") */
  readonly type: string;
}

/**
 * Persistence implementation using browser local storage.
 * Data persists across browser sessions and tabs.
 *
 * @example
 * ```ts
 * import { browserLocalPersistence } from './persistence.js';
 * const auth = initializeAuth(app, { persistence: browserLocalPersistence });
 * ```
 */
export const browserLocalPersistence: Persistence = {
  type: PersistenceType.LOCAL
}

/**
 * Persistence implementation using browser session storage.
 * Data persists only for the current browser tab/session.
 *
 * @example
 * ```ts
 * import { browserSessionPersistence } from './persistence.js';
 * const auth = initializeAuth(app, { persistence: browserSessionPersistence });
 * ```
 */
export const browserSessionPersistence: Persistence = {
  type: PersistenceType.SESSION
}

/**
 * Persistence implementation that stores data only in memory.
 * Data is lost when the page is refreshed or navigated away from.
 *
 * @example
 * ```ts
 * import { inMemoryPersistence } from './persistence.js';
 * const auth = initializeAuth(app, { persistence: inMemoryPersistence });
 * ```
 */
export const inMemoryPersistence: Persistence = {
  type: PersistenceType.NONE
}
