# @fusabase/oracledb

## Introduction

`@fusabase/oracledb` provides Firebase-compatible collection and document data
APIs for Oracle Backend with Firebase APIs (Fusabase). It supports reads,
writes, queries, listeners, transactions, aggregates, vector search, and
browser offline data.

## Install

```bash
npm install @fusabase/app @fusabase/oracledb
```

## Quick start

```javascript
import { getOracledb } from '@fusabase/oracledb';

const db = getOracledb(app);
```

## Documentation

- [Oracle Backend for Firebase documentation](https://docs.oracle.com/en/database/oracle/backend-for-firebase/index.html)

## Before you begin

Initialize the app with `backend_type: 'COLLECTION'` and obtain the database
instance with `getOracledb(app)`.

## Examples

### Add and query documents

```javascript
import { initializeApp } from '@fusabase/app';
import {
  addDoc,
  collection,
  getDocs,
  getOracledb,
  query,
  where
} from '@fusabase/oracledb';

const db = getOracledb(initializeApp(config));
await addDoc(collection(db, 'tasks'), { title: 'Ship docs', done: false });

const snapshot = await getDocs(
  query(collection(db, 'tasks'), where('done', '==', false))
);
snapshot.forEach((task) => console.log(task.id, task.data()));
```

### Enable browser offline data

```javascript
import { enableOffline, persistentLocalCache } from '@fusabase/oracledb';

await enableOffline(db, persistentLocalCache({ synchronizeTabs: true }));
```

### Find similar documents

```javascript
import { collection, findNearest, getDocs, query } from '@fusabase/oracledb';

const similarDocuments = await getDocs(query(
  collection(db, 'documents'),
  findNearest('embedding', { vector: [0.2, 0.9, -0.1] }, {
    metric: 'COSINE',
    topK: 10
  })
));
```
