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

import { Auth } from "../types/auth.js";
import { UserCredential } from "../internal/credential.js";
import { ActionCodeSettings } from "../types/action-code.js";

/**
 * Creates a new user with the provided email and password.
 *
 * @param auth - The Auth instance.
 * @param email - The user's email.
 * @param password - The user's password.
 * @returns A promise resolving with a UserCredential on success.
 */
export declare function createUserWithEmailAndPassword(
  auth: Auth,
  email: string,
  password: string
): Promise<UserCredential>;


// /**
//  * Fetches the list of sign-in methods for a given email address.
//  *
//  * @param auth - The Auth instance.
//  * @param email - The email address.
//  * @returns A promise resolving with an array of sign-in methods (strings).
//  */
// export declare function fetchSignInMethodsForEmail(
//   auth: Auth,
//   email: string
// ): Promise<string[]>;


// /**
//  * Checks if a link is a sign-in with email link.
//  *
//  * @param auth - The Auth instance.
//  * @param emailLink - The link to check.
//  * @returns True if the link is a sign-in with email link.
//  */
// export declare function isSignInWithEmailLink(
//   auth: Auth,
//   emailLink: string
// ): boolean;



// /**
//  * Sends a sign-in email link to the provided email address.
//  *
//  * @param auth - The Auth instance.
//  * @param email - The email to which the link should be sent.
//  * @param actionCodeSettings - The action code settings.
//  * @returns A promise that resolves when the link has been sent.
//  */
// export declare function sendSignInLinkToEmail(
//   auth: Auth,
//   email: string,
//   actionCodeSettings: ActionCodeSettings
// ): Promise<void>;


