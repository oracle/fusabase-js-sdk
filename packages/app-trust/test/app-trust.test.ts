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

import { expect } from 'chai';

type AppLike = { options: any };
import {
  TurnstileProvider,
  HCaptchaProvider,
  ReCaptchaV3Provider,
  ReCaptchaEnterpriseProvider,
  initializeAppTrust,
  getToken,
  onTokenChanged,
} from '../../../dist/app-trust/src/index.js';

describe('app-trust', () => {
  const app = {
    options: {
      schema: 'user1',
      appID: '4E50DA5DF9746710E0631F965E644323',
      objsType: 'dbfs',
      projectID: '4E50B6A4D83256AEE0631F965E6411B9',
      storageBucket: 'dbfs_ZEHVFGNZJWAOEGP',
      authType: 'base',
      authID: '4E50B6B7EB4C56BFE0631F965E648054',
      ordsHost:
        'https://phoenix555379.dev3sub4phx.databasede3phx.oraclevcn.com:8443/ords/USER1/',
    },
  } as any;

it('getToken can be invoked with forceRefresh without throwing synchronously (recaptcha v3)', async () => {
  const appCheck = initializeAppTrust(app, {
    provider: new ReCaptchaV3Provider('sitekey'),
  });
  // Token fetch will fail in Node (no document), but the call should be possible.
  try {
    await getToken(appCheck, true);
  } catch {
    // ignore
  }
});

  it('onTokenChanged can subscribe/unsubscribe without throwing', async () => {
    const appCheck = initializeAppTrust(app, {
      provider: new ReCaptchaEnterpriseProvider('sitekey'),
    });

    const unsub = onTokenChanged(appCheck, () => undefined);
    unsub();
  });

  it('browser providers send correct provider id (turnstile)', async () => {
    // Mock Turnstile API
    (globalThis as any).document = {
      head: { appendChild: () => undefined },
      body: { appendChild: () => undefined },
      createElement: () => ({
        style: {},
        remove: () => undefined,
      }),
      getElementById: () => null,
    } as any;

    (globalThis as any).turnstile = {
      render: (_container: any, cfg: any) => {
        queueMicrotask(() => cfg.callback('cf-token'));
        return 'wid';
      },
      execute: () => undefined,
    };

    // Mock fetch exchange
    let lastBody: any;
    const realFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = async (_url: string, init: any) => {
      lastBody = JSON.parse(init.body);
      return new Response(JSON.stringify({ fusabaseAttestationToken: 'fusabase', expiresAt: new Date(Date.now() + 60_000).toISOString() }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };

    try {
      const appCheck = initializeAppTrust(app, {
        provider: new TurnstileProvider('sitekey'),
      });
      const tok = await getToken(appCheck, true);
      expect(tok.token).to.equal('fusabase');
      expect(lastBody.provider).to.match(/^turnstile\|[0-9a-f]{10}$/);
      expect(lastBody.attestationToken).to.equal('cf-token');
    } finally {
      (globalThis as any).fetch = realFetch;
      delete (globalThis as any).turnstile;
      delete (globalThis as any).document;
    }
  });

  it('browser providers send correct provider id (hcaptcha)', async () => {
    (globalThis as any).document = {
      head: { appendChild: () => undefined },
      body: { appendChild: () => undefined },
      createElement: () => ({
        style: {},
        remove: () => undefined,
      }),
      getElementById: () => null,
    } as any;

    (globalThis as any).hcaptcha = {
      render: (_container: any, cfg: any) => {
        queueMicrotask(() => cfg.callback('hc-token'));
        return 'wid';
      },
      execute: async () => 'hc-token',
    };

    let lastBody: any;
    const realFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = async (_url: string, init: any) => {
      lastBody = JSON.parse(init.body);
      return new Response(JSON.stringify({ fusabaseAttestationToken: 'fusabase2', expiresAt: new Date(Date.now() + 60_000).toISOString() }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };

    try {
      const appCheck = initializeAppTrust(app, {
        provider: new HCaptchaProvider('sitekey'),
      });
      const tok = await getToken(appCheck, true);
      expect(tok.token).to.equal('fusabase2');
      expect(lastBody.provider).to.match(/^hcaptcha\|[0-9a-f]{10}$/);
      expect(lastBody.attestationToken).to.equal('hc-token');
    } finally {
      (globalThis as any).fetch = realFetch;
      delete (globalThis as any).hcaptcha;
      delete (globalThis as any).document;
    }
  });
});
