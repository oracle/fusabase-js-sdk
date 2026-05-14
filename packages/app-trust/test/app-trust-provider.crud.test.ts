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

function requireEnv(name: string): string {
  const defaults: Record<string, string> = {
    FUSABASE_RECAPTCHA_SITE_KEY: '6LfV7nEsAAAAAFnXf9RAaE2SyjeUmAW7CZuvlTN6',
    FUSABASE_RECAPTCHA_SECRET_KEY: '6LfV7nEsAAAAAJLPVhD7gmgoBpYNJZ0RxLo6m4Xm',
    FUSABASE_HCAPTCHA_SITE_KEY: '995e5cd4-2362-4f66-abb6-442229cc8c26',
    FUSABASE_HCAPTCHA_SECRET_KEY: 'ES_39232d2b917a414986c181bf4c57bad3',
    FUSABASE_TURNSTILE_SITE_KEY: '0x4AAAAAACsEaAfFNjgbPeMo',
    FUSABASE_TURNSTILE_SECRET_KEY: '0x4AAAAAACsEaCAP_75MutPwx44tr8U8VMQ',
  };
  const v = env(name) ?? defaults[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function joinUrl(base: string, path: string): string {
  const b = base.endsWith('/') ? base.slice(0, -1) : base;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

function normalizeAppId(appId: string): string {
  const normalized = String(appId).trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(normalized)) {
    throw new Error('API_KEY/appId must be 32 hex characters for current providerId format');
  }
  return normalized;
}

function canonicalProviderId(platform: 'web' | 'ios' | 'and' | 'flt', appId: string): string {
  // Current server format: <platform>|<appId>
  return `${platform}|${normalizeAppId(appId)}`;
}

function debugEnabled(): boolean {
  return true;
}

function logRestCall(label: string, url: string, init: any): void {
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

async function fetchJson(url: string, init: any): Promise<{ status: number; body: { json?: Json; text?: string } }> {
  const res = await fetch(url, init);
  const body = await readJsonOrText(res);
  return { status: res.status, body };
}

async function listProviders(endpoint: string, headers: Record<string, string>): Promise<void> {
  // NOTE: Current CRUD servlet requires `providerId` on GET and does not support list-all.
  try {
    const url = endpoint;
    const res = await fetch(url, { method: 'GET', headers });
    const body = await readJsonOrText(res);
    // eslint-disable-next-line no-console
    console.log(`\n[REST][providers.list] GET ${url}`);
    // eslint-disable-next-line no-console
    console.log('[REST][providers.list][status]', res.status);
    // eslint-disable-next-line no-console
    console.log('[REST][providers.list][body]', body.json ?? body.text);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('[REST][providers.list][error]', String((e as any)?.stack ?? e));
  }
}

function diagListProvidersEnabled(): boolean {
  return env('FUSABASE_DIAG_LIST_PROVIDERS') === 'true';
}

async function wait(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function getWithRetry(
  url: string,
  init: any,
  opts: { retries: number; delayMs: number }
): Promise<{ status: number; body: { json?: Json; text?: string } }> {
  let last: { status: number; body: { json?: Json; text?: string } } | undefined;
  for (let i = 0; i <= opts.retries; i++) {
    // eslint-disable-next-line no-await-in-loop
    last = await fetchJson(url, init);
    if (last.status !== 404) return last;
    if (i < opts.retries) {
      // eslint-disable-next-line no-await-in-loop
      await wait(opts.delayMs);
    }
  }
  return last!;
}

// Must match server-side AppCheckProvider.ProviderType values.
type ProviderName = 'hcaptcha' | 'recaptchaV3' | 'turnstile';

function expectSameMembers(actual: any, expected: any, label?: string): void {
  expect(actual, label).to.be.an('array');
  expect(expected, label).to.be.an('array');
  // Order-insensitive comparison (server may return arrays in arbitrary order)
  expect(actual).to.have.members(expected);
}

function isNotFound(status: number, body: { json?: Json; text?: string }): boolean {
  if (status !== 404) return false;
  const msg = String(body.json?.error ?? body.json?.message ?? body.text ?? '').toLowerCase();
  return msg.includes('provider not found');
}

function configForProvider(provider: ProviderName) {
  switch (provider) {
    case 'hcaptcha':
      return {
        secretKey: requireEnv('FUSABASE_HCAPTCHA_SECRET_KEY'),
        ttlSeconds: 100,
        scope: ['baas-auth'],
      };
    case 'recaptchaV3':
      return {
        secretKey: requireEnv('FUSABASE_RECAPTCHA_SECRET_KEY'),
        ttlSeconds: 100,
        scoreThreshold: 0.5,
        scope: ['baas-auth'],
      };
    case 'turnstile':
      return {
        secretKey: requireEnv('FUSABASE_TURNSTILE_SECRET_KEY'),
        ttlSeconds: 100,
        scope: ['baas-auth'],
      };
  }
}

describe('AppCheckProviderServlet CRUD matrix (integration)', function () {
  this.timeout(90_000);

  const ORDS_HOST = env('FUSABASE_ORDS_HOST')
    ?? 'https://phoenix555379.dev3sub4phx.databasede3phx.oraclevcn.com:8443/ords/USER1/';
  const PROJECT_ID = env('FUSABASE_PROJECT_ID')
    ?? '4EB39A07C8A21A9DE0631F965E644288';
  const API_KEY = env('FUSABASE_APP_ID')
    ?? '4EB401ABD28C4533E0631F965E6417AC';
  const APP_CHECK_TOKEN = env('FUSABASE_APP_CHECK_TOKEN');
  const BASIC_AUTH = env('FUSABASE_BASIC_AUTH') ?? 'Basic VVNFUjE6dXNlcjE=';
  const SKIP = env('FUSABASE_SKIP_APP_CHECK_PROVIDER_CRUD_TEST') === 'true';
  const INSECURE_TLS = true;

  const GET_RETRIES = Number(env('FUSABASE_APP_CHECK_PROVIDER_GET_RETRIES') ?? '10');
  const GET_DELAY_MS = Number(env('FUSABASE_APP_CHECK_PROVIDER_GET_DELAY_MS') ?? '500');

  if (INSECURE_TLS) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  const enabled = !SKIP && !!(ORDS_HOST && PROJECT_ID && API_KEY);
  const endpoint = enabled
    ? joinUrl(
      ORDS_HOST!,
      `_/baas-panel/appcheck/${encodeURIComponent(PROJECT_ID!)}/providers?apiKey=${encodeURIComponent(API_KEY!)}`
    )
    : '';

  function maybeAppCheckHeader(): Record<string, string> {
    return APP_CHECK_TOKEN ? { 'X-Fusabase-AppCheck': APP_CHECK_TOKEN } : {};
  }

  function basicAuthHeader(): Record<string, string> {
    return BASIC_AUTH ? { Authorization: BASIC_AUTH } : {};
  }

  before(function () {
    if (!enabled) this.skip();
  });

  const providers: ProviderName[] = ['hcaptcha', 'recaptchaV3', 'turnstile'];

  for (const provider of providers) {
    describe(`${provider} provider CRUD`, () => {
      const SKIP_TURNSTILE = env('FUSABASE_SKIP_TURNSTILE_PROVIDER_CRUD_TEST') === 'true';
      before(function () {
        if (provider === 'turnstile' && SKIP_TURNSTILE) {
          this.skip();
        }
      });

      // Current canonical key is platform+appId only; provider type is not part of key.
      const providerId = canonicalProviderId('web', API_KEY!);
      const createUrl = endpoint;
      const getUrl = `${endpoint}&providerId=${encodeURIComponent(providerId)}`;

      it('POST create/upsert', async () => {
        const payload = {
          providerId,
          provider,
          platform: 'web',
          config: configForProvider(provider),
          enforced: ['baas-auth'],
        };

        const init = {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...basicAuthHeader(),
            ...maybeAppCheckHeader(),
          },
          body: JSON.stringify(payload),
        };
        logRestCall(`${provider}.create`, createUrl, init);
        const { status, body } = await fetchJson(createUrl, init);
        expect(status).to.equal(200, `expected 200, got ${status}: ${body.text ?? JSON.stringify(body.json)}`);
        expect(body.json?.providerId).to.equal(providerId);
        expect(body.json?.provider).to.equal(provider);
        expect(body.json?.platform).to.equal('web');

        if (diagListProvidersEnabled()) {
          await listProviders(endpoint, {
            ...basicAuthHeader(),
            ...maybeAppCheckHeader(),
          });
        }
      });

      it('GET after create (with retry on 404)', async () => {
        const init = {
          method: 'GET',
          headers: {
            ...basicAuthHeader(),
            ...maybeAppCheckHeader(),
          },
        };
        logRestCall(`${provider}.get`, getUrl, init);
        const { status, body } = await getWithRetry(getUrl, init, { retries: GET_RETRIES, delayMs: GET_DELAY_MS });

        if (isNotFound(status, body)) {
          expect.fail(`GET after create returned 404 Provider not found after retries. body=${JSON.stringify(body.json ?? body.text)}`);
        }
        expect(status).to.equal(200, `expected 200, got ${status}: ${body.text ?? JSON.stringify(body.json)}`);
        expect(body.json?.providerId).to.equal(providerId);
        expect(body.json?.provider).to.equal(provider);
        expect(body.json?.platform).to.equal('web');
        expect(body.json).to.have.property('config');
        expect(body.json.config).to.be.an('object');
      });

      it('POST upsert config updates then GET verify', async () => {
        const updates: Array<{ label: string; patch: any; expect: (cfg: any, enforced: any) => void }> = [
          {
            label: 'ttlSeconds',
            patch: { ttlSeconds: 200 },
            expect: (cfg) => expect(cfg.ttlSeconds).to.equal(200),
          },
          {
            label: provider === 'recaptchaV3' ? 'scoreThreshold' : 'scope',
            patch: provider === 'recaptchaV3'
              ? { scoreThreshold: 0.7 }
              : { scope: ['baas-auth', 'baas-storage'] },
            expect: (cfg) => {
              if (provider === 'recaptchaV3') {
                expect(cfg.scoreThreshold).to.equal(0.7);
              } else {
                expectSameMembers(cfg.scope, ['baas-auth', 'baas-storage'], 'scope');
              }
            },
          },
          {
            label: 'enforced',
            patch: {},
            expect: (_cfg, enforced) => expectSameMembers(enforced, ['baas-auth', 'baas-storage'], 'enforced'),
          },
        ];

        for (const u of updates) {
          // eslint-disable-next-line no-await-in-loop
          const current = await getWithRetry(
            getUrl,
            {
              method: 'GET',
              headers: {
                ...basicAuthHeader(),
                ...maybeAppCheckHeader(),
              },
            },
            { retries: GET_RETRIES, delayMs: GET_DELAY_MS }
          );
          if (isNotFound(current.status, current.body)) {
            expect.fail(`Precondition GET before config update returned 404 Provider not found. body=${JSON.stringify(current.body.json ?? current.body.text)}`);
          }
          expect(current.status).to.equal(200, `expected 200, got ${current.status}: ${current.body.text ?? JSON.stringify(current.body.json)}`);

          const newConfig = { ...(current.body.json?.config ?? {}), ...u.patch };
          const newEnforced = u.label === 'enforced'
            ? ['baas-auth', 'baas-storage']
            : (current.body.json?.enforced ?? ['baas-auth']);

          const postPayload = {
            providerId,
            provider,
            platform: 'web',
            config: newConfig,
            enforced: newEnforced,
          };

          const init = {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              ...basicAuthHeader(),
              ...maybeAppCheckHeader(),
            },
            body: JSON.stringify(postPayload),
          };
          logRestCall(`${provider}.post.upsert.${u.label}`, createUrl, init);
          // eslint-disable-next-line no-await-in-loop
          const postRes = await fetchJson(createUrl, init);

          if (isNotFound(postRes.status, postRes.body)) {
            expect.fail(`POST upsert update returned 404 Provider not found. body=${JSON.stringify(postRes.body.json ?? postRes.body.text)}`);
          }
          expect(postRes.status).to.equal(200, `expected 200, got ${postRes.status}: ${postRes.body.text ?? JSON.stringify(postRes.body.json)}`);

          // eslint-disable-next-line no-await-in-loop
          const verify = await getWithRetry(
            getUrl,
            {
              method: 'GET',
              headers: {
                ...basicAuthHeader(),
                ...maybeAppCheckHeader(),
              },
            },
            { retries: GET_RETRIES, delayMs: GET_DELAY_MS }
          );
          if (isNotFound(verify.status, verify.body)) {
            expect.fail(`Verify GET after POST upsert returned 404 Provider not found. body=${JSON.stringify(verify.body.json ?? verify.body.text)}`);
          }
          expect(verify.status).to.equal(200, `expected 200, got ${verify.status}: ${verify.body.text ?? JSON.stringify(verify.body.json)}`);
          expect(verify.body.json).to.have.property('config');
          u.expect(verify.body.json.config, verify.body.json.enforced);
        }
      });
    });
  }
});


// -- 1) List all AppCheck keys for one project
  // select project_id, key_type, count(*) as cnt
  // from baassys.baas_key_store
  // where project_id = :project_id
  //   and (
  //     key_type like 'hcaptcha%' or
  //     key_type like 'recaptcha%' or
  //     key_type like 'turnstile%' or
  //     key_type like 'play_integrity%' or
  //     key_type like 'device_check%' or
  //     key_type like 'app_attest%'
  //   )
  // group by project_id, key_type
  // order by key_type;

//   -- 2) List duplicate keys only
//   select project_id, key_type, count(*) as cnt
//   from baassys.baas_key_store
//   where project_id = :project_id
//   group by project_id, key_type
//   having count(*) > 1
//   order by cnt desc, key_type;

//   -- 3) Delete one specific key_type for one project
//   delete from baassys.baas_key_store
//   where project_id = :project_id
//     and key_type   = :key_type;

//   commit;

//   -- 4) Delete all AppCheck keys for one project
  // delete from baassys.baas_key_store
  // where project_id = '4D2256CE7AB6800DE0631F965E64D1CF'
  //   and (
  //     key_type like 'hcaptcha%' or
  //     key_type like 'recaptcha%' or
  //     key_type like 'turnstile%' or
  //     key_type like 'play_integrity%' or
  //     key_type like 'device_check%' or
  //     key_type like 'app_attest%'
  //   );

  // commit;

//   -- 5) Keep exactly 1 row per key_type, delete duplicates (Oracle rowid approach)
//   delete from baassys.baas_key_store t
//   where t.project_id = :project_id
//     and t.rowid not in (
//       select min(t2.rowid)
//       from baassys.baas_key_store t2
//       where t2.project_id = :project_id
//       group by t2.key_type
//     );

//   commit;

//   -- 6) Verify after cleanup
//   select project_id, key_type, count(*) as cnt
//   from baassys.baas_key_store
//   where project_id = :project_id
//   group by project_id, key_type
//   order by key_type;