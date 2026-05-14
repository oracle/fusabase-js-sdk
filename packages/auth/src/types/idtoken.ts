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

/**
 * ID token result from getIdTokenResult().
 */
// export interface IdTokenResult {
//   token: string;
//   expirationTime: string;
//   authTime: string;
//   issuedAtTime: string;
//   signInProvider?: string | null;
//   claims: Record<string, any>;
// }


import { authErrorHandler } from "../errors.js";
import { Utils } from "../util/util.js";

interface AuthError extends Error {
  status?: number;
}

/**
 * Structure representing a parsed JWT token.
 *
 * @example
 * ```ts
 * const parsed: ParsedToken = {
 *   header: { alg: 'RS256', typ: 'JWT' },
 *   payload: { sub: 'user123', iat: 1234567890, exp: 1234567900 },
 *   signature: 'signature_string',
 *   iat: 1234567890,
 *   exp: 1234567900,
 *   sub: 'user123'
 * };
 * ```
 */
export interface ParsedToken {
  /** JWT header containing algorithm and token type */
  header: Record<string, any>;
  /** JWT payload containing claims */
  payload: Record<string, any>;
  /** JWT signature */
  signature: string;
  /** Issued at timestamp */
  iat: number;
  /** Expiration timestamp */
  exp: number;
  /** Subject identifier */
  sub: string;
}


/**
 * Represents the result of an ID token, containing the token string and metadata.
 *
 * @example
 * ```ts
 * const tokenResult = new IdTokenResult('eyJ...', 'password');
 * console.log(tokenResult.token); // The JWT token string
 * console.log(tokenResult.expirationTime); // Expiration timestamp
 * ```
 */
export class IdTokenResult {
  private intToken:string;
  issuedAtTime: number | null = null;
  expirationTime: number | null = null;
  authTime: number | null = null;

  signInProvider?: string | null;
  claims: Record<string, any> = {};
  parsedJwt: ParsedToken | null = null;

  /**
   * Constructs the token.

   * @param {String} token
   */
  constructor(token: string, provider = 'password') {

    if (token.length === 0) {
      let error: AuthError = new Error(`Empty token provided`);
      error.status = 400;
      throw authErrorHandler(error);
    }

    this.intToken = token;
    this.parsedJwt = Utils.parseJWT(token);
    if (this.parsedJwt) {
      this.issuedAtTime = this.parsedJwt.iat;
      this.expirationTime = this.parsedJwt.exp;
      this.authTime = this.parsedJwt.iat;

      this.claims = {
        auth_time: this.parsedJwt.iat,
        exp: this.parsedJwt.exp,
        iat: this.parsedJwt.iat,
        sub: this.parsedJwt.sub
      };
    }
    this.signInProvider = provider;
  }

  /**
   * Internal method to check validity of the access token.
   */
  /**
   * @internal
   */
  private validateAccessToken(): boolean {
    let exp = 0;
    if (this.expirationTime) {
      exp = this.expirationTime;
    }
    if (
      exp <
      Math.round(new Date().getTime() / 1000)
    ) {
      return false;
    }
    return true;
  }


  get token(): string {
    return this.validateAccessToken() ? this.intToken : "";
  }

  /**
   * Internal method to stringify the token object.
   */
  stringify() {
    return JSON.stringify({
      ['token']: this.token,
      ['issuedAtTime']: this.issuedAtTime,
      ['expirationTime']: this.expirationTime,
      ['authTime']: this.authTime,
      ['parsedJwt']: this.parsedJwt,
    })
  }
}
