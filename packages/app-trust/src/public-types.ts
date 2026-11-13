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

/** Describes the public `AppTrustToken` value. */
export interface AppTrustToken {
  /**
   * FUSABASE App Trust token value.
   *
   * This is the token that is sent to FUSABASE backend endpoints
   */
  token: string;

  /**
   * Token expiry time as a Unix timestamp in milliseconds.
   */
  expireTimeMillis: number;
}

/** Describes the public `AppTrustTokenResult` value. */
export interface AppTrustTokenResult extends AppTrustToken {}

/** Receives each newly issued App Trust token. */
export type AppTrustTokenListener = (token: AppTrustTokenResult) => void;

/** Removes a previously registered App Trust token listener. */
export type Unsubscribe = () => void;

/** Describes the public `AppTrustOptions` value. */
export interface AppTrustOptions {
  /**
   * Provider used to mint an attestation token in the browser.
   *
   * The minted provider token is exchanged with the FUSABASE App Trust servlet
   */
  provider:
    | ReCaptchaV3Provider
    | ReCaptchaEnterpriseProvider
    | TurnstileProvider
    | HCaptchaProvider;
}

/** Describes the public `AppTrust` value. */
export interface AppTrust {
  /**
   * The {@link App} instance that this App Trust service is associated with.
   */
  readonly app: App;
}

/**
 * Browser provider that obtains an attestation token using reCAPTCHA v3.
 *
 * @example
 * ```ts
 * const provider = new ReCaptchaV3Provider("site-key");
 * ```
 */
export class ReCaptchaV3Provider {
  /** reCAPTCHA v3 site key. */
  readonly siteKey: string;

  /**
   * Creates a browser attestation provider.
   *
   * @param siteKey - Site key supplied by the attestation provider.
   * @returns A configured provider instance.
   * @example
   * ```ts
   * const provider = new ReCaptchaV3Provider("site-key");
   * ```
   */
  constructor(siteKey: string) {
    this.siteKey = siteKey;
  }
  /** @internal */
  async _getAttestationToken(action: string): Promise<string> {
    if (typeof document === 'undefined') {
      throw new Error('ReCaptchaV3Provider requires a browser environment');
    }

    const w = globalThis as any;
    if (!w.grecaptcha) {
      await new Promise<void>((resolve, reject) => {
        const id = `fusabase-app-trust-v3-${this.siteKey}`;
        if (document.getElementById(id)) {
          const start = Date.now();
          const timer = setInterval(() => {
            if (w.grecaptcha) {
              clearInterval(timer);
              resolve();
            } else if (Date.now() - start > 15000) {
              clearInterval(timer);
              reject(new Error('Timed out loading v3 attestation script'));
            }
          }, 50);
          return;
        }

        const s = document.createElement('script');
        s.id = id;
        s.async = true;
        s.defer = true;
        s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(this.siteKey)}`;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load v3 attestation script'));
        document.head.appendChild(s);
      });
    }

    await new Promise<void>((resolve) => {
      w.grecaptcha.ready(() => resolve());
    });

    const tok = await w.grecaptcha.execute(this.siteKey, { action });
    return tok;
  }
}

/**
 * Browser provider that obtains an enterprise attestation token.
 *
 * @example
 * ```ts
 * const provider = new ReCaptchaEnterpriseProvider("site-key");
 * ```
 */
export class ReCaptchaEnterpriseProvider {
  /** reCAPTCHA Enterprise site key. */
  readonly siteKey: string;

  /**
   * Creates an enterprise attestation provider.
   *
   * @param siteKey - Site key supplied by the attestation provider.
   * @returns A configured provider instance.
   * @example
   * ```ts
   * const provider = new ReCaptchaEnterpriseProvider("site-key");
   * ```
   */
  constructor(siteKey: string) {
    this.siteKey = siteKey;
  }
  /** @internal */
  async _getAttestationToken(action: string): Promise<string> {
    if (typeof document === 'undefined') {
      throw new Error('ReCaptchaEnterpriseProvider requires a browser environment');
    }

    const w = globalThis as any;

    if (!w.grecaptcha?.enterprise) {
      await new Promise<void>((resolve, reject) => {
        const id = `fusabase-app-trust-enterprise-${this.siteKey}`;
        if (document.getElementById(id)) {
          // script is loading; poll for availability
          const start = Date.now();
          const timer = setInterval(() => {
            if (w.grecaptcha?.enterprise) {
              clearInterval(timer);
              resolve();
            } else if (Date.now() - start > 15000) {
              clearInterval(timer);
              reject(new Error('Timed out loading enterprise attestation script'));
            }
          }, 50);
          return;
        }

        const s = document.createElement('script');
        s.id = id;
        s.async = true;
        s.defer = true;
        s.src = `https://www.google.com/recaptcha/enterprise.js?render=${encodeURIComponent(this.siteKey)}`;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load enterprise attestation script'));
        document.head.appendChild(s);
      });
    }

    await new Promise<void>((resolve) => {
      w.grecaptcha.enterprise.ready(() => resolve());
    });

    return w.grecaptcha.enterprise.execute(this.siteKey, { action });
  }
}

/**
 * Browser provider that obtains an attestation token through Turnstile.
 *
 * @example
 * ```ts
 * const provider = new TurnstileProvider("site-key");
 * ```
 */
export class TurnstileProvider {
  /** Cloudflare Turnstile site key. */
  readonly siteKey: string;

  /** @internal Prevent concurrent/double execution (Turnstile errors like 110200). */
  private _inFlight?: Promise<string>;

  /**
   * Creates a Turnstile attestation provider.
   *
   * @param siteKey - Site key supplied by the attestation provider.
   * @returns A configured provider instance.
   * @example
   * ```ts
   * const provider = new TurnstileProvider("site-key");
   * ```
   */
  constructor(siteKey: string) {
    this.siteKey = siteKey;
  }

  /** @internal */
  async _getAttestationToken(action: string): Promise<string> {
    if (typeof document === 'undefined') {
      throw new Error('TurnstileProvider requires a browser environment');
    }

    const w = globalThis as any;

    if (!w.turnstile) {
      await new Promise<void>((resolve, reject) => {
        const id = `fusabase-app-trust-turnstile-${this.siteKey}`;
        if (document.getElementById(id)) {
          const start = Date.now();
          const timer = setInterval(() => {
            if (w.turnstile) {
              clearInterval(timer);
              resolve();
            } else if (Date.now() - start > 15000) {
              clearInterval(timer);
              reject(new Error('Timed out loading Turnstile attestation script'));
            }
          }, 50);
          return;
        }

        const s = document.createElement('script');
        s.id = id;
        s.async = true;
        s.defer = true;
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load Turnstile attestation script'));
        document.head.appendChild(s);
      });
    }

    if (this._inFlight) return this._inFlight;

    this._inFlight = (async () => {
      const TIMEOUT_MS = 20000;

      const container = document.createElement('div');
      Object.assign(container.style, {
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: '2147483647',
        background: '#fff',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 12px 40px rgba(0,0,0,.25)',
      });
      document.body.appendChild(container);

      let widgetId: any;

      try {
        const token = await new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`Timed out waiting for Turnstile token after ${TIMEOUT_MS}ms`));
          }, TIMEOUT_MS);

          const doneResolve = (t: string) => {
            clearTimeout(timeout);
            resolve(t);
          };
          const doneReject = (e: unknown) => {
            clearTimeout(timeout);
            reject(e instanceof Error ? e : new Error(String(e)));
          };

          widgetId = w.turnstile.render(container, {
            sitekey: this.siteKey,
            size: 'normal',
            execution: 'render',
            action,
            callback: (t: string) => doneResolve(t),
            // Expose error code if Turnstile provides it.
            'error-callback': (code?: string) =>
              doneReject(
                new Error(code ? `Turnstile failed to generate token (code=${code})` : 'Turnstile failed to generate token')
              ),
            'expired-callback': () => doneReject(new Error('Turnstile token expired')),
          });

          setTimeout(() => {
            const exec = () => w.turnstile.execute(widgetId);
            try {
              exec();
            } catch (e: any) {
              const msg = typeof e?.message === 'string' ? e.message : String(e);
              const alreadyExec = msg?.toLowerCase().includes('already executing');
              if (alreadyExec && w.turnstile?.reset) {
                try {
                  w.turnstile.reset(widgetId);
                  exec();
                  return;
                } catch (e2) {
                  doneReject(e2);
                  return;
                }
              }
              doneReject(e);
            }
          }, 0);
        });

        return token;
      } finally {
        try {
          if (widgetId != null && w.turnstile?.remove) w.turnstile.remove(widgetId);
        } catch {
          // ignore
        }
        try {
          container.remove();
        } catch {
          // ignore
        }
      }
    })().finally(() => {
      this._inFlight = undefined;
    });

    return this._inFlight;
  }
}

/**
 * Browser provider that obtains an attestation token through hCaptcha.
 *
 * @example
 * ```ts
 * const provider = new HCaptchaProvider("site-key");
 * ```
 */
export class HCaptchaProvider {
  /** hCaptcha site key. */
  readonly siteKey: string;

  /**
   * Creates an hCaptcha attestation provider.
   *
   * @param siteKey - Site key supplied by the attestation provider.
   * @returns A configured provider instance.
   * @example
   * ```ts
   * const provider = new HCaptchaProvider("site-key");
   * ```
   */
  constructor(siteKey: string) {
    this.siteKey = siteKey;
  }

  /** @internal */
  async _getAttestationToken(action: string): Promise<string> {
    if (action) {
      // kept for signature parity; hCaptcha doesn't use action for basic tokens.
    }
    if (typeof document === 'undefined') {
      throw new Error('HCaptchaProvider requires a browser environment');
    }

    const w = globalThis as any;

    if (!w.hcaptcha) {
      await new Promise<void>((resolve, reject) => {
        const id = `fusabase-app-trust-hcaptcha-${this.siteKey}`;
        if (document.getElementById(id)) {
          const start = Date.now();
          const timer = setInterval(() => {
            if (w.hcaptcha) {
              clearInterval(timer);
              resolve();
            } else if (Date.now() - start > 15000) {
              clearInterval(timer);
              reject(new Error('Timed out loading hCaptcha attestation script'));
            }
          }, 50);
          return;
        }

        const s = document.createElement('script');
        s.id = id;
        s.async = true;
        s.defer = true;
        s.src = 'https://js.hcaptcha.com/1/api.js?render=explicit';
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load hCaptcha attestation script'));
        document.head.appendChild(s);
      });
    }

    const container = document.createElement('div');
    Object.assign(container.style, {
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: '2147483647',
      background: '#fff',
      padding: '20px',
      borderRadius: '12px',
      boxShadow: '0 12px 40px rgba(0,0,0,.25)',
    });
    document.body.appendChild(container);

    try {
      const token = await new Promise<string>((resolve, reject) => {
        const widgetId = w.hcaptcha.render(container, {
          sitekey: this.siteKey,
          size: 'invisible',
          callback: (t: string) => resolve(t),
          'error-callback': () => reject(new Error('hCaptcha failed to generate token')),
          'expired-callback': () => reject(new Error('hCaptcha token expired')),
        });

        try {
          w.hcaptcha.execute(widgetId, { async: true }).then(resolve).catch(reject);
        } catch {
          // Fallback for older API: wait for callback.
        }
      });

      return token;
    } finally {
      try {
        container.remove();
      } catch {
        // ignore
      }
    }
  }
}
