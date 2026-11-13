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
import { authErrorHandler,argCheck,typeStrings, AuthError, ErrorCodeMessage } from '../errors.js';
import { PopupRedirectResolver } from '../types/auth.js';
import { AuthProvider } from '../providers/provider.js';
import { MultiFactorUser } from '../types/multifactor.js';
import { MultiFactorUserImpl } from '../internal/multifactor_user.js';


/**
 * Executes the getIdToken operation for this public SDK type.
 *
 * @param user - The user accepted by this operation.
 * @param forceRefresh - The forceRefresh accepted by this operation.
 * @returns The result produced by `getIdToken`, including any requested data or handle.
 * @example
 * ```ts
 * import { getIdToken } from "fusabase/auth";
 * const result = getIdToken(value, value);
 * void result;
 * ```
 */
export async function getIdToken(user: User, forceRefresh?: boolean): Promise<string> {
  if (!(user instanceof User)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid user instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    let token = await user.getIdToken(forceRefresh);
    return token ?? "";
}

/**
 * Executes the getIdTokenResult operation for this public SDK type.
 *
 * @param user - The user accepted by this operation.
 * @param forceRefresh - The forceRefresh accepted by this operation.
 * @returns The result produced by `getIdTokenResult`, including any requested data or handle.
 * @example
 * ```ts
 * import { getIdTokenResult } from "fusabase/auth";
 * const result = getIdTokenResult(value, value);
 * void result;
 * ```
 */
export function getIdTokenResult(user: User, forceRefresh?: boolean): Promise<any> {
  if (!(user instanceof User)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid user instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    return user.getIdTokenResult(forceRefresh);
}

/**
 * Executes the multiFactor operation for this public SDK type.
 *
 * @param user - The user accepted by this operation.
 * @returns The result produced by `multiFactor`, including any requested data or handle.
 * @example
 * ```ts
 * import { multiFactor } from "fusabase/auth";
 * const result = multiFactor(value);
 * void result;
 * ```
 */
export function multiFactor(user: User): MultiFactorUser {
  if (!(user instanceof User)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid user instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    return new MultiFactorUserImpl(user);
}

/**
 * Executes the reload operation for this public SDK type.
 *
 * @param user - The user accepted by this operation.
 * @returns The result produced by `reload`, including any requested data or handle.
 * @example
 * ```ts
 * import { reload } from "fusabase/auth";
 * const result = reload(value);
 * void result;
 * ```
 */
export function reload(user: User): Promise<void> {
  if (!(user instanceof User)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid user instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    return user.reload();
}

/**
 * Executes the sendEmailVerification operation for this public SDK type.
 *
 * @param user - The user accepted by this operation.
 * @param actionCodeSettings - The actionCodeSettings accepted by this operation.
 * @returns The result produced by `sendEmailVerification`, including any requested data or handle.
 * @example
 * ```ts
 * import { sendEmailVerification } from "fusabase/auth";
 * const result = sendEmailVerification(value, value);
 * void result;
 * ```
 */
export function sendEmailVerification(
  user: User,
  actionCodeSettings?: ActionCodeSettings
): Promise<void> {
  if (!(user instanceof User)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid user instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    return user.sendEmailVerification(actionCodeSettings);
}


/**
 * Executes the updatePassword operation for this public SDK type.
 *
 * @param user - The user accepted by this operation.
 * @param oldPassword - The oldPassword accepted by this operation.
 * @param newPassword - The newPassword accepted by this operation.
 * @returns The result produced by `updatePassword`, including any requested data or handle.
 * @example
 * ```ts
 * import { updatePassword } from "fusabase/auth";
 * const result = updatePassword(value, "correct-horse-battery-staple", "correct-horse-battery-staple");
 * void result;
 * ```
 */
export function updatePassword(
  user: User,
  oldPassword: string,
  newPassword: string
): Promise<void> {
  if (!(user instanceof User)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid user instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    return user.updatePassword(oldPassword, newPassword);
}

/**
 * Executes the updateProfile operation for this public SDK type.
 *
 * @param user - The user accepted by this operation.
 * @param profile - The profile accepted by this operation.
 * @returns The result produced by `updateProfile`, including any requested data or handle.
 * @example
 * ```ts
 * import { updateProfile } from "fusabase/auth";
 * const result = updateProfile(value, value);
 * void result;
 * ```
 */
export function updateProfile(
  user: User,
  profile: { displayName?: string; photoURL?: string }
): Promise<void> {
  if (!(user instanceof User)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid user instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    return user.updateProfile(profile);
}

/**
 * Executes the linkWithCredential operation for this public SDK type.
 *
 * @param user - The user accepted by this operation.
 * @param credential - The credential to attach or convert.
 * @returns The result produced by `linkWithCredential`, including any requested data or handle.
 * @example
 * ```ts
 * import { linkWithCredential } from "fusabase/auth";
 * const result = linkWithCredential(value, value);
 * void result;
 * ```
 */
export function linkWithCredential(user: User, credential: AuthCredential): Promise<UserCredential> {
    return user.linkWithCredential(credential);
}

/**
 * Executes the linkWithRedirect operation for this public SDK type.
 *
 * @param user - The user accepted by this operation.
 * @param provider - The authentication provider to use.
 * @param resolver - The resolver accepted by this operation.
 * @returns The result produced by `linkWithRedirect`, including any requested data or handle.
 * @example
 * ```ts
 * import { linkWithRedirect } from "fusabase/auth";
 * const result = linkWithRedirect(value, value, value);
 * void result;
 * ```
 */
export function linkWithRedirect(user: User, provider: AuthProvider, resolver?: PopupRedirectResolver): Promise<never> {
    return user.linkWithRedirect(provider);
}

/**
 * Executes the linkWithPopup operation for this public SDK type.
 *
 * @param user - The user accepted by this operation.
 * @param provider - The authentication provider to use.
 * @param resolver - The resolver accepted by this operation.
 * @returns The result produced by `linkWithPopup`, including any requested data or handle.
 * @example
 * ```ts
 * import { linkWithPopup } from "fusabase/auth";
 * const result = linkWithPopup(value, value, value);
 * void result;
 * ```
 */
export function linkWithPopup(user: User, provider: AuthProvider, resolver?: PopupRedirectResolver): Promise<UserCredential> {
    return user.linkWithPopup(provider);
}

/**
 * Executes the unlink operation for this public SDK type.
 *
 * @param user - The user accepted by this operation.
 * @param providerId - The provider identifier.
 * @returns The result produced by `unlink`, including any requested data or handle.
 * @example
 * ```ts
 * import { unlink } from "fusabase/auth";
 * const result = unlink(value, "example-provider");
 * void result;
 * ```
 */
export function unlink(user: User, providerId: string): Promise<User> {
    return user.unlink(providerId);
}
