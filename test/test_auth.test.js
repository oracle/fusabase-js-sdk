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
import {initializeApp, setLogLevel, LogLevel} from "fusabase/app";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  getIdToken,
  signInWithEmailAndPassword,
  updatePassword,
  updateProfile,
  getIdTokenResult,
  reload,
  signOut,
  Auth,
  User
} from 'fusabase/auth';

/**
 * App Trust enforcement testing (Option 1):
 * Provide a *valid* FUSABASE App Trust token via environment variable.
 *
 *   FUSABASE_APP_TRUST_TOKEN="<token>" npm test
 *
 * The SDK will attach it as `X-Fusabase-AppTrust` (see packages/app/src/app-trust-header.ts).
 */


function generateRandomEmail() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let username = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const domains = ["gmail.com", "yahoo.com", "outlook.com", "randommail.com"];
  return `${username}@${domains[Math.floor(Math.random() * domains.length)]}`;
}

describe("fusabase Auth Tests", function () {
  this.timeout(30000);

  let app, auth_c;
  const options = {};

  const providerid_value = "password";
  const providerid_value1 = "UserNamePassword";

  const email = generateRandomEmail();
  const password = "Chirag@123";
  const newPassword = "Chirag@1234";
  const newName1 = "Test name 1";
  const phoneNumber1 = "1234567891";
  const newName2 = "Test name 2";
  const phoneNumber2 = "1234567892";

  before(() => {
    // Option 1: If provided, this token is automatically attached as X-Fusabase-AppTrust
    // on eligible SDK requests.
    const appTrustToken = process.env.FUSABASE_APP_TRUST_TOKEN;
    const initOptions = appTrustToken ? { ...options, appTrustToken } : options;
    app = initializeApp({...options,appTrustToken:"APP_TRUST_TOKEN"}, "test");
    setLogLevel(LogLevel.ERROR);
    auth_c = getAuth(app);
  });

  describe("App Initialization", () => {
    it("should set app options correctly", () => {
      expect(app.options.ordsHost).to.equal(options.ords_host);
      expect(app.options.schema).to.equal(options.schema);
      expect(app.options.appID).to.equal(options.app_id);
      expect(app.options.objsType).to.equal(options.objs_type);
      expect(app.options.storageBucket).to.equal(options.storage_bucket);
      expect(app.options.authType).to.equal(options.auth_type);
      expect(app.options.authID).to.equal(options.auth_id);
    });

    it("should include appTrustToken in app options when FUSABASE_APP_TRUST_TOKEN is set", function () {
      const tok = process.env.FUSABASE_APP_TRUST_TOKEN;
      if (!tok) {
        expect((app.options || {}).appTrustToken).to.be.undefined;
        return;
      }
      expect((app.options || {}).appTrustToken).to.equal(tok);
    });
  });

  describe("User Lifecycle", () => {
    let createdUser;

    it("should create a user with email and password", async () => {
      const res1 = await createUserWithEmailAndPassword(auth_c, email, password);
      expect(res1.user).to.exist;
      expect(res1.credential).to.exist;
      expect(res1.user.displayName).to.equal("- -");
      expect(res1.user.email).to.equal(email);
      expect(res1.user.phoneNumber).to.be.null;
      expect(res1.user.photoURL).to.be.null;
      expect(res1.user.refreshToken).to.exist;
      expect(res1.user.providerId).to.equal(providerid_value1);
      expect(res1.credential.providerId).to.equal(providerid_value);
      expect(res1.credential.signInMethod).to.equal("password");
      createdUser = res1.user;
    });

    it("should sign in with email and password", async () => {
      const res2 = await signInWithEmailAndPassword(auth_c, email, password);
      expect(res2.user).to.exist;
      expect(res2.credential).to.exist;
      expect(res2.user.email).to.equal(email);
      expect(auth_c.currentUser.email).to.equal(email);
    });

    it("should update password", async () => {
      await updatePassword(createdUser, password, newPassword);
      const res3 = await signInWithEmailAndPassword(auth_c, email, newPassword);
      expect(res3.user).to.exist;
      expect(res3.user.email).to.equal(email);
    });

    it("should update displayName", async () => {
      await updateProfile(createdUser, { displayName: newName1 })
      const res4 = await auth_c.signInWithEmailAndPassword(email, newPassword);
      expect(res4.user.displayName).to.equal(newName1);
    });

    // it("should update phone number", async () => {
    //   await updateProfile(createdUser, { phoneNumber: phoneNumber1 })
    //   const res5 = await auth_c.signInWithEmailAndPassword(email, newPassword);
    //   console.log(res5.user);
    //   const t = await res5.user.getIdToken();
    //   console.log(t);
    //   expect(res5.user.phoneNumber).to.equal(phoneNumber1);
    // });

    // it("should update displayName and phoneNumber together", async () => {
    //   await updateProfile(createdUser, {
    //     displayName: newName2,
    //     phoneNumber: phoneNumber2,
    //   });
    //   const res6 = await signInWithEmailAndPassword(auth_c, email, newPassword);
    //   expect(res6.user.displayName).to.equal(newName2);
    //   expect(res6.user.phoneNumber).to.equal(phoneNumber2);
    // });

    it("should sign out", async () => {
      await signOut(auth_c);
      expect(auth_c.currentUser).to.be.null;
    });
  });

  describe("Token and Reload Tests", () => {
    let signedInUser;

    before(async () => {
      const res = await signInWithEmailAndPassword(auth_c, email, newPassword);
      signedInUser = res.user;
    });

    it("should get IdToken", async () => {
      const token = await getIdToken(signedInUser);
      expect(token).to.be.a("string").and.not.empty;
    });

    it("should get IdTokenResult", async () => {
      const tokenRes = await getIdTokenResult(signedInUser);
      expect(tokenRes).to.have.property("issuedAtTime");
      expect(tokenRes).to.have.property("expirationTime");
      expect(tokenRes).to.have.property("authTime");
      expect(tokenRes).to.have.property("parsedJwt");
      expect(tokenRes.parsedJwt).to.have.property("user_id");
    });

    it("should reload user", async () => {
      await reload(signedInUser);
      expect(auth_c.currentUser.email).to.equal(signedInUser.email);
    });
  });
});


// describe("fusabase Auth Tests IDCS", function () {
//   this.timeout(30000);

//   let app, auth_c;
//   const options = {}
//   };

//   const providerid_value = "password";
//   const providerid_value1 = "UserNamePassword";

//   const email = generateRandomEmail();
//   const password = "Chirag@123";
//   const newPassword = "Chirag@1234";
//   const newName1 = "Test name 1";
//   const phoneNumber1 = "1234567891";
//   const newName2 = "Test name 2";
//   const phoneNumber2 = "1234567892";

//   before(() => {
//     app = initializeApp(options, "test");
//     setLogLevel(LogLevel.ERROR);
//     auth_c = getAuth(app);
//   });

//   describe("App Initialization", () => {
//     it("should set app options correctly", () => {
//       expect(app.options.ordsHost).to.equal(options.ords_host);
//       expect(app.options.schema).to.equal(options.schema);
//       expect(app.options.appID).to.equal(options.app_id);
//       expect(app.options.objsType).to.equal(options.objs_type);
//       expect(app.options.storageBucket).to.equal(options.storage_bucket);
//       expect(app.options.authType).to.equal(options.auth_type);
//       expect(app.options.authID).to.equal(options.auth_id);
//     });
//   });

//   describe("User Lifecycle", () => {
//     let createdUser;

//     it("should create a user with email and password", async () => {
//       const res1 = await createUserWithEmailAndPassword(auth_c, email, password);
//       expect(res1.user).to.exist;
//       expect(res1.credential).to.exist;
//       expect(res1.user.displayName).to.equal("- -");
//       expect(res1.user.email).to.equal(email);
//       expect(res1.user.phoneNumber).to.be.null;
//       expect(res1.user.photoURL).to.be.null;
//       expect(res1.user.refreshToken).to.exist;
//       expect(res1.user.providerId).to.equal(providerid_value1);
//       expect(res1.credential.providerId).to.equal(providerid_value);
//       expect(res1.credential.signInMethod).to.equal("password");
//       createdUser = res1.user;
//     });

//     it("should sign in with email and password", async () => {
//       const res2 = await signInWithEmailAndPassword(auth_c, email, password);
//       expect(res2.user).to.exist;
//       expect(res2.credential).to.exist;
//       expect(res2.user.email).to.equal(email);
//       expect(auth_c.currentUser.email).to.equal(email);
//     });

//     it("should update password", async () => {
//       await updatePassword(createdUser, password, newPassword);
//       const res3 = await signInWithEmailAndPassword(auth_c, email, newPassword);
//       expect(res3.user).to.exist;
//       expect(res3.user.email).to.equal(email);
//     });

//     it("should update displayName", async () => {
//       await updateProfile(createdUser, { displayName: newName1 })
//       const res4 = await auth_c.signInWithEmailAndPassword(email, newPassword);
//       expect(res4.user.displayName).to.equal(newName1);
//     });

//     it("should update phone number", async () => {
//       await updateProfile(createdUser, { phoneNumber: phoneNumber1 })
//       const res5 = await auth_c.signInWithEmailAndPassword(email, newPassword);
//       const t = await res5.user.getIdToken();
//       expect(res5.user.phoneNumber).to.equal(phoneNumber1);
//     });

//     it("should update photo url", async () => {
//       await updateProfile(createdUser, { photoURL: "https://aaa.com" })
//       const res5 = await auth_c.signInWithEmailAndPassword(email, newPassword);
//       const t = await res5.user.getIdToken();
//       expect(res5.user.photoURL).to.equal("https://aaa.com");
//     });

//     it("should update displayName and phoneNumber together", async () => {
//       await updateProfile(createdUser, {
//         displayName: newName2,
//         phoneNumber: phoneNumber2,
//       });
//       const res6 = await signInWithEmailAndPassword(auth_c, email, newPassword);
//       expect(res6.user.displayName).to.equal(newName2);
//       expect(res6.user.phoneNumber).to.equal(phoneNumber2);
//     });

//     it("should sign out", async () => {
//       await signOut(auth_c);
//       expect(auth_c.currentUser).to.be.null;
//     });
//   });

//   describe("Token and Reload Tests", () => {
//     let signedInUser;

//     before(async () => {
//       const res = await signInWithEmailAndPassword(auth_c, email, newPassword);
//       signedInUser = res.user;
//     });

//     it("should get IdToken", async () => {
//       const token = await getIdToken(signedInUser);
//       expect(token).to.be.a("string").and.not.empty;
//     });

//     it("should get IdTokenResult", async () => {
//       const tokenRes = await getIdTokenResult(signedInUser);
//       expect(tokenRes).to.have.property("issuedAtTime");
//       expect(tokenRes).to.have.property("expirationTime");
//       expect(tokenRes).to.have.property("authTime");
//       expect(tokenRes).to.have.property("parsedJwt");
//       expect(tokenRes.parsedJwt).to.have.property("user_id");
//     });

//     it("should reload user", async () => {
//       await reload(signedInUser);
//       expect(auth_c.currentUser.email).to.equal(signedInUser.email);
//     });
//   });
// });
