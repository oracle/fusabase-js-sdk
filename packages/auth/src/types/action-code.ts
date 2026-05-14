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
 * Represents a response from an email action code operation.
 *
 * @example
 * ```ts
 * import { ActionCodeInfo } from './type/action-code.js';
 * const info: ActionCodeInfo = { operation: 'PASSWORD_RESET', email: 'user@example.com' };
 * console.log(info.operation); // PASSWORD_RESET
 * ```
 */
export interface ActionCodeInfo {
  /** The type of action the code represents, e.g., PASSWORD_RESET */
  operation: string;
  /** The email for which the action code applies */
  email?: string;
  /** The previous email, if applicable (for email change) */
  previousEmail?: string;
}

/**
 * Settings for handling email action links, including continue URL and optional platform identifiers.
 *
 * @example
 * ```ts
 * import { ActionCodeSettings } from './type/action-code.js';
 * const settings: ActionCodeSettings = {
 *   url: 'https://example.com/finishSignUp',
 *   handleCodeInApp: true,
 *   iOS: { bundleId: 'com.example.ios' },
 *   android: { packageName: 'com.example.android', installApp: true },
 * };
 * ```
 */
export interface ActionCodeSettings {
  /** The URL the user is redirected to after completing the action */
  url: string;
  /** Whether the code should be handled in-app (true) or in a web page (false) */
  handleCodeInApp?: boolean;
  /** Optional iOS bundle identifier */
  iOS?: { bundleId: string };
  /** Optional Android package name and settings */
  android?: { packageName: string; installApp?: boolean; minimumVersion?: string };
  /** Optional dynamic link domain */
  dynamicLinkDomain?: string;
}
