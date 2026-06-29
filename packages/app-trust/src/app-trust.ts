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

import type { App } from '../../app/src/public-types.js';
import type {
  AppTrust,
  AppTrustOptions,
  AppTrustTokenResult,
  AppTrustTokenListener,
  Unsubscribe,
} from './public-types.js';
import { HCaptchaProvider, ReCaptchaEnterpriseProvider } from './public-types.js';
import { FusabaseAppTrustError } from './errors.js';
import { fusabaseFetch } from '../../app/src/fusabase-fetch.js';
import { setAppTrustToken } from '../../app/src/app-trust-header.js';
import { idbGetAppTrustToken, idbRemoveAppTrustToken, idbSetAppTrustToken } from './internal/indexeddb.js';

type Observer = {
  next?: (value: AppTrustTokenResult) => void;
  error?: (err: Error) => void;
  complete?: () => void;
};

type InternalState = {
  app: App;
  provider: { _getAttestationToken: (action: string) => Promise<string> };
  cachedToken?: AppTrustTokenResult;
  inFlight?: Promise<AppTrustTokenResult>;
  listeners: Set<AppTrustTokenListener>;
};

type AttestRequest = {
  provider: string;
  attestationToken: string;
  action: string;
  deviceInfo: {
    platform: string;
    userAgent: string;
  };
  siteKey?: string;
};

type AttestResponse = {
  attestToken: string;
};

class AppTrustImpl implements AppTrust {
  constructor(readonly app: App) {}
  /** @internal */
  _state!: InternalState;
}

const APP_TRUST_INSTANCE = new WeakMap<App, AppTrustImpl>();

function assertProvider(provider: AppTrustOptions['provider']): { _getAttestationToken: (action: string) => Promise<string> } {
  if ((provider as any)?._getAttestationToken instanceof Function) {
    return provider as any;
  }
  throw new FusabaseAppTrustError('Unsupported provider.', { code: 'app-trust/unsupported-provider', status: 400 });
}

function providerKeyForWeb(platform: string, appId: string): string {
  const normalizedPlatform = String(platform ?? '').trim().toLowerCase();
  const normalized = String(appId ?? '').trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(normalized)) {
    throw new FusabaseAppTrustError(
      'Invalid appID: expected 32 hex characters (servlet requires provider in format <platform>|<appId>)',
      { status: 400, code: 'app-trust/invalid-appID' }
    );
  }
  return `${normalizedPlatform}|${normalized}`;
}

function buildAttestUrl(app: App): string {
  const projectId = app.options.projectID;
  const apiKey = app.options.appID;
  const ordsHost = app.options.ordsHost;
  if (!ordsHost) throw new FusabaseAppTrustError('Missing ordsHost in app options', { status: 400, code: 'app-trust/missing-ordsHost' });
  if (!projectId) throw new FusabaseAppTrustError('Missing projectID in app options', { status: 400, code: 'app-trust/missing-projectID' });
  if (!apiKey) throw new FusabaseAppTrustError('Missing appID (used as apiKey) in app options', { status: 400, code: 'app-trust/missing-appID' });
  const base = ordsHost.endsWith('/') ? ordsHost.slice(0, -1) : ordsHost;
  return `${base}/_/baas-services/appcheck/${encodeURIComponent(projectId)}/attest?apiKey=${encodeURIComponent(apiKey)}`;
}

function siteKeyForAttestationRequest(provider: InternalState['provider']): string | undefined {
  if (provider instanceof HCaptchaProvider || provider instanceof ReCaptchaEnterpriseProvider) {
    return provider.siteKey;
  }
  return undefined;
}

function parseExpiresAtToMillis(expiresAt: string | undefined): number {
  if (expiresAt) {
    // Keep signature for backward compatibility but do not rely on expiresAt.
    // (OpenAPI does not define it; token TTL is currently treated as a short-lived cache.)
  }
  return Date.now() + 5 * 60 * 1000;
}

function emit(state: InternalState, token: AppTrustTokenResult): void {
  for (const cb of state.listeners) {
    try {
      cb(token);
    } catch {
      // ignore listener errors
    }
  }
}

function appTrustStorageKey(app: App): string {
  const projectId = String(app.options.projectID ?? '').trim();
  const appId = String(app.options.appID ?? '').trim();
  return `${projectId}:${appId}`;
}

function clearLegacyAppTokenMirrors(app: App): void {
  try {
    delete (app as any)._appTrustToken;
    delete (app as any)._appTrustTokenPersisted;
  } catch {
    // ignore
  }
}

async function loadPersistedTokenIntoState(state: InternalState): Promise<void> {
  const key = appTrustStorageKey(state.app);
  const persisted = await idbGetAppTrustToken(key);
  if (!persisted?.token) return;

  if (!persisted.expireTimeMillis || persisted.expireTimeMillis <= Date.now() + 5000) {
    await idbRemoveAppTrustToken(key);
    return;
  }

  const tokenResult: AppTrustTokenResult = {
    token: persisted.token,
    expireTimeMillis: persisted.expireTimeMillis,
  };

  state.cachedToken = tokenResult;
  setAppTrustToken(state.app, tokenResult.token);
  clearLegacyAppTokenMirrors(state.app);
}

export function initializeAppTrust(app: App | undefined, options: AppTrustOptions): AppTrust {
  if (!app) throw new FusabaseAppTrustError('App is required', { status: 400, code: 'app-trust/no-app' });
  if (APP_TRUST_INSTANCE.has(app)) {
    throw new FusabaseAppTrustError('App Trust already initialized for this app', {
      status: 400,
      code: 'app-trust/already-initialized',
    });
  }

  const instance = new AppTrustImpl(app);
  const provider = assertProvider(options.provider);
  instance._state = {
    app,
    provider,
    listeners: new Set(),
  };
  APP_TRUST_INSTANCE.set(app, instance);

  try {
    (app as any)._appTrustInstance = instance;
  } catch {
    // ignore
  }

  void loadPersistedTokenIntoState(instance._state);

  return instance;
}

export async function getToken(appTrustInstance: AppTrust, forceRefresh: boolean = false): Promise<AppTrustTokenResult> {
  /**
   * Returns an FUSABASE App Trust token.
   *
   * - If `forceRefresh` is `false`, a cached token will be returned when still
   *   valid.
   * - If `forceRefresh` is `true`, the SDK will mint a new provider attestation
   *   token and exchange it with the FUSABASE App Trust servlet.
   *
   */
  const impl = appTrustInstance as AppTrustImpl;
  const state = impl?._state;
  if (!state) {
    throw new FusabaseAppTrustError('Invalid App Trust instance', { status: 400, code: 'app-trust/invalid-instance' });
  }

  if (!state.cachedToken) {
    await loadPersistedTokenIntoState(state);
  }

  if (!forceRefresh && state.cachedToken && state.cachedToken.expireTimeMillis > Date.now() + 5000) {
    return state.cachedToken;
  }

  if (state.inFlight) return state.inFlight;

  state.inFlight = (async () => {
    let result: AppTrustTokenResult;

    const action = 'attest';
    const attestationToken = await state.provider._getAttestationToken(action);

    const platform = String((state.app.options as any)?.appType ?? 'web').toLowerCase();
    const deviceInfo = {
      platform,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    };
    const attestRequest: AttestRequest = {
      provider: providerKeyForWeb(platform, state.app.options.appID ?? ''),
      attestationToken,
      action,
      deviceInfo,
    };
    const siteKey = siteKeyForAttestationRequest(state.provider);
    if (siteKey) {
      attestRequest.siteKey = siteKey;
    }
    const attestUrl = buildAttestUrl(state.app);
    const res = await fusabaseFetch(state.app, attestUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(attestRequest),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new FusabaseAppTrustError(`Attestation exchange failed (${res.status})`, {
        status: res.status,
        code: 'app-trust/attestation-exchange-failed',
        cause: text,
      });
    }
    const json = (await res.json()) as Partial<AttestResponse>;
    if (!json?.attestToken) {
      throw new FusabaseAppTrustError('Attestation response missing attestToken', {
        status: 500,
        code: 'app-trust/invalid-attestation-response',
      });
    }
    result = {
      token: json.attestToken,
      // OpenAPI does not define expiresAt; treat AppTrust token as short-lived cache.
      expireTimeMillis: parseExpiresAtToMillis(undefined),
    };

    state.cachedToken = result;
    setAppTrustToken(state.app, result.token);
    clearLegacyAppTokenMirrors(state.app);

    try {
      const key = appTrustStorageKey(state.app);
      await idbSetAppTrustToken(key, {
        token: result.token,
        expireTimeMillis: result.expireTimeMillis,
        updatedAtMillis: Date.now(),
      });
    } catch {
      // ignore
    }

    emit(state, result);
    return result;
  })().finally(() => {
    state.inFlight = undefined;
  });

  return state.inFlight;
}

export function onTokenChanged(appTrustInstance: AppTrust, observer: Partial<Observer>): Unsubscribe;
export function onTokenChanged(
  appTrustInstance: AppTrust,
  onNext: (tokenResult: AppTrustTokenResult) => void,
  onError?: (error: Error) => void,
  onCompletion?: () => void
): Unsubscribe;
export function onTokenChanged(
  appTrustInstance: AppTrust,
  a: Partial<Observer> | ((tokenResult: AppTrustTokenResult) => void),
  b?: (error: Error) => void,
  c?: () => void
): Unsubscribe {
  /**
   * Registers a listener for App Trust token changes.
   *
   * The callback will be called whenever a new token is minted and cached.
   * If a cached token already exists, the listener is invoked asynchronously
   * with the current token.
   *
   * @returns An unsubscribe function.
   */
  const impl = appTrustInstance as AppTrustImpl;
  const state = impl?._state;
  if (!state) {
    throw new FusabaseAppTrustError('Invalid App Trust instance', { status: 400, code: 'app-trust/invalid-instance' });
  }

  const next = typeof a === 'function' ? a : a.next;
  const error = typeof a === 'function' ? b : a.error;
  const complete = typeof a === 'function' ? c : a.complete;
  if (complete) {
    // unused
  }

  const listener: AppTrustTokenListener = (t) => {
    try {
      next?.(t);
    } catch (e) {
      error?.(e as Error);
    }
  };
  state.listeners.add(listener);
  if (state.cachedToken) queueMicrotask(() => listener(state.cachedToken!));
  return () => state.listeners.delete(listener);
}
