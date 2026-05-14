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

import { App } from "../../../app/src/public-types.js";
import { authErrorHandler, AuthError, ErrorCodeMessage } from "../errors.js";

/**
 * Class representing the configuration of the application. 
 */
export class Config {
  public authType: string;

  /**
   * Base class Config, which type is the Identity Provider.
   * It can be either 'base','ldap' or 'idcs'
   * @param {string} authType 
   */
  constructor(authType: string) {
    this.authType = authType;
  }
}

/**
 * Class representing the configuration of the onprem application. 
 */
/**
 * @internal
 */
export class ONPREMConfig extends Config {
  public authID: string;
  public appID: string;
  public domainURL: string;
  public projectID: string;

  static AUTHENTICATE_REST_EP = "authenticate";
  static SELF_REGISTER_EP = "useradd";
  static UPDATE_PASSWORD_HELPER = "changePassword";
  static UPDATE_PROFILE_HELPER = "updateProfile";
  static REVOKE_REFRESH_TOKEN = "rf/revoke";
  static SEND_EMAIL_VERIFICATION = "sendemail";
  static SEND_PASSWORD_RESET_EMAIL = "sendemail";
  static CONFIRM_PASSWORD_RESET = "resetpwd";
  static VERIFY_PASSWORD_RESET_CODE = "verifycode";
  static SIGN_IN_WITH_CREDENTIAL = 'getcredential';
  static REDIRECT_RESULT_EP = 'redirectResult';

  /**
   * Constructs the onprem config.
   * @param {string} domainURL
   * @param {string} appID
   * @param {string} authID
   * @param {string} authType
   * @param {string} projectID
   */
  constructor(domainURL: string, appID: string, authID: string, authType: string, projectID: string) {
    super(authType);

    this.authID = authID;
    this.appID = appID;
    this.domainURL = domainURL;
    this.projectID = projectID;
  }
}


/**
 * Class representing the configuration of the IDCS application. 
 */
/**
 * @internal
 */
export class IDCSConfig extends Config {
  public domainURL: string;
  public appID: string;
  public clientId: string;
  public clientSecret: string;
  public selfRegistrationProfile?: string;
  public projectID: string;
  public authID: string;

  static AUTHENTICATE_REST_EP = "/sso/v1/sdk/authenticate";
  static OAUTH_TOKEN_REST_EP = "/oauth2/v1/token";
  static SELF_ME_REST_EP = "/admin/v1/Me";
  static LOGOUT_REST_EP = "/oauth2/v1/userlogout";
  static REVOKE_REFRESH_TOKEN_REST_EP = "/oauth2/v1/revoke";
  static SEND_PASSWORD_RESET_EMAIL = "/admin/v1/MePasswordResetRequestor"
  static CONFIRM_PASSWORD_RESET = "/admin/v1/MePasswordResetter"
  static VERIFY_PASSWORD_RESET_CODE = "/admin/v1/UserTokenValidator"
  static UPDATE_PASSWORD_HELPER = "/admin/v1/MePasswordChanger"
  static SEND_EMAIL_VERIFICATION = "/admin/v1/MeEmailVerifier";
  static FETCH_FUSABASE_TOKEN = "tokenExchange";
  static REDIRECT_RESULT_EP = "redirectResult";
  static ADD_USER_REST_EP = "useradd";

  /**
   * Constructs the IDCS config.
   * @param {string} domainURL 
   * @param {string} clientId 
   * @param {string} clientSecret 
   */
  constructor(domainURL: string, clientId: string, clientSecret: string, selfRegistrationProfile?: string, appID?: string,
     projectID?: string) {
    // Validating Arguments
    super('idcs');

    if (domainURL.length === 0) {
      let error = new AuthError(ErrorCodeMessage.INVALID_ARGS, `Domain URL is not provided`);
      throw authErrorHandler(error);
    }
    else if (clientId.length === 0) {
      let error = new AuthError(ErrorCodeMessage.INVALID_ARGS, `Client ID is not provided`);
      throw authErrorHandler(error);
    }
    else if (clientSecret.length === 0) {
      let error = new AuthError(ErrorCodeMessage.INVALID_ARGS, `Client Secret is not provided`);
      throw authErrorHandler(error);
    }

    this.domainURL = domainURL;
    this.appID = appID!
    this.authID = "";
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.selfRegistrationProfile = selfRegistrationProfile;
    this.projectID = projectID!;
  }
}

/**
* Internal method to get the config of the auth.
*/
/**
 * @internal
 */
export function getConfig(app: App): IDCSConfig | ONPREMConfig {
  let projectConfig = app.options;
  if (projectConfig.authType === 'base' ||
    projectConfig.authType === 'ldap') {
    return new ONPREMConfig(
      `${projectConfig.ordsHost}_/baas-services/idm/onprem/${projectConfig.projectID}/`,
      projectConfig.appID ?? "",
      projectConfig.authID ?? "",
      projectConfig.authType,
      projectConfig.projectID ?? ""
    )
  } else if (projectConfig.authType === 'idcs') {
    return new IDCSConfig(
      projectConfig.idcsConfig?.domainURL ?? "",
      projectConfig.idcsConfig?.clientId ?? "",
      projectConfig.idcsConfig?.clientSecret ?? "",
      projectConfig.idcsConfig?.selfRegistrationProfile ?? "",
      projectConfig.appID,
      projectConfig.projectID
    )
  } 
  // else if (projectConfig.authType === 'base_s'
  //   || projectConfig.authType === 'ldap_s') {
  //   return new ONPREMSRPConfig(
  //     `${projectConfig.ordsHost}_/baas-services/idm/onprem/${projectConfig.projectID}/`,
  //     projectConfig.appID ?? "",
  //     projectConfig.authID ?? "",
  //     projectConfig.authType,
  //     projectConfig.projectID ?? ""
  //   )
  // } 
  else {
    throw new AuthError(ErrorCodeMessage.SERVER_ERROR, `Unsupported authType: ${projectConfig.authType}`);
  }
}
