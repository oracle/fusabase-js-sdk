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
import { AuthError, ErrorCodeMessage } from "../errors.js";

/**
 * Class representing the configuration of the application.
 */
/**
 * Base configuration for an authentication service.
 *
 * @example
 * ```ts
 * const config = new Config();
 * ```
 */
export class Config {
/** Describes the public `authType` value. */
  public authType: string;

/**
 * Constructs a Config instance with the supplied configuration.
 *
 * @param authType - The authType accepted by this operation.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { Config } from "fusabase/auth";
 * const result = new Config(value);
 * void result;
 * ```
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
/**
 * Configuration for an on-premises authentication service.
 *
 * @example
 * ```ts
 * const config = new ONPREMConfig();
 * ```
 */
export class ONPREMConfig extends Config {
/** Describes the public `authID` value. */
  public authID: string;
/** Describes the public `appID` value. */
  public appID: string;
/** Describes the public `domainURL` value. */
  public domainURL: string;
/** Describes the public `projectID` value. */
  public projectID: string;

/** Describes the public `AUTHENTICATE_REST_EP` value. */
  static AUTHENTICATE_REST_EP = "authenticate";
/** Describes the public `SELF_REGISTER_EP` value. */
  static SELF_REGISTER_EP = "useradd";
/** Describes the public `UPDATE_PASSWORD_HELPER` value. */
  static UPDATE_PASSWORD_HELPER = "changePassword";
/** Describes the public `UPDATE_PROFILE_HELPER` value. */
  static UPDATE_PROFILE_HELPER = "profile";
/** Describes the public `REVOKE_REFRESH_TOKEN` value. */
  static REVOKE_REFRESH_TOKEN = "rf/revoke";
/** Describes the public `SEND_EMAIL_VERIFICATION` value. */
  static SEND_EMAIL_VERIFICATION = "sendemail";
/** Describes the public `SEND_PASSWORD_RESET_EMAIL` value. */
  static SEND_PASSWORD_RESET_EMAIL = "sendemail";
/** Describes the public `CONFIRM_PASSWORD_RESET` value. */
  static CONFIRM_PASSWORD_RESET = "resetpwd";
/** Describes the public `VERIFY_PASSWORD_RESET_CODE` value. */
  static VERIFY_PASSWORD_RESET_CODE = "verifycode";
/** Describes the public `SIGN_IN_WITH_CREDENTIAL` value. */
  static SIGN_IN_WITH_CREDENTIAL = 'getcredential';
/** Describes the public `REDIRECT_RESULT_EP` value. */
  static REDIRECT_RESULT_EP = 'redirectResult';

/**
 * Constructs a ONPREMConfig instance with the supplied configuration.
 *
 * @param domainURL - The domainURL accepted by this operation.
 * @param appID - The appID accepted by this operation.
 * @param authID - The authID accepted by this operation.
 * @param authType - The authType accepted by this operation.
 * @param projectID - The projectID accepted by this operation.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { ONPREMConfig } from "fusabase/auth";
 * const result = new ONPREMConfig(value, value, value, value, value);
 * void result;
 * ```
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
/**
 * Configuration for an identity-domain authentication service.
 *
 * @example
 * ```ts
 * const config = new IDCSConfig();
 * ```
 */
export class IDCSConfig extends ONPREMConfig {
/** Describes the public `idcsDomainURL` value. */
  public idcsDomainURL: string;

/** Describes the public `LOGOUT_REST_EP` value. */
  static LOGOUT_REST_EP = "/oauth2/v1/userlogout";

/**
 * Constructs a IDCSConfig instance with the supplied configuration.
 *
 * @param domainURL - The domainURL accepted by this operation.
 * @param appID - The appID accepted by this operation.
 * @param authID - The authID accepted by this operation.
 * @param authType - The authType accepted by this operation.
 * @param projectID - The projectID accepted by this operation.
 * @param idcsDomainURL - The idcsDomainURL accepted by this operation.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { IDCSConfig } from "fusabase/auth";
 * const result = new IDCSConfig(value, value, value, value, value, value);
 * void result;
 * ```
 */
  constructor(domainURL: string, appID: string, authID: string, authType: string, projectID: string, idcsDomainURL: string) {
    super(domainURL, appID, authID, authType, projectID);
    this.idcsDomainURL = idcsDomainURL.replace(/\/+$/, "");
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
  const ordsHost = ensureTrailingSlash(projectConfig.ordsHost ?? "");
  if (projectConfig.authType === 'base' ||
    projectConfig.authType === 'ldap') {
    return new ONPREMConfig(
      `${ordsHost}_/baas-services/idm/onprem/${projectConfig.projectID}/`,
      projectConfig.appID ?? "",
      projectConfig.authID ?? "",
      projectConfig.authType,
      projectConfig.projectID ?? ""
    )
  } else if (projectConfig.authType === 'idcs') {
    return new IDCSConfig(
      `${ordsHost}_/baas-services/idm/idcs/${projectConfig.projectID}/`,
      projectConfig.appID ?? "",
      projectConfig.authID ?? "",
      projectConfig.authType,
      projectConfig.projectID ?? "",
      projectConfig.idcsDomainURL ?? ""
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

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
