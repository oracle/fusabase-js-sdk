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
import { UserCredential, AuthCredential } from '../internal/credential.js';
import { AuthProvider } from '../providers/provider.js';
import { PopupRedirectResolver, ApplicationVerifier, Auth, hasEquivalentAuthAppConfig } from '../types/auth.js';
import { ActionCodeSettings } from '../types/action-code.js';
import { authErrorHandler,argCheck,typeStrings, AuthError, ErrorCodeMessage } from '../errors.js';
import { ConfirmationResult } from '../types/user.js';

/**
 * Loads the reCAPTCHA configuration into the Auth instance.
 *
 * @example
 * ```ts
 * import { getAuth, initializeRecaptchaConfig } from 'fusabase/auth';
 *
 * const auth = getAuth();
 * await initializeRecaptchaConfig(auth);
 * ```
 */
/**
 * @internal
 */
export function initializeRecaptchaConfig(auth: Auth): Promise<void> {
  let error = new AuthError(ErrorCodeMessage.NOT_IMPLEMENT,"Not implemented");
  error.status = 501;
  throw authErrorHandler(error);
}

/**
 * Signs in using a Fusabase Custom Token.
 *
 * @example
 * ```ts
 * import { getAuth, signInWithCustomToken } from 'fusabase/auth';
 *
 * const auth = getAuth();
 * const userCredential = await signInWithCustomToken(auth, customJwtToken);
 * ```
 */
/**
 * @internal
 */
export function signInWithCustomToken(
  auth: Auth,
  customToken: string
): Promise<UserCredential> {
  let error = new AuthError(ErrorCodeMessage.NOT_IMPLEMENT,"Not implemented");
  error.status = 501;
  throw authErrorHandler(error);
}

/**
 * Executes the signInWithCredential operation for this public SDK type.
 *
 * @param auth - The Auth instance for this operation.
 * @param credential - The credential to attach or convert.
 * @returns The result produced by `signInWithCredential`, including any requested data or handle.
 * @example
 * ```ts
 * import { signInWithCredential } from "fusabase/auth";
 * const result = signInWithCredential(value, value);
 * void result;
 * ```
 */
export function signInWithCredential(
  auth: Auth,
  credential: AuthCredential
): Promise<UserCredential> {
  return auth.signInWithCredential(credential);
}

/**
 * Executes the signInWithPopup operation for this public SDK type.
 *
 * @param auth - The Auth instance for this operation.
 * @param provider - The authentication provider to use.
 * @param resolver - The resolver accepted by this operation.
 * @returns The result produced by `signInWithPopup`, including any requested data or handle.
 * @example
 * ```ts
 * import { signInWithPopup } from "fusabase/auth";
 * const result = signInWithPopup(value, value, value);
 * void result;
 * ```
 */
export function signInWithPopup(
  auth: Auth,
  provider: AuthProvider,
  resolver?: PopupRedirectResolver
): Promise<UserCredential> {
  if (!(auth instanceof Auth)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid authentication instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    return auth.signInWithPopup(provider);
}

/**
 * Executes the signInWithRedirect operation for this public SDK type.
 *
 * @param auth - The Auth instance for this operation.
 * @param provider - The authentication provider to use.
 * @param resolver - The resolver accepted by this operation.
 * @returns The result produced by `signInWithRedirect`, including any requested data or handle.
 * @example
 * ```ts
 * import { signInWithRedirect } from "fusabase/auth";
 * const result = signInWithRedirect(value, value, value);
 * void result;
 * ```
 */
export function signInWithRedirect(
  auth: Auth,
  provider: AuthProvider,
  resolver?: PopupRedirectResolver
):  Promise<never> {
  if (!(auth instanceof Auth)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS, "Invalid authentication instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    return auth.signInWithRedirect(provider);
}

/**
 * Executes the signInWithEmailAndPassword operation for this public SDK type.
 *
 * @param auth - The Auth instance for this operation.
 * @param email - The account email address.
 * @param password - The account password.
 * @returns The result produced by `signInWithEmailAndPassword`, including any requested data or handle.
 * @example
 * ```ts
 * import { signInWithEmailAndPassword } from "fusabase/auth";
 * const result = signInWithEmailAndPassword(value, "user@example.com", "correct-horse-battery-staple");
 * void result;
 * ```
 */
export function signInWithEmailAndPassword(
  auth: Auth,
  email: string,
  password: string
): Promise<UserCredential> {
  if (!(auth instanceof Auth)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid authentication instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    return auth.signInWithEmailAndPassword(email, password);
}

// /**
//  * Starts a phone number sign-in flow using reCAPTCHA.
//  *
//  * @example
//  * ```ts
//  * import { getAuth, signInWithPhoneNumber, RecaptchaVerifier } from 'fusabase/auth';
//  *
//  * const auth = getAuth();
//  * const verifier = new RecaptchaVerifier('recaptcha-container', {}, auth);
//  * const confirmationResult = await signInWithPhoneNumber(auth, '+15555550100', verifier);
//  * ```
//  */
// export function signInWithPhoneNumber(
//   auth: Auth,
//   phoneNumber: string,
//   appVerifier: ApplicationVerifier
// ): Promise<ConfirmationResult> {
//   let error = new AuthError(ErrorCodeMessage.NOT_IMPLEMENT,"Not implemented");
//   error.status = 501;
//   throw authErrorHandler(error);
// }

// /**
//  * Re-authenticates the user with a fresh AuthCredential.
//  *
//  * @example
//  * ```ts
//  * import { reauthenticateWithCredential, EmailAuthProvider } from 'fusabase/auth';
//  *
//  * const credential = EmailAuthProvider.credential(user.email!, 'password123');
//  * await reauthenticateWithCredential(user, credential);
//  * ```
//  */
// export function reauthenticateWithCredential(
//   user: User,
//   credential: AuthCredential
// ): Promise<UserCredential> {
//   let error = new AuthError(ErrorCodeMessage.NOT_IMPLEMENT,"Not implemented");
//   error.status = 501;
//   throw authErrorHandler(error);
// }

// /**
//  * Re-authenticates the current user with a provider using a popup flow.
//  *
//  * @example
//  * ```ts
//  * import { reauthenticateWithPopup, GoogleAuthProvider } from 'fusabase/auth';
//  *
//  * const provider = new GoogleAuthProvider();
//  * await reauthenticateWithPopup(user, provider);
//  * ```
//  */
// export function reauthenticateWithPopup(
//   user: User,
//   provider: AuthProvider,
//   resolver?: PopupRedirectResolver
// ): Promise<UserCredential> {
//   let error = new AuthError(ErrorCodeMessage.NOT_IMPLEMENT,"Not implemented");
//   error.status = 501;
//   throw authErrorHandler(error);
// }

// /**
//  * Re-authenticates the current user with a provider using a redirect flow.
//  *
//  * @example
//  * ```ts
//  * import { reauthenticateWithRedirect, GoogleAuthProvider } from 'fusabase/auth';
//  *
//  * const provider = new GoogleAuthProvider();
//  * await reauthenticateWithRedirect(user, provider);
//  * ```
//  */
// export function reauthenticateWithRedirect(
//   user: User,
//   provider: AuthProvider,
//   resolver?: PopupRedirectResolver
// ): Promise<never> {
//   let error = new AuthError(ErrorCodeMessage.NOT_IMPLEMENT,"Not implemented");
//   error.status = 501;
//   throw authErrorHandler(error);
// }

// /**
//  * Re-authenticates the current user with a phone credential.
//  *
//  * @example
//  * ```ts
//  * import { reauthenticateWithPhoneNumber, RecaptchaVerifier } from 'fusabase/auth';
//  *
//  * const verifier = new RecaptchaVerifier('recaptcha-container', {}, auth);
//  * const confirmationResult = await reauthenticateWithPhoneNumber(user, '+15555550100', verifier);
//  * ```
//  */
// export function reauthenticateWithPhoneNumber(
//   user: User,
//   phoneNumber: string,
//   appVerifier: ApplicationVerifier
// ): Promise<ConfirmationResult> {
//   let error = new AuthError(ErrorCodeMessage.NOT_IMPLEMENT,"Not implemented");
//   error.status = 501;
//   throw authErrorHandler(error);
// }


/**
 * Executes the updateCurrentUser operation for this public SDK type.
 *
 * @param auth - The Auth instance for this operation.
 * @param user - The user accepted by this operation.
 * @returns The result produced by `updateCurrentUser`, including any requested data or handle.
 * @example
 * ```ts
 * import { updateCurrentUser } from "fusabase/auth";
 * const result = updateCurrentUser(value, value);
 * void result;
 * ```
 */
export async function updateCurrentUser(
  auth: Auth,
  user: User | null
): Promise<void> {
  if (!(auth instanceof Auth)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid authentication instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    if (user && user instanceof User && !hasEquivalentAuthAppConfig(user.auth, auth)) {
      const error = new AuthError(
        ErrorCodeMessage.INVALID_ARGS,
        new Error("User belongs to an Auth instance with a different app configuration")
      );
      error.status = 400;
      throw authErrorHandler(error);
    }
    await auth.updateCurrentUser(user);
}

/**
 * Executes the signOut operation for this public SDK type.
 *
 * @param auth - The Auth instance for this operation.
 * @returns The result produced by `signOut`, including any requested data or handle.
 * @example
 * ```ts
 * import { signOut } from "fusabase/auth";
 * const result = signOut(value);
 * void result;
 * ```
 */
export function signOut(auth: Auth): Promise<void> {
  if (!(auth instanceof Auth)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid authentication instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    return auth.signOut();
}
