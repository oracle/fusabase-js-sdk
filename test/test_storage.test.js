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
import {initializeApp, setLogLevel, LogLevel, App} from "fusabase/app";
import {  
    getStorage,  
    ref,  
    uploadBytes,  
    getDownloadURL,  
    getMetadata,  
    list,  
    deleteObject,
    listAll 
  } from 'fusabase/storage';

describe("fusabase Storage Tests", function () {
    this.timeout(30000);

    const options = {};


    let app, storage, ref1, ref2, ref3;

    it("should initialize app with correct options", function () {
        app = initializeApp({...options,appTrustToken:"APP_TRUST_TOKEN"}, "test");
        expect(app.options.ordsHost).to.equal(options.ords_host);
        expect(app.options.schema).to.equal(options.schema);
        expect(app.options.appID).to.equal(options.app_id);
        expect(app.options.objsType).to.equal(options.objs_type);
        expect(app.options.storageBucket).to.equal(options.storage_bucket);
        expect(app.options.authType).to.equal(options.auth_type);
        expect(app.options.authID).to.equal(options.auth_id);
    });

    it("should configure log level", function () {
        setLogLevel(LogLevel.ERROR);
    });

    it("should get storage object with correct config", function () {
        storage = getStorage(app);
        expect(storage.app.options.ordsHost).to.equal(options.ords_host);
        expect(storage.app.options.schema).to.equal(options.schema);
        expect(storage.app.options.appID).to.equal(options.app_id);
        expect(storage.app.options.objsType).to.equal(options.objs_type);
        expect(storage.app.options.storageBucket).to.equal(options.storage_bucket);
        expect(storage.app.options.authType).to.equal(options.auth_type);
        expect(storage.app.options.authID).to.equal(options.auth_id);
        expect(storage.app.config.objsType).to.equal(options.objs_type);
        expect(storage.config.host).to.equal(options.ords_host);
        expect(storage.config.schema).to.equal(options.schema);
        expect(storage.config.appID).to.equal(options.app_id);
        expect(storage.maxOperationRetryTime).to.equal(10000);
        expect(storage.maxUploadRetryTime).to.equal(10000);
    });

    it("should create references correctly", function () {
        ref1 = ref(storage, "products/11");
        expect(ref1.name).to.equal("11");
        expect(ref1.root.name).to.equal("");
        expect(ref1.parent.name).to.equal("products");
        expect(ref1.parent.parent.name).to.equal("");
        expect(ref1.storage).to.exist;
        expect(ref1.bucket).to.equal(options.storage_bucket);
        expect(ref1.fullPath).to.equal("products/11");

        ref2 = ref(ref1, "16.jpg");
        expect(ref2.name).to.equal("16.jpg");
        expect(ref2.root.name).to.equal("");
        expect(ref2.parent.name).to.equal("11");
        expect(ref2.parent.parent.name).to.equal("products");
        expect(ref2.parent.parent.parent.name).to.equal("");
        expect(ref2.storage).to.exist;
        expect(ref2.bucket).to.equal(options.storage_bucket);
        expect(ref2.fullPath).to.equal("products/11/16.jpg");
    });

    it("should update retry times", function () {
        storage.maxOperationRetryTime = 20000;
        storage.maxUploadRetryTime = 20000;
        expect(storage.maxOperationRetryTime).to.equal(20000);
        expect(storage.maxUploadRetryTime).to.equal(20000);
    });

    it("should upload, fetch URL, metadata, list, and delete", async function () {
        ref3 = ref(ref1, "array2.jpg");
        const bytes = new Uint8Array([
            0x48, 0x65, 0x6c, 0x6c, 0x6f,
            0x2c, 0x20, 0x77, 0x6f, 0x72,
            0x6c, 0x64, 0x21
        ]);

        const snapshot = await uploadBytes(ref3, bytes)

        const url = await getDownloadURL(ref3);
        expect(url).to.be.a("string");

        const meta = await getMetadata(ref3);
        expect(meta.bucket).to.equal(options.storage_bucket);
        expect(meta.fullPath).to.equal(ref3.fullPath);
        expect(meta.name).to.equal(ref3.name);
        expect(meta.updated).to.exist;
        expect(meta.size).to.exist;

        const listRes = await list(ref1);
        expect(listRes.items).to.exist;
        expect(listRes.items.length).to.be.greaterThan(0);
        expect(listRes.prefixes).to.exist;

        const listAllRes = await listAll(ref1);
        expect(listAllRes.items).to.exist;
        expect(listAllRes.items.length).to.be.greaterThan(0);
        expect(listAllRes.prefixes).to.exist;

        await ref3.delete();
    });
});
