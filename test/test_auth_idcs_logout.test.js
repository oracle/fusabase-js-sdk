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
import { Auth } from "../dist/auth-core/src/auth.js";
import { User } from "../dist/auth-core/src/user.js";
import { IDCSAuthProvider } from "../dist/auth-core/src/providers/idcs.js";
import { IDCSUserHelper } from "../dist/auth-core/src/helpers/userHelper.js";
import { IdTokenResult } from "../dist/auth-core/src/types/idtoken.js";
import BrowserLocalPersistence from "../dist/auth-core/src/helpers/storage/BrowserLocalPersistence.js";

const ACCESS_TOKEN = "header.eyJpYXQiOjEsImV4cCI6Mn0.signature";
const REFRESHED_ACCESS_TOKEN = "header.eyJpYXQiOjEsImV4cCI6NDEwMjQ0NDgwMH0.signature";
const USER_DETAILS = {
  displayName: "IDCS User",
  emails: [{ value: "idcs@example.test" }],
  id: "idcs-user",
  idp_name: "idcs",
  meta: { created: "2026-01-01", lastSignIn: "2026-01-01" }
};

class StorageMock {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

class BroadcastChannelMock {
  constructor() {
    this.onmessage = null;
  }

  postMessage() {}

  close() {}
}

function installBrowserMock() {
  const submittedForms = [];
  const document = {
    title: "Test",
    body: {
      appendChild(element) {
        element.parentNode = this;
      }
    },
    createElement(tagName) {
      if (tagName === "form") {
        return {
          method: "",
          action: "",
          style: {},
          children: [],
          appendChild(input) {
            this.children.push(input);
          },
          submit() {
            submittedForms.push(this);
          }
        };
      }
      return { type: "", name: "", value: "" };
    }
  };
  globalThis.window = {
    localStorage: new StorageMock(),
    sessionStorage: new StorageMock(),
    BroadcastChannel: BroadcastChannelMock,
    location: {
      origin: "https://app.example.test",
      pathname: "/signed-in",
      href: "https://app.example.test/signed-in"
    },
    history: { replaceState() {} }
  };
  globalThis.document = document;
  return submittedForms;
}

function createAuth() {
  const app = {
    name: "idcs-logout-test",
    logLevel: 0,
    options: {
      ordsHost: "https://ords.example.test/ords/demo/",
      appID: "app-id",
      authID: "auth-id",
      authType: "idcs",
      projectID: "project-id",
      idcsDomainURL: "https://idcs.example.test"
    },
    container: {
      getProvider() {
        return { getInitializedInstances: () => [] };
      }
    }
  };
  const auth = new Auth(app);
  app.auth = () => auth;
  return auth;
}

function useLocalPersistence(auth) {
  auth.persistenceUserManager.persistence = new BrowserLocalPersistence();
}

describe("IDCS logout handoff", () => {
  let submittedForms;
  let getFusabaseToken;

  beforeEach(() => {
    submittedForms = installBrowserMock();
    getFusabaseToken = User.prototype.getFUSABASEToken;
    User.prototype.getFUSABASEToken = async () => null;
  });

  afterEach(() => {
    User.prototype.getFUSABASEToken = getFusabaseToken;
    delete globalThis.window;
    delete globalThis.document;
  });

  it("persists the internal ID token with the existing token payload", async () => {
    const auth = createAuth();
    await auth._setTokenDataOnStorage(auth.TOKEN_KEY, {
      access_token: { token: ACCESS_TOKEN },
      refresh_token: "refresh-token",
      id_token: "id-token"
    });

    const stored = await auth.persistenceUserManager.persistence._get(auth.TOKEN_KEY);
    expect(stored).to.include({ refresh_token: "refresh-token", id_token: "id-token" });
  });

  it("retains the persisted ID token when an IDCS access token is refreshed", async () => {
    const auth = createAuth();
    useLocalPersistence(auth);
    const user = new User(USER_DETAILS, null, { token: ACCESS_TOKEN }, "old-refresh-token", auth);
    auth.currentUser = user;
    user.userHelper = {
      acc_tok: { token: ACCESS_TOKEN },
      refreshAccessToken: async () => "refreshed-refresh-token"
    };

    await auth._setTokenDataOnStorage(auth.TOKEN_KEY, {
      access_token: { token: ACCESS_TOKEN },
      refresh_token: "old-refresh-token",
      id_token: "persisted-id-token"
    });

    await user.getIdToken(true);

    const stored = await auth.persistenceUserManager.persistence._get(auth.TOKEN_KEY);
    expect(stored).to.include({
      refresh_token: "refreshed-refresh-token",
      id_token: "persisted-id-token"
    });
  });

  it("restores the refreshed ID token for the IDCS logout form post after reload", async () => {
    const auth = createAuth();
    useLocalPersistence(auth);
    await auth._setTokenDataOnStorage(auth.TOKEN_KEY, {
      access_token: { token: ACCESS_TOKEN },
      refresh_token: "refreshed-refresh-token",
      id_token: "persisted-id-token"
    });

    const reloadedAuth = createAuth();
    useLocalPersistence(reloadedAuth);
    const tokens = await reloadedAuth.persistenceUserManager.persistence._get(reloadedAuth.TOKEN_KEY);
    reloadedAuth.setIdTokenHint(reloadedAuth.tokensParse(tokens));
    reloadedAuth.currentUser = { refreshToken: "refreshed-refresh-token" };
    reloadedAuth.authHelper.performSignOut = async () => {};

    await reloadedAuth.signOut();

    expect(submittedForms).to.have.length(1);
    expect(Object.fromEntries(submittedForms[0].children.map(input => [input.name, input.value])))
      .to.include({ id_token_hint: "persisted-id-token" });
  });

  it("keeps the ID token hint when initialization refreshes an expired access token", async () => {
    const auth = createAuth();
    useLocalPersistence(auth);
    auth.authHelper = {
      getUserDetails: async () => ({ ...USER_DETAILS, idp_name: "google" }),
      performSignOut: async () => {}
    };
    const validateAccessToken = IDCSUserHelper.prototype.validateAccessToken;
    const refreshAccessToken = IDCSUserHelper.prototype.refreshAccessToken;
    IDCSUserHelper.prototype.validateAccessToken = () => false;
    IDCSUserHelper.prototype.refreshAccessToken = async function () {
      this.acc_tok = new IdTokenResult(REFRESHED_ACCESS_TOKEN);
      return "refreshed-refresh-token";
    };

    try {
      await auth.initialSignIn({
        access_token: { intToken: ACCESS_TOKEN },
        refresh_token: "refresh-token",
        id_token: "persisted-id-token"
      });

      await auth.signOut();

      expect(submittedForms).to.have.length(1);
      expect(Object.fromEntries(submittedForms[0].children.map(input => [input.name, input.value])))
        .to.include({ id_token_hint: "persisted-id-token" });
    } finally {
      IDCSUserHelper.prototype.validateAccessToken = validateAccessToken;
      IDCSUserHelper.prototype.refreshAccessToken = refreshAccessToken;
    }
  });

  it("retains the callback ID token for an IDCS popup sign-in", async () => {
    const auth = createAuth();
    auth.authHelper = {
      socialLogin: async () => ({
        authnToken: null,
        id_token: "popup-id-token",
        tokens: { access_token: { token: ACCESS_TOKEN }, refresh_token: "refresh-token" }
      }),
      getUserDetails: async () => USER_DETAILS
    };

    const result = await auth.signInWithPopup(new IDCSAuthProvider());

    expect(result.credential.providerId).to.equal("idcs");
    expect(result.credential.idToken).to.equal("popup-id-token");
    expect(auth.idTokenHint).to.equal("popup-id-token");
  });

  it("retains the callback ID token for an IDCS redirect sign-in", async () => {
    const auth = createAuth();
    window.location.href = "https://app.example.test/signed-in?code=redirect-code";
    window.sessionStorage.setItem(
      "fusabase:auth:app-id:idcs-logout-test:redirect-flow",
      JSON.stringify({ providerId: "idcs", codeVerifier: "verifier", createdAt: Date.now() })
    );
    auth.authHelper = {
      getRedirectCredentials: async () => ({
        access_token: ACCESS_TOKEN,
        refresh_token: "refresh-token",
        id_token: "redirect-id-token"
      }),
      getUserDetails: async () => USER_DETAILS
    };

    const result = await auth.getRedirectResult();

    expect(result.credential.providerId).to.equal("idcs");
    expect(result.credential.idToken).to.equal("redirect-id-token");
    expect(auth.idTokenHint).to.equal("redirect-id-token");
  });

  it("clears local state and posts the IDCS logout handoff", async () => {
    const auth = createAuth();
    auth.currentUser = { refreshToken: "refresh-token" };
    auth.idTokenHint = "id-token";
    let revokedToken = null;
    auth.authHelper = {
      performSignOut: async token => {
        revokedToken = token;
      }
    };

    await auth.signOut();

    expect(auth.currentUser).to.equal(null);
    expect(revokedToken).to.equal("refresh-token");
    expect(submittedForms).to.have.length(1);
    const form = submittedForms[0];
    expect(form.method).to.equal("POST");
    expect(form.action).to.equal(
      "https://ords.example.test/ords/demo/_/baas-services/idm/idcs/project-id/logout"
    );
    expect(Object.fromEntries(form.children.map(input => [input.name, input.value]))).to.deep.equal({
      apiKey: "app-id",
      context_uri: "https://app.example.test/signed-in",
      id_token_hint: "id-token"
    });
  });

  it("never includes the refresh token in the IDCS logout handoff", async () => {
    const auth = createAuth();
    auth.currentUser = { refreshToken: "refresh-token" };
    auth.idTokenHint = "id-token";
    auth.authHelper = { performSignOut: async () => {} };

    await auth.signOut();

    const fields = Object.fromEntries(
      submittedForms[0].children.map(input => [input.name, input.value])
    );
    expect(fields).to.not.have.property("refresh_token");
  });

  it("preserves local state when refresh-token revocation fails", async () => {
    const auth = createAuth();
    const currentUser = { refreshToken: "refresh-token" };
    auth.currentUser = currentUser;
    auth.idTokenHint = "id-token";
    auth.authHelper = {
      performSignOut: async () => {
        throw new Error("network unavailable");
      }
    };

    let error;
    try {
      await auth.signOut();
    } catch (caught) {
      error = caught;
    }

    expect(error).to.be.instanceOf(Error);
    expect(auth.currentUser).to.equal(currentUser);
    expect(auth.idTokenHint).to.equal("id-token");
    expect(submittedForms).to.have.length(0);
  });

  it("continues logout when refresh-token revocation reports an invalid token", async () => {
    const auth = createAuth();
    auth.currentUser = { refreshToken: "already-invalid-token" };
    auth.idTokenHint = "id-token";
    auth.authHelper = {
      performSignOut: async () => {
        const error = new Error("invalid token");
        error.status = 401;
        throw error;
      }
    };

    await auth.signOut();

    expect(auth.currentUser).to.equal(null);
    expect(submittedForms).to.have.length(1);
  });

  it("does not close realtime listeners when a sign-out guard rejects", async () => {
    const auth = createAuth();
    const currentUser = { refreshToken: null };
    auth.currentUser = currentUser;
    let closeCalls = 0;
    auth.app.container.getProvider = () => ({
      getInitializedInstances: () => [{
        __closeRealtimeForSignOut: () => {
          closeCalls++;
        }
      }]
    });
    auth.beforeAuthStateChanged(() => {
      throw new Error("sign-out denied");
    });

    try {
      await auth.signOut();
      expect.fail("Expected signOut to reject");
    } catch (error) {
      expect(error.message).to.equal("sign-out denied");
    }

    expect(auth.currentUser).to.equal(currentUser);
    expect(closeCalls).to.equal(0);
  });

  it("uses project-scoped refresh-token revocation when no ID token is available", async () => {
    const auth = createAuth();
    auth.currentUser = { refreshToken: "refresh-token" };
    auth.idTokenHint = null;
    let revokedToken = null;
    auth.authHelper = {
      performSignOut: async token => {
        revokedToken = token;
      }
    };

    await auth.signOut();

    expect(revokedToken).to.equal("refresh-token");
    expect(submittedForms).to.have.length(0);
  });
});
