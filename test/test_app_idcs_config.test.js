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

import { expect } from "chai";
import { deleteApp, initializeApp } from "../dist/app/src/index.js";

describe("IDCS app configuration", () => {
  it("initializes without an idcs_domain_url", async () => {
    const app = initializeApp({
      ords_host: "https://ords.example.test/ords/demo/",
      schema: "demo",
      app_name: "IDCS Test",
      app_type: "WEB",
      app_id: "app-id",
      project_id: "project-id",
      objs_type: "dbfs",
      storage_bucket: "bucket-name",
      auth_type: "idcs",
      auth_id: "auth-id"
    }, "idcs-without-domain-url");

    expect(app.options.idcsDomainURL).to.equal(undefined);
    await deleteApp(app);
  });

  it("treats e-idcs as IDCS", async () => {
    const app = initializeApp({
      ords_host: "https://ords.example.test/ords/demo/",
      schema: "demo",
      app_name: "E-IDCS Test",
      app_type: "WEB",
      app_id: "app-id",
      project_id: "project-id",
      objs_type: "dbfs",
      storage_bucket: "bucket-name",
      auth_type: "e-idcs",
      auth_id: "auth-id"
    }, "e-idcs-alias");

    expect(app.options.authType).to.equal("idcs");
    await deleteApp(app);
  });
});
