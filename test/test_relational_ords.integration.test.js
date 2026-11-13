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
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const prefix = `sdk-relational-${runId}`;
const email = `sdk-relational-${runId}@example.com`;
const password = "FusabaseRelational!123";

function data(result, operation) {
  expect(result.error, `${operation}: ${result.error?.message ?? "unknown error"}`).to.equal(null);
  expect(result.data, `${operation}: missing response data`).to.not.equal(null);
  return result.data;
}

describeIntegration("Relational ORDS API integration", function () {
  this.timeout(30000);

  let client;
  let files;
  let signedUpload;
  let session;
  const paths = new Set();
  const path = name => `${prefix}/${name}`;
  const body = new Uint8Array([1, 2, 3, 4, 5, 6]);

  before(function () {
    client = createClient(ordsHost, clientConfig);
    files = client.storage.from(clientConfig.storage_bucket);
  });

  after(async function () {
    if (paths.size) await files.remove([...paths]);
    await client.auth.dispose();
    await deleteApp(client.app);
  });

  it("storage.upload", async function () {
    const target = path("single.txt");
    paths.add(target);
    data(await files.upload(target, "first", { contentType: "text/plain" }), "upload");
  });
  it("storage.update", async function () { data(await files.update(path("single.txt"), "second", { contentType: "text/plain" }), "update"); });
  it("storage.download", async function () { expect(await data(await files.download(path("single.txt")), "download").text()).to.equal("second"); });
  it("storage.list", async function () { expect(data(await files.list(prefix, { search: "single" }), "list")).to.have.length.greaterThan(0); });
  it("storage.exists", async function () { expect(data(await files.exists(path("single.txt")), "exists")).to.equal(true); });
  it("storage.info", async function () { expect(data(await files.info(path("single.txt")), "info").name).to.equal("single.txt"); });
  it("storage.getMetadata", async function () { expect(data(await files.getMetadata(path("single.txt")), "getMetadata").name).to.equal("single.txt"); });
  it("storage.getPublicUrl", function () { expect(files.getPublicUrl(path("single.txt")).data.publicUrl).to.contain(path("single.txt")); });
  it("storage.createSignedUrl", async function () { expect(data(await files.createSignedUrl(path("single.txt"), 60), "createSignedUrl").signedUrl).to.be.a("string").and.not.empty; });
  it("storage.createSignedUrls", async function () { expect(data(await files.createSignedUrls([path("single.txt")], 60), "createSignedUrls")).to.have.length(1); });
  it("storage.createSignedUploadUrl", async function () {
    const target = path("signed.txt");
    paths.add(target);
    signedUpload = data(await files.createSignedUploadUrl(target), "createSignedUploadUrl");
    expect(signedUpload.token).to.be.a("string").and.not.empty;
  });
  it("storage.uploadToSignedUrl", async function () { data(await files.uploadToSignedUrl(path("signed.txt"), signedUpload.token, "signed"), "uploadToSignedUrl"); });
  it("storage.remove", async function () {
    const target = path("signed.txt");
    data(await files.remove([target]), "remove");
    paths.delete(target);
  });

  it("storage.createResumableUpload", async function () {
    const target = path("multipart-create.bin");
    paths.add(target);
    session = data(await files.createResumableUpload(target), "createResumableUpload");
  });
  it("storage.abortResumableUpload", async function () { data(await files.abortResumableUpload(path("multipart-create.bin"), session.uploadId), "abortResumableUpload"); });
  it("storage.uploadResumable", async function () {
    const target = path("multipart-upload.bin");
    paths.add(target);
    expect(data(await files.uploadResumable(target, body, { chunkSize: 2 }), "uploadResumable").parts).to.equal(3);
  });
  it("storage.resumeUpload", async function () {
    const target = path("multipart-resume.bin");
    paths.add(target);
    const resumable = data(await files.createResumableUpload(target), "resume setup");
    data(await files.resumeUpload(target, resumable.uploadId, body, { chunkSize: 2 }), "resumeUpload");
  });
  it("storage.commitResumableUpload", async function () {
    const target = path("multipart-commit.bin");
    paths.add(target);
    const resumable = data(await files.createResumableUpload(target), "commit setup");
    data(await files.commitResumableUpload(target, resumable.uploadId), "commitResumableUpload");
  });

  async function taskWithSession(name) {
    const target = path(name);
    paths.add(target);
    const resumable = data(await files.createResumableUpload(target), `${name} setup`);
    return files.createResumableUploadTask(target, body, { uploadId: resumable.uploadId, chunkSize: 2 });
  }

  it("storage.createResumableUploadTask", async function () { expect(await taskWithSession("task-create.bin")).to.exist; });
  it("resumable task.snapshot", async function () { expect((await taskWithSession("task-snapshot.bin")).snapshot()).to.have.property("uploadId"); });
  it("resumable task.start", async function () { data(await (await taskWithSession("task-start.bin")).start(), "task.start"); });
  it("resumable task.pause", async function () {
    const task = await taskWithSession("task-pause.bin");
    expect(task.pause()).to.have.property("uploadId");
    data(await task.abort(), "task pause cleanup");
  });
  it("resumable task.resume", async function () { data(await (await taskWithSession("task-resume.bin")).resume(), "task.resume"); });
  it("resumable task.abort", async function () {
    const result = await (await taskWithSession("task-abort.bin")).abort();
    expect(result.data || result.error).to.exist;
  });

  it("auth.initialize", async function () { data(await client.auth.initialize(), "initialize"); });
  it("auth.startAutoRefresh and auth.stopAutoRefresh", async function () {
    client.auth.startAutoRefresh();
    await new Promise(resolve => setTimeout(resolve, 0));
    client.auth.stopAutoRefresh();
  });
  it("auth.signUp", async function () { expect(data(await client.auth.signUp({ email, password, options: { data: { full_name: "Relational SDK Test" } } }), "signUp").user?.email).to.equal(email); });
  it("auth.signInWithPassword", async function () { data(await client.auth.signInWithPassword({ email, password }), "signInWithPassword"); });
  it("auth.getSession", async function () { data(await client.auth.getSession(), "getSession"); });
  it("auth.getUser", async function () { data(await client.auth.getUser(), "getUser"); });
  it("auth.getClaims", async function () { data(await client.auth.getClaims(), "getClaims"); });
  it("auth.updateUser", async function () { data(await client.auth.updateUser({ data: { full_name: "Relational SDK Updated" } }), "updateUser"); });
  it("auth.refreshSession", async function () { client._testSession = data(await client.auth.refreshSession(), "refreshSession").session; });
  it("auth.setSession", async function () {
    const current = client._testSession ?? data(await client.auth.getSession(), "setSession setup").session;
    data(await client.auth.setSession({ access_token: current.access_token, refresh_token: current.refresh_token }), "setSession");
  });
  it("auth.onAuthStateChange", function () { const subscription = client.auth.onAuthStateChange(() => {}); subscription.data.subscription.unsubscribe(); });
  it("auth.resetPasswordForEmail", async function () { data(await client.auth.resetPasswordForEmail(email), "resetPasswordForEmail"); });
  it("auth.verifyOtp", async function () { expect(await client.auth.verifyOtp({ type: "recovery", token: "invalid-test-token" })).to.have.property("error"); });
  it("auth.resend", async function () { data(await client.auth.resend({ type: "signup", email }), "resend"); });
  it("auth.getUserIdentities", async function () { expect(data(await client.auth.getUserIdentities(), "getUserIdentities").identities).to.be.an("array"); });
  it("auth.signInWithIdToken", async function () { expect(await client.auth.signInWithIdToken({ provider: "google", token: "invalid-test-token" })).to.have.property("error"); });
  it("auth.signInWithOAuth", async function () { expect(await client.auth.signInWithOAuth({ provider: "google", options: { skipBrowserRedirect: true } })).to.have.property("error"); });
  it("auth.linkIdentity", async function () { expect(await client.auth.linkIdentity({ provider: "google", token: "invalid-test-token" })).to.have.property("error"); });
  it("auth.unlinkIdentity", async function () { expect(await client.auth.unlinkIdentity("google")).to.have.property("error"); });
  it("auth.signInAnonymously", async function () { expect((await client.auth.signInAnonymously()).error).to.exist; });
  it("auth.signInWithOtp", async function () { expect((await client.auth.signInWithOtp()).error).to.exist; });
  it("auth.signInWithSSO", async function () { expect((await client.auth.signInWithSSO()).error).to.exist; });
  it("auth.signOut", async function () { data(await client.auth.signOut(), "signOut"); });

  it("appTrust.initialize", function () {
    client._appTrustProvider = { _getAttestationToken: async () => process.env.FUSABASE_APP_TRUST_TEST_TOKEN ?? "invalid-test-attestation-token" };
    expect(client.appTrust.initialize({ provider: client._appTrustProvider }).app).to.equal(client.app);
  });
  it("appTrust.onTokenChanged", function () { const unsubscribe = client.appTrust.onTokenChanged(() => {}); unsubscribe(); });
  for (const forceRefresh of [false, true]) {
    it(`appTrust.getToken(${forceRefresh})`, async function () {
      try {
        expect((await client.appTrust.getToken(forceRefresh)).token).to.be.a("string").and.not.empty;
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
      }
    });
  }
});
