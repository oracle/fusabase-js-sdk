// Copyright (c) 2015, 2025, Oracle and/or its affiliates.

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
import { attachAppCheckHeader, getAppCheckToken, shouldAttachAppCheckHeader } from './app-trust-header.js';

function includesAppCheckHint(text: string): boolean {
  return text.toLowerCase().includes('appcheck');
}

/** @internal */
export async function fusabaseFetch(app: App | undefined, url: string, init: RequestInit): Promise<Response> {
  const doFetch = (reqInit: RequestInit) => fetch(url, reqInit);

  if (app && shouldAttachAppCheckHeader(url)) {
    const appCheckInstance = (app as any)?._appCheckInstance;
    const tok = getAppCheckToken(app);
    if (appCheckInstance && !tok) {
      try {
        const { getToken } = await import('../../app-trust/src/app-trust.js');
        await getToken(appCheckInstance, false);
      } catch {
      }
    }
  }

  let reqInit = attachAppCheckHeader(app, url, init);

  let res = await doFetch(reqInit);

  if (!shouldAttachAppCheckHeader(url)) return res;
  if (res.status !== 401) return res;

  let bodyText = '';
  try {
    bodyText = await res.clone().text();
  } catch {
    // ignore
  }
  if (!bodyText || !includesAppCheckHint(bodyText)) return res;

  const appCheckInstance = (app as any)?._appCheckInstance;
  if (!appCheckInstance) return res;

  try {
    const { getToken } = await import('../../app-trust/src/app-trust.js');
    await getToken(appCheckInstance, true);
  } catch {
    return res;
  }

  reqInit = attachAppCheckHeader(app, url, init);
  res = await doFetch(reqInit);
  return res;
}
