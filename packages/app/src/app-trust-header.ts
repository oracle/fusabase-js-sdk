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

export const FUSABASE_APP_TRUST_HEADER = 'X-BAAS-AppCheck';
export const FUSABASE_INSTANCE_ID_HEADER = 'X-BAAS-InstanceId';

const APP_TRUST_TOKENS = new WeakMap<App, string>();

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function getPathSegmentsAfterConfiguredHost(app: App | undefined, url: string): { parsed: URL; segments: string[] } | null {
  const configuredHost = String(app?.options?.ordsHost ?? '').trim();
  if (!configuredHost) return null;

  let parsed: URL;
  let expected: URL;
  try {
    parsed = new URL(url);
    expected = new URL(configuredHost);
  } catch {
    return null;
  }

  const expectedPath = expected.pathname.endsWith('/') ? expected.pathname : `${expected.pathname}/`;
  if (parsed.origin !== expected.origin || !parsed.pathname.startsWith(expectedPath)) {
    return null;
  }

  return {
    parsed,
    segments: parsed.pathname
      .slice(expectedPath.length)
      .split('/')
      .filter((segment) => segment.length > 0),
  };
}

function getProjectSegment(segments: string[]): string | undefined {
  if (segments[2] === 'idm') return segments[4];
  if (segments[3] === 'par') return segments[4];
  return segments[3];
}

function hasMatchingProject(segments: string[], projectId: string): boolean {
  const projectSegment = getProjectSegment(segments);
  return typeof projectSegment === 'string' &&
    decodePathSegment(projectSegment) === projectId;
}

function hasMatchingAppId(parsed: URL, appId: string): boolean {
  return parsed.searchParams.get('apiKey') === appId ||
    parsed.searchParams.get('appID') === appId ||
    parsed.searchParams.get('app_id') === appId;
}

function isAppTrustAttestEndpoint(segments: string[], projectId: string): boolean {
  return segments.length >= 5 &&
    segments[0] === '_' &&
    segments[1] === 'baas-services' &&
    segments[2] === 'appcheck' &&
    decodePathSegment(segments[3]) === projectId &&
    segments[4] === 'attest';
}

/** @internal */
export function shouldAttachAppTrustHeader(app: App | undefined, url: string): boolean {
  if (typeof url !== 'string') return false;

  const projectId = String(app?.options?.projectID ?? '').trim();
  const appId = String(app?.options?.appID ?? '').trim();
  if (!projectId || !appId) return false;

  const pathInfo = getPathSegmentsAfterConfiguredHost(app, url);
  if (!pathInfo) return false;

  const { parsed, segments } = pathInfo;
  if (segments[0] !== '_' || segments[1] !== 'baas-services') return false;
  if (isAppTrustAttestEndpoint(segments, projectId)) return false;
  if (!hasMatchingProject(segments, projectId)) return false;
  if (!hasMatchingAppId(parsed, appId)) return false;
  return true;
}

/** @internal */
export function getAppTrustToken(app: App | undefined): string | undefined {
  if (!app) return undefined;

  const optTok = (app.options as any)?.appTrustToken;
  if (typeof optTok === 'string' && optTok) return optTok;

  const internalTok = APP_TRUST_TOKENS.get(app);
  if (typeof internalTok === 'string' && internalTok) return internalTok;

  // Compatibility for callers that configured the undocumented legacy fields
  // themselves. App Trust no longer writes tokens onto the app object.
  const legacyTok = (app as any)?._appTrustToken;
  if (typeof legacyTok === 'string' && legacyTok) return legacyTok;

  const persistedTok = (app as any)?._appTrustTokenPersisted;
  if (typeof persistedTok === 'string' && persistedTok) return persistedTok;

  return undefined;
}

/** @internal */
export function setAppTrustToken(app: App | undefined, token: string | undefined): void {
  if (!app) return;

  if (typeof token === 'string' && token) {
    APP_TRUST_TOKENS.set(app, token);
  } else {
    APP_TRUST_TOKENS.delete(app);
  }
}

/** @internal */
export function attachAppTrustHeader(app: App | undefined, url: string, init: RequestInit): RequestInit {
  if (!shouldAttachAppTrustHeader(app, url)) return init;

  const tok = getAppTrustToken(app);
  const instanceId = (app as any)?._instanceId as string | undefined;

  const existing = (init?.headers ?? {}) as any;
  const headers = new Headers(existing);

  headers.delete(FUSABASE_APP_TRUST_HEADER);
  headers.delete(FUSABASE_INSTANCE_ID_HEADER);

  if (tok) headers.set(FUSABASE_APP_TRUST_HEADER, tok);

  if (instanceId) {
    const platform = String((app?.options as any)?.appType ?? 'web').toLowerCase();
    const appId = String(app?.options?.appID ?? '').trim();
    const sanitizedInstanceId = String(instanceId).replace(/-/g, '');
    headers.set(FUSABASE_INSTANCE_ID_HEADER, `${platform}|${appId}|${sanitizedInstanceId}`);
  }

  return {
    ...init,
    headers,
  };
}
