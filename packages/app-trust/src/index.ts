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

/**
 * FUSABASE App Trust module.
 *
 * App Trust helps protect FUSABASE backend endpoints 
 *
 * Typical usage:
 * 1. Call {@link initializeAppTrust} once during app startup.
 * 2. (Optional) Call {@link getToken} to pre-mint a token.
 *
 * @packageDocumentation
 */

export type {
  AppTrust,
  AppTrustOptions,
  AppTrustToken,
  AppTrustTokenListener,
  AppTrustTokenResult,
  Unsubscribe,
} from './public-types.js';

export {
  ReCaptchaV3Provider,
  ReCaptchaEnterpriseProvider,
  TurnstileProvider,
  HCaptchaProvider,
} from './public-types.js';

export {
  initializeAppTrust,
  getToken,
  onTokenChanged,
} from './app-trust.js';

export { FusabaseAppTrustError } from './errors.js';

