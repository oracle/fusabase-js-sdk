# @fusabase/relational

## Introduction

`@fusabase/relational` provides the Supabase-compatible relational API for
Oracle Backend with Supabase APIs (Fusabase). New applications should normally
use `@fusabase/fusabase-relational`, which re-exports this API as the
recommended convenience package.

## Install

```bash
npm install @fusabase/relational
```

## Quick start

```javascript
import { createClient } from '@fusabase/relational';

const client = createClient('https://your-ords-host/ords/your-schema/', {
  ...config,
  backend_type: 'RELATIONAL'
});
```

## Documentation

- [Oracle Backend for Firebase documentation](https://docs.oracle.com/en/database/oracle/backend-for-firebase/index.html)

## Before you begin

New applications should prefer `@fusabase/fusabase-relational`. When using this
package directly, pass `backend_type: 'RELATIONAL'` to `createClient` and check
the `error` field returned by each operation.

## Examples

### Configure offline data and query a relation

```javascript
import { createClient, enableOffline, persistentLocalCache } from '@fusabase/relational';

const client = createClient('https://your-ords-host/ords/your-schema/', {
  ...config,
  backend_type: 'RELATIONAL'
});

await enableOffline(client, persistentLocalCache({
  relations: { tasks: { primaryKey: ['id'] } }
}));

const { data, error } = await client.from('tasks').select().order('id');
if (error) throw error;
```

### Sign in with a password

```javascript
const { data, error } = await client.auth.signInWithPassword({ email, password });
if (error) throw error;
```

### Upload an object and create a signed URL

```javascript
const files = client.storage.from('uploads');
const { data: uploaded, error: uploadError } = await files.upload('reports/q1.csv', file);
if (uploadError) throw uploadError;

const { data: url, error: urlError } = await files.createSignedUrl(uploaded.path, 60);
if (urlError) throw urlError;
```

For the recommended package, see [@fusabase/fusabase-relational](../fusabase-relational/README.md).
