# @fusabase/app

## Introduction

`@fusabase/app` initializes and manages an Oracle Backend with Firebase APIs
(Fusabase) application. Initialize an app before using Firebase-compatible Auth,
OracleDB, Storage, App Trust, or UI packages.

## Install

```bash
npm install @fusabase/app
```

## Quick start

```javascript
import { initializeApp } from '@fusabase/app';

const app = initializeApp({ ...config, backend_type: 'COLLECTION' });
```

## Documentation

- [Oracle Backend for Firebase documentation](https://docs.oracle.com/en/database/oracle/backend-for-firebase/index.html)

## Before you begin

Use the configuration generated for your Fusabase application. The `ords_host`
value must include the ORDS path and trailing slash. Use `COLLECTION` for the
Firebase-compatible service family.

## Examples

### Initialize an application

```javascript
import { getApp, initializeApp } from '@fusabase/app';

const app = initializeApp({
  ords_host: 'https://your-ords-host/ords/your-schema/',
  schema: 'your-schema',
  app_name: 'YourApp',
  app_type: 'WEB',
  app_id: 'your-app-id',
  project_id: 'your-project-id',
  objs_type: 'dbfs',
  storage_bucket: 'your-bucket',
  auth_type: 'base',
  auth_id: 'your-auth-id',
  backend_type: 'COLLECTION'
});

console.log(getApp() === app);
```

### Manage application instances

```javascript
import { deleteApp, getApps, LogLevel, setLogLevel } from '@fusabase/app';

setLogLevel(LogLevel.WARN);
console.log(getApps().map((instance) => instance.name));
await deleteApp(app);
```

See the [root README](../../README.md) for related Firebase-compatible packages.
