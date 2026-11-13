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

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required test configuration: ${name}`);
  return value;
}

export const ordsHost = required("FUSABASE_TEST_ORDS_HOST");

export const clientConfig = Object.freeze({
  schema: required("FUSABASE_TEST_SCHEMA"),
  app_name: required("FUSABASE_TEST_APP_NAME"),
  app_type: required("FUSABASE_TEST_APP_TYPE"),
  app_id: required("FUSABASE_TEST_APP_ID"),
  objs_type: required("FUSABASE_TEST_OBJS_TYPE"),
  project_id: required("FUSABASE_TEST_PROJECT_ID"),
  storage_bucket: required("FUSABASE_TEST_STORAGE_BUCKET"),
  auth_type: required("FUSABASE_TEST_AUTH_TYPE"),
  auth_id: required("FUSABASE_TEST_AUTH_ID"),
});

export const testAppConfig = Object.freeze({
  ...clientConfig,
  ords_host: ordsHost,
});
