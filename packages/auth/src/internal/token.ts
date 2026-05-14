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

import { Auth } from '../types/auth.js';
import { User } from '../types/user.js';
import { authErrorHandler, AuthError, ErrorCodeMessage } from '../errors.js';

/**
 * Adds an observer for changes to the user's ID token.
 *
 * This listener is triggered when the user's ID token changes, such as when
 * the token is refreshed or when the user signs in/out.
 *
 * @param auth - The Auth instance.
 * @param nextOrObserver - A function called when the ID token changes, receiving the current user or null.
 * @param error - Optional error callback (currently not implemented).
 * @param completed - Optional completion callback (currently not implemented).
 * @returns An unsubscribe function to remove the listener.
 *
 * @example
 * ```ts
 * import { onIdTokenChanged, getAuth } from 'fusabase/auth';
 *
 * const auth = getAuth();
 * const unsubscribe = onIdTokenChanged(auth, (user) => {
 *   if (user) {
 *     console.log('User is signed in:', user.uid);
 *     // Get the ID token
 *     user.getIdToken().then((idToken) => {
 *       console.log('ID Token:', idToken);
 *     });
 *   } else {
 *     console.log('User is signed out');
 *   }
 * });
 *
 * // Later, to remove the listener:
 * unsubscribe();
 * ```
 */
export function onIdTokenChanged(
  auth: Auth,
  nextOrObserver: ((user: User | null) => void),
  error?: (error: Error) => void,
  completed?: () => void
): () => void {
  if (!(auth instanceof Auth)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS, "Invalid authentication instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    return auth.onIdTokenChanged(nextOrObserver);
}

/**
 * Revokes an OAuth access token (Apple only).
 *
 * @example
 * ```ts
 * import { revokeAccessToken } from 'fusabase/auth';
 *
 * await revokeAccessToken(auth, appleAccessToken);
 * ```
 */
export declare function revokeAccessToken(
  auth: Auth,
  token: string
): Promise<void>;
