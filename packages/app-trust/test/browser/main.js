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

import {
  initializeAppCheck,
  getToken,
  TurnstileProvider,
  HCaptchaProvider,
  ReCaptchaV3Provider,
  ReCaptchaEnterpriseProvider,
} from '../../src/index.ts';

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element: ${id}`);
  return el;
}

const logEl = $('log');
function log(...args) {
  const line = args
    .map((a) => {
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a, null, 2);
      } catch {
        return String(a);
      }
    })
    .join(' ');
  logEl.textContent += `${line}\n`;
  logEl.scrollTop = logEl.scrollHeight;
  // eslint-disable-next-line no-console
  console.log(...args);
}

function maybeRedact(value) {
  const redact = $('redact').value === 'true';
  if (!redact) return value;
  if (typeof value !== 'string') return value;
  if (value.length <= 12) return '<redacted>';
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

// Patch fetch to log all REST calls and tokens.
const realFetch = window.fetch.bind(window);
window.fetch = async (url, init = {}) => {
  const bodyText = init?.body;
  let parsed;
  try {
    parsed = bodyText ? JSON.parse(bodyText) : undefined;
  } catch {
    parsed = bodyText;
  }

  log('[fetch][request]', {
    url: String(url),
    method: init?.method ?? 'GET',
    headers: init?.headers,
    body:
      parsed && typeof parsed === 'object'
        ? {
            ...parsed,
            attestationToken: maybeRedact(parsed.attestationToken),
          }
        : parsed,
  });

  const res = await realFetch(url, init);
  const cloned = res.clone();
  const ct = cloned.headers.get('content-type') ?? '';
  let resp;
  try {
    resp = ct.includes('application/json') ? await cloned.json() : await cloned.text();
  } catch {
    resp = '<unreadable>';
  }

  const respLogged = resp && typeof resp === 'object'
    ? {
      ...resp,
      fusabaseAttestationToken: maybeRedact(resp.fusabaseAttestationToken),
    }
    : resp;

  log('[fetch][response]', {
    url: String(url),
    status: res.status,
    body: respLogged,
  });
  return res;
};

function buildProvider() {
  const kind = $('provider').value;
  const siteKey = $('siteKey').value.trim();
  if (!siteKey) throw new Error('Provider siteKey is required');

  switch (kind) {
    case 'turnstile':
      return { provider: new TurnstileProvider(siteKey), providerLabel: 'turnstile' };
    case 'hcaptcha':
      return { provider: new HCaptchaProvider(siteKey), providerLabel: 'hcaptcha' };
    case 'recaptcha_enterprise':
      return { provider: new ReCaptchaEnterpriseProvider(siteKey), providerLabel: 'recaptcha_enterprise' };
    case 'recaptcha_v3':
    default:
      return { provider: new ReCaptchaV3Provider(siteKey), providerLabel: 'recaptcha_v3' };
  }
}

let currentApp = null;
let currentAppCheckToken = null;
function getOrCreateApp() {
  if (currentApp) return currentApp;

  // IMPORTANT: the backend requires X-Fusabase-InstanceId for /attest.
  // In the real SDK, this is created during app initialization.
  // The browser harness constructs a minimal app object, so we generate one here.
  const instanceId = (() => {
    try {
      const k = 'fusabase_instance_id';
      const existing = window.localStorage?.getItem?.(k);
      if (existing) return existing;
      const created =
        window.crypto?.randomUUID?.() ??
        `fusabase_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
      window.localStorage?.setItem?.(k, created);
      return created;
    } catch {
      return (
        window.crypto?.randomUUID?.() ??
        `fusabase_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
      );
    }
  })();

  currentApp = {
    options: {
      ordsHost: $('ordsHost').value.trim(),
      projectID: $('projectId').value.trim(),
      appID: $('appId').value.trim(),
    },
    _instanceId: instanceId,
  };

  return currentApp;
}

function resetApp(reason) {
  currentApp = null;
  currentAppCheckToken = null;
  try {
    $('appCheckEnabled').value = 'false';
  } catch {
    // ignore
  }
  log(`[app] reset (${reason})`);
}

async function setAppCheckEnabled(enabled) {
  const app = getOrCreateApp();
  if (!enabled) {
    currentAppCheckToken = null;
    log('[appcheck] OFF (cleared local token; requests will not include X-Fusabase-AppCheck)');
    return;
  }

  // reCAPTCHA v3 action must match allowed chars: A-Za-z/_
  // Our default 'baas-attest' contains '-' and fails in some reCAPTCHA builds.
  let appCheck = app._appCheckInstance;
  if (!appCheck) {
    const { provider, providerLabel } = buildProvider();
    log('[appcheck] initializing provider=', providerLabel);
    // SDK currently supports only `{ provider }` in AppCheckOptions.
    appCheck = initializeAppCheck(app, { provider });
  }

  const tok = await Promise.race([
    getToken(appCheck, true),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timed out waiting for FUSABASE token (30s)')), 30000)
    ),
  ]);

  log('[appcheck] ON token=', {
    token: maybeRedact(tok.token),
    expireTimeMillis: tok.expireTimeMillis,
  });
  currentAppCheckToken = tok.token;
}

async function runQueryCity() {
  const appCheckEnabled = $('appCheckEnabled').value === 'true';
  const app = getOrCreateApp();

  const ordsHost = String(app.options.ordsHost ?? '').trim();
  const projectId = String(app.options.projectID ?? '').trim();
  const apiKey = String(app.options.appID ?? '').trim();
  if (!ordsHost) throw new Error('Missing ORDS Host');
  if (!projectId) throw new Error('Missing Project ID');
  if (!apiKey) throw new Error('Missing App ID (apiKey)');
  const base = ordsHost.endsWith('/') ? ordsHost.slice(0, -1) : ordsHost;
  const url = `${base}/_/baas-services/database/${encodeURIComponent(projectId)}/v2/runQuery?apiKey=${encodeURIComponent(apiKey)}`;

  const headers = new Headers({
    'x-transaction': '{"begin_trans":0,"end_trans":0,"trans_name":""}',
    'Content-Type': 'application/json',
  });

  if (appCheckEnabled) {
    if (!currentAppCheckToken) {
      throw new Error('AppCheck is ON but token is not minted yet. Toggle AppCheck ON and solve captcha first.');
    }
    headers.set('X-Fusabase-AppCheck', currentAppCheckToken);
  }

  const body = {
    path: ['city'],
    explicitOrder: [],
    limit: 0,
    rt: 0,
    aggregate: [],
    options: {},
  };

  log(`\n=== DB: runQuery city (AppCheck ${appCheckEnabled ? 'ON' : 'OFF'}) ===`);
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  // Log response body (best effort)
  const text = await res.text().catch(() => '');
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : text;
  } catch {
    parsed = text;
  }
  log('[db][runQuery][result]', { status: res.status, ok: res.ok, body: parsed });
  log('=== DB done ===\n');
}

$('btnRunQuery').addEventListener('click', async () => {
  try {
    await runQueryCity();
  } catch (e) {
    log('[error]', String(e?.stack ?? e));
  }
});

$('btnClear').addEventListener('click', () => {
  logEl.textContent = '';
});

// If provider or siteKey changes, we must reset the App.
// AppCheck can only be initialized once per App instance, so switching provider requires a new App.
for (const id of ['provider', 'siteKey']) {
  try {
    $(id).addEventListener('change', () => resetApp(`${id} changed`));
    $(id).addEventListener('input', () => resetApp(`${id} changed`));
  } catch {
    // ignore
  }
}

$('appCheckEnabled').addEventListener('change', async () => {
  try {
    await setAppCheckEnabled($('appCheckEnabled').value === 'true');
  } catch (e) {
    // If enable fails, revert UI back to OFF.
    try {
      $('appCheckEnabled').value = 'false';
    } catch {
      // ignore
    }
    log('[error]', String(e?.stack ?? e));
  }
});

log('Ready. Fill ORDS/project/app + choose provider + enter siteKey, then toggle AppCheck OFF/ON and run DB query.');
