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

type Json = any;

function env(name: string): string | undefined {
  return process.env[name] && process.env[name]!.length ? process.env[name] : undefined;
}

function joinUrl(base: string, path: string): string {
  const b = base.endsWith('/') ? base.slice(0, -1) : base;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

async function readJsonOrText(res: Response): Promise<{ json?: Json; text?: string }> {
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    try {
      return { json: await res.json() };
    } catch {
      // fall through
    }
  }
  return { text: await res.text().catch(() => '') };
}

/**
 * Integration test for FUSABASE attestation exchange using Cloudflare Turnstile and hCaptcha.
 *
 * This test calls the FUSABASE attestation servlet directly:
 *   POST /_/baas-services/appcheck/:projectId/attest?apiKey=:appId
 *
 * It requires:
 * - a server deployment configured with provider ids `turnstile` and/or `hcaptcha`
 * - real tokens minted by your application, provided via env vars
 */
describe('AppCheck attestation exchange (integration): turnstile + hcaptcha', function () {
  this.timeout(60_000);

  const ORDS_HOST = env('FUSABASE_ORDS_HOST');
  const PROJECT_ID = env('FUSABASE_PROJECT_ID') ?? '4D2256CE7AB6800DE0631F965E64D1CF';
  const API_KEY = env('FUSABASE_APP_ID') ?? '4D22F089F2FDC2AFE0631F965E6442D3';

  const TURNSTILE_TOKEN = env('FUSABASE_TURNSTILE_TOKEN');
  const HCAPTCHA_TOKEN = env('FUSABASE_HCAPTCHA_TOKEN');

  const SKIP = env('FUSABASE_SKIP_APP_CHECK_ATTEST_INTEGRATION_TEST') === 'true';

  const enabled = !SKIP && !!(ORDS_HOST && PROJECT_ID && API_KEY) && !!(TURNSTILE_TOKEN || HCAPTCHA_TOKEN);

  const endpoint = enabled
    ? joinUrl(ORDS_HOST!, `_/baas-services/appcheck/${encodeURIComponent(PROJECT_ID!)}/attest?apiKey=${encodeURIComponent(API_KEY!)}`)
    : '';

  before(function () {
    if (!enabled) {
      this.skip();
    }
  });

  async function exchange(provider: 'turnstile' | 'hcaptcha', attestationToken: string): Promise<any> {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider,
        attestationToken,
        action: 'baas-auth',
        deviceInfo: { platform: 'web', userAgent: 'integration-test' },
      }),
    });

    const body = await readJsonOrText(res);
    expect(res.status).to.equal(200, `expected 200, got ${res.status}: ${body.text ?? JSON.stringify(body.json)}`);
    return body.json;
  }

  it('exchanges a Turnstile token for an fusabaseAttestationToken', async () => {
    if (!TURNSTILE_TOKEN) return;
    const json = await exchange('turnstile', TURNSTILE_TOKEN);
    expect(json).to.have.property('fusabaseAttestationToken');
    expect(json.fusabaseAttestationToken).to.be.a('string').and.to.have.length.greaterThan(10);
  });

  it('exchanges an hCaptcha token for an fusabaseAttestationToken', async () => {
    if (!HCAPTCHA_TOKEN) return;
    const json = await exchange('hcaptcha', HCAPTCHA_TOKEN);
    expect(json).to.have.property('fusabaseAttestationToken');
    expect(json.fusabaseAttestationToken).to.be.a('string').and.to.have.length.greaterThan(10);
  });
});
