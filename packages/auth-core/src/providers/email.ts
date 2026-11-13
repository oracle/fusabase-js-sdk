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

import { EmailAuthCredential, UserCredential } from '../internal/credential.js';
import { AuthError } from '../errors.js';
import { AuthProvider } from './provider.js';

/**
 * The EmailAuthProvider class allows you to generate credentials for email/password or email link-based sign-in.
 *
 * @example
 * ```ts
 * // Example usage to generate EmailAuthCredential using email and password
 * const emailCredential = EmailAuthProvider.credential('user@example.com', 'password123');
 * ```
 */
/** Email-and-password authentication provider. @example `const credential = EmailAuthProvider.credential(email, password);` */
export class EmailAuthProvider extends AuthProvider {

  /** Provider ID for email/password sign-in */
    static PROVIDER_ID: string = 'password';

    /** Sign-in method for email/password authentication */
    static EMAIL_PASSWORD_SIGN_IN_METHOD: string = 'password';

    /** Sign-in method for email link-based authentication */
    static EMAIL_LINK_SIGN_IN_METHOD: string = 'emailLink';

  //  Check out with Auth Credential

/**
 * Creates this public authentication object.
 *
 * @returns The value produced by this operation.
 * @throws Throws an authentication or service error when the operation cannot complete.
 * @example
 * ```ts
 * import { getAuth } from "fusabase/auth";
 *
 * const auth = getAuth(app);
 * void auth;
 * ```
 */
  constructor() {
    super('password')
  }

/**
 * Executes the credential operation for this public SDK type.
 *
 * @param email - The account email address.
 * @param password - The account password.
 * @returns The result produced by `credential`, including any requested data or handle.
 * @throws Throws an authentication or service error when the operation cannot complete.
 * @example
 * ```ts
 * import { getAuth } from "fusabase/auth";
 *
 * const auth = getAuth(app);
 * void auth;
 * ```
 */
  static credential(email: string, password: string): EmailAuthCredential {
    const credential = new EmailAuthCredential(EmailAuthProvider.PROVIDER_ID,
      EmailAuthProvider.EMAIL_PASSWORD_SIGN_IN_METHOD, email, password, undefined);
    return credential;
  }

/**
 * Executes the credentialWithLink operation for this public SDK type.
 *
 * @param email - The account email address.
 * @param emailLink - The emailLink accepted by this operation.
 * @returns The result produced by `credentialWithLink`, including any requested data or handle.
 * @throws Throws an authentication or service error when the operation cannot complete.
 * @example
 * ```ts
 * import { getAuth } from "fusabase/auth";
 *
 * const auth = getAuth(app);
 * void auth;
 * ```
 */
  static credentialWithLink(email: string, emailLink: string): EmailAuthCredential {
    const credential = new EmailAuthCredential(EmailAuthProvider.PROVIDER_ID,
      EmailAuthProvider.EMAIL_LINK_SIGN_IN_METHOD, email, undefined, emailLink);
    return credential;
  }

  /**
     * Extracts an EmailAuthCredential from an AuthError.
     * This method helps to extract credentials from an AuthError if available.
     *
     * @param error The error object that occurred during the sign-in or link process.
     * @returns An EmailAuthCredential or null, if not available from the error.
     *
     * @example
     * ```ts
     * try {
     *   // Attempt some auth operation that might throw an error
     * } catch (error) {
     *   const emailCredential = EmailAuthProvider.credentialFromError(error);
     *   console.log(emailCredential);
     * }
     * ```
     */
    static credentialFromError(error: AuthError): EmailAuthCredential | null {
        // Implement logic to handle error and extract credential if possible
        throw new Error('Not implemented');
    }

    /**
     * Extracts an EmailAuthCredential from the user credential object.
     * This method allows you to extract the credentials that were used during the sign-in or link operation.
     *
     * @param userCredential The UserCredential object returned after a successful sign-in or link operation.
     * @returns An EmailAuthCredential or null if not available.
     *
     * @example
     * ```ts
     * const userCredential: UserCredential = await signInWithEmailAndPassword('user@example.com', 'password123');
     * const emailCredential = EmailAuthProvider.credentialFromResult(userCredential);
     * console.log(emailCredential);
     * ```
     */
    static credentialFromResult(userCredential: UserCredential): EmailAuthCredential | null {
        // Implement logic to extract the credential from the result
        throw new Error('Not implemented');
    }

}
