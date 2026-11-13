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

import { expect } from "chai";
import { deleteApp, initializeApp } from "fusabase/app";
import { getOracledb } from "fusabase/oracledb";
import { getStorage } from "fusabase/storage";
import {
  createClient,
  RelationalDatabaseError,
  clearIndexedDbPersistence,
  disableNetwork,
  enableNetwork,
  enableMemoryPersistence,
} from "fusabase/fusabase-relational";
import { clientConfig, ordsHost, testAppConfig } from "./test_config.js";

describe("Relational database unit tests", function () {
  const appConfig = clientConfig;
  let app;
  let relational;
  let originalFetch;
  let requests;
  let responses;

  before(function () {
    relational = createClient(ordsHost, appConfig);
    app = relational.app;
  });

  after(async function () {
    await deleteApp(app);
  });

  beforeEach(function () {
    originalFetch = globalThis.fetch;
    requests = [];
    responses = [];

    globalThis.fetch = async (url, init) => {
      requests.push({
        url: String(url),
        init,
        headers: new Headers(init.headers),
        body: init.body ? JSON.parse(init.body) : undefined,
      });

      const next = responses.shift() ?? {
        body: { items: [] },
        status: 200,
        statusText: "OK",
      };

      return new Response(
        next.body === undefined ? null : JSON.stringify(next.body),
        {
          status: next.status ?? 200,
          statusText: next.statusText ?? "",
          headers: { "Content-Type": "application/json" },
        }
      );
    };
  });

  afterEach(function () {
    globalThis.fetch = originalFetch;
  });

  function table(name = "users_1") {
    return relational.from(name);
  }

  function enqueue(body, status = 200, statusText = "OK") {
    responses.push({ body, status, statusText });
  }

  it("stores normalized camelCase options from snake_case config", function () {
    expect(app.options.backendType).to.equal("relational");
    expect(app.options.ordsHost).to.equal(ordsHost);
  });

  it("supports the explicit backend argument and restricts collection APIs in relational mode", async function () {
    const explicitRelationalApp = initializeApp(
      testAppConfig,
      "relational-explicit-backend-unit-test",
      "relational"
    );
    const collectionDefaultApp = initializeApp(
      testAppConfig,
      "collection-default-backend-unit-test",
      null
    );

    try {
      expect(explicitRelationalApp.options.backendType).to.equal("relational");
      expect(() => getOracledb(explicitRelationalApp)).to.throw("backend is 'collection'");
      expect(() => getStorage(explicitRelationalApp)).to.throw("backend is 'collection'");
      expect(collectionDefaultApp.options.backendType).to.equal("collection");
    } finally {
      await deleteApp(explicitRelationalApp);
      await deleteApp(collectionDefaultApp);
    }
  });

  it("builds a select request with relational filters, ordering, and pagination", async function () {
    await table()
      .select("id, name")
      .eq("active", true)
      .gte("age", 18)
      .order("name", { ascending: false, nullsFirst: false })
      .range(20, 39);

    expect(requests).to.have.length(1);
    expect(requests[0].body).to.deep.equal({
      projection: {
        all: false,
        columns: ["id", "name"],
        aggregates: [],
        relations: [],
      },
      qbe: {
        $query: {
          $and: [
            { active: { $eq: true } },
            { age: { $gte: 18 } },
          ],
        },
        $orderby: [
          {
            column: "name",
            direction: "DESC",
            nulls: "LAST",
          },
        ],
        $limit: 20,
        $offset: 20,
      },
    });
  });

  it("serves configured relational rows from the memory cache and applies queued writes", async function () {
    await enableMemoryPersistence(relational, {
      relations: { users_1: { primaryKey: ["UUID"] } },
    });
    enqueue({
      items: [
        { UUID: 1, NAME: "pratik", AGE: 29 },
        { UUID: 2, NAME: "hrishabh", AGE: 23 },
      ],
    });

    await relational.from("users_1").select("UUID,NAME,AGE").eq("AGE", 23);
    await disableNetwork(relational);
    await relational.from("users_1").update({ AGE: 23 }).eq("UUID", 1);

    const cached = await relational
      .from("users_1")
      .select("UUID,NAME,AGE")
      .eq("AGE", 23)
      .fromCache({ requireComplete: true });

    expect(cached.data).to.deep.equal([
      { UUID: 1, NAME: "pratik", AGE: 23 },
      { UUID: 2, NAME: "hrishabh", AGE: 23 },
    ]);
    expect(cached.offline).to.deep.equal({
      fromCache: true,
      hasPendingWrites: true,
    });
    await clearIndexedDbPersistence(relational);
    await enableNetwork(relational);
  });

  it("bypasses offline handling for relations omitted from the offline configuration", async function () {
    await enableMemoryPersistence(relational, {
      relations: { users_1: { primaryKey: ["UUID"] } },
    });
    await disableNetwork(relational);
    enqueue({ items: [{ UUID: 99, NAME: "server-only", AGE: 42 }] });

    const result = await relational.from("users_not_offline").select("UUID,NAME,AGE");

    expect(requests).to.have.length(1);
    expect(result.data).to.deep.equal([{ UUID: 99, NAME: "server-only", AGE: 42 }]);
    expect(result.offline).to.equal(undefined);
    await enableNetwork(relational);
  });

  it("builds nested JSON filters and JSON ordering", async function () {
    await table()
      .select("*")
      .eq("DOC->status->check", "ACTIVE")
      .gt("DOC->metrics->score", 10)
      .order("DOC->status->check", {
        ascending: true,
        datatype: "string",
      });

    expect(requests[0].body).to.deep.equal({
      projection: {
        all: true,
        columns: [],
        aggregates: [],
        relations: [],
      },
      qbe: {
        $query: {
          $and: [
            {
              DOC: {
                status: {
                  check: { $eq: "ACTIVE" },
                },
              },
            },
            {
              DOC: {
                metrics: {
                  score: { $gt: 10 },
                },
              },
            },
          ],
        },
        $orderby: [
          {
            column: "DOC",
            path: "status.check",
            direction: "ASC",
            datatype: "string",
          },
        ],
      },
    });
  });

  it("supports JSON paths in match, filter, not, and or", async function () {
    await table()
      .select()
      .match({ "DOC->status->check": "ACTIVE" })
      .filter("DOC->metrics->score", "gte", 10)
      .not("DOC->flags->enabled", "eq", false)
      .or("DOC->role->name.eq.admin,DOC->role->name.eq.owner");

    const query = requests[0].body.qbe.$query;
    expect(JSON.stringify(query)).to.contain('"check":{"$eq":"ACTIVE"}');
    expect(JSON.stringify(query)).to.contain('"score":{"$gte":10}');
    expect(JSON.stringify(query)).to.contain('"enabled":{"$ne":false}');
    expect(JSON.stringify(query)).to.contain('"$or"');
    expect(JSON.stringify(query)).to.contain('"name":{"$eq":"admin"}');
    expect(JSON.stringify(query)).to.contain('"name":{"$eq":"owner"}');
  });

  it("supports text-style JSON path separators", async function () {
    await table().select().eq("DOC->>status->>check", "ACTIVE");

    expect(requests[0].body.qbe.$query).to.deep.equal({
      DOC: {
        status: {
          check: { $eq: "ACTIVE" },
        },
      },
    });
  });

  it("builds case-insensitive pattern and logical groups", async function () {
    await table().select().ilike("name", "%RA%");
    expect(requests[0].body.qbe.$query).to.deep.equal({
      name: { $ilike: "%RA%" },
    });

    await table().select().ilikeAllOf("name", ["%ra%", "%tik%"]);
    expect(requests[1].body.qbe.$query).to.deep.equal({
      $and: [
        { name: { $ilike: "%ra%" } },
        { name: { $ilike: "%tik%" } },
      ],
    });

    await table().select().ilikeAnyOf("name", ["%ra%", "%man%"]);
    expect(requests[2].body.qbe.$query).to.deep.equal({
      $or: [
        { name: { $ilike: "%ra%" } },
        { name: { $ilike: "%man%" } },
      ],
    });

    await table().select().and("uuid.gt.1,age.lte.29");
    expect(requests[3].body.qbe.$query).to.deep.equal({
      $and: [
        { uuid: { $gt: 1 } },
        { age: { $lte: 29 } },
      ],
    });
  });

  it("encodes null checks with the BAAS exists convention", async function () {
    await table().select().is("active", null);
    expect(requests[0].body.qbe.$query).to.deep.equal({ active: { $exists: false } });

    await table().select().filter("active", "is", null);
    expect(requests[1].body.qbe.$query).to.deep.equal({ active: { $exists: false } });

    await table().select().and("active.is.null");
    expect(requests[2].body.qbe.$query).to.deep.equal({
      $and: [{ active: { $exists: false } }],
    });

    await table().select().filter("active", "notnull", true);
    expect(requests[3].body.qbe.$query).to.deep.equal({ active: { $exists: true } });

    await table().select().not("active", "null", true);
    expect(requests[4].body.qbe.$query).to.deep.equal({ active: { $exists: true } });
  });

  it("builds PostgREST-style select projections", async function () {
    await table().select(
      "id,full_name:name,total:amount.sum(),orders!billing!inner(id,items(count)),...director(last_name)"
    );

    expect(requests[0].body).to.deep.equal({
      projection: {
        all: false,
        columns: ["id", { column: "name", alias: "full_name" }],
        aggregates: [{ function: "sum", column: "amount", alias: "total" }],
        relations: [
          {
            table: "orders",
            hint: "billing",
            joinType: "inner",
            projection: {
              all: false,
              columns: ["id"],
              aggregates: [],
              relations: [
                {
                  table: "items",
                  joinType: "left",
                  relationCount: true,
                },
              ],
            },
          },
          {
            table: "director",
            joinType: "left",
            spread: true,
            projection: {
              all: false,
              columns: ["last_name"],
              aggregates: [],
              relations: [],
            },
          },
        ],
      },
    });
  });

  it("wraps date values recursively in filters and write rows", async function () {
    const timestamp = "2026-07-21T08:00:00Z";

    await table()
      .insert({
        created_at: new Date(timestamp),
        DOC: {
          audit: {
            updatedAt: timestamp,
          },
        },
      })
      .select("*");

    expect(requests[0].body.rows).to.deep.equal([
      {
        created_at: { $date: "2026-07-21T08:00:00.000Z" },
        DOC: {
          audit: {
            updatedAt: { $date: timestamp },
          },
        },
      },
    ]);
    expect(requests[0].body.returnRows).to.equal(true);
  });

  it("translates array overlap into an any-match predicate", async function () {
    await table()
      .select()
      .overlaps("DOC->skills", ["Oracle", "SQL"]);

    expect(requests[0].body.qbe.$query).to.deep.equal({
      DOC: {
        skills: {
          $in: ["Oracle", "SQL"],
        },
      },
    });
  });

  it("uses all-match containment and instr text-search predicates", async function () {
    await table()
      .select()
      .contains("DOC->skills", ["Oracle", "SQL"])
      .textSearch("name", "Ada");

    expect(requests[0].body.qbe.$query).to.deep.equal({
      $and: [
        { DOC: { skills: { $all: ["Oracle", "SQL"] } } },
        { name: { $instr: "Ada" } },
      ],
    });
  });

  it("builds insert and upsert requests", async function () {
    enqueue({ items: [{ id: 1 }] });
    const inserted = await table("countries")
      .insert({ id: 1, name: "Mordor" })
      .select("id");

    expect(requests[0].init.method).to.equal("POST");
    expect(requests[0].body).to.deep.equal({
      rows: [{ id: 1, name: "Mordor" }],
      returnRows: true,
      columns: ["id"],
    });
    expect(inserted.data).to.deep.equal([{ id: 1 }]);

    await table("countries").upsert(
      { id: 1, name: "Gondor" },
      { onConflict: "id" }
    );

    expect(requests[1].url).to.contain("upsert=true");
    expect(requests[1].body.onConflict).to.equal("id");
  });

  it("builds update and delete requests with QBE filters", async function () {
    await table("countries")
      .update({ name: "Rohan" })
      .eq("id", 1)
      .select("id,name");

    expect(requests[0].init.method).to.equal("PUT");
    expect(requests[0].body).to.deep.equal({
      set: { name: "Rohan" },
      qbe: { $query: { id: { $eq: 1 } } },
      returnRows: true,
      columns: ["id", "name"],
    });

    await table("countries").delete().eq("id", 2).select("id");
    expect(requests[1].url).to.contain("delete=true");
    expect(requests[1].body).to.deep.equal({
      qbe: { $query: { id: { $eq: 2 } } },
      returnRows: true,
      columns: ["id"],
    });
  });

  it("builds RPC requests and wraps date arguments", async function () {
    await relational.rpc(
      "events_after",
      {
        starts_at: "2026-07-21T08:00:00Z",
        options: { enabled: true },
      },
      { overload: "2" }
    );

    expect(requests[0].init.method).to.equal("PUT");
    expect(requests[0].body).to.deep.equal({
      args: {
        starts_at: { $date: "2026-07-21T08:00:00Z" },
        options: { enabled: true },
      },
      overload: "2",
    });
  });

  it("normalizes items, data, and Data responses and supports maybeSingle", async function () {
    enqueue({ items: [{ id: 7, name: "Leia" }] });
    const itemResponse = await table().select("*").maybeSingle();

    expect(itemResponse).to.include({
      error: null,
      count: null,
      status: 200,
      statusText: "OK",
    });
    expect(itemResponse.data).to.deep.equal({ id: 7, name: "Leia" });

    enqueue({ data: [{ id: 8, name: "Han" }] });
    expect((await table().select("*").maybeSingle()).data).to.deep.equal({ id: 8, name: "Han" });

    enqueue({ Data: [{ id: 9, name: "Luke" }] });
    expect((await table().select("*").maybeSingle()).data).to.deep.equal({ id: 9, name: "Luke" });
  });

  it("returns structured database errors", async function () {
    enqueue(
      {
        error: "Invalid predicate",
        code: "QBE_INVALID",
        details: "Unknown field",
        hint: "Check the JSON path",
      },
      400,
      "Bad Request"
    );

    const response = await table().select().eq("missing", 1);
    expect(response.data).to.equal(null);
    expect(response.error).to.be.instanceOf(RelationalDatabaseError);
    expect(response.error).to.include({
      message: "Invalid predicate",
      code: "QBE_INVALID",
      details: "Unknown field",
      hint: "Check the JSON path",
      status: 400,
    });
  });

  it("throws database errors when throwOnError is enabled", async function () {
    enqueue({ error: "Rejected" }, 422, "Unprocessable Entity");

    let thrown;
    try {
      await table().select().eq("id", 1).throwOnError();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).to.be.instanceOf(RelationalDatabaseError);
    expect(thrown.message).to.equal("Rejected");
    expect(thrown.status).to.equal(422);
  });

  it("retries retryable select failures with exponential retry metadata", async function () {
    enqueue({ error: "Temporarily unavailable" }, 503, "Unavailable");
    enqueue({ items: [{ id: 1 }] }, 200, "OK");

    const response = await table()
      .select()
      .retry({ maxRetries: 2, initialDelayMs: 0, maxDelayMs: 0 });

    expect(response.error).to.equal(null);
    expect(response.data).to.deep.equal([{ id: 1 }]);
    expect(requests).to.have.length(2);
    expect(requests[0].headers.has("x-retry-count")).to.equal(false);
    expect(requests[1].headers.get("x-retry-count")).to.equal("1");
  });

  it("does not retry write operations", async function () {
    enqueue({ error: "Unavailable" }, 503, "Unavailable");

    const response = await table()
      .insert({ id: 1 })
      .retry({ maxRetries: 2, initialDelayMs: 0, maxDelayMs: 0 });

    expect(response.error).to.be.instanceOf(RelationalDatabaseError);
    expect(requests).to.have.length(1);
  });

  it("creates signed download URLs through the PAR endpoint", async function () {
    enqueue({ URL: "https://storage.example/par/read-token/o/reports/january.pdf" });

    const result = await relational.storage
      .from("reports")
      .createSignedUrl("january.pdf", 60);

    expect(result.error).to.equal(null);
    expect(result.data).to.deep.equal({
      signedUrl: "https://storage.example/par/read-token/o/reports/january.pdf",
      path: "january.pdf",
    });
    expect(new URL(requests[0].url).pathname).to.match(/\/b\/reports\/par$/);
    expect(requests[0].init.method).to.equal("POST");
    expect(requests[0].body).to.include({ path: "january.pdf", access_type: "ObjectRead" });
  });

  it("uses the authenticated object and multipart endpoints for resumable uploads", async function () {
    const files = relational.storage.from("reports");
    enqueue({ uploadId: "upload-1" });

    const created = await files.createResumableUpload("exports/january.csv", {
      contentType: "text/csv",
      cacheControl: "max-age=60",
      metadata: { source: "report" },
    });
    expect(created.error).to.equal(null);
    expect(created.data?.uploadId).to.equal("upload-1");
    expect(new URL(requests[0].url).pathname).to.match(/\/b\/reports\/o\/exports\/january\.csv$/);
    expect(requests[0].init.method).to.equal("POST");
    expect(requests[0].init.body).to.equal(undefined);
    expect(requests[0].headers.get("opc-multipart")).to.equal("true");
    expect(requests[0].headers.get("content-type")).to.equal("text/csv");
    expect(requests[0].headers.get("cache-control")).to.equal("max-age=60");
    expect(requests[0].headers.get("opc-meta-source")).to.equal("report");

    await files.commitResumableUpload("exports/january.csv", "upload-1");
    await files.abortResumableUpload("exports/january.csv", "upload-1");

    for (const request of requests.slice(1)) {
      const url = new URL(request.url);
      expect(url.pathname).to.match(/\/b\/reports\/u\/exports\/january\.csv$/);
      expect(url.searchParams.get("uploadId")).to.equal("upload-1");
    }
    expect(requests.slice(1).map((request) => request.init.method)).to.deep.equal(["POST", "DELETE"]);
  });

  it("keeps runtime modifier methods request-neutral", function () {
    const builder = table().select();
    expect(builder.returns()).to.equal(builder);
    expect(builder.overrideTypes()).to.equal(builder);
  });

  it("rejects invalid filters, paths, ranges, and retry options", function () {
    expect(() => table().select().filter("DOC->", "eq", 1))
      .to.throw("Invalid column or JSON path");
    expect(() => table().select().rangeGt("created_at", "not-a-range"))
      .to.throw(RelationalDatabaseError);
    for (const method of ["rangeAdjacent", "rangeGt", "rangeGte", "rangeLt", "rangeLte"]) {
      expect(() => table().select()[method]("created_at", "[1,2]"))
        .to.throw("is not supported");
    }
    expect(() => table().select().containedBy("tags", ["a"]))
      .to.throw("is not supported");
    expect(() => table().select().overlaps("score", "[1,2]"))
      .to.throw("does not support range values");
    expect(() => table().select().retry({ maxRetries: -1 }))
      .to.throw(RelationalDatabaseError);
    expect(() =>
      table().select().order("DOC->status", { path: "check" })
    ).to.throw(RelationalDatabaseError);
  });

  it("supports database writes, request controls, and type-only modifiers", async function () {
    enqueue({ items: [{ uuid: 99, name: "created" }] });
    const inserted = await table()
      .insert({ uuid: 99, name: "created", age: 30 })
      .select("uuid,name");
    expect(inserted.error).to.equal(null);

    enqueue({ items: [{ uuid: 99, name: "upserted" }] });
    const upserted = await table()
      .upsert({ uuid: 99, name: "upserted", age: 31 }, { onConflict: "uuid" })
      .select();
    expect(upserted.error).to.equal(null);

    enqueue({ items: [{ uuid: 99, name: "updated" }] });
    const updated = await table()
      .update({ name: "updated" })
      .eq("uuid", 99)
      .select();
    expect(updated.error).to.equal(null);

    enqueue({ items: [{ uuid: 99 }] });
    const deleted = await table().delete().eq("uuid", 99).select();
    expect(deleted.error).to.equal(null);

    enqueue({ items: [{ uuid: 1, name: "Ada" }] });
    const typed = table()
      .select()
      .textSearch("name", "Ada")
      .returns()
      .overrideTypes();
    const searched = await typed;
    expect(searched.error).to.equal(null);
    expect(requests[4].body.qbe.$query).to.deep.equal({ name: { $instr: "Ada" } });

    const controller = new AbortController();
    controller.abort();
    let abortError;
    try {
      await table().select().abortSignal(controller.signal);
    } catch (error) {
      abortError = error;
    }
    expect(abortError?.name).to.equal("AbortError");

    enqueue({ error: "retry once" }, 503, "Unavailable");
    enqueue({ items: [{ uuid: 1 }] });
    const retried = await table()
      .select()
      .retry({ maxRetries: 1, initialDelayMs: 0, maxDelayMs: 0 });
    expect(retried.error).to.equal(null);

    enqueue({ error: "rejected" }, 422, "Unprocessable Entity");
    let thrown;
    try {
      await table().select().throwOnError();
    } catch (error) {
      thrown = error;
    }
    expect(thrown?.message).to.equal("rejected");
  });

  it("supports every public bucket file API and resumable upload task control", async function () {
    const original = globalThis.fetch;
    let pauseNextPart = false;
    const calls = [];

    globalThis.fetch = async (url, init = {}) => {
      const target = new URL(String(url));
      const method = init.method ?? "GET";
      calls.push({ method, target });

      if (pauseNextPart && method === "PUT" && target.searchParams.has("part")) {
        pauseNextPart = false;
        return new Promise((_, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("Request aborted", "AbortError")), { once: true });
        });
      }
      if (target.pathname.endsWith("/par") && method === "POST") {
        const body = JSON.parse(init.body);
        return new Response(JSON.stringify(body.access_type === "ObjectWrite"
          ? { PAR_ID: "write-token", URL: "https://signed.example/write" }
          : { URL: "https://signed.example/read" }), { status: 200 });
      }
      if (method === "GET" && target.searchParams.get("metadata_only") === "true") {
        return new Response(JSON.stringify({ name: "single.txt", id: "object-1" }), { status: 200 });
      }
      if (method === "GET" && target.pathname.endsWith("/dir")) {
        return new Response(JSON.stringify({ items: [{ name: "single.txt", id: "object-1" }], prefixes: ["archive"] }), { status: 200 });
      }
      if (method === "GET") return new Response("file contents", { status: 200 });
      if (method === "POST" && init.headers && new Headers(init.headers).get("opc-multipart") === "true") {
        return new Response(JSON.stringify({ uploadId: "upload-1" }), { status: 200 });
      }
      return new Response(JSON.stringify({ name: "single.txt" }), { status: 200 });
    };

    try {
      const files = relational.storage.from("reports");
      expect(files.bucketId).to.equal("reports");

      expect((await files.upload("single.txt", "one")).error).to.equal(null);
      expect((await files.update("single.txt", "two")).error).to.equal(null);
      const downloaded = await files.download("single.txt");
      expect(await downloaded.data?.text()).to.equal("file contents");
      expect((await files.list("", { limit: 10, offset: 0, search: "single", sortBy: { column: "name" } })).data).to.have.length(1);
      expect((await files.remove(["single.txt"])).error).to.equal(null);

      expect((await files.createSignedUrl("single.txt", 60)).data?.signedUrl).to.equal("https://signed.example/read");
      expect((await files.createSignedUrls(["single.txt", "other.txt"], 60)).data).to.have.length(2);
      const signedUpload = await files.createSignedUploadUrl("signed.txt");
      expect(signedUpload.data?.token).to.equal("write-token");
      expect((await files.uploadToSignedUrl("signed.txt", "write-token", "signed")).error).to.equal(null);

      const session = await files.createResumableUpload("multipart.txt");
      expect(session.data?.uploadId).to.equal("upload-1");
      expect((await files.uploadResumable("multipart.txt", new Uint8Array([1, 2, 3]), { chunkSize: 2 })).data?.parts).to.equal(2);
      expect((await files.resumeUpload("multipart.txt", "upload-1", new Uint8Array([1, 2]), { chunkSize: 2 })).error).to.equal(null);
      expect((await files.commitResumableUpload("multipart.txt", "upload-1")).error).to.equal(null);
      expect((await files.abortResumableUpload("multipart.txt", "upload-1")).error).to.equal(null);

      expect(files.getPublicUrl("single.txt").data.publicUrl).to.contain("/reports/o/single.txt");
      expect((await files.exists("single.txt")).data).to.equal(true);
      expect((await files.info("single.txt")).data?.name).to.equal("single.txt");
      expect((await files.getMetadata("single.txt")).data?.id).to.equal("object-1");

      const task = files.createResumableUploadTask("task.txt", new Uint8Array([1, 2]), {
        uploadId: "task-upload",
        chunkSize: 2,
      });
      expect(task.snapshot()).to.deep.include({ path: "task.txt", uploadId: "task-upload" });
      pauseNextPart = true;
      const running = task.start();
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(task.pause()).to.deep.include({ uploadId: "task-upload" });
      await running;
      expect(task.state).to.equal("paused");
      expect((await task.resume()).error).to.equal(null);
      expect(task.state).to.equal("success");
      expect((await task.abort()).error).to.equal(null);
      expect(task.state).to.equal("aborted");
      expect(calls.length).to.be.greaterThan(15);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("exercises every non-MFA authentication method through the relational facade", async function () {
    const user = {
      uid: "user-1",
      providerId: "password",
      providerData: [],
      email: "relational@example.test",
      displayName: "Relational User",
      phoneNumber: null,
      photoURL: null,
      emailVerified: true,
      refreshToken: "refresh-token",
      metadata: { creationTime: "2026-01-01T00:00:00.000Z", lastSignInTime: "2026-01-01T00:00:00.000Z" },
      getIdToken: async () => "access-token",
      getIdTokenResult: async () => ({ expirationTime: Math.floor(Date.now() / 1000) + 3600, claims: { role: "tester" } }),
    };
    let authListener = null;
    const core = {
      currentUser: user,
      authStateReady: async () => {},
      signUpWithPassword: async () => ({ user }),
      signInWithPassword: async () => ({ user }),
      signInWithProviderCredential: async () => ({ user }),
      signInWithProviderPopup: async () => ({ user }),
      signInWithProviderRedirect: async () => {},
      reload: async () => {},
      updateProfile: async (_user, values) => { user.displayName = values.displayName; },
      updatePassword: async () => {},
      setSession: async () => ({ user }),
      signOut: async () => { core.currentUser = null; authListener?.(null); },
      onAuthStateChanged: callback => { authListener = callback; callback(core.currentUser); return () => { authListener = null; }; },
      sendPasswordResetEmail: async () => {},
      verifyPasswordResetCode: async () => {},
      sendEmailVerification: async () => {},
      linkWithProviderCredential: async () => ({ user }),
      linkWithProviderPopup: async () => ({ user }),
      linkWithProviderRedirect: async () => {},
      unlink: async () => {},
    };
    relational.auth.auth = core;

    expect((await relational.auth.initialize()).error).to.equal(null);
    relational.auth.startAutoRefresh();
    await new Promise(resolve => setTimeout(resolve, 0));
    relational.auth.stopAutoRefresh();
    expect((await relational.auth.signUp({ email: user.email, password: "password", options: { data: { full_name: "Updated User" } } })).data.user?.id).to.equal(user.uid);
    expect((await relational.auth.signInWithPassword({ email: user.email, password: "password" })).error).to.equal(null);
    expect((await relational.auth.signInWithIdToken({ provider: "google", token: "provider-token" })).error).to.equal(null);
    expect((await relational.auth.signInWithOAuth({ provider: "google", options: { skipBrowserRedirect: true } })).error).to.equal(null);
    expect((await relational.auth.getSession()).data.session?.access_token).to.equal("access-token");
    expect((await relational.auth.getUser()).data.user?.email).to.equal(user.email);
    expect((await relational.auth.getClaims()).data.claims).to.deep.equal({ role: "tester" });
    expect((await relational.auth.updateUser({ data: { full_name: "Changed User" }, password: "next", oldPassword: "password" })).error).to.equal(null);
    const refreshed = await relational.auth.refreshSession();
    expect(refreshed.data.session?.refresh_token).to.equal("refresh-token");
    expect((await relational.auth.setSession({ access_token: "access-token", refresh_token: "refresh-token" })).error).to.equal(null);

    const events = [];
    const subscription = relational.auth.onAuthStateChange((event) => events.push(event));
    expect((await relational.auth.resetPasswordForEmail(user.email)).error).to.equal(null);
    expect((await relational.auth.verifyOtp({ type: "recovery", token: "recovery-token" })).error).to.equal(null);
    expect((await relational.auth.resend({ type: "signup", email: user.email })).error).to.equal(null);
    expect((await relational.auth.getUserIdentities()).data.identities).to.be.an("array");
    expect((await relational.auth.linkIdentity({ provider: "google", token: "provider-token" })).error).to.equal(null);
    expect((await relational.auth.unlinkIdentity("google")).error).to.equal(null);
    expect((await relational.auth.signInAnonymously()).error?.code).to.equal("unsupported");
    expect((await relational.auth.signInWithOtp()).error?.code).to.equal("unsupported");
    expect((await relational.auth.signInWithSSO()).error?.code).to.equal("unsupported");
    expect((await relational.auth.signOut()).error).to.equal(null);
    subscription.data.subscription.unsubscribe();
    await relational.auth.dispose();
    expect(events).to.include("INITIAL_SESSION");
  });

  it("exercises every App Trust client method", async function () {
    expect(() => relational.appTrust.onTokenChanged(() => {})).to.throw("not initialized");
    let uninitializedError;
    try {
      await relational.appTrust.getToken();
    } catch (error) {
      uninitializedError = error;
    }
    expect(uninitializedError?.message).to.contain("not initialized");

    const original = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ attestToken: "app-trust-token" }), { status: 200 });
    try {
      const instance = relational.appTrust.initialize({
        provider: { _getAttestationToken: async () => "provider-token" },
      });
      expect(instance.app).to.equal(app);
      const received = [];
      const unsubscribe = relational.appTrust.onTokenChanged(token => received.push(token.token));
      expect((await relational.appTrust.getToken()).token).to.equal("app-trust-token");
      expect((await relational.appTrust.getToken(true)).token).to.equal("app-trust-token");
      unsubscribe();
      expect(received).to.deep.equal(["app-trust-token", "app-trust-token"]);
    } finally {
      globalThis.fetch = original;
    }
  });
});
