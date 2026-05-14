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
import { attachAppCheckHeader, FUSABASE_APP_CHECK_HEADER, FUSABASE_INSTANCE_ID_HEADER } from '../../app/src/app-trust-header.js';

describe('attachAppCheckHeader', () => {
  it('adds X-Fusabase-AppCheck header only for baas-services URLs', () => {
    const app = { options: {}, _appCheckToken: 'tok123', _instanceId: 'iid-1' } as any;

    const init = { method: 'GET', headers: { 'x-test': '1' } } as RequestInit;

    const nonBaas = attachAppCheckHeader(app, 'https://example.com/other', init);
    const nonHeaders = new Headers(nonBaas.headers as any);
    expect(nonHeaders.has(FUSABASE_APP_CHECK_HEADER)).to.equal(false);

    const baas = attachAppCheckHeader(app, 'https://host/_/baas-services/storage/p/', init);
    const baasHeaders = new Headers(baas.headers as any);
    expect(baasHeaders.get(FUSABASE_APP_CHECK_HEADER)).to.equal('tok123');
    expect(baasHeaders.get(FUSABASE_INSTANCE_ID_HEADER)).to.equal('iid-1');
    expect(baasHeaders.get('x-test')).to.equal('1');
  });

  it('does not attach X-Fusabase-AppCheck for the appcheck attest endpoint', () => {
    const app = { options: {}, _appCheckToken: 'tok123', _instanceId: 'iid-1' } as any;
    const init = { method: 'POST', headers: { 'x-test': '1' } } as RequestInit;

    const attestUrl = 'https://host/_/baas-services/appcheck/proj/attest?apiKey=app';
    const res = attachAppCheckHeader(app, attestUrl, init);
    const headers = new Headers(res.headers as any);

    expect(headers.has(FUSABASE_APP_CHECK_HEADER)).to.equal(false);
    // InstanceId is also not attached since we skip this endpoint entirely.
    expect(headers.has(FUSABASE_INSTANCE_ID_HEADER)).to.equal(false);
    expect(headers.get('x-test')).to.equal('1');
  });
});
