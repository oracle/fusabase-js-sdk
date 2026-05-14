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

function debugEnabled(): boolean {
  return true;
}

function maybeRedact(value: unknown): unknown {
  const redact = env('FUSABASE_REDACT_TOKENS') === 'true';
  if (!redact) return value;
  if (typeof value !== 'string') return value;
  if (value.length <= 12) return '<redacted>';
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function logRest(label: string, url: string, init: any, extra?: Record<string, unknown>): void {
  if (!debugEnabled()) return;
  // eslint-disable-next-line no-console
  console.log(`\n[REST][${label}] ${init?.method ?? 'GET'} ${url}`);
  if (init?.headers) {
    // eslint-disable-next-line no-console
    console.log('[REST][headers]', init.headers);
  }
  if (init?.body) {
    // eslint-disable-next-line no-console
    console.log('[REST][body]', init.body);
  }
  if (extra) {
    // eslint-disable-next-line no-console
    console.log('[REST][extra]', extra);
  }
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
 * Integration test: reCAPTCHA v3 attestation exchange.
 *
 * Env:
 * - FUSABASE_ORDS_HOST, FUSABASE_PROJECT_ID, FUSABASE_APP_ID
 * - FUSABASE_RECAPTCHAV3_TOKEN (real token minted by browser/app)
 * - FUSABASE_REDACT_TOKENS=true to redact tokens in logs
 */
describe('AppCheck attestation exchange (integration): recaptcha v3', function () {
  this.timeout(60_000);

  const ORDS_HOST = env('FUSABASE_ORDS_HOST');
  const PROJECT_ID = env('FUSABASE_PROJECT_ID') ?? '4D2256CE7AB6800DE0631F965E64D1CF';
  const API_KEY = env('FUSABASE_APP_ID') ?? '4D22F089F2FDC2AFE0631F965E6442D3';

  const TOKEN = env('FUSABASE_RECAPTCHAV3_TOKEN');

  const SKIP = env('FUSABASE_SKIP_APP_CHECK_ATTEST_RECAPTCHAV3_TEST') === 'true';
  const enabled = !SKIP && !!(ORDS_HOST && PROJECT_ID && API_KEY && TOKEN);

  const endpoint = enabled
    ? joinUrl(ORDS_HOST!, `_/baas-services/appcheck/${encodeURIComponent(PROJECT_ID!)}/attest?apiKey=${encodeURIComponent(API_KEY!)}`)
    : '';

  before(function () {
    if (!enabled) this.skip();
  });

  it('exchanges a token for an fusabaseAttestationToken', async () => {
    const payload = {
      provider: 'recaptcha',
      attestationToken: TOKEN,
      action: 'baas-auth',
      deviceInfo: { platform: 'web', userAgent: 'integration-test' },
    };

    const init = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    };

    logRest('attest.recaptchav3', endpoint, init, {
      provider: payload.provider,
      action: payload.action,
      attestationToken: maybeRedact(TOKEN),
    });

    const res = await fetch(endpoint, init);
    const body = await readJsonOrText(res);

    if (debugEnabled()) {
      // eslint-disable-next-line no-console
      console.log('[REST][attest.recaptchav3][response]', {
        status: res.status,
        body: body.json ?? body.text,
        fusabaseAttestationToken: maybeRedact(body.json?.fusabaseAttestationToken),
      });
    }

    expect(res.status).to.equal(200, `expected 200, got ${res.status}: ${body.text ?? JSON.stringify(body.json)}`);
    expect(body.json).to.have.property('fusabaseAttestationToken');
    expect(body.json.fusabaseAttestationToken).to.be.a('string').and.to.have.length.greaterThan(10);
    expect(body.json).to.have.property('decision');
  });
});
