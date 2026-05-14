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

import { AuthCredential } from './credential.js';
import { authErrorHandler, argCheck, typeStrings } from '../errors.js';

/**
 * Represents OAuth credentials returned by an OAuthProvider.
 *
 * @example
 * ```ts
 * import { OAuthCredential, GoogleAuthProvider } from 'fusabase/auth';
 * const credential = GoogleAuthProvider.credential(idToken);
 * ```
 */
export class OAuthCredential extends AuthCredential {
  /** The access token used for OAuth authentication */
  accessToken?: string;
  /** The ID token used for OAuth authentication */
  idToken?: string;

  /** Converts the credential to a JSON serializable object */
  toJSON(): { providerId: string; signInMethod: string; accessToken?: string; idToken?: string } {
    const cred = {
      providerId: this.providerId,
      signInMethod: this.signInMethod,
      accessToken: this.accessToken,
      idToken: this.idToken
    };
    return cred;
  }

  /**
   * Method to convert the data in JSON format to data members.
   */
  static fromJSON(authCredential: string): OAuthCredential {
    argCheck(authCredential, "Invalid object", true, [typeStrings.OBJECT]);
    const res = JSON.parse(authCredential);
    const oauth = new OAuthCredential(res.providerId, res.signInMethod);
    oauth.accessToken = res.accessToken;
    oauth.idToken = res.idToken;
    return oauth;
  }
}

/**
 * Represents credentials returned by PhoneAuthProvider.
 *
 * @example
 * ```ts
 * import { PhoneAuthCredential, PhoneAuthProvider } from 'fusabase/auth';
 * const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
 * ```
 */
export class PhoneAuthCredential extends AuthCredential {
  /** Converts the credential to a JSON serializable object */
  toJSON(): { providerId: string; signInMethod: string } {
    throw new Error('Method not implemented.');
  }
}

/**
 * Represents a phone-based MultiFactor assertion for MFA.
 *
 * @example
 * ```ts
 * import { PhoneMultiFactorAssertion, PhoneMultiFactorGenerator } from 'fusabase/auth';
 * const assertion = PhoneMultiFactorGenerator.assertion(credential);
 * ```
 */
export class PhoneMultiFactorAssertion {
  /** Converts the assertion to a JSON serializable object */
  toJSON(): object {
    throw new Error('Method not implemented.');
  }
}

/**
 * Represents a TOTP-based MultiFactor assertion for MFA.
 *
 * @example
 * ```ts
 * import { TotpMultiFactorAssertion, TotpMultiFactorGenerator } from 'fusabase/auth';
 * const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret);
 * ```
 */
export class TotpMultiFactorAssertion {
  /** Converts the assertion to a JSON serializable object */
  toJSON(): object {
    throw new Error('Method not implemented.');
  }
}
