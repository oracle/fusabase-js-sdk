# Storage Module

Use `fusabase/storage` for object references, uploads, downloads, metadata inspection, listing, and deletion.

## Primary Imports

```ts
import {
  deleteObject,
  getBytes,
  getDownloadURL,
  getMetadata,
  getStorage,
  list,
  listAll,
  ref,
  uploadBytes,
  uploadBytesResumable
} from "fusabase/storage";
```

## Common Patterns

### Upload a file

```ts
import { getStorage, ref, uploadBytes } from "fusabase/storage";

const storage = getStorage(app);
const imageRef = ref(storage, `recipes/${recipeId}/${file.name}`);
await uploadBytes(imageRef, file, { contentType: file.type });
```

### Resumable upload

```ts
import {
  TaskEvent,
  getStorage,
  ref,
  uploadBytesResumable
} from "fusabase/storage";

const task = uploadBytesResumable(ref(getStorage(app), "recipes/tea.png"), file);
task.on(TaskEvent.STATE_CHANGED, (snapshot) => {
  console.log(snapshot.bytesTransferred, snapshot.totalBytes);
});
```

### Download and inspect metadata

```ts
import {
  getDownloadURL,
  getMetadata,
  getStorage,
  ref
} from "fusabase/storage";

const imageRef = ref(getStorage(app), "recipes/tea.png");
const [url, metadata] = await Promise.all([
  getDownloadURL(imageRef),
  getMetadata(imageRef)
]);
```

## Other Public Areas

- `getBytes`, `getBlob`, and `getStream`.
- `list` and `listAll` for directory-style traversal.
- `deleteObject` for cleanup.

## Related Docs

- `agent_docs/oracledb.md`
