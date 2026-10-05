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

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));

function readEnvFile(path) {
  const values = {};

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim().replace(/^export\s+/, '');
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  return values;
}

const env = readEnvFile(envPath);
const requiredKeys = [
  'FUSABASE_TEST_SCHEMA',
  'FUSABASE_TEST_APP_NAME',
  'FUSABASE_TEST_APP_TYPE',
  'FUSABASE_TEST_APP_ID',
  'FUSABASE_TEST_OBJS_TYPE',
  'FUSABASE_TEST_PROJECT_ID',
  'FUSABASE_TEST_STORAGE_BUCKET',
  'FUSABASE_TEST_AUTH_TYPE',
  'FUSABASE_TEST_AUTH_ID',
  'FUSABASE_TEST_ORDS_HOST'
];

const missingKeys = requiredKeys.filter((key) => !env[key]);
if (missingKeys.length) {
  throw new Error(`Missing required Fusabase test configuration in ${envPath}: ${missingKeys.join(', ')}`);
}

export const options = Object.freeze({
  schema: env.FUSABASE_TEST_SCHEMA,
  app_name: env.FUSABASE_TEST_APP_NAME,
  app_type: env.FUSABASE_TEST_APP_TYPE,
  app_id: env.FUSABASE_TEST_APP_ID,
  objs_type: env.FUSABASE_TEST_OBJS_TYPE,
  project_id: env.FUSABASE_TEST_PROJECT_ID,
  storage_bucket: env.FUSABASE_TEST_STORAGE_BUCKET,
  auth_type: env.FUSABASE_TEST_AUTH_TYPE,
  auth_id: env.FUSABASE_TEST_AUTH_ID,
  ords_host: env.FUSABASE_TEST_ORDS_HOST
});

export const appTrustToken = env.FUSABASE_APP_TRUST_TOKEN;
