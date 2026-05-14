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

import { User } from '../types/user.js';
import { AuthCredential, UserCredential } from '../internal/credential.js';
import { ActionCodeSettings } from '../types/action-code.js';
import { AuthProvider } from '../providers/provider.js';
import { PopupRedirectResolver } from '../types/auth.js';


/**
 * Returns a JSON Web Token (JWT) for the user.
 *
 * @example
 * ```ts
 * import { getIdToken } from 'fusabase/auth';
 * const token = await getIdToken(user, true);
 * ```
 */
export declare function getIdToken(user: User, forceRefresh?: boolean): Promise<string>;

/**
 * Returns a deserialized ID token with claims and metadata.
 *
 * @example
 * ```ts
 * import { getIdTokenResult } from 'fusabase/auth';
 * const tokenResult = await getIdTokenResult(user, true);
 * console.log(tokenResult.claims);
 * ```
 */
export declare function getIdTokenResult(user: User, forceRefresh?: boolean): Promise<any>;

/**
 * Returns the MultiFactorUser corresponding to the user.
 *
 * @example
 * ```ts
 * import { multiFactor } from 'fusabase/auth';
 * const mfaUser = multiFactor(user);
 * ```
 */
// export declare function multiFactor(user: User): MultiFactorUser;

/**
 * Reloads the user account data.
 *
 * @example
 * ```ts
 * import { reload } from 'fusabase/auth';
 * await reload(user);
 * ```
 */
export declare function reload(user: User): Promise<void>;

/**
 * Sends a verification email to the user.
 *
 * @example
 * ```ts
 * import { sendEmailVerification } from 'fusabase/auth';
 * await sendEmailVerification(user, { url: 'https://example.com/finishSignUp' });
 * ```
 */
export declare function sendEmailVerification(
  user: User,
  actionCodeSettings?: ActionCodeSettings
): Promise<void>;


/**
 * Updates the user's password.
 *
 * @example
 * ```ts
 * import { updatePassword } from 'fusabase/auth';
 * await updatePassword(user, 'NewStrongPass123!');
 * ```
 */
export declare function updatePassword(
  user: User,
  newPassword: string
): Promise<void>;

/**
 * Updates the user's profile data (displayName and photoURL).
 *
 * @example
 * ```ts
 * import { updateProfile } from 'fusabase/auth';
 * await updateProfile(user, { displayName: 'John Doe', photoURL: 'https://example.com/photo.jpg' });
 * ```
 */
export declare function updateProfile(
  user: User,
  profile: { displayName?: string; photoURL?: string }
): Promise<void>;

/**
 * Links the provided credential to the current user account.
 *
 * @example
 * ```ts
 * import { linkWithCredential } from 'fusabase/auth';
 * // Assume credential is obtained
 * const userCredential = await linkWithCredential(user, credential);
 * ```
 */
export declare function linkWithCredential(user: User, credential: AuthCredential): Promise<UserCredential>;

/**
 * Links the user account with the given provider using a popup window.
 *
 * @example
 * ```ts
 * import { linkWithPopup, GoogleAuthProvider } from 'fusabase/auth';
 * const provider = new GoogleAuthProvider();
 * const userCredential = await linkWithPopup(user, provider);
 * ```
 */
export declare function linkWithPopup(user: User, provider: AuthProvider, resolver?: PopupRedirectResolver): Promise<UserCredential>;

/**
 * Links the user account with the given provider using a redirect.
 *
 * @example
 * ```ts
 * import { linkWithRedirect, GoogleAuthProvider } from 'fusabase/auth';
 * const provider = new GoogleAuthProvider();
 * await linkWithRedirect(user, provider);
 * ```
 */
export declare function linkWithRedirect(user: User, provider: AuthProvider, resolver?: PopupRedirectResolver): Promise<never>;
