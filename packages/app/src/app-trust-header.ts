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

import type { App } from './public-types.js';

export const FUSABASE_APP_CHECK_HEADER = 'X-BAAS-AppCheck';
export const FUSABASE_INSTANCE_ID_HEADER = 'X-BAAS-InstanceId';

const APP_CHECK_TOKENS = new WeakMap<App, string>();

function isAppCheckAttestEndpoint(url: string): boolean {
  return typeof url === 'string' && /\/_\/baas-services\/appcheck\/[^/]+\/attest(\?|$)/.test(url);
}

/** @internal */
export function shouldAttachAppCheckHeader(url: string): boolean {
  if (typeof url !== 'string' || !url.includes('/_/baas-services/')) return false;
  if (isAppCheckAttestEndpoint(url)) return false;
  return true;
}

/** @internal */
export function getAppCheckToken(app: App | undefined): string | undefined {
  if (!app) return undefined;

  const optTok = (app.options as any)?.appCheckToken;
  if (typeof optTok === 'string' && optTok) return optTok;

  const internalTok = APP_CHECK_TOKENS.get(app);
  if (typeof internalTok === 'string' && internalTok) return internalTok;

  // Compatibility for callers that configured the undocumented legacy fields
  // themselves. App Trust no longer writes tokens onto the app object.
  const legacyTok = (app as any)?._appCheckToken;
  if (typeof legacyTok === 'string' && legacyTok) return legacyTok;

  const persistedTok = (app as any)?._appCheckTokenPersisted;
  if (typeof persistedTok === 'string' && persistedTok) return persistedTok;

  return undefined;
}

/** @internal */
export function setAppCheckToken(app: App | undefined, token: string | undefined): void {
  if (!app) return;

  if (typeof token === 'string' && token) {
    APP_CHECK_TOKENS.set(app, token);
  } else {
    APP_CHECK_TOKENS.delete(app);
  }
}

/** @internal */
export function attachAppCheckHeader(app: App | undefined, url: string, init: RequestInit): RequestInit {
  if (!shouldAttachAppCheckHeader(url)) return init;

  const tok = getAppCheckToken(app);
  const instanceId = (app as any)?._instanceId as string | undefined;

  if (!tok && !instanceId) return init;

  const existing = (init?.headers ?? {}) as any;
  const headers = new Headers(existing);

  if (!headers.has(FUSABASE_APP_CHECK_HEADER)) {
    if (tok) headers.set(FUSABASE_APP_CHECK_HEADER, tok);
  }

  if (!headers.has(FUSABASE_INSTANCE_ID_HEADER)) {
    if (instanceId) {
      const platform = String((app?.options as any)?.appType ?? 'web').toLowerCase();
      const appId = String(app?.options?.appID ?? '').trim();
      const sanitizedInstanceId = String(instanceId).replace(/-/g, '');
      headers.set(FUSABASE_INSTANCE_ID_HEADER, `${platform}|${appId}|${sanitizedInstanceId}`);
    }
  }

  return {
    ...init,
    headers,
  };
}
