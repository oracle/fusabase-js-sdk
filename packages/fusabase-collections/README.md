# @fusabase/fusabase-collections

## Introduction

`@fusabase/fusabase-collections` is a convenience package for Oracle Backend
with Firebase APIs (Fusabase). It provides Firebase-compatible App, Auth,
OracleDB, Storage, and UI APIs through focused subpath imports.

## Install

```bash
npm install @fusabase/fusabase-collections
```

Install `@fusabase/app-trust` separately when your application uses App Trust.

## Quick start

```javascript
import { initializeApp } from '@fusabase/fusabase-collections/app';
import { getOracledb } from '@fusabase/fusabase-collections/db';

const app = initializeApp({ ...config, backend_type: 'COLLECTION' });
const db = getOracledb(app);
```

## Documentation

- [Oracle Backend for Firebase documentation](https://docs.oracle.com/en/database/oracle/backend-for-firebase/index.html)

## Before you begin

Use the focused `app`, `auth`, `db`, `storage`, and `ui` subpaths shown below.
They make dependencies clear while retaining the convenience of one package.

## Examples

### Authenticate and write a document

```javascript
import { initializeApp } from '@fusabase/fusabase-collections/app';
import { getAuth, onAuthStateChanged } from '@fusabase/fusabase-collections/auth';
import { addDoc, collection, getOracledb } from '@fusabase/fusabase-collections/db';

const app = initializeApp({ ...config, backend_type: 'COLLECTION' });
const auth = getAuth(app);
const db = getOracledb(app);

onAuthStateChanged(auth, async (user) => {
  if (user) await addDoc(collection(db, 'tasks'), { title: 'Write documentation' });
});
```

### Upload an object

```javascript
import { getStorage, ref, uploadBytes } from '@fusabase/fusabase-collections/storage';

const storage = getStorage(app);
await uploadBytes(ref(storage, 'uploads/note.txt'), file, {
  contentType: file.type
});
```
