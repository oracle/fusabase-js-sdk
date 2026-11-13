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

/** Base credential used to authenticate an account. @example `await signInWithCredential(auth, credential);` */
export class AuthCredential {
  /** The authentication provider ID for this credential */
  readonly providerId: string;

  /** The sign-in method associated with this credential */
  readonly signInMethod: string;

/**
 * Constructs a AuthCredential instance with the supplied configuration.
 *
 * @param providerId - The provider identifier.
 * @param signInMethod - The signInMethod accepted by this operation.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { AuthCredential } from "fusabase/auth";
 * const result = new AuthCredential("example-provider", value);
 * void result;
 * ```
 */
  constructor(providerId: string, signInMethod: string) {
    this.providerId = providerId;
    this.signInMethod = signInMethod;
  }

/**
 * Executes the toJSON operation for this public SDK type.
 *
 * @returns The result produced by `toJSON`, including any requested data or handle.
 * @example
 * ```ts
 * import { AuthCredential } from "fusabase/auth";
 * const result = client.toJSON();
 * void result;
 * ```
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
/** Email-and-password credential. @example `const credential = EmailAuthProvider.credential(email, password);` */
export class EmailAuthCredential extends AuthCredential {
  /** Email address associated with this credential. */
  readonly email: string;
  /** Password supplied for password-based sign-in, when present. */
  readonly password?: string|null;
  /** Email sign-in link associated with this credential, when present. */
  readonly emailLink?: string|null;

/**
 * Constructs a EmailAuthCredential instance with the supplied configuration.
 *
 * @param providerId - The provider identifier.
 * @param methodUsed - The methodUsed accepted by this operation.
 * @param email - The account email address.
 * @param password - The account password.
 * @param emailLink - The emailLink accepted by this operation.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { EmailAuthCredential } from "fusabase/auth";
 * const result = new EmailAuthCredential("example-provider", value, "user@example.com", "correct-horse-battery-staple", "user@example.com");
 * void result;
 * ```
 */
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

/**
 * Executes the fromJSON operation for this public SDK type.
 *
 * @param json - The json accepted by this operation.
 * @returns The result produced by `fromJSON`, including any requested data or handle.
 * @example
 * ```ts
 * import { EmailAuthCredential } from "fusabase/auth";
 * const result = EmailAuthCredential.fromJSON(value);
 * void result;
 * ```
 */
  static fromJSON(json: { email: string; password?: string; emailLink?: string }): EmailAuthCredential {
    return new EmailAuthCredential("password",'password', json.email);
  }

/**
 * Executes the toJSON operation for this public SDK type.
 *
 * @returns The result produced by `toJSON`, including any requested data or handle.
 * @example
 * ```ts
 * import { EmailAuthCredential } from "fusabase/auth";
 * const result = client.toJSON();
 * void result;
 * ```
 */
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
/** Result returned after a successful account operation. @example `const credential = await signInWithEmailAndPassword(auth, email, password);` */
export class UserCredential {
  /**
   * Constructor to create an instance of the class.
   * @param {User} user
   * @param {AuthCredential} credential
   */
  user: User;
  /** Credential used to complete the account operation. */
  credential: AuthCredential;
  /** Provider identifier associated with the credential. */
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
/** Credential returned by a SAML provider. @example `const credential = SAMLAuthProvider.credential(token);` */
export class SAMLAuthCredential extends AuthCredential {
  /** Provider access token, when supplied by the identity provider. */
  accessToken = "";
  /** Provider ID token, when supplied by the identity provider. */
  idToken = "";   // Will be null always

/**
 * Executes the toJSON operation for this public SDK type.
 *
 * @returns The result produced by `toJSON`, including any requested data or handle.
 * @example
 * ```ts
 * import { SAMLAuthCredential } from "fusabase/auth";
 * const result = client.toJSON();
 * void result;
 * ```
 */
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
 * Executes the fromJSON operation for this public SDK type.
 *
 * @param authCredential - The authCredential accepted by this operation.
 * @returns The result produced by `fromJSON`, including any requested data or handle.
 * @example
 * ```ts
 * import { SAMLAuthCredential } from "fusabase/auth";
 * const result = SAMLAuthCredential.fromJSON(value);
 * void result;
 * ```
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
