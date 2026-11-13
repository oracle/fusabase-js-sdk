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

import fs from "node:fs";
import path from "node:path";
import { expect } from "chai";
import { deleteApp } from "fusabase/app";
import { createClient } from "fusabase/fusabase-relational";
import { clientConfig, ordsHost, testAppConfig } from "./test_config.js";

// This suite calls the shared development endpoint configured in
// .env. First run test/sql/relational_projection_setup.sql.
//
// FUSABASE_RELATIONAL_PROJECTION_CASES may override the fixture matrix. Each item
// may select from another table: { "name": "orders", "table": "users_1", "select": "orders(*)" }.
const enabled = process.env.FUSABASE_RELATIONAL_INTEGRATION === "1";
const describeIntegration = enabled ? describe : describe.skip;

const appConfig = testAppConfig;

const defaultCases = [
  { name: "all columns", select: "*" },
  { name: "one column", select: "uuid" },
  { name: "multiple columns", select: "uuid,name" },
  { name: "column alias", select: "user_name:name" },
  { name: "embedded all columns", select: "orders(*)" },
  { name: "embedded selected columns", select: "orders(id,amount)" },
  { name: "embedded relation alias", select: "myorders:orders(*)" },
  { name: "embedded inner join", select: "orders!inner(*)" },
  { name: "nested embedded relation", select: "orders(id,items(*))" },
  { name: "multiple embedded relations", select: "orders(*),payments(*)" },
  { name: "embedded relation count", select: "uuid,orders(count)" },
  { name: "root count aggregate", select: "count()" },
  { name: "root sum aggregate", table: "orders", select: "amount.sum()" },
  { name: "root average aggregate", table: "orders", select: "amount.avg()" },
  { name: "root minimum aggregate", table: "orders", select: "amount.min()" },
  { name: "root maximum aggregate", table: "orders", select: "amount.max()" },
  { name: "root aggregate alias", table: "orders", select: "total:amount.sum()" },
  { name: "embedded aggregate", select: "orders(amount.sum())" },
  {
    name: "embedded aggregate and count",
    select: "orders(id,total:amount.sum(),items(count))",
  },
  { name: "spread relation", table: "orders", select: "...directors(last_name)" },
  { name: "join hint", table: "users_billing", select: "orders!billing(*)" },
  { name: "inner join hint", table: "users_billing", select: "orders!billing!inner(*)" },
  { name: "aliased join hint", table: "users_billing", select: "bill:orders!billing(*)" },
  { name: "start scan join hint", table: "users_start", select: "start_scan:scans!scan_id_start(*)" },
  { name: "end scan join hint", table: "users_end", select: "end_scan:scans!scan_id_end(*)" },
];

const queryCases = [
  { name: "eq", syntax: '.eq("uuid", 1)', apply: (q) => q.eq("uuid", 1) },
  { name: "neq", syntax: '.neq("uuid", 1)', apply: (q) => q.neq("uuid", 1) },
  { name: "gt", syntax: '.gt("age", 23)', apply: (q) => q.gt("age", 23) },
  { name: "gte", syntax: '.gte("age", 23)', apply: (q) => q.gte("age", 23) },
  { name: "lt", syntax: '.lt("age", 29)', apply: (q) => q.lt("age", 29) },
  { name: "lte", syntax: '.lte("age", 29)', apply: (q) => q.lte("age", 29) },
  { name: "like", syntax: '.like("name", "%ra%")', apply: (q) => q.like("name", "%ra%") },
  { name: "ilike", syntax: '.ilike("name", "PRA%")', apply: (q) => q.ilike("name", "PRA%") },
  { name: "ilikeAllOf", syntax: '.ilikeAllOf("name", ["%ra%", "%tik%"] )', apply: (q) => q.ilikeAllOf("name", ["%ra%", "%tik%"]) },
  { name: "ilikeAnyOf", syntax: '.ilikeAnyOf("name", ["%ra%", "%man%"] )', apply: (q) => q.ilikeAnyOf("name", ["%ra%", "%man%"]) },
  { name: "is", table: "users_3", syntax: '.is("temp->active", true)', apply: (q) => q.is("temp->active", true) },
  { name: "is null", table: "users_4", syntax: '.is("active", null)', apply: (q) => q.is("active", null) },
  { name: "in", syntax: '.in("uuid", [1, 2])', apply: (q) => q.in("uuid", [1, 2]) },
  { name: "contains", table: "users_3", syntax: '.contains("temp->skills", ["Oracle"])', apply: (q) => q.contains("temp->skills", ["Oracle"]) },
  { name: "overlaps array", table: "users_3", syntax: '.overlaps("temp->skills", ["Oracle"])', apply: (q) => q.overlaps("temp->skills", ["Oracle"]) },
  { name: "match", syntax: '.match({ uuid: 1, name: "pratik" })', apply: (q) => q.match({ uuid: 1, name: "pratik" }) },
  { name: "not", syntax: '.not("uuid", "eq", 1)', apply: (q) => q.not("uuid", "eq", 1) },
  { name: "or", syntax: '.or("uuid.eq.1,uuid.eq.2")', apply: (q) => q.or("uuid.eq.1,uuid.eq.2") },
  { name: "and", syntax: '.and("uuid.gt.1,age.lte.29")', apply: (q) => q.and("uuid.gt.1,age.lte.29") },
  { name: "filter between", syntax: '.filter("age", "between", [23, 29])', apply: (q) => q.filter("age", "between", [23, 29]) },
  { name: "filter ge alias", syntax: '.filter("age", "ge", 23)', apply: (q) => q.filter("age", "ge", 23) },
  { name: "filter le alias", syntax: '.filter("age", "le", 29)', apply: (q) => q.filter("age", "le", 29) },
  { name: "filter nin", syntax: '.filter("uuid", "nin", [99])', apply: (q) => q.filter("uuid", "nin", [99]) },
  { name: "filter null", table: "users_4", syntax: '.filter("active", "null", true)', apply: (q) => q.filter("active", "null", true) },
  { name: "filter notnull", table: "users_4", syntax: '.filter("active", "notnull", true)', apply: (q) => q.filter("active", "notnull", true) },
  { name: "filter instr", syntax: '.filter("name", "instr", "ra")', apply: (q) => q.filter("name", "instr", "ra") },
  { name: "filter ninstr", syntax: '.filter("name", "ninstr", "zz")', apply: (q) => q.filter("name", "ninstr", "zz") },
  { name: "filter exists", table: "users_4", syntax: '.filter("active", "exists", true)', apply: (q) => q.filter("active", "exists", true) },
  { name: "filter JSON all", table: "users_3", syntax: '.filter("temp->skills", "all", ["Oracle"])', apply: (q) => q.filter("temp->skills", "all", ["Oracle"]) },
  { name: "filter JSON cs alias", table: "users_3", syntax: '.filter("temp->skills", "cs", ["Oracle"])', apply: (q) => q.filter("temp->skills", "cs", ["Oracle"]) },
  { name: "filter JSON regex", table: "users_3", syntax: '.filter("temp->city", "regex", "^Pune$")', apply: (q) => q.filter("temp->city", "regex", "^Pune$") },
  { name: "filter JSON likeRegex", table: "users_3", syntax: '.filter("temp->city", "likeRegex", "P%")', apply: (q) => q.filter("temp->city", "likeRegex", "P%") },
  { name: "filter JSON ciRegex", table: "users_3", syntax: '.filter("temp->city", "ciRegex", "^pune$")', apply: (q) => q.filter("temp->city", "ciRegex", "^pune$") },
  { name: "filter JSON ciLikeRegex", table: "users_3", syntax: '.filter("temp->city", "ciLikeRegex", "p%")', apply: (q) => q.filter("temp->city", "ciLikeRegex", "p%") },
  { name: "filter JSON nlRegex", table: "users_3", syntax: '.filter("temp->city", "nlRegex", "^Pune$")', apply: (q) => q.filter("temp->city", "nlRegex", "^Pune$") },
  { name: "filter JSON nlLikeRegex", table: "users_3", syntax: '.filter("temp->city", "nlLikeRegex", "P%")', apply: (q) => q.filter("temp->city", "nlLikeRegex", "P%") },
  { name: "filter JSON nlciRegex", table: "users_3", syntax: '.filter("temp->city", "nlciRegex", "^pune$")', apply: (q) => q.filter("temp->city", "nlciRegex", "^pune$") },
  { name: "filter JSON nlciLikeRegex", table: "users_3", syntax: '.filter("temp->city", "nlciLikeRegex", "p%")', apply: (q) => q.filter("temp->city", "nlciLikeRegex", "p%") },
  { name: "filter JSON hasSubstring", table: "users_3", syntax: '.filter("temp->city", "hasSubstring", "un")', apply: (q) => q.filter("temp->city", "hasSubstring", "un") },
  { name: "filter JSON startsWith", table: "users_3", syntax: '.filter("temp->city", "startsWith", "Pu")', apply: (q) => q.filter("temp->city", "startsWith", "Pu") },
  { name: "filter JSON not", table: "users_3", syntax: '.not("temp->city", "regex", "^Delhi$")', apply: (q) => q.not("temp->city", "regex", "^Delhi$") },
  { name: "filter bitsAllSet", table: "users_3", syntax: '.filter("temp->experience", "bitsAllSet", 1)', apply: (q) => q.filter("temp->experience", "bitsAllSet", 1) },
  { name: "filter bitsAllClear", table: "users_3", syntax: '.filter("temp->experience", "bitsAllClear", 2)', apply: (q) => q.filter("temp->experience", "bitsAllClear", 2) },
  { name: "filter bitsAnySet", table: "users_3", syntax: '.filter("temp->experience", "bitsAnySet", 4)', apply: (q) => q.filter("temp->experience", "bitsAnySet", 4) },
  { name: "filter bitsAnyClear", table: "users_3", syntax: '.filter("temp->experience", "bitsAnyClear", 2)', apply: (q) => q.filter("temp->experience", "bitsAnyClear", 2) },
  { name: "filter range alias sr", syntax: '.filter("age", "sr", 23)', apply: (q) => q.filter("age", "sr", 23) },
  { name: "filter range alias nxl", syntax: '.filter("age", "nxl", 23)', apply: (q) => q.filter("age", "nxl", 23) },
  { name: "filter range alias sl", syntax: '.filter("age", "sl", 29)', apply: (q) => q.filter("age", "sl", 29) },
  { name: "filter range alias nxr", syntax: '.filter("age", "nxr", 29)', apply: (q) => q.filter("age", "nxr", 29) },
  { name: "relational order", syntax: '.order("name", { ascending: false, nullsFirst: false })', apply: (q) => q.order("name", { ascending: false, nullsFirst: false }) },
  { name: "JSON order", table: "users_3", syntax: '.order("temp->city", { datatype: "string" })', apply: (q) => q.order("temp->city", { datatype: "string" }) },
  { name: "pagination limit", syntax: '.limit(2)', apply: (q) => q.limit(2) },
  { name: "pagination range", syntax: '.range(1, 2)', apply: (q) => q.range(1, 2) },
  { name: "single", syntax: '.eq("uuid", 1).single()', apply: (q) => q.eq("uuid", 1).single() },
  { name: "maybeSingle", syntax: '.eq("uuid", 1).maybeSingle()', apply: (q) => q.eq("uuid", 1).maybeSingle() },
  { name: "custom header", syntax: '.setHeader("X-Relational-Integration-Test", "true")', apply: (q) => q.setHeader("X-Relational-Integration-Test", "true") },
];

function configuredCases() {
  const raw = process.env.FUSABASE_RELATIONAL_PROJECTION_CASES;
  if (!raw) return defaultCases;

  const cases = JSON.parse(raw);
  if (!Array.isArray(cases)) {
    throw new Error("FUSABASE_RELATIONAL_PROJECTION_CASES must be a JSON array");
  }
  return cases;
}

describeIntegration("Relational projection endpoint integration", function () {
  this.timeout(30000);

  const table = process.env.FUSABASE_RELATIONAL_PROJECTION_TABLE ?? "users_1";
  const cases = configuredCases();
  let app;
  let relational;
  let originalFetch;
  let lastRequest;
  let logFile;
  let passed = 0;
  let failed = 0;

  before(function () {
    logFile = path.resolve(
      "test/logs",
      `relational-projection-integration-${new Date().toISOString().replace(/[:.]/g, "-")}.log`
    );
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    writeLog(logFile, "START", {
      appConfig,
      defaultTable: table,
      projectionCases: cases.length,
      queryCases: queryCases.length,
    });
    console.log(`Relational projection integration log: ${logFile}`);

    relational = createClient(ordsHost, clientConfig);
    app = relational.app;
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      lastRequest = {
        url: String(url),
        method: init?.method,
        payload: parseJson(init?.body),
      };
      try {
        const response = await originalFetch(url, init);
        lastRequest.response = {
          status: response.status,
          statusText: response.statusText,
          body: await response.clone().text(),
        };
        return response;
      } catch (error) {
        lastRequest.transportError = serializeError(error);
        throw error;
      }
    };
  });

  after(async function () {
    globalThis.fetch = originalFetch;
    if (app) {
      await deleteApp(app);
    }
    writeLog(logFile, "SUMMARY", { passed, failed });
  });

  for (const projectionCase of cases) {
    it(`returns server results for ${projectionCase.name}: ${projectionCase.select}`, async function () {
      if (!projectionCase?.name || !projectionCase?.select) {
        throw new Error("Each projection case needs string 'name' and 'select' properties");
      }

      lastRequest = undefined;
      let response;
      try {
        response = await relational
          .from(projectionCase.table ?? table)
          .select(projectionCase.select)
          .limit(1);

        expect(
          response.error,
          `Endpoint rejected '${projectionCase.select}': ${response.error?.message ?? "unknown error"}`
        ).to.equal(null);
        expect(response.status, "Endpoint did not return a successful HTTP status").to.be.within(200, 299);
        expect(response.data, "Endpoint returned no result payload").to.not.equal(null);
        passed += 1;
        writeLog(logFile, "PASS", {
          name: projectionCase.name,
          selectSyntax: selectSyntax(projectionCase, table),
          request: lastRequest,
          sdkResponse: serializeResponse(response),
        });
      } catch (error) {
        failed += 1;
        const diagnostics = {
          projection: projectionCase.select,
          selectSyntax: selectSyntax(projectionCase, table),
          request: lastRequest,
          sdkResponse: serializeResponse(response),
          assertionOrTransportError: serializeError(error),
        };
        writeLog(logFile, "FAIL", diagnostics);
        console.error(`Relational projection request failed: ${projectionCase.name}`, JSON.stringify(diagnostics, null, 2));
        throw error;
      }
    });
  }

  for (const queryCase of queryCases) {
    it(`executes ${queryCase.name}`, async function () {
      const queryTable = queryCase.table ?? table;
      const syntax = `relational.from(${JSON.stringify(queryTable)}).select("*")${queryCase.syntax}`;
      await assertSuccessfulRequest(queryCase.name, syntax, () =>
        queryCase.apply(relational.from(queryTable).select("*"))
      );
    });
  }

  const writeTable = "users_1";
  const writeRow = () => ({
    uuid: Date.now() + Math.floor(Math.random() * 1000),
    name: `relational-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    age: 30,
  });

  async function removeWriteRow(row) {
    const cleanup = await relational.from(writeTable).delete().eq("uuid", row.uuid);
    if (cleanup.error) console.error("Could not clean up relational fixture row", cleanup.error);
  }

  it("inserts a fixture row", async function () {
    const row = writeRow();
    try {
      const result = await relational.from(writeTable).insert(row).select("uuid,name,age");
      expect(result.error).to.equal(null);
    } finally {
      await removeWriteRow(row);
    }
  });

  it("upserts a fixture row", async function () {
    const row = writeRow();
    try {
      const result = await relational.from(writeTable).upsert(row, { onConflict: "uuid" }).select("uuid,name");
      expect(result.error).to.equal(null);
    } finally {
      await removeWriteRow(row);
    }
  });

  it("updates a fixture row", async function () {
    const row = writeRow();
    try {
      expect((await relational.from(writeTable).insert(row)).error).to.equal(null);
      const result = await relational.from(writeTable).update({ age: 31 }).eq("uuid", row.uuid).select("uuid,age");
      expect(result.error).to.equal(null);
    } finally {
      await removeWriteRow(row);
    }
  });

  it("deletes a fixture row", async function () {
    const row = writeRow();
    try {
      expect((await relational.from(writeTable).insert(row)).error).to.equal(null);
      const result = await relational.from(writeTable).delete().eq("uuid", row.uuid).select("uuid");
      expect(result.error).to.equal(null);
    } finally {
      await removeWriteRow(row);
    }
  });

  it("applies textSearch", async function () {
    const result = await relational.from(writeTable).select("uuid,name").textSearch("name", "pratik");
    expect(result.error).to.equal(null);
  });

  it("applies abortSignal", async function () {
    const controller = new AbortController();
    controller.abort();
    let error;
    try {
      await relational.from(writeTable).select().abortSignal(controller.signal);
    } catch (caught) {
      error = caught;
    }
    expect(error?.name).to.equal("AbortError");
  });

  it("applies retry", async function () {
    const result = await relational.from(writeTable).select().retry(false);
    expect(result.error).to.equal(null);
  });

  it("applies overrideTypes", async function () {
    const result = await relational.from(writeTable).select("uuid").overrideTypes();
    expect(result.error).to.equal(null);
  });

  it("applies returns", async function () {
    const result = await relational.from(writeTable).select("uuid").returns();
    expect(result.error).to.equal(null);
  });

  it("throws an error when throwOnError is enabled", async function () {
    let error;
    try {
      await relational.from("relational_missing_table").select().throwOnError();
    } catch (caught) {
      error = caught;
    }
    expect(error).to.be.instanceOf(Error);
  });

  async function assertSuccessfulRequest(name, syntax, createRequest) {
    lastRequest = undefined;
    let response;
    try {
      response = await createRequest();
      expect(response.error, `Endpoint rejected ${syntax}: ${response.error?.message ?? "unknown error"}`).to.equal(null);
      expect(response.status, "Endpoint did not return a successful HTTP status").to.be.within(200, 299);
      expect(response.data, "Endpoint returned no result payload").to.not.equal(null);
      passed += 1;
      writeLog(logFile, "PASS", { name, selectSyntax: syntax, request: lastRequest, sdkResponse: serializeResponse(response) });
    } catch (error) {
      failed += 1;
      const diagnostics = {
        query: name,
        selectSyntax: syntax,
        request: lastRequest,
        sdkResponse: serializeResponse(response),
        assertionOrTransportError: serializeError(error),
      };
      writeLog(logFile, "FAIL", diagnostics);
      console.error(`Relational query request failed: ${name}`, JSON.stringify(diagnostics, null, 2));
      throw error;
    }
  }

});

function parseJson(body) {
  if (typeof body !== "string") return body;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

function serializeError(error) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return error;
}

function serializeResponse(response) {
  if (!response) return response;
  return {
    data: response.data,
    error: serializeError(response.error),
    status: response.status,
    statusText: response.statusText,
  };
}

function selectSyntax(projectionCase, defaultTable) {
  return `relational.from(${JSON.stringify(projectionCase.table ?? defaultTable)}).select(${JSON.stringify(projectionCase.select)}).limit(1)`;
}

function writeLog(logFile, event, details) {
  fs.appendFileSync(
    logFile,
    `[${new Date().toISOString()}] ${event}\n${JSON.stringify(details, null, 2)}\n\n`
  );
}
