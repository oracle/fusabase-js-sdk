# @fusabase/storage

## Introduction

`@fusabase/storage` provides Firebase-compatible object storage APIs for Oracle
Backend with Firebase APIs (Fusabase). Use it to upload, download, list, and
manage objects in configured storage buckets.

## Install

```bash
npm install @fusabase/app @fusabase/storage
```

## Quick start

```javascript
import { getStorage, ref, uploadBytes } from '@fusabase/storage';

const storage = getStorage(app);
await uploadBytes(ref(storage, 'uploads/hello.txt'), file);
```

## Documentation

- [Oracle Backend for Firebase documentation](https://docs.oracle.com/en/database/oracle/backend-for-firebase/index.html)

## Before you begin

Initialize a Fusabase application and ensure `storage_bucket` is configured for
the application.

## Examples

### Upload with progress and retrieve a download URL

```javascript
import { getStorage, getDownloadURL, ref, uploadBytesResumable } from '@fusabase/storage';

const storage = getStorage(app);
const fileRef = ref(storage, 'uploads/photo.png');
const task = uploadBytesResumable(fileRef, file, { contentType: file.type });

task.on('state_changed', (snapshot) => {
  console.log(`${snapshot.bytesTransferred}/${snapshot.totalBytes}`);
});

await task;
console.log(await getDownloadURL(fileRef));
```

### List and delete objects

```javascript
import { deleteObject, listAll, ref } from '@fusabase/storage';

const uploads = ref(storage, 'uploads/');
const { items } = await listAll(uploads);
console.log(items.map((item) => item.fullPath));

await deleteObject(ref(storage, 'uploads/old-photo.png'));
```
