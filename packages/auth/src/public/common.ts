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
import { User } from "../types/user.js";
import {ActionCodeInfo} from '../types/action-code.js';
import { authErrorHandler,argCheck,typeStrings, AuthError, ErrorCodeMessage } from '../errors.js';

export function onAuthStateChanged(
  auth: Auth,
  nextOrObserver: ((user: User | null) => void),
  error?: (error: Error) => void,
  completed?: () => void
): () => void {
  if (!(auth instanceof Auth)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid authentication instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
    return auth.onAuthStateChanged(nextOrObserver);
}


// /**
//  * Applies a verification code sent to the user via email for actions like
//  * email verification or password reset.
//  *
//  * Common use cases:
//  * - Confirming a user's email address.
//  * - Reverting a password reset (if supported).
//  *
//  * Example:
//  * ```ts
//  * import { applyActionCode, getAuth } from 'fusabase/auth';
//  *
//  * const auth = getAuth();
//  * await applyActionCode(auth, actionCode);
//  * ```
//  *
//  * @param auth - The Auth instance to use.
//  * @param oobCode - The out-of-band (OOB) code from the email action link.
//  *
//  * @returns A promise that resolves when the action has been applied successfully.
//  *          Rejects with an error if the code is invalid, expired, or already used.
//  */
// export declare function applyActionCode(
//   auth: Auth,
//   oobCode: string
// ): Promise<void>;


// /**
//  * Checks the validity of an out-of-band action code.
//  *
//  * Typically used for password reset, email verification, or recovering a disabled account.
//  *
//  * @param auth - The Auth instance.
//  * @param oobCode - The action code from the email link.
//  * @returns A promise resolving with ActionCodeInfo if the code is valid.
//  */
// export declare function checkActionCode(
//   auth: Auth,
//   oobCode: string
// ): Promise<ActionCodeInfo>;