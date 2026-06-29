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

import {LogLevel} from "../../../logger/LogLevel.js";
import { IDCSConfig, ONPREMConfig } from "./config.js";
import { Utils } from "../util/util.js";
import { AuthError, ErrorCode, authErrorHandler, ErrorCodeMessage, getErrorMessage } from "../errors.js";
import { IdTokenResult } from "../types/idtoken.js";
import { convertIatToTimestamp } from '../util/util.js'
import { fusabaseFetch } from '../../../app/src/fusabase-fetch.js';
/**
 * Internal Helper class for Auth for IDCS.
 * Mirrors the base/onprem helper; the IDCS config supplies the idcs URL segment.
 */
/**
 * @internal
 */
export class IDCSAuthHelper {
  private delegate: ONPREMAuthHelper;
  config: IDCSConfig;
  logLevel: LogLevel;
  ordsHostOrigin: string;

  /** @internal */
  private _app: any;

  constructor(config: IDCSConfig, logLevel: LogLevel, ordsHostOrigin?: string) {
    this.config = config;
    this.logLevel = logLevel;
    this.ordsHostOrigin = ordsHostOrigin ?? "";
    this.delegate = new ONPREMAuthHelper(config, logLevel, ordsHostOrigin);
    this._app = null;
  }

  /** @internal */
  _setApp(app: any): void {
    this._app = app;
    this.delegate._setApp(app);
  }
  async authenticateAndGetDetails(email: string, password: string): Promise<any> {
    return this.delegate.authenticateAndGetDetails(email, password);
  }

  async authenticateUser(email: string, password: string): Promise<any> {
    return this.delegate.authenticateUser(email, password);
  }


  async reloadUser(user: any): Promise<any> {
    return this.delegate.reloadUser(user);
  }

  async getUserDetails(access_token?: IdTokenResult): Promise<any> {
    return this.delegate.getUserDetails(access_token);
  }

  async registerUser(email: string, password: string, url:string): Promise<any> {
    return this.delegate.registerUser(email, password, url);
  }

  base64UrlEncode(arrayBuffer: Uint8Array): string {
    return this.delegate.base64UrlEncode(arrayBuffer);
  }

  generateCodeVerifier(length = 96): string {
    return this.delegate.generateCodeVerifier(length);
  }

  async generateCodeChallenge(codeVerifier: string): Promise<string> {
    return this.delegate.generateCodeChallenge(codeVerifier);
  }

  async getRedirectCredentials(code: string, url: string): Promise<any> {
    return this.delegate.getRedirectCredentials(code, url);
  }

  async socialLogin(url: string): Promise<any> {
    return this.delegate.socialLogin(url);
  }

  async listenForAuthToken(popupWindow: any): Promise<any> {
    return this.delegate.listenForAuthToken(popupWindow);
  }

  async performSignOut(refresh_token: string): Promise<void> {
    try {
      await this.delegate.performSignOut(refresh_token);
    } finally {
      await this.signOutFromIDCS();
    }
  }

  async signOutFromIDCS(): Promise<void> {
    let response: Response | null = null;
    const reqURL = `${this.config.idcsDomainURL}${IDCSConfig.LOGOUT_REST_EP}`;
    const params = {
      method: "GET",
      headers: {
        "Content-Type": "application/scim+json",
      },
    };

    try {
      response = await fusabaseFetch(this._app, reqURL, params);
      if (!response) {
        throw new AuthError(ErrorCodeMessage.UNKNOWN, getErrorMessage('FAILED_OPERATION', 'sign out from IDCS'));
      }
      Utils.checkResponse(response);
    } catch (err: any) {
      Utils.baasTrace(this.logLevel, params, reqURL, response);
      err.status = response? response.status : 408;
      err.authType = this.config.authType.toUpperCase();
      if (response) {
        try {
          const newMessage = await response.json();
          err.message = newMessage["detail"] || 'Unknown error';
        } catch (jsonErr) {
          err.message = 'Unknown';
        }
      } else {
        err.message = 'Network error';
      }
      throw authErrorHandler(err);
    }
  }

  async revokeRefreshToken(refresh_token: string): Promise<void> {
    return this.delegate.revokeRefreshToken(refresh_token);
  }

  async sendPasswordResetEmailHelper(email: string): Promise<void> {
    return this.delegate.sendPasswordResetEmailHelper(email);
  }

  async verifyPasswordResetCodeHelper(code: string): Promise<any> {
    return this.delegate.verifyPasswordResetCodeHelper(code);
  }

  async confirmPasswordResetHelper(code: string, newPass: string, email: string): Promise<any> {
    return this.delegate.confirmPasswordResetHelper(code, newPass, email);
  }

  async signInWithCredentialHelper(credential: any): Promise<any> {
    return this.delegate.signInWithCredentialHelper(credential);
  }
}


/**
 * Internal helper class for Auth for Onprem.
 */
/**
 * @internal
 */
export class ONPREMAuthHelper {
  config: ONPREMConfig;
  logLevel: LogLevel;
  ordsHostOrigin: string;

  /** @internal */
  private _app:any;

  constructor(config: ONPREMConfig, logLevel: LogLevel, ordsHostOrigin?: string) {
    this.config = config;
    this.logLevel = logLevel;
    this.ordsHostOrigin = ordsHostOrigin ?? "";
    this._app = null;
  }

  /** @internal */
  _setApp(app: any): void {
    this._app = app;
  }

  async authenticateAndGetDetails(email: string, password: string): Promise<any> {
    const tok_res = await this.authenticateUser(email, password);
    const access_token = tok_res.access_token;
    const refresh_token = tok_res.refresh_token;
    const userDetails = await this.getUserDetails(access_token);
    return {
      userDetails: userDetails,
      authnToken: null,
      access_token: access_token,
      refresh_token: refresh_token,
    };
  }

  async authenticateUser(email: string, password: string): Promise<any> {
    let response: Response | null = null;
    let result: any = null;
    const reqURL = `${this.config.domainURL}${ONPREMConfig.AUTHENTICATE_REST_EP}?apiKey=${this.config.appID}`;
    const params = {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: "user_credentials",
        username: email,
        password: password,
      }),
    };

    try {
      response = await fusabaseFetch(this._app, reqURL, params);
      Utils.checkResponse(response);
      result = await response.json();
      const tok_res = {
        access_token: new IdTokenResult(result.access_token),
        refresh_token: String(result.refresh_token),
      };
      return tok_res;
    } catch (err: any) {
      Utils.baasTrace(this.logLevel, {}, reqURL, response, result);
      err.status = response? response.status : 408;
      err.authType = this.config.authType.toUpperCase();
      if (response) {
        try {
          const newMessage = await response.json();
          err.message = newMessage["error"] || 'Unknown error';
        } catch (jsonErr) {
          err.message = 'Unknown';
        }
      } else {
        err.message = 'Network error';
      }
      throw authErrorHandler(err);
    }
  }

  async reloadUser(user: any): Promise<any> {
    const access_token = await user.getIdTokenResult(true);
    return this.getUserDetails(access_token);
  }

  async getUserDetails(access_token?: IdTokenResult): Promise<any> {
    if (access_token == null) {
      Utils.baasTrace(this.logLevel);
      let err = new AuthError(ErrorCodeMessage.UNKNOWN, getErrorMessage('NULL_TOKEN'));
      err.status = ErrorCode.INVALID_USER_TOK;
      err.authType = this.config.authType.toUpperCase();
      throw authErrorHandler(err);
    }
    const data = Utils.parseJWT(access_token.token);

    const userData = {
      "displayName": data.user_displayname,
      "emails": [{ "value": data.sub }],
      "meta": {
        "created": data.creation_time,
        "lastSignIn": convertIatToTimestamp(data.iat),
      },
      "id": data.user_id,
      "idcsCreatedBy": data.iss,
      "schemas": null,
      "phoneNumbers": [{
        "value": data.user_phonenumber !== undefined ? data.user_phonenumber : null,
      }],
      "photos": [{
        "value": data.photo_url !== undefined ? data.photo_url : null,
      }],
      "emailVerified": data.email_verified,
      "ocid": null,
      "idp_name": data.idp_name,
      "idp_type": data.idp_type,
    };
    return userData;
  }

  async registerUser(email: string, password: string, url:string): Promise<any> {
    let response: Response | null = null;
    let result: any = null;
    const reqURL = `${this.config.domainURL}${ONPREMConfig.SELF_REGISTER_EP}?apiKey=${this.config.appID}`;
    const params = {
      method: "POST",
      headers: { },
      body: JSON.stringify({
        "first_name": "-",
        "last_name": "-",
        "email": email,
        "password": password,
      }),
    };

    try {
      response = await fusabaseFetch(this._app, reqURL, params);
      Utils.checkResponse(response);
    } catch (err: any) {
      Utils.baasTrace(this.logLevel, {}, reqURL, response, result);
      err.status = response? response.status : 408;
      err.authType = this.config.authType.toUpperCase();
      if (response) {
        try {
          const newMessage = await response.json();
          err.message = newMessage["error"] || 'Unknown error';
        } catch (jsonErr) {
          err.message = 'Unknown';
        }
      } else {
        err.message = 'Network error';
      }
      throw authErrorHandler(err);
    }
  }

  base64UrlEncode(arrayBuffer: Uint8Array): string {
    return btoa(String.fromCharCode(...arrayBuffer))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  generateCodeVerifier(length = 96): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  async generateCodeChallenge(codeVerifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(digest));
  }

  async getRedirectCredentials(code: string, url: string): Promise<any> {
    let response: Response | null = null;
    let result: any = null;
    const codeVerifier = localStorage.getItem("codeVerifier");
    const reqURL = `${this.config.domainURL}${ONPREMConfig.REDIRECT_RESULT_EP}?apiKey=${this.config.appID}`;
    const params = {
      method: "POST",
      body: JSON.stringify({
        "code_verifier": codeVerifier,
        "code": code,
      }),
    };

    try {
      response = await fusabaseFetch(this._app,reqURL, params);
      Utils.checkResponse(response);
      result = await response.json();
      Utils.baasLogger(this.logLevel, "Fetched response ", result);
      return result;
    } catch (err) {
      Utils.baasLogger(this.logLevel, "Error occurred in getting creds", err);
    }
  }

  async socialLogin(url: string): Promise<any> {
    const popup = window.open("", "name", "width=800,height=600");
    if (popup) {
      popup.location.href = url;
      const data = await this.listenForAuthToken(popup);
      popup.close();

      return {
        authnToken: null,
        tokens: {
          access_token: new IdTokenResult(data.access_token),
          refresh_token: data.refresh_token,
        },
      };
    } else {
      throw new AuthError(ErrorCodeMessage.UNKNOWN, getErrorMessage('POPUP_BLOCKED_SIMPLE'));
    }
  }

  async listenForAuthToken(popupWindow: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      const expectedOrigin = this.ordsHostOrigin;
      const providerAuthToken = (event: MessageEvent) => {
        if (event.source !== popupWindow) return;
        if (event.origin !== expectedOrigin) return;
        try {
          const data = JSON.parse(event.data);
          controller.abort();
          resolve(data);
        } catch (err) {
          reject(err);
        }
      };
      window.addEventListener("message", providerAuthToken, { signal: controller.signal });
    });
  }

  async performSignOut(refresh_token: string): Promise<void> {
    await this.revokeRefreshToken(refresh_token);
  }

  async revokeRefreshToken(refresh_token: string): Promise<void> {
    let response: Response | null = null;
    const reqURL = `${this.config.domainURL}${ONPREMConfig.REVOKE_REFRESH_TOKEN}?apiKey=${this.config.appID}`;
    const params = {
      method: "PUT",
      headers: {},
      body: JSON.stringify({
        "token": refresh_token,
      }),
    };

    try {
      response = await fusabaseFetch(this._app, reqURL, params);
      Utils.checkResponse(response);
    } catch (err: any) {
      Utils.baasTrace(this.logLevel, {}, reqURL, response);
      err.status = response? response.status : 408;
      err.authType = this.config.authType.toUpperCase();
      if (response) {
        try {
          const newMessage = await response.json();
          err.message = newMessage["error"] || 'Unknown error';
        } catch (jsonErr) {
          err.message = 'Unknown';
        }
      } else {
        err.message = 'Network error';
      }
      throw authErrorHandler(err);
    }
  }

  async sendPasswordResetEmailHelper(email: string): Promise<void> {
    let response: Response | null = null;
    const reqURL = `${this.config.domainURL}${ONPREMConfig.SEND_PASSWORD_RESET_EMAIL}?apiKey=${this.config.appID}&email=${email}&requesttype=resetpwd`;
    const params = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    };

    try {
      response = await fusabaseFetch(this._app, reqURL, params);
      Utils.checkResponse(response);
    } catch (err: any) {
      Utils.baasTrace(this.logLevel, {}, reqURL, response);
      err.status = response? response.status : 408;
      err.authType = this.config.authType.toUpperCase();
      if (response) {
        try {
          const newMessage = await response.json();
          err.message = newMessage["error"] || 'Unknown error';
        } catch (jsonErr) {
          err.message = 'Unknown';
        }
      } else {
        err.message = 'Network error';
      }
      throw authErrorHandler(err);
    }
  }

  async verifyPasswordResetCodeHelper(code: string): Promise<any> {
    let response: Response | null = null;
    let result: any = null;
    const reqURL = `${this.config.domainURL}${ONPREMConfig.VERIFY_PASSWORD_RESET_CODE}?apiKey=${this.config.appID}&code=${code}&requesttype=resetpwd`;
    const params = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    };

    try {
      response = await fusabaseFetch(this._app, reqURL, params);
      Utils.checkResponse(response);
      result = await response.json();
      return result.username;
    } catch (err: any) {
      Utils.baasTrace(this.logLevel, params, reqURL, response, result);
      err.status = response? response.status : 408;
      err.authType = this.config.authType.toUpperCase();
      if (response) {
        try {
          const newMessage = await response.json();
          err.message = newMessage["error"] || 'Unknown error';
        } catch (jsonErr) {
          err.message = 'Unknown';
        }
      } else {
        err.message = 'Network error';
      }
      throw authErrorHandler(err);
    }
  }

  async confirmPasswordResetHelper(code: string, newPass: string, email: string): Promise<any> {
    let response: Response | null = null;
    let result: any = null;
    const reqURL = `${this.config.domainURL}${ONPREMConfig.CONFIRM_PASSWORD_RESET}?apiKey=${this.config.appID}&requesttype=resetpwd`;
    const params = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        password: newPass,
      }),
    };

    try {
      response = await fusabaseFetch(this._app, reqURL, params);
      if (!response) throw new AuthError(ErrorCodeMessage.UNKNOWN, getErrorMessage('FAILED_OPERATION', 'confirm password reset'));
      Utils.checkResponse(response);
      result = await response.json();
      return result;
    } catch (err: any) {
      Utils.baasTrace(this.logLevel, {}, reqURL, response, result);
      err.status = response? response.status : 408;
      err.authType = this.config.authType.toUpperCase();
      if (response) {
        try {
          const newMessage = await response.json();
          err.message = newMessage["error"] || 'Unknown error';
        } catch (jsonErr) {
          err.message = 'Unknown';
        }
      } else {
        err.message = 'Network error';
      }
      throw authErrorHandler(err);
    }
  }

  async signInWithCredentialHelper(credential: any): Promise<any> {
    let response: Response | null = null;
    let result: any = null;
    const reqURL = `${this.config.domainURL}${ONPREMConfig.SIGN_IN_WITH_CREDENTIAL}?apiKey=${this.config.appID}&method=${credential.providerId}&link=0`;
    const params = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "token": credential.idToken,
      }),
    };

    try {
      response = await fusabaseFetch(this._app, reqURL, params);
      Utils.checkResponse(response);
      result = await response.json();
      return result;
    } catch (err: any) {
      Utils.baasTrace(this.logLevel, params, reqURL, response, result);
      err.status = response? response.status : 408;
      err.authType = this.config.authType.toUpperCase();
      if (response) {
        try {
          const newMessage = await response.json();
          err.message = newMessage["error"] || 'Unknown error';
        } catch (jsonErr) {
          err.message = 'Unknown';
        }
      } else {
        err.message = 'Network error';
      }
      throw authErrorHandler(err);
    }
  }
}

// export class ONPREMSRPAuthHelper extends ONPREMAuthHelper {

//   constructor(config: ONPREMSRPConfig, logLevel: LogLevel) {
//     super(config, logLevel);
//     this.logLevel = logLevel;
//   }

//   generateRandomBigInteger(bits: number): bigint {
//     const bytes = bits / 8;
//     const buffer = new Uint8Array(bytes);
//     crypto.getRandomValues(buffer);
//     return BigInt('0x' + Array.from(buffer, (byte) => byte.toString(16).padStart(2, '0')).join(''));
//   }

//   generateSalt(): string {
//     const lengthInBytes = 128 / 8;
//     const array = new Uint8Array(lengthInBytes);
//     crypto.getRandomValues(array);
//     return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
//   }

//   async generateHash(input: string): Promise<string> {
//     const encoder = new TextEncoder();
//     const data = encoder.encode(input);
//     const hash = await crypto.subtle.digest('SHA-256', data);
//     let hexString = '';
//     const hashArray = Array.from(new Uint8Array(hash));
//     hashArray.forEach((b) => {
//       const hex = b.toString(16).padStart(2, '0');
//       hexString += hex;
//     });
//     return hexString;
//   }

//   async encodeToBigInt(text: string): Promise<bigint> {
//     const hex = await this.generateHash(text);
//     return BigInt('0x' + hex);
//   }

//   async getSharedKey(email: string): Promise<any> {
//     let response: Response | null = null;
//     let result: any = null;
//     const reqURL = `${this.config.domainURL}${ONPREMSRPConfig.GET_SHARED_KEY}?apiKey=${this.config.appID}&email=${email}`;
//     const params = {
//       method: "GET",
//       headers: {
//         "Content-Type": "application/json",
//       },
//     };

//     try {
//       response = await fusabaseFetch(this._app,reqURL, params);
//       Utils.checkResponse(response);
//       result = await response.json();
//       return result;
//     } catch (err: any) {
//       Utils.baasTrace(this.logLevel, params, reqURL, response, result);
//       err.status = response? response.status : 408;
//       err.authType = this.config.authType.toUpperCase();
//       if (response) {
//         try {
//           const newMessage = await response.json();
//           err.message = newMessage["error"] || 'Unknown error';
//         } catch (jsonErr) {
//           err.message = 'Unknown';
//         }
//       } else {
//         err.message = 'Network error';
//       }
//       throw authErrorHandler(err);
//     }
//   }

//   async addUserUsingSRP(body: any): Promise<any> {
//     let response: Response | null = null;
//     let result: any = null;
//     const reqURL = `${this.config.domainURL}${ONPREMSRPConfig.SRP_ADD_USER}?apiKey=${this.config.appID}`;
//     const params = {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: safeStringify(body),
//     };

//     try {
//       response = await fusabaseFetch(this._app,reqURL, params);
//       Utils.checkResponse(response);
//       result = await response.json();
//       const tok_res = {
//         access_token: new IdTokenResult(result.access_token),
//         refresh_token: String(result.refresh_token),
//       };
//       return tok_res;
//     } catch (err: any) {
//       Utils.baasTrace(this.logLevel, params, reqURL, response, result);
//       err.status = response? response.status : 408;
//       err.authType = this.config.authType.toUpperCase();
//       if (response) {
//         try {
//           const newMessage = await response.json();
//           err.message = newMessage["error"] || 'Unknown error';
//         } catch (jsonErr) {
//           err.message = 'Unknown';
//         }
//       } else {
//         err.message = 'Network error';
//       }
//       throw authErrorHandler(err);
//     }
//   }

//   async registerUser(email: string, password: string): Promise<any> {
//     const res = await this.getSharedKey(email);
//     const salt = this.generateSalt();
//     const credHash = await this.generateHash(`${email}${password}`);
//     const X = await this.encodeToBigInt(`${salt}${credHash}`);
//     const G = BigInt(res["G"]);
//     const N = BigInt(res["N"]);
//     const K = BigInt(res["K"]);
//     const V = modPow(G, X, N);
//     const tokens = await this.addUserUsingSRP({
//       "n": N,
//       "g": G,
//       "k": K,
//       "v": V,
//       "s": salt,
//       "email": email,
//       "first_name": "-",
//       "last_name": "-",
//     });
//     const userDetails = await this.getUserDetails(tokens.access_token);
//     return {
//       userDetails: userDetails,
//       authnToken: null,
//       access_token: tokens.access_token,
//       refresh_token: tokens.refresh_token,
//     };
//   }

//   async keyExchangeSRP(A: bigint, email: string): Promise<any> {
//     let response: Response | null = null;
//     let result: any = null;
//     const reqURL = `${this.config.domainURL}${ONPREMSRPConfig.SRP_AUTHENTICATE_USER}?apiKey=${this.config.appID}&reqtype=key_exchange`;
//     const params = {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: safeStringify({
//         'A': A.toString(),
//         "email": email,
//       }),
//     };

//     try {
//       response = await fusabaseFetch(this._app,reqURL, params);
//       Utils.checkResponse(response);
//       result = await response.json();
//       return result;
//     } catch (err: any) {
//       Utils.baasTrace(this.logLevel, params, reqURL, response, result);
//       err.status = response? response.status : 408;
//       err.authType = this.config.authType.toUpperCase();
//       if (response) {
//         try {
//           const newMessage = await response.json();
//           err.message = newMessage["error"] || 'Unknown error';
//         } catch (jsonErr) {
//           err.message = 'Unknown';
//         }
//       } else {
//         err.message = 'Network error';
//       }
//       throw authErrorHandler(err);
//     }
//   }

//   async sessionMatchSRP(sharedkey: bigint, email: string): Promise<any> {
//     let response: Response | null = null;
//     let result: any = null;
//     const reqURL = `${this.config.domainURL}${ONPREMSRPConfig.SRP_AUTHENTICATE_USER}?apiKey=${this.config.appID}&reqtype=session_match`;
//     const params = {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: safeStringify({
//         'shared_key': sharedkey.toString(),
//         "email": email,
//       }),
//     };

//     try {
//       response = await fusabaseFetch(this._app,reqURL, params);
//       Utils.checkResponse(response);
//       result = await response.json();
//       return result;
//     } catch (err: any) {
//       Utils.baasTrace(this.logLevel, params, reqURL, response, result);
//       err.status = response? response.status : 408;
//       err.authType = this.config.authType.toUpperCase();
//       if (response) {
//         try {
//           const newMessage = await response.json();
//           err.message = newMessage["error"] || 'Unknown error';
//         } catch (jsonErr) {
//           err.message = 'Unknown';
//         }
//       } else {
//         err.message = 'Network error';
//       }
//       throw authErrorHandler(err);
//     }
//   }

//   async authenticateAndGetDetails(email: string, password: string): Promise<{ userDetails: any, authnToken: null, access_token: IdTokenResult, refresh_token: string }> {
//     const a = this.generateRandomBigInteger(256);
//     const res = await this.getSharedKey(email);
//     const G = BigInt(res["G"]);
//     const N = BigInt(res["N"]);
//     const K = BigInt(res["K"]);
//     const A = modPow(G, a, N);
//     const key_res = await this.keyExchangeSRP(A, email);
//     const U = await this.encodeToBigInt(`${A}${BigInt(key_res["B"])}`);
//     const B = BigInt(key_res["B"]);
//     const salt = BigInt('0x' + key_res["salt"]);
//     const credHash = await this.generateHash(`${email}${password}`);
//     const X = await this.encodeToBigInt(`${salt}${credHash}`);
//     const gPowXmodN = modPow(G, X, N);
//     const kTimesgPowXmodN = K * gPowXmodN;
//     const subB = BigInt(B - kTimesgPowXmodN);
//     const subtractedValue = customMod(subB, N);
//     const exponent = a + (U * X);
//     const S = modPow(subtractedValue, exponent, N);
//     const f_K = await this.encodeToBigInt(S.toString());
//     const tokens = await this.sessionMatchSRP(f_K, email);
//     const userDetails = await this.getUserDetails(tokens.access_token);
//     return {
//       userDetails: userDetails,
//       authnToken: null,
//       access_token: tokens.access_token,
//       refresh_token: tokens.refresh_token,
//     };
//   }

//   async resetPasswordRequest(body: any): Promise<any> {
//     let response: Response | null = null;
//     let result: any = null;
//     const reqURL = `${this.config.domainURL}${ONPREMSRPConfig.SRP_RESET_PASSWORD}?apiKey=${this.config.appID}&reqtype=session_match`;
//     const params = {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: safeStringify(body),
//     };

//     try {
//       response = await fusabaseFetch(this._app,reqURL, params);
//       Utils.checkResponse(response);
//       result = await response.json();
//       return result;
//     } catch (err: any) {
//       Utils.baasTrace(this.logLevel, params, reqURL, response, result);
//       err.status = response? response.status : 408;
//       err.authType = this.config.authType.toUpperCase();
//       if (response) {
//         try {
//           const newMessage = await response.json();
//           err.message = newMessage["error"] || 'Unknown error';
//         } catch (jsonErr) {
//           err.message = 'Unknown';
//         }
//       } else {
//         err.message = 'Network error';
//       }
//       throw authErrorHandler(err);
//     }
//   }

//   async confirmPasswordResetHelper(code: string, newPassword: string, email: string): Promise<any> {
//     const a = this.generateRandomBigInteger(256);
//     const res = await this.getSharedKey(email);
//     const G = BigInt(res["G"]);
//     const N = BigInt(res["N"]);
//     const K = BigInt(res["K"]);
//     const A = modPow(G, a, N);
//     const key_res = await this.keyExchangeSRP(A, email);
//     const U = await this.encodeToBigInt(`${A}${BigInt(key_res["B"])}`);
//     const B = BigInt(key_res["B"]);
//     const salt = BigInt('0x' + key_res["salt"]);
//     const credHash = await this.generateHash(`${email}${newPassword}`);
//     const X = await this.encodeToBigInt(`${salt}${credHash}`);
//     const gPowXmodN = modPow(G, X, N);
//     const result = await this.resetPasswordRequest({
//       "V": gPowXmodN.toString(),
//       "salt": salt.toString(),
//       "email": email,
//       "code": code,
//     });
//     if (!(result["success"] && result["success"][0] === 1)) {
//       const error = new AuthError(ErrorCodeMessage.UNKNOWN, getErrorMessage('PASSWORD_RESET_FAILED'));
//       error.status = ErrorCode.UNKNOWN;
//       throw authErrorHandler(error);
//     }
//   }
// }
