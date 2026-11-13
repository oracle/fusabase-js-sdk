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
import { deleteApp } from "fusabase/app";
import { createClient } from "fusabase/fusabase-relational";
import { clientConfig, ordsHost } from "./test_config.js";

const enabled = process.env.FUSABASE_RELATIONAL_INTEGRATION === "1";
const describeIntegration = enabled ? describe : describe.skip;
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const fixtureUuid = Number(`9${Date.now().toString().slice(-12)}`);
const nullActiveUuid = fixtureUuid + 1;
const duplicateUuid = fixtureUuid + 2;

describeIntegration("Relational ORDS behavior integration", function () {
  this.timeout(30000);

  let relational;
  let app;
  const createdRows = {
    users_1: new Set(),
    users_4: new Set(),
  };

  function assertSuccess(result, operation) {
    expect(result.error, `${operation}: ${result.error?.message ?? "unknown error"}`).to.equal(null);
    expect(result.status, `${operation}: unexpected HTTP status`).to.be.within(200, 299);
    return result.data;
  }

  function rows(data, operation) {
    expect(data, `${operation}: missing response data`).to.be.an("array");
    return data;
  }

  function uuids(data, operation) {
    return rows(data, operation).map((row) => column(row, "uuid"));
  }

  function column(row, name) {
    return row[name] ?? row[name.toUpperCase()];
  }

  async function insertFixture(table, row) {
    const data = assertSuccess(await relational.from(table).insert(row), `insert ${table} fixture`);
    createdRows[table].add(row.uuid);
    return data;
  }

  before(async function () {
    relational = createClient(ordsHost, clientConfig);
    app = relational.app;

    // An orphan parent makes left and inner relation behavior observable. A
    // nullable timestamp makes both null predicates observable without
    // changing the shared SQL fixture.
    await insertFixture("users_1", {
      uuid: fixtureUuid,
      name: `relational-behavior-${runId}`,
      age: 30,
    });
    await insertFixture("users_4", {
      uuid: nullActiveUuid,
      name: `relational-null-${runId}`,
      age: 30,
      active: null,
    });
  });

  after(async function () {
    const cleanupFailures = [];
    try {
      // Delete dependent tables first if this suite later gains fixtures with
      // foreign keys. These two tables currently have no test-created children.
      for (const [table, ids] of Object.entries(createdRows).reverse()) {
        for (const uuid of ids) {
          try {
            const result = await relational.from(table).delete().eq("uuid", uuid);
            if (result.error) cleanupFailures.push(`${table}.${uuid}: ${result.error.message}`);
          } catch (error) {
            cleanupFailures.push(`${table}.${uuid}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
    } finally {
      if (app) await deleteApp(app);
    }
    expect(cleanupFailures, `Could not clean up test rows: ${cleanupFailures.join("; ")}`).to.deep.equal([]);
  });

  it("returns exact rows for combined filters and logical groups", async function () {
    const combined = assertSuccess(
      await relational.from("users_1").select("uuid,name").eq("age", 23).like("name", "%ra%").order("uuid"),
      "combined eq and like"
    );
    expect(uuids(combined, "combined eq and like")).to.deep.equal([4]);

    const andGroup = assertSuccess(
      await relational.from("users_1").select("uuid").in("uuid", [1, 2, 3, 4]).and("uuid.gt.1,age.lte.29").order("uuid"),
      "AND group"
    );
    expect(uuids(andGroup, "AND group")).to.deep.equal([2, 3, 4]);

    const nestedGroup = assertSuccess(
      await relational
        .from("users_1")
        .select("uuid")
        .or("and(uuid.eq.1,age.eq.29),and(uuid.eq.4,age.eq.23)")
        .order("uuid"),
      "nested OR and AND groups"
    );
    expect(uuids(nestedGroup, "nested OR and AND groups")).to.deep.equal([1, 4]);
  });

  it("returns exact rows for IN, LIKE, BETWEEN, NULL, and NOT NULL boundaries", async function () {
    const inRows = assertSuccess(
      await relational.from("users_1").select("uuid").in("uuid", [1, 4]).order("uuid"),
      "IN filter"
    );
    expect(uuids(inRows, "IN filter")).to.deep.equal([1, 4]);

    const likeRows = assertSuccess(
      await relational.from("users_1").select("uuid").like("name", "%ra%").order("uuid"),
      "LIKE filter"
    );
    expect(uuids(likeRows, "LIKE filter")).to.deep.equal([1, 4]);

    const betweenRows = assertSuccess(
      await relational.from("users_1").select("uuid").in("uuid", [1, 2, 3, 4]).filter("age", "between", [23, 29]).order("uuid"),
      "BETWEEN inclusive boundaries"
    );
    expect(uuids(betweenRows, "BETWEEN inclusive boundaries")).to.deep.equal([1, 2, 3, 4]);

    const nullRows = assertSuccess(
      await relational.from("users_4").select("uuid").is("active", null).order("uuid"),
      "NULL filter"
    );
    expect(uuids(nullRows, "NULL filter")).to.deep.equal([nullActiveUuid]);

    const notNullRows = assertSuccess(
      await relational.from("users_4").select("uuid").filter("active", "notnull", true).order("uuid"),
      "NOT NULL filter"
    );
    expect(uuids(notNullRows, "NOT NULL filter")).to.deep.equal([1, 2, 3, 4]);
  });

  it("persists CRUD changes, upserts an existing row, and rejects duplicate keys", async function () {
    const row = {
      uuid: duplicateUuid,
      name: `relational-crud-${runId}`,
      age: 30,
    };
    await insertFixture("users_1", row);

    let read = assertSuccess(
      await relational.from("users_1").select("uuid,name,age").eq("uuid", row.uuid).single(),
      "read inserted row"
    );
    expect(column(read, "uuid")).to.equal(row.uuid);
    expect(column(read, "name")).to.equal(row.name);
    expect(column(read, "age")).to.equal(row.age);

    assertSuccess(
      await relational.from("users_1").update({ age: 31 }).eq("uuid", row.uuid).select("uuid,age"),
      "update row"
    );
    read = assertSuccess(
      await relational.from("users_1").select("uuid,age").eq("uuid", row.uuid).single(),
      "read updated row"
    );
    expect(column(read, "uuid")).to.equal(row.uuid);
    expect(column(read, "age")).to.equal(31);

    assertSuccess(
      await relational.from("users_1").upsert({ ...row, age: 32 }, { onConflict: "uuid" }).select("uuid,age"),
      "upsert existing row"
    );
    read = assertSuccess(
      await relational.from("users_1").select("uuid,age").eq("uuid", row.uuid).single(),
      "read upserted row"
    );
    expect(column(read, "uuid")).to.equal(row.uuid);
    expect(column(read, "age")).to.equal(32);

    const duplicate = await relational.from("users_1").insert({ ...row, age: 33 });
    expect(duplicate.error, "duplicate primary key was accepted").to.not.equal(null);

    assertSuccess(
      await relational.from("users_1").delete().eq("uuid", row.uuid).select("uuid"),
      "delete row"
    );
    createdRows.users_1.delete(row.uuid);
    const deleted = assertSuccess(
      await relational.from("users_1").select("uuid").eq("uuid", row.uuid).maybeSingle(),
      "read deleted row"
    );
    expect(deleted).to.equal(null);
  });

  it("enforces single-row result cardinality", async function () {
    const one = assertSuccess(
      await relational.from("users_1").select("uuid,name").eq("uuid", 1).single(),
      "single matching row"
    );
    expect(column(one, "uuid")).to.equal(1);
    expect(column(one, "name")).to.equal("pratik");

    const none = assertSuccess(
      await relational.from("users_1").select("uuid").eq("uuid", -1).maybeSingle(),
      "maybeSingle missing row"
    );
    expect(none).to.equal(null);

    const many = assertSuccess(
      await relational.from("users_1").select("uuid").in("uuid", [1, 2]).single(),
      "single multiple rows"
    );
    expect(many, "single must not return an arbitrary row for multiple matches").to.equal(null);
  });

  it("distinguishes left and inner relation behavior", async function () {
    const left = assertSuccess(
      await relational.from("users_1").select("uuid,orders(id)").eq("uuid", fixtureUuid).single(),
      "left relation"
    );
    expect(column(left, "uuid")).to.equal(fixtureUuid);
    expect(left.orders).to.deep.equal([]);

    const inner = assertSuccess(
      await relational.from("users_1").select("uuid,orders!inner(id)").eq("uuid", fixtureUuid).single(),
      "inner relation"
    );
    expect(inner).to.equal(null);
  });

  it("returns exact aggregate values for the supplied orders fixture", async function () {
    const totals = assertSuccess(
      await relational.from("orders").select("row_count:count(),total:amount.sum(),average:amount.avg(),minimum:amount.min(),maximum:amount.max()").single(),
      "aggregate query"
    );
    expect(totals).to.deep.equal({
      row_count: 2,
      total: 167.5,
      average: 83.75,
      minimum: 42,
      maximum: 125.5,
    });
  });
});
