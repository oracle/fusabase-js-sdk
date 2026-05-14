import { IDCSConfig, ONPREMConfig } from "./config.js";
import { AuthError, authErrorHandler, ErrorCode, ErrorCodeMessage } from "../errors.js";
import { IdTokenResult } from "../types/idtoken.js";
import { Utils, safeStringify, customMod, modPow } from '../util/util.js';
import { LogLevel } from "../../../logger/LogLevel.js";
import { AuthCredential, EmailAuthCredential } from "../internal/credential.js";
import { EmailAuthProvider } from "../providers/email.js";
import { fusabaseFetch } from "../../../app/src/fusabase-fetch.js";
import type { App } from "../../../app/src/public-types.js";

/**
 * Internal helper class for IDCS user.
 */
/**
 * @internal
 */
export class IDCSUserHelper {
  readonly config: any;
  private authnToken: string | null;
  acc_tok: IdTokenResult | null;
  private encodedSecret: string;
  user: any;
  fusabase_token: IdTokenResult | null;
  protected logLevel: LogLevel;
  private refresh_token: string | null;

  /** @internal */
  private _app:any;
  

  /**
   * Constructs the UserHelper object.
   * @param config 
   * @param authnToken 
   * @param acc_tok 
   * @param logLevel 
   */
  constructor(config: any, authnToken: string | null, acc_tok: IdTokenResult, logLevel: LogLevel) {
    this.config = config;
    this.authnToken = authnToken;
    this.acc_tok = acc_tok;
    this.fusabase_token = null;
    this.refresh_token = null;
    this.encodedSecret = btoa(
      `${this.config.clientId}:${this.config.clientSecret}`
    );
    this.logLevel = logLevel;
    this._app = null;
  }

  /** @internal */
  _setApp(app: any): void {
    this._app = app;
  }

  /**
   * Utility function to refresh access token.
   * @param refresh_token 
   * @returns Refresh Token
   */
  async refreshAccessToken(refresh_token: string): Promise<string|null> {
    let result: any = null;
    let response: Response | null = null;
    const reqURL = `${this.config.domainURL}${IDCSConfig.OAUTH_TOKEN_REST_EP}`;
    const params = {
      method: "POST",
      headers: {
        Authorization: `Basic ${this.encodedSecret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `grant_type=refresh_token&refresh_token=${refresh_token}&scope=offline_access`,
    };

    try {
      response = await fusabaseFetch(this._app,reqURL, params);
      Utils.checkResponse(response);
      result = await response.json();
    } catch (err: any) {
      Utils.baasTrace(this.logLevel, {}, reqURL, response, result);
      err.status = response? response.status : 408;
      err.authType = this.config.authType.toUpperCase();
      try {
        var newMessage = await response?.json();
        err.message = newMessage["detail"];
      } catch (jsonErr) {
        err.message = 'Unknown';
      }
      throw authErrorHandler(err);
    }

    this.acc_tok = new IdTokenResult(result.access_token);
    this.refresh_token = result.refresh_token;
    return this.refresh_token;
  }

  /**
   * Validates the access token.
   * @returns true if token is valid else false.
   */
  validateAccessToken(): boolean {
    let exp = 0;
    if (this.acc_tok?.expirationTime) {
      exp = this.acc_tok?.expirationTime;
    }
    if (
      exp <
      Math.round(new Date().getTime() / 1000)
    ) {
      return false;
    }
    return true;
  }

  /**
   * Validates the access token.
   * @returns true if token is valid else false.
   */
  validateFUSABASEAccessToken(): boolean {
    if (!this.fusabase_token) {
      return false;
    }
    let exp = 0;
    if (this.fusabase_token?.expirationTime) {
      exp = this.fusabase_token?.expirationTime;
    }
    if (
      exp <
      Math.round(new Date().getTime() / 1000)
    ) {
      return false;
    }
    return true;
  }

  /**
   * Internal method to create operations on update profile.
   */
  makeOperations(userProfile: any): any[] {
    let operations: any[] = [];
    if (
      Object.hasOwn(userProfile, "displayName") &&
      userProfile.displayName !== this.user.displayName
    ) {
      operations.push({
        op: this.user.displayName
          ? userProfile.displayName
            ? "replace"
            : "remove"
          : "add",
        path: "displayName",
        value: userProfile.displayName,
      });
    }

    if (
      Object.hasOwn(userProfile, "phoneNumber") &&
      userProfile.phoneNumber !== this.user.phoneNumber
    ) {
      operations.push({
        op: this.user.phoneNumber
          ? userProfile.phoneNumber
            ? "replace"
            : "remove"
          : "add",
        path: "phoneNumbers",
        value: [{
          "value": userProfile.phoneNumber,
          "type": "home"
        }],
      });
    }

    if (
      Object.hasOwn(userProfile, "photoURL") &&
      userProfile.photoURL !== this.user.photoURL
    ) {
      operations.push({
        op: this.user.photoURL
          ? userProfile.photoURL
            ? "replace"
            : "remove"
          : "add",
        path: "photos",
        value: [{
          "value": userProfile.photoURL,
          "type": "photo"
        }],
      });
    }
    return operations;
  }

  /**
   * Helper function to update the user's profile.
   * @param userProfile 
   * @param schemas 
   * @return 
   */
  async updateProfile(userProfile: any): Promise<any> {
    let result: any = null;
    let response: Response | null = null;
    const reqURL = `${this.config.domainURL}${IDCSConfig.SELF_ME_REST_EP}`;
    let body = {
      schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
      Operations: this.makeOperations(userProfile),
    };
    const params = {
      method: "PATCH",
      headers: {
        "Content-Type": "application/scim+json",
        Authorization: `Bearer ${await this.user.getIdToken()}`,
      },
      body: JSON.stringify(body),
    };

    try {
      response = await fusabaseFetch(this._app,reqURL, params);
      Utils.checkResponse(response);
      result = await response.json();
    } catch (err: any) {
      Utils.baasTrace(this.logLevel, params, reqURL, response, result);
      err.status = response? response.status : 408;
      err.authType = this.config.authType.toUpperCase();
      try {
        var newMessage = await response?.json();
        err.message = newMessage["detail"];
      } catch (jsonErr) {
        err.message = 'Unknown';
      }
      throw authErrorHandler(err);
    }

    return result;
  }

  /**
   * Updates the user's password.
   * @param email 
   * @param newPassword 
   * @param oldPassword 
   * @return 
   */
  async updatePasswordHelper(email: string, newPass: string, oldPass: string): Promise<any> {
    let response: Response | null = null;
    let result: any = null;
    const reqURL = `${this.config.domainURL}${IDCSConfig.UPDATE_PASSWORD_HELPER}`;
    const data = {
      password: newPass,
      oldPassword: oldPass,
      schemas: [
        "urn:ietf:params:scim:schemas:oracle:idcs:MePasswordChanger"
      ]
    };
    const params = {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.acc_tok?.token}`,
        "Content-Type": "application/scim+json",
      },
      body: JSON.stringify(data),
    };

    try {
      response = await fusabaseFetch(this._app,reqURL, params);
      Utils.checkResponse(response);
      result = await response.json();
      return result;
    } catch (err: any) {
      Utils.baasTrace(this.logLevel, {}, reqURL, response, result);
      err.status = response? response.status : 408;
      err.authType = this.config.authType.toUpperCase();
      try {
        var newMessage = await response?.json();
        err.message = newMessage["detail"];
      } catch (jsonErr) {
        err.message = 'Unknown';
      }
      throw authErrorHandler(err);
    }
  }

  async sendEmailVerificationHelper(email: string, id: string): Promise<void> {
    let response: Response | null = null;
    const reqURL = `${this.config.domainURL}${IDCSConfig.SEND_EMAIL_VERIFICATION}`;
    const data = {
      id: id,
      email: email,
      schemas: ["urn:ietf:params:scim:schemas:oracle:idcs:MeEmailVerifier"],
      meta: {
        "resourceType": "MeEmailVerifier"
      }
    };
    const params = {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.acc_tok?.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    };

    try {
      response = await fusabaseFetch(this._app,reqURL, params);
      Utils.checkResponse(response);
    } catch (err: any) {
      Utils.baasTrace(this.logLevel, params, reqURL, response);
      err.status = response? response.status : 408;
      err.authType = this.config.authType.toUpperCase();
      try {
        var newMessage = await response?.json();
        err.message = newMessage["detail"];
      } catch (jsonErr) {
        err.message = 'Unknown';
      }
      throw authErrorHandler(err);
    }
  }

  async fetchFusabaseToken(url:any, app: any) : Promise<string> {
    let response = null
    let result = null
    const reqURL =
      url;
    const data = {
      token: this.acc_tok?.token
    }
    const params = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    };

    try {
      response = await fusabaseFetch(app, reqURL, params);
      Utils.checkResponse(response);
      result = await response.json();
      return result.access_token;
    } catch (err: any) {
      Utils.baasTrace(this.logLevel, params, reqURL, response);
      err.status = response? response.status : 408;
      err.authType = this.config.authType.toUpperCase();
      try {
        var newMessage = await response?.json();
        err.message = newMessage["detail"];
      }
      catch (jsonErr) {
        /* response is not JSON text */
        err.message = 'Unknown';
      }
      throw authErrorHandler(err);
    }
  }

  async linkWithCredentialHelper(credential: any): Promise<never> {
    const err: any = new Error(
      "Method is not supported in IDCS authentication"
    );
    err.status = ErrorCode.NOT_IMPLEMENT;
    err.authType = "IDCS";
    throw authErrorHandler(err);
  }

  async socialLink(url: string): Promise<any> {
    const err: any = new Error(
      "Method is not supported in IDCS authentication"
    );
    err.status = ErrorCode.NOT_IMPLEMENT;
    err.authType = "IDCS";
    throw authErrorHandler(err);
  }

  async listenForSuccess(popupWindow: any): Promise<any> {
    return new Promise((resolve) => {
      const controller = new AbortController();

      const handler = (event: MessageEvent) => {
        if (event.source !== popupWindow) return;

        try {
          const parsed = JSON.parse(event.data);
          Utils.baasLogger(this.logLevel, event.data);
          controller.abort(); // stop listening
          resolve(parsed);
        } catch {
          // ignore non-JSON messages
        }
      };

      window.addEventListener("message", handler, {
        signal: controller.signal,
      });
    });
  }

  async unlinkHelper(providerId: any): Promise<never> {
    const err: any = new Error(
      "Method is not supported in IDCS authentication"
    );
    err.status = ErrorCode.NOT_IMPLEMENT;
    err.authType = "IDCS";
    throw authErrorHandler(err);
  }

  generateCodeVerifier(length = 96): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  base64UrlEncode(arrayBuffer: Uint8Array): string {
    return btoa(String.fromCharCode(...arrayBuffer))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  async generateCodeChallenge(codeVerifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(digest));
  }
}

/**
 * Internal helper class for onprem user.
 */
/**
 * @internal
 */
export class ONPREMUserHelper {
  readonly config: any;
  private authnToken: string | null;
  acc_tok: IdTokenResult | null;
  fusabase_token: IdTokenResult | null;
  user: any;
  protected logLevel: LogLevel;

  /** @internal */
  private _app: any;

  /**
   * Constructs the UserHelper object.
   * @param config 
   * @param authnToken 
   * @param acc_tok 
   * @param logLevel 
   */
  constructor(config: any, authnToken: string | null, acc_tok: IdTokenResult, logLevel: LogLevel) {
    this.config = config;
    this.authnToken = authnToken;
    this.fusabase_token = null;
    this.acc_tok = acc_tok;
    this._app = null;
    this.logLevel = logLevel;
  }

  /** @internal */
  _setApp(app: any): void {
    this._app = app;
  }

  /**
   * Utility function to refresh access token.
   * @param refresh_token 
   * @returns Refresh Token
   */
  async refreshAccessToken(refresh_token: string): Promise<string> {
    let response: Response | null = null;
    let result: any = null;
    const reqURL = `${this.config.domainURL}${ONPREMConfig.AUTHENTICATE_REST_EP}?apiKey=${this.config.appID}`;
    const params = {
      method: "POST",
      headers: {},
      body: JSON.stringify({
        "refresh_token": refresh_token,
        "grant_type": "refresh_token"
      }),
    };

    try {
      response = await fusabaseFetch(this._app,reqURL, params);
      Utils.checkResponse(response);
      result = await response.json();
      const tok_res = {
        access_token: new IdTokenResult(result.access_token),
        refresh_token: result.refresh_token
      };

      this.acc_tok = tok_res.access_token;
      return tok_res.refresh_token;
    } catch (err: any) {
      Utils.baasTrace(this.logLevel, {}, reqURL, response, result);
      err.status = response? response.status : 408;
      err.authType = this.config.authType.toUpperCase();
      try {
        var newMessage = await response?.json();
        err.message = newMessage["error"];
      } catch (jsonErr) {
        err.message = 'Unknown';
      }
      throw authErrorHandler(err);
    }
  }

  /**
   * Validates the access token.
   * @returns true if token is valid else false.
   */
  validateAccessToken(): boolean {
    let exp = 0;
    if (this.acc_tok?.expirationTime) {
      exp = this.acc_tok?.expirationTime;
    }
    if (
      exp <
      Math.round(new Date().getTime() / 1000)
    ) {
      return false;
    }
    return true;
  }

  /**
   * Internal method to create operations on update profile.
   */
  makeOperations(userProfile: any): any[] {
    let operations: any[] = [];
    if (
      Object.hasOwn(userProfile, "displayName") &&
      userProfile.displayName !== this.user.displayName
    ) {
      operations.push({
        op: this.user.displayName
          ? userProfile.displayName
            ? "replace"
            : "replace"
          : "add",
        path: "displayName",
        value: userProfile.displayName,
      });
    }
    if (
      Object.hasOwn(userProfile, "phoneNumber") &&
      userProfile.phoneNumber !== this.user.phoneNumber
    ) {
      operations.push({
        op: this.user.phoneNumber
          ? userProfile.phoneNumber
            ? "replace"
            : "replace"
          : "add",
        path: "phoneNumber",
        value: userProfile.phoneNumber,
      });
    }
    return operations;
  }

  /**
   * Helper function to update the user's profile for onprem.
   * @param userProfile 
   * @param schemas 
   * @return 
   */
  async updateProfile(userProfile: any): Promise<any> {
    let response: Response | null = null;
    const reqURL = `${this.config.domainURL}${ONPREMConfig.UPDATE_PROFILE_HELPER}?apiKey=${this.config.appID}`;
    let body = {
      Operations: this.makeOperations(userProfile),
    };
    if (body.Operations.length === 0) {
      let err = new AuthError(ErrorCodeMessage.INVALID_ARGS,"No operation to perform");
      err.status = 400;
      throw authErrorHandler(err);
    }

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (this.acc_tok) {
        headers["X-AUTHZ"] = this.acc_tok.token;
    }
    const params = {
      method: "PUT",
      headers: headers,
      body: JSON.stringify(body),
    };

    try {
      response = await fusabaseFetch(this._app,reqURL, params);
      Utils.checkResponse(response);
    } catch (err: any) {
      Utils.baasTrace(this.logLevel, params, reqURL, response);
      err.status = response? response.status : 408;
      err.authType = this.config.authType.toUpperCase();
      try {
        var newMessage = await response?.json();
        err.message = newMessage["error"];
      } catch (jsonErr) {
        err.message = 'Unknown';
      }
      throw authErrorHandler(err);
    }

    return { displayName: userProfile.displayName, phoneNumber: userProfile.phoneNumber };
  }

  /**
   * Updates the user's password.
   * @param email 
   * @param newPassword 
   * @param oldPassword 
   * @return 
   */
  async updatePasswordHelper(email: string, newPassword: string, oldPassword: string): Promise<void> {
    let response: Response | null = null;
    const reqURL = `${this.config.domainURL}${ONPREMConfig.UPDATE_PASSWORD_HELPER}?apiKey=${this.config.appID}`;
    const data = {
      "oldPassword": oldPassword,
      "password": newPassword
    };

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (this.acc_tok) {
        headers["X-AUTHZ"] = this.acc_tok.token;
    }

    const params = {
      method: "PUT",
      headers: headers,
      body: JSON.stringify(data),
    };

    try {
      response = await fusabaseFetch(this._app,reqURL, params);
      Utils.checkResponse(response);
    } catch (err: any) {
      Utils.baasTrace(this.logLevel, {}, reqURL, response);
      err.status = response? response.status : 408;
      err.authType = this.config.authType.toUpperCase();
      try {
        var newMessage = await response?.json();
        err.message = newMessage["error"];
      } catch (jsonErr) {
        err.message = 'Unknown';
      }
      throw authErrorHandler(err);
    }
  }

  async sendEmailVerificationHelper(email: string, id: string): Promise<void> {
    let response: Response | null = null;
    const reqURL = `${this.config.domainURL}${ONPREMConfig.SEND_EMAIL_VERIFICATION}?apiKey=${this.config.appID}&email=${email}&requesttype=verifyemail`;

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (this.acc_tok) {
        headers["X-AUTHZ"] = this.acc_tok.token;
    }
    
    const params = {
      method: "GET",
      headers: headers
    };

    try {
      response = await fusabaseFetch(this._app,reqURL, params);
      Utils.checkResponse(response);
    } catch (err: any) {
      Utils.baasTrace(this.logLevel, params, reqURL, response);
      err.status = response? response.status : 408;
      err.authType = this.config.authType.toUpperCase();
      try {
        var newMessage = await response?.json();
        err.message = newMessage["error"];
      } catch (jsonErr) {
        err.message = 'Unknown';
      }
      throw authErrorHandler(err);
    }
  }

  /**
   * Validates the access token.
   * @returns true if token is valid else false.
   */
  validateFUSABASEAccessToken(): boolean {
    if (!this.fusabase_token) {
      return false;
    }
    let exp = 0;
    if (this.fusabase_token?.expirationTime) {
      exp = this.fusabase_token?.expirationTime;
    }
    if (
      exp <
      Math.round(new Date().getTime() / 1000)
    ) {
      return false;
    }
    return true;
  }

  async fetchFusabaseToken(url:any, app: any) {
    return this.acc_tok?.token;
  }

  async linkWithCredentialHelper(
    credential: AuthCredential
  ): Promise<any> {
    let response: Response | null = null;
    let result: any = null;

    let body: Record<string, any> = {
      token: "",
      password: "",
    };

    let linkProvider = credential.providerId;

    if (credential instanceof EmailAuthCredential) {
      body.password = credential.password;
      linkProvider = "epw";
    } else {
      body.token = (credential as any).idToken;
    }

    const reqURL =
      `${this.config.domainURL}${ONPREMConfig.SIGN_IN_WITH_CREDENTIAL}` +
      `?apiKey=${this.config.appID}&method=${linkProvider}&link=1`;

    const params: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${await this.user.getIdToken()}`,
      },
      body: JSON.stringify(body),
    };

    try {
      response = await fusabaseFetch(this._app, reqURL, params);
      Utils.checkResponse(response);
      result = await response.json();
      return result;
    } catch (err: any) {
      Utils.baasTrace(this.logLevel, params, reqURL, response, result);

      const ex: any = err;
      ex.status = response? response.status : 408;
      ex.authType = this.config.authType.toUpperCase();

      try {
        const newMessage = await response!.json();
        ex.message = newMessage["error"];
      } catch {
        ex.message = "Unknown";
      }

      throw authErrorHandler(ex);
    }
  }

  /** Social login using popup */
  async socialLink(url: string): Promise<{ idToken: string }> {
    const popup = window.open("", "name", "width=800,height=600")!;
    popup.location.href = url;

    const data = await this.listenForAuthToken(popup);

    popup.close();

    return {
      idToken: data.id_token,
    };
  }

  /** Listen for popup "postMessage" authentication token */
  async listenForAuthToken(
    popupWindow: Window
  ): Promise<any> {
    const expectedOrigin = new URL(this.config.domainURL).origin;
    return new Promise((resolve) => {
      const controller = new AbortController();

      const handler = (event: MessageEvent) => {
        if (event.source !== popupWindow) return;
        if (event.origin !== expectedOrigin) return;
        try {
          const parsed: any = JSON.parse(event.data);
          Utils.baasLogger(this.logLevel, event.data);
          controller.abort();
          resolve(parsed);
        } catch {
          // ignore malformed messages
        }
      };

      window.addEventListener("message", handler, {
        signal: controller.signal,
      });
    });
  }

  /** Unlink provider */
  async unlinkHelper(providerId: string): Promise<any> {
    let response: Response | null = null;
    let result: any = null;

    let linkProvider = providerId;

    if (providerId === EmailAuthProvider.PROVIDER_ID) {
      linkProvider = "epw";
    }

    const reqURL =
      `${this.config.domainURL}${ONPREMConfig.SIGN_IN_WITH_CREDENTIAL}` +
      `?apiKey=${this.config.appID}&method=${linkProvider}`;

    const params: RequestInit = {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${await this.user.getIdToken()}`,
      },
    };

    try {
      response = await fusabaseFetch(this._app, reqURL, params);
      Utils.checkResponse(response);
      result = await response.json();
      return result;
    } catch (err: any) {
      Utils.baasTrace(this.logLevel, params, reqURL, response, result);

      const ex: any = err;
      ex.status = response? response.status : 408;
      ex.authType = this.config.authType.toUpperCase();

      try {
        const newMessage = await response!.json();
        ex.message = newMessage["error"];
      } catch {
        ex.message = "Unknown";
      }

      throw authErrorHandler(ex);
    }
  }

  generateCodeVerifier(length = 96): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  base64UrlEncode(arrayBuffer: Uint8Array): string {
    return btoa(String.fromCharCode(...arrayBuffer))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  async generateCodeChallenge(codeVerifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(digest));
  }
}

// export class ONPREMSRPUserHelper extends ONPREMUserHelper {
//   protected logLevel: LogLevel;

//   constructor(config: any, authnToken: string | null, access_token: IdTokenResult, logLevel: LogLevel) {
//     super(config, authnToken, access_token, logLevel);
//     this.logLevel = logLevel;
//   }

//   async updatePasswordRequest(body: any): Promise<any> {
//     let response: Response | null = null;
//     let result: any = null;
//     const reqURL = `${this.config.domainURL}${ONPREMSRPConfig.SRP_UPDATE_PASSWORD}?apiKey=${this.config.appID}&reqtype=session_match`;
    
//     const headers: Record<string, string> = {
//         "Content-Type": "application/json",
//     };
//     if (this.access_token) {
//         headers["X-AUTHZ"] = this.access_token.token;
//     }
    
//     const params = {
//       method: "POST",
//       headers: headers,
//       body: JSON.stringify(body),
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
//       try {
//         var newMessage = await response?.json();
//         err.message = newMessage["error"];
//       } catch (jsonErr) {
//         err.message = 'Unknown';
//       }
//       throw authErrorHandler(err);
//     }
//   }

//   async updatePasswordHelper(email: string, newPassword: string, oldPassword: string): Promise<void> {
//     // Implementation remains the same
//   }
// }
