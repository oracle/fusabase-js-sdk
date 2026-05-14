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

import { UserCredential } from '../internal/credential.js';
import { PopupRedirectResolver } from '../types/auth.js';
import { Auth } from '../types/auth.js';
import { AuthError, authErrorHandler, ErrorCodeMessage } from '../errors.js';

/**
 * Returns the result of a redirect-based sign-in flow.
 *
 * @param auth - The Auth instance.
 * @param resolver - Optional popup/redirect resolver.
 * @returns A promise resolving with the UserCredential if available, or null.
 */
export function getRedirectResult(
  auth: Auth,
  resolver?: PopupRedirectResolver
): Promise<UserCredential | null> {
  if (!(auth instanceof Auth)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid authentication instance");
        error.status = 400;
        throw authErrorHandler(error);
    }
  return auth.getRedirectResult();
}




