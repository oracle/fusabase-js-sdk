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

const networkFetch = globalThis.fetch.bind(globalThis);
let sequence = 0;
let testSequence = 0;
let activeTest = null;

const sensitiveName = /authorization|api[-_]?key|password|token|secret|cookie|x-authz/i;

function redactUrl(value) {
    return value;
}

function redact(value) {
  return value;
}

function requestBody(body) {
  if (body == null) return undefined;
  if (typeof body !== "string") return "[non-text request body]";
  try {
    return redact(JSON.parse(body));
  } catch {
    return body.length > 10_000 ? `${body.slice(0, 10_000)}…[truncated]` : body;
  }
}

async function responseBody(response) {
  try {
    const text = await response.clone().text();
    if (!text) return undefined;
    try {
      return redact(JSON.parse(text));
    } catch {
      return text.length > 10_000 ? `${text.slice(0, 10_000)}…[truncated]` : text;
    }
  } catch (error) {
    return `[response body unavailable: ${error instanceof Error ? error.message : String(error)}]`;
  }
}

function headersFor(request, init) {
  const headers = new Headers(request?.headers);
  if (init?.headers) {
    for (const [name, value] of new Headers(init.headers)) headers.set(name, value);
  }
  return Object.fromEntries([...headers].map(([name, value]) => [
    name,
    sensitiveName.test(name) ? "[REDACTED]" : value,
  ]));
}

globalThis.fetch = async (input, init) => {
  const request = input instanceof Request ? input : undefined;
  const url = typeof input === "string" || input instanceof URL ? input.toString() : request?.url ?? String(input);
  const method = init?.method ?? request?.method ?? "GET";
  const id = ++sequence;

  console.log(`[REQUEST ${id}]\n${JSON.stringify({
    test: activeTest,
    method,
    url: redactUrl(url),
    headers: headersFor(request, init),
    body: requestBody(init?.body),
  }, null, 2)}`);

  try {
    const response = await networkFetch(input, init);
    console.log(`[RESPONSE ${id}]\n${JSON.stringify({
      test: activeTest,
      outcome: response.ok ? "PASS" : "FAIL",
      status: response.status,
      statusText: response.statusText,
      body: await responseBody(response),
    }, null, 2)}`);
    return response;
  } catch (error) {
    console.log(`[RESPONSE ${id}]\n${JSON.stringify({
      test: activeTest,
      outcome: "FAIL",
      error: error instanceof Error ? error.message : String(error),
    }, null, 2)}`);
    throw error;
  }
};

console.log("[REQUEST LOGGER] enabled");

exports.mochaHooks = {
  beforeEach() {
    activeTest = this.currentTest.fullTitle();
    console.log(`[TEST ${++testSequence} START] ${activeTest}`);
  },
  afterEach() {
    const test = this.currentTest.fullTitle();
    const state = this.currentTest.state?.toUpperCase() ?? "UNKNOWN";
    console.log(`[TEST ${testSequence} ${state}] ${test}`);
    activeTest = null;
  },
};
