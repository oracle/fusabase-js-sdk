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

import { UserCredential, AuthCredential, SAMLAuthCredential } from '../internal/credential.js';
import { AuthError, ErrorCode, ErrorCodeMessage } from '../errors.js';
import { AuthProvider } from './provider.js';
import { authErrorHandler } from '../errors.js';

/**
 * The SAMLAuthProvider class allows you to generate credentials for SAML-based authentication.
 * It provides methods for obtaining credentials and setting custom parameters for SAML flows.
 *
 * @example
 * ```ts
 * // Example usage to generate SAMLAuthCredential using SAML access token
 * const samlCredential = SAMLAuthProvider.credential('SAML_ACCESS_TOKEN');
 * ```
 */
export class SAMLAuthProvider extends AuthProvider {

  static SAML_SIGN_IN_METHOD = "saml";
  static PROVIDER_ID: string = 'saml';

  private customParameters: Record<string, unknown>;

  constructor(providerId: string) {
    // Input Sanitation
    if (typeof providerId === "string" && providerId !== "") {
      super(providerId);
      this.providerId = providerId;
      this.customParameters = {};
    }
    else
      throw authErrorHandler(new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid providerId provided to SAMLAuthProvider"));
  }

  /**
  * @property 
  */
  get providerName() {
    return this.providerId;
  }

   /**
  * @property 
  */
  static credential(accessToken?: string): SAMLAuthCredential {
    if (typeof accessToken !== "string") {
      throw authErrorHandler(new AuthError(ErrorCodeMessage.INVALID_ARGS,"Invalid credentials provided to credential()"));
    }

    let samlCreds = new SAMLAuthCredential(this.PROVIDER_ID, this.SAML_SIGN_IN_METHOD);
    samlCreds.accessToken = accessToken;

    return samlCreds;
  }

    static credentialFromError(error: AuthError): AuthCredential | null {
      if (!(error instanceof AuthError)) {
        return null;
      }
      return null;
    }

    static credentialFromResult(userCredential: UserCredential): AuthCredential | null {
      if (!(userCredential instanceof UserCredential)) {
        let error = new AuthError(ErrorCodeMessage.INVALID_ARGS,`Invalid credentials`);
        throw authErrorHandler(error);
      }
      return userCredential.credential;
    }

    setCustomParameters(params: Record<string, unknown>): this {
      this.customParameters = params;
      return this;
    }
}
