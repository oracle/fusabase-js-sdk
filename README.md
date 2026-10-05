<br />
<p align="center">
  <img src="assets/fusabase-color.svg" alt="Fusabase logo" width="180" />
</p>

<h1 align="center">Oracle Backend with Firebase APIs (Fusabase) JavaScript SDK</h1>

<p align="center">
  <a href="https://docs.oracle.com/en/database/oracle/backend-for-firebase/26.1/index.html">Guides</a>
  ·
  <a href="https://livelabs.oracle.com/ords/r/dbpm/livelabs/view-workshop?wid=4404&amp;clear=180,RR&amp;session=117297029571778">Free Workshop</a>
</p>

A modular JavaScript SDK for Oracle Backend with Firebase APIs (Fusabase) that provides authentication, document database, storage, App Trust, vector search, and UI component capabilities.

This Oracle Backend with Firebase APIs JavaScript SDK follows the Firebase design, API patterns, and rules-based authorization model. Its SDK interfaces are designed to mirror the Firebase SDK interfaces so developers can move across backends with minimal changes. This Oracle Backend with Firebase APIs JavaScript SDK is a distinct Oracle offering.

## Prerequisites

- Node.js (version 18 or later)
- npm (comes with Node.js)

## Installation

Install the JavaScript Modular SDK package:

   ```bash
   npm install fusabase
   ```

The package provides app setup, authentication, document data, storage, UI, App Trust, and browser offline data access through these public imports: `fusabase/app`, `fusabase/auth`, `fusabase/oracledb`, `fusabase/storage`, `fusabase/ui`, and `fusabase/app-trust`.

## Usage

Here are examples of how to import and use the Fusabase SDK modules in your browser application.

### App Initialization (Browser)

```javascript
import { initializeApp } from 'fusabase/app';

const app = initializeApp({
  // required
  ords_host: 'https://your-ords-host/ords/your-schema/',
  schema: 'your-schema',
  app_type: 'WEB',
  app_id: 'your-app-id',
  project_id: 'your-project-id',
  objs_type: 'dbfs',                // your objects type (e.g. 'dbfs')
  storage_bucket: 'your-bucket',
  auth_type: 'base',                // base | idcs
  auth_id: 'your-auth-id'
});
```

### Authentication (Browser)

```javascript
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'fusabase/auth';

const auth = getAuth(app);

// Observe auth state
const unsubscribe = onAuthStateChanged(auth, (user) => {
  if (user) console.log('Signed in:', user.uid);
  else console.log('Signed out');
});

// Email/Password sign up
try {
  const userCred = await createUserWithEmailAndPassword(auth, 'user@example.com', 'password123!');
  console.log('Created user:', userCred.user);
} catch (err) {
  console.error('Sign up failed:', err);
}

// Email/Password sign in
try {
  const userCred = await signInWithEmailAndPassword(auth, 'user@example.com', 'password123!');
  console.log('Signed in:', userCred.user);
} catch (err) {
  console.error('Sign in failed:', err);
}

// Sign out later
await signOut(auth);
// later: unsubscribe();
```

### Database (OracleDB) — Core Examples (Browser)

```javascript
import {
  getOracledb,
  collection,
  doc,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'fusabase/oracledb';

const db = getOracledb(app);

// Read a document
const postRef = doc(db, 'posts', 'post-123');
const postSnap = await getDoc(postRef);
if (postSnap.exists()) {
  console.log('Post:', postSnap.data());
}

// Create with auto-id
const newRef = await addDoc(collection(db, 'posts'), {
  title: 'Hello',
  createdAt: Date.now(),
});

// Create/replace
await setDoc(doc(db, 'posts', 'post-123'), { title: 'Updated', views: 0 });

// Update
await updateDoc(doc(db, 'posts', 'post-123'), { views: 1 });

// Delete
await deleteDoc(doc(db, 'posts', 'post-123'));

// Query (filter + order + limit)
const q = query(
  collection(db, 'posts'),
  where('published', '==', true),
  orderBy('createdAt', 'desc'),
  limit(10)
);
const snaps = await getDocs(q);
snaps.forEach((snap) => console.log(snap.id, snap.data()));
```

### Offline Use (Browser)

Enable offline support once after creating the database instance, before reads, writes, or listeners. Choose one persistence setup for an instance; a later setup call replaces the current offline configuration.

#### Persistent browser cache

`enableOffline(db, options?)` is the general setup API. Without options, it uses a persistent browser cache. Use `persistentLocalCache` to configure its size or coordinate multiple browser tabs.

```javascript
import {
  enableOffline,
  getOracledb,
  persistentLocalCache
} from 'fusabase/oracledb';

const db = getOracledb(app);

await enableOffline(
  db,
  persistentLocalCache({
    cacheSizeBytes: 10 * 1024 * 1024,
    synchronizeTabs: true
  })
);
```

Use `enableIndexedDbPersistence(db)` when the default persistent browser cache is sufficient:

```javascript
import { enableIndexedDbPersistence, getOracledb } from 'fusabase/oracledb';

const db = getOracledb(app);
await enableIndexedDbPersistence(db);
```

This cache survives page reloads and requires a browser environment with IndexedDB support.

#### In-memory cache

Use `enableMemoryPersistence(db)` when cached data should only live for the current page or process. Its data is discarded when the page or process ends.

```javascript
import { enableMemoryPersistence, getOracledb } from 'fusabase/oracledb';

const db = getOracledb(app);
await enableMemoryPersistence(db);
```

#### Reading, writing, and reconnecting

Once enabled, use the normal read, write, and listener APIs. If connectivity is unavailable, cached reads are used where available and writes are queued for later synchronization.

```javascript
import {
  collection,
  disableNetwork,
  doc,
  enableNetwork,
  getDocFromCache,
  setDoc,
  waitForPendingWrites
} from 'fusabase/oracledb';

const recipe = doc(collection(db, 'recipes'), 'tea');

await disableNetwork(db);
await setDoc(recipe, { title: 'Tea', ratingCount: 0 });

const cached = await getDocFromCache(recipe);
console.log(cached.data());

await enableNetwork(db);
await waitForPendingWrites(db);
```

`getDocFromCache` and `getDocsFromCache` require offline support and read only local data. `waitForPendingWrites` resolves after writes queued before the call are acknowledged or rejected.

With offline support enabled, write promises resolve after the local cache is updated. Use `waitForPendingWrites(db)` after reconnecting when the next step requires server acknowledgement. `onSnapshot` with `{ includeMetadataChanges: true }` exposes `snapshot.metadata.fromCache` and `snapshot.metadata.hasPendingWrites`.

Cached queries support ordinary filters, ordering, and limits, but not joins, aggregates, vector search, or composite filters. Transactions still require the server. `clearIndexedDbPersistence(db)` discards cached data and queued writes; call it only when that local data should be removed.

See [the offline API guide](agent_docs/offline.md) for all setup options and limitations.

### Vector Search (Browser)

Fusabase supports similarity search over dense and sparse embeddings stored on documents. Use `findNearest` as a query constraint.

```javascript
import {
  collection,
  query,
  getDocs,
  findNearest,
} from 'fusabase/oracledb';

// Dense vector similarity search
const denseQuery = query(
  collection(db, 'documents'),
  findNearest(
    'embedding',
    { vector: [0.22, 0.93, -0.10] },
    { metric: 'COSINE', topK: 10 }
  )
);
const denseSnap = await getDocs(denseQuery);
denseSnap.forEach((snap) => console.log(snap.id, snap.data()));

// Sparse vector similarity search
const sparseQuery = query(
  collection(db, 'documents'),
  findNearest(
    'embedding',
    { sparse: { type: 'sparse', dimension: 1000, indices: [2, 7, 900], values: [0.9, 0.3, 0.5] } },
    { metric: 'DOT', topK: 5 }
  )
);
const sparseSnap = await getDocs(sparseQuery);
```

Supported metrics: `'COSINE'`, `'EUCLIDEAN'`, `'DOT'`.

### Storage (Browser)

```javascript
import {
  getStorage,
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  list,
  listAll,
  getMetadata,
  deleteObject
} from 'fusabase/storage';

const storage = getStorage(app);

// Upload a Blob/File and get URL
const fileRef = ref(storage, 'uploads/photo.jpg');
const result = await uploadBytes(fileRef, fileBlob /* or File */, { contentType: 'image/jpeg' });
const url = await getDownloadURL(result.ref);

// Resumable upload with progress (event name: 'state_changed')
const task = uploadBytesResumable(fileRef, fileInput.files[0], { contentType: 'image/jpeg' });
task.on('state_changed',
  (snap) => {
    const pct = (snap.bytesTransferred / snap.totalBytes) * 100;
    console.log(`Upload ${pct.toFixed(1)}%`);
  },
  (err) => console.error('Upload failed:', err),
  async () => {
    const downloadURL = await getDownloadURL(task.snapshot.ref);
    console.log('File available at', downloadURL);
  }
);

// List and metadata
const shallow = await list(ref(storage, 'uploads/'), { maxResults: 100 });
const recursive = await listAll(ref(storage, 'uploads/'));
const meta = await getMetadata(fileRef);

// Delete
await deleteObject(fileRef);
```

### App Trust (Browser)

Fusabase App Trust protects your backend endpoints by adding an attestation token to
all **`/_/baas-services/*`** requests.

#### Initialize App Trust

```ts
import { initializeAppTrust } from 'fusabase/app-trust';
```

Pick one provider:

##### Cloudflare Turnstile

```ts
import { initializeAppTrust, TurnstileProvider } from 'fusabase/app-trust';

const appTrust = initializeAppTrust(app, {
  provider: new TurnstileProvider('YOUR_TURNSTILE_SITE_KEY'),
});
```

> Note: the Fusabase attestation servlet must be configured with a provider id of **`turnstile`**.

##### hCaptcha

```ts
import { initializeAppTrust, HCaptchaProvider } from 'fusabase/app-trust';

const appTrust = initializeAppTrust(app, {
  provider: new HCaptchaProvider('YOUR_HCAPTCHA_SITE_KEY'),
});
```

> Note: the Fusabase attestation servlet must be configured with a provider id of **`hcaptcha`**.

##### reCAPTCHA v3

```ts
import { initializeAppTrust, ReCaptchaV3Provider } from 'fusabase/app-trust';

const appTrust = initializeAppTrust(app, {
  provider: new ReCaptchaV3Provider('YOUR_RECAPTCHA_V3_SITE_KEY'),
});
```

> Note: the Fusabase attestation servlet must be configured with a provider id of **`recaptchav3`**.

##### reCAPTCHA Enterprise

```ts
import { initializeAppTrust, ReCaptchaEnterpriseProvider } from 'fusabase/app-trust';

const appTrust = initializeAppTrust(app, {
  provider: new ReCaptchaEnterpriseProvider('YOUR_RECAPTCHA_ENTERPRISE_SITE_KEY'),
});
```

> Note: the Fusabase attestation servlet must be configured with a provider id of **`recaptchaenterprise`**.

#### Mint / refresh a token (optional)

Normally you don’t need to call this directly, but it can be useful if you want
to pre-mint a token during app startup:

```ts
import { getToken } from 'fusabase/app-trust';

const tok = await getToken(appTrust, true);
console.log('App Trust token expires at', new Date(tok.expireTimeMillis));
```

### UI Components (Browser)

```javascript
import { authUI } from 'fusabase/ui';
import {
  getAuth,
  GoogleAuthProvider,
  FacebookAuthProvider,
  GithubAuthProvider,
  EmailAuthProvider
} from 'fusabase/auth';

const auth = getAuth(app);

// Create UI instance with Auth (you may also pass App or config to the constructor)
const ui = new authUI.AuthUI(auth);

// Mount into a container (selector or HTMLElement)
ui.start('#auth-root', {
  signInOptions: [
    GoogleAuthProvider.PROVIDER_ID,   // 'google'
    FacebookAuthProvider.PROVIDER_ID, // 'facebook'
    GithubAuthProvider.PROVIDER_ID,   // 'github'
    EmailAuthProvider.PROVIDER_ID,    // 'password' (shows email/password login/register)
  ],
  callbacks: {
    // Return true to allow redirect; false to prevent it
    signInSuccessWithAuthResult: (authResult, redirectUrl) => {
      console.log('Signed in:', authResult.user.uid, 'redirect to:', redirectUrl);
      return true;
    },
  },
  // If provided and callback returns true, UI will navigate to this URL
  signInSuccessUrl: '/home',
});
```

## Documentation

Generate TypeDoc documentation:

```bash
npm run docs
```

The documentation will be generated in `docs/api-reference/`.

## Building the Project

To build the SDK from TypeScript source:

```bash
npm run build
```

This compiles the TypeScript files to JavaScript in the `dist/` directory.

## Creating Distribution Binaries

To create a valid npm package tarball for distribution:

```bash
npm pack
```

This generates a `.tgz` file containing the built distribution files from the `dist/` directory, ready for publishing or local installation.

## Running Local Tests

Run the unit tests using Mocha:

```bash
npm test

```


## Running Integration Tests (via npm)

Integration tests are run against a separate test application using the published SDK package. Follow these steps:

1. In a separate test application, include `"fusabase": "*"` in `package.json` to fetch the latest from artifactory.

   Note: Use `26.3.0` if you need this exact release.
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Run the integration tests:
   ```bash
   npm run testBase
   ```

## Running Integration Tests (For File-based Import)

Integration tests are run against a separate test application. Follow these steps:

1. Build the SDK:
   ```bash
   npm run build
   ```

2. Link the SDK globally:
   ```bash
   npm link
   ```

3. Navigate to the test application directory:
   ```bash
   cd <App-Dir>
   ```

4. Link the SDK in the test application:
   ```bash
   npm link fusabase
   ```

5. Run the integration tests:
   ```bash
   npm run testBase
   ```

## Trademarks

Firebase is a trademark of Google LLC.  Use of the Firebase name here is solely to describe the design patterns and SDK interfaces that Oracle Backend with Firebase APIs follows for developer familiarity and ease of migration; it does not imply any affiliation with or endorsement by Google.

## Contributing

This project welcomes contributions from the community. Before submitting a pull request, please [review our contribution guide](./CONTRIBUTING.md).

## Security

Please consult the [security guide](./SECURITY.md) for our responsible security vulnerability disclosure process.

## License

Copyright (c) 2015, 2026, Oracle and/or its affiliates.

This software is dual-licensed to you under the Universal Permissive License
(UPL) 1.0 as shown at https://oss.oracle.com/licenses/upl and Apache License
2.0 as shown at http://www.apache.org/licenses/LICENSE-2.0. You may choose
either license.

If you elect to accept the software under the Apache License, Version 2.0,
the following applies:

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
