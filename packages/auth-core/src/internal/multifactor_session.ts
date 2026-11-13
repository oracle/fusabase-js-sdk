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

import { MultiFactorSession } from "../types/multifactor.js";
import { User } from "../types/user.js";

export type MultiFactorSessionType = "enroll" | "signin";

/**
 * Internal MFA session used by enrollment and sign-in helper APIs.
 */
export class MultiFactorSessionImpl implements MultiFactorSession {
  private constructor(
    readonly _type: MultiFactorSessionType,
    readonly _id?: string,
    readonly _token?: string,
    readonly _user?: User
  ) {}

  static _fromEnrollment(user: User, challengeId?: string, mfaSessionToken?: string): MultiFactorSessionImpl {
    return new MultiFactorSessionImpl("enroll", challengeId, mfaSessionToken, user);
  }

  static _fromSignIn(challengeId: string, mfaSessionToken?: string): MultiFactorSessionImpl {
    return new MultiFactorSessionImpl("signin", challengeId, mfaSessionToken);
  }
}
