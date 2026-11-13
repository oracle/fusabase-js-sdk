# @fusabase/auth-core

## Introduction

> **Private, internal package — not for direct application use.**
> `@fusabase/auth-core` is published to support Fusabase SDK packages. Use
> `@fusabase/auth` for Firebase-compatible authentication or
> `@fusabase/fusabase-relational` for Supabase-compatible authentication.

This package contains shared authentication primitives used by published
Fusabase packages. Its direct API is not a supported application integration
surface and can change independently of the public Auth packages.

## Install

Applications should not install this package directly. Install a public package:

```bash
npm install @fusabase/auth
# or
npm install @fusabase/fusabase-relational
```

## Documentation

- [Authentication package README](../auth/README.md)
- [Oracle Backend for Firebase documentation](https://docs.oracle.com/en/database/oracle/backend-for-firebase/index.html)

## Example: use the supported Auth package instead

```javascript
import { getAuth, signInWithEmailAndPassword } from '@fusabase/auth';

const auth = getAuth(app);
await signInWithEmailAndPassword(auth, email, password);
```
