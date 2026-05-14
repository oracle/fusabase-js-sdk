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

import { authErrorHandler,argCheck,typeStrings } from '../errors.js';
import { User } from '../types/user.js';
import { SignInMethod } from '../types/auth.js';

export class AuthCredential {
  /** The authentication provider ID for this credential */
  readonly providerId: string;

  /** The sign-in method associated with this credential */
  readonly signInMethod: string;

  /**
   * Internal constructor; third-party code should not call directly
   * or extend this class.
   */
  constructor(providerId: string, signInMethod: string) {
    this.providerId = providerId;
    this.signInMethod = signInMethod;
  }

  /**
   * Returns a JSON-serializable representation of this credential
   */
  toJSON(): { providerId: string; signInMethod: string } {
    return {
      providerId: this.providerId,
      signInMethod: this.signInMethod
    };
  }
}

/**
 * Represents credentials returned by EmailAuthProvider for PASSWORD or EMAIL_LINK sign-in.
 * Internal constructor; do not call directly or extend.
 */
export class EmailAuthCredential extends AuthCredential {
  readonly email: string;
  readonly password?: string|null;
  readonly emailLink?: string|null;

  /** Internal constructor */
  constructor(
    providerId: string,
    methodUsed: string,
    email: string,
    password?: string,
    emailLink?: string
  ) {
    super('password', methodUsed);
    this.email = email;
    this.password = password;
    this.emailLink = emailLink;
  }

  /** Deserializes a JSON representation into an EmailAuthCredential */
  static fromJSON(json: { email: string; password?: string; emailLink?: string }): EmailAuthCredential {
    return new EmailAuthCredential("password",'password', json.email);
  }

  /** Returns a JSON-serializable representation */
  toJSON(): { providerId: string; signInMethod: string; email: string; password?: string; emailLink?: string } {
    return {
      providerId: this.providerId,
      signInMethod: this.signInMethod,
      email: this.email
    };
  }
}

/**
 * Class representing the User along with the Auth Credential.
 */
export class UserCredential {
  /**
   * Constructor to create an instance of the class.
   * @param {User} user
   * @param {AuthCredential} credential
   */
  user: User;
  credential: AuthCredential;
  providerId: string;

constructor(user: User, credential: AuthCredential) {
    this.user = user;
    this.credential = credential;
    this.providerId = credential.providerId;
  }
}

/**
 * Credential class for OAuthCredential.
 */
export class SAMLAuthCredential extends AuthCredential {
  accessToken = "";
  idToken = "";   // Will be null always

  toJSON(): { providerId: string; signInMethod: string; accessToken: string; idToken: string } {
    return {
      providerId: this.providerId,
      signInMethod: this.signInMethod,
      accessToken: this.accessToken,
      idToken: this.idToken
    };
  }

  /**
  * @property 
  */
  /**
   * Method to convert the data in JSON format to data members.
   * (Needs a lookup)
   */
static fromJSON(authCredential: string): SAMLAuthCredential {
    argCheck(authCredential, "Invalid object", true, [typeStrings.OBJECT]);
    const res = JSON.parse(authCredential);
    const oauth = new SAMLAuthCredential(res.providerId, res.signInMethod);
    oauth.accessToken = res.accessToken;
    oauth.idToken = res.idToken;
    return oauth;
  }

}
