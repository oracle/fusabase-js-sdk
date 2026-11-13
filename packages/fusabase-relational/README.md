# @fusabase/fusabase-relational

## Introduction

`@fusabase/fusabase-relational` is the recommended Supabase-compatible client
for Oracle Backend with Supabase APIs (Fusabase). It provides a single client
for relational data, authentication, storage, App Trust, and offline data.

## Install

```bash
npm install @fusabase/fusabase-relational
```

## Quick start

```javascript
import { createClient } from '@fusabase/fusabase-relational';

const client = createClient('https://your-ords-host/ords/your-schema/', {
  ...config,
  backend_type: 'RELATIONAL'
});
```

## Documentation

- [Oracle Backend for Firebase documentation](https://docs.oracle.com/en/database/oracle/backend-for-firebase/index.html)

## Before you begin

Pass a relational configuration with `backend_type: 'RELATIONAL'` to
`createClient`. Check the `error` field returned by each client operation before
using its `data` field.

## Examples

### Query a relation

```javascript
import { createClient } from '@fusabase/fusabase-relational';

const client = createClient('https://your-ords-host/ords/your-schema/', {
  ...config,
  backend_type: 'RELATIONAL'
});

const { data, error } = await client
  .from('tasks')
  .select('id,title,done')
  .eq('done', false);
if (error) throw error;
```

### Sign in and upload an object

```javascript
const { error } = await client.auth.signInWithPassword({ email, password });
if (error) throw error;

const uploads = client.storage.from('uploads');
const { error: uploadError } = await uploads.upload('avatars/me.png', file);
if (uploadError) throw uploadError;
```

### Configure offline relations

```javascript
import { enableOffline, persistentLocalCache } from '@fusabase/fusabase-relational';

await enableOffline(client, persistentLocalCache({
  relations: { tasks: { primaryKey: ['id'] } }
}));

const { data, error } = await client.from('tasks').select().fromCache();
if (error) throw error;
```
