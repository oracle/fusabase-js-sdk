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


import type { App } from "../../app/src/public-types.js";
import {
  FusabaseAppTrustError,
  getToken,
  initializeAppTrust,
  onTokenChanged,
  type AppTrust,
  type AppTrustOptions,
  type AppTrustTokenListener,
  type AppTrustTokenResult,
  type Unsubscribe,
} from "../../app-trust/src/index.js";

/**
 * Manages application-attestation tokens for a client.
 *
 * Initialize this member before requesting a token or subscribing to token
 * changes. Tokens are cached and refreshed by the underlying attestation API.
 *
 * @example
 * ```ts
 * client.appTrust.initialize({ provider });
 * const token = await client.appTrust.getToken();
 * ```
 */
export class AppTrustClient {
  private instance: AppTrust | null = null;

/**
 * Constructs a AppTrustClient instance with the supplied configuration.
 *
 * @param app - The app instance that owns this service.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { AppTrustClient } from "fusabase/relational";
 * const result = new AppTrustClient(value);
 * void result;
 * ```
 */
  constructor(private readonly app: App) {}

  /**
   * Initializes attestation with a configured provider.
   * @param options - `AppTrustOptions` object with a required `provider`
   * instance and optional provider-specific settings.
   * @returns The initialized attestation instance.
   * @example
   * ```ts
   * client.appTrust.initialize({ provider });
   * ```
   */
  initialize(options: AppTrustOptions): AppTrust {
    this.instance = initializeAppTrust(this.app, options);
    return this.instance;
  }

  /**
   * Returns the current attestation token, optionally bypassing the cache.
   * @param forceRefresh - When `true`, requests a newly minted token.
   * @returns A token result containing the token and expiry information.
   * @example
   * ```ts
   * const { token } = await client.appTrust.getToken(true);
   * ```
   */
  getToken(forceRefresh = false): Promise<AppTrustTokenResult> {
    return getToken(this.requireInstance(), forceRefresh);
  }

  /**
   * Registers a listener for token changes.
   * @param observer - `AppTrustTokenListener` function that receives an
   * `AppTrustTokenResult` whenever a token becomes available.
   * @returns A function that removes the listener.
   * @example
   * ```ts
   * const unsubscribe = client.appTrust.onTokenChanged(result => console.log(result.token));
   * unsubscribe();
   * ```
   */
  onTokenChanged(observer: AppTrustTokenListener): Unsubscribe {
    return onTokenChanged(this.requireInstance(), observer);
  }

  private requireInstance(): AppTrust {
    if (!this.instance) {
      throw new FusabaseAppTrustError(
        "App Trust is not initialized. Call relational.appTrust.initialize() first.",
        { status: 400, code: "app-trust/not-initialized" }
      );
    }
    return this.instance;
  }
}

export type {
  AppTrust,
  AppTrustOptions,
  AppTrustTokenListener,
  AppTrustTokenResult,
  Unsubscribe,
};
