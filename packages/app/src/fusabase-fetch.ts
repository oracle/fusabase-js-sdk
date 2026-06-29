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
import { attachAppTrustHeader, getAppTrustToken, shouldAttachAppTrustHeader } from './app-trust-header.js';

function includesAppTrustHint(text: string): boolean {
  return text.toLowerCase().includes('appcheck');
}

/** @internal */
export async function fusabaseFetch(app: App | undefined, url: string, init: RequestInit): Promise<Response> {
  const doFetch = (reqInit: RequestInit) => fetch(url, reqInit);
  const shouldAttachHeaders = shouldAttachAppTrustHeader(app, url);

  if (app && shouldAttachHeaders) {
    const appTrustInstance = (app as any)?._appTrustInstance;
    const tok = getAppTrustToken(app);
    if (appTrustInstance && !tok) {
      try {
        const { getToken } = await import('../../app-trust/src/app-trust.js');
        await getToken(appTrustInstance, false);
      } catch {
      }
    }
  }

  let reqInit = attachAppTrustHeader(app, url, init);

  let res = await doFetch(reqInit);

  if (!shouldAttachHeaders) return res;
  if (res.status !== 401) return res;

  let bodyText = '';
  try {
    bodyText = await res.clone().text();
  } catch {
    // ignore
  }
  if (!bodyText || !includesAppTrustHint(bodyText)) return res;

  const appTrustInstance = (app as any)?._appTrustInstance;
  if (!appTrustInstance) return res;

  try {
    const { getToken } = await import('../../app-trust/src/app-trust.js');
    await getToken(appTrustInstance, true);
  } catch {
    return res;
  }

  reqInit = attachAppTrustHeader(app, url, init);
  res = await doFetch(reqInit);
  return res;
}
