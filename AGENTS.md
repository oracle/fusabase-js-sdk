# Oracle Backend for Firebase SDK Guide for Coding Agents

This repository contains the Oracle Backend for Firebase JavaScript modular SDK. The product name is **Oracle Backend for Firebase**. The package and import name that application code should use is **`fusabase`**.

Use this file as background context when you are scanning the SDK or generating application code that consumes it.

## Canonical Imports

Use only the public package subpaths:

```ts
import { initializeApp } from "fusabase/app";
import { getAuth } from "fusabase/auth";
import { getOracledb } from "fusabase/oracledb";
import { getStorage } from "fusabase/storage";
import { authUI } from "fusabase/ui";
import { initializeAppTrust } from "fusabase/app-trust";
```

Do not import from `packages/...`, `dist/...`, or other internal repository paths when generating application code.

## Configuration

Applications initialize the SDK with a config object from the Oracle Backend for Firebase console. The public input shape uses **snake_case** keys (the console emits JSON; pass it through unchanged):

- `ords_host`
- `schema`
- `app_name`
- `app_type`
- `app_id`
- `project_id`
- `objs_type`
- `storage_bucket`
- `auth_type`
- `auth_id`
- `idcs_config`

High-level example:

```ts
import { initializeApp } from "fusabase/app";

const app = initializeApp({
  schema: "testuser",
  app_name: "RecipeShare",
  app_type: "WEB",
  app_id: "app-id",
  objs_type: "dbfs",
  project_id: "project-id",
  storage_bucket: "bucket-name",
  auth_type: "base",
  auth_id: "auth-id",
  ords_host: "http://localhost:8080/ords/testuser/"
});
```

Internally the SDK exposes a camelCase `FusabaseOptions` view on `app.options` (e.g. `app.options.ordsHost`). Application code that reads back option values sees the camelCase form; code that passes config in must use snake_case.

## SDK Surface

- `fusabase/app`: app initialization, named apps, app lookup, app deletion, and log level control.
- `fusabase/auth`: authentication state, email/password auth, provider auth, token access, persistence, linking, and user account operations.
- `fusabase/oracledb`: document and collection access, queries, writes, transactions, aggregates, listeners, field operations, vector search, bulk updates, collection-group queries, and duality-view helpers.
- `fusabase/storage`: storage references, uploads, downloads, metadata, listing, and deletion.
- `fusabase/ui`: browser auth UI helpers through `authUI.AuthUI`.
- `fusabase/app-trust`: browser trust-token initialization and token acquisition with provider-based attestation.

## Short Examples

### App

```ts
import { getApp, getApps, initializeApp } from "fusabase/app";

const app = getApps().length ? getApp() : initializeApp(config);
```

### Auth

```ts
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword
} from "fusabase/auth";

const auth = getAuth(app);
onAuthStateChanged(auth, (user) => console.log(user?.email ?? "signed out"));
await signInWithEmailAndPassword(auth, email, password);
```

### OracleDB

```ts
import {
  addDoc,
  collection,
  getDocs,
  getOracledb,
  query,
  where
} from "fusabase/oracledb";

const db = getOracledb(app);
const recipesRef = collection(db, "recipes");
await addDoc(recipesRef, { title: "Tea", category: "Drinks" });
const snap = await getDocs(query(recipesRef, where("category", "==", "Drinks")));
```

### Storage

```ts
import { getDownloadURL, getStorage, ref, uploadBytes } from "fusabase/storage";

const storage = getStorage(app);
const photoRef = ref(storage, "recipes/tea.png");
await uploadBytes(photoRef, file, { contentType: file.type });
const url = await getDownloadURL(photoRef);
```

### UI

```ts
import { EmailAuthProvider, GoogleAuthProvider } from "fusabase/auth";
import { authUI } from "fusabase/ui";

const ui = new authUI.AuthUI(app);
ui.start("#auth", {
  signInOptions: [EmailAuthProvider.PROVIDER_ID, GoogleAuthProvider.PROVIDER_ID]
});
```

### App Trust

```ts
import { initializeAppTrust, ReCaptchaV3Provider } from "fusabase/app-trust";

const appTrust = initializeAppTrust(app, {
  provider: new ReCaptchaV3Provider("site-key")
});
```

## More Detail

Use these docs when you need more module-specific context:

- `agent_docs/configuration.md`: app config shape, naming, and initialization context.
- `agent_docs/app.md`: app lifecycle and shared app-instance APIs.
- `agent_docs/auth.md`: auth state, sign-in flows, persistence, tokens, and user operations.
- `agent_docs/oracledb.md`: collections, documents, queries, writes, transactions, aggregates, listeners, vector search, bulk updates, collection-group queries, and duality-view joins.
- `agent_docs/storage.md`: references, uploads, downloads, metadata, listing, and deletion.
- `agent_docs/ui.md`: `authUI.AuthUI` usage and supported sign-in options.
- `agent_docs/app-trust.md`: browser app-trust providers, token retrieval, and token listeners.
- `agent_docs/api-reference.md`: how to generate local API docs with `npm run docs` and where the generated reference lives.

## API Reference

Generate local API docs with:

```bash
npm run docs
```

That command writes the generated reference under `docs/api-reference/`. See `agent_docs/api-reference.md` for details and current limitations.
