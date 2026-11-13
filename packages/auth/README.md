# @fusabase/auth

## Introduction

`@fusabase/auth` provides Firebase-compatible authentication APIs for Oracle
Backend with Firebase APIs (Fusabase), including email/password, federation,
redirect and popup flows, account management, persistence, and MFA.

## Install

```bash
npm install @fusabase/app @fusabase/auth
```

## Quick start

```javascript
import { getAuth, signInWithEmailAndPassword } from '@fusabase/auth';

const auth = getAuth(app);
await signInWithEmailAndPassword(auth, 'person@example.com', 'password');
```

## Documentation

- [Oracle Backend for Firebase documentation](https://docs.oracle.com/en/database/oracle/backend-for-firebase/index.html)

## Before you begin

Initialize an application with `@fusabase/app`, then pass that application to
`getAuth`. Choose the provider and persistence settings required by your app.

## Examples

### Observe and sign in a user

```javascript
import { initializeApp } from '@fusabase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from '@fusabase/auth';

const auth = getAuth(initializeApp(config));
onAuthStateChanged(auth, (user) => console.log(user?.email ?? 'signed out'));

await signInWithEmailAndPassword(auth, 'person@example.com', 'password');
await signOut(auth);
```

### Sign in with Google

```javascript
import { GoogleAuthProvider, signInWithPopup } from '@fusabase/auth';

const result = await signInWithPopup(auth, new GoogleAuthProvider());
console.log(result.user.uid);
```

### Enroll a TOTP factor

```javascript
import {
  browserLocalPersistence,
  multiFactor,
  setPersistence,
  TotpMultiFactorGenerator
} from '@fusabase/auth';

await setPersistence(auth, browserLocalPersistence);
const session = await multiFactor(auth.currentUser).getSession();
const secret = await TotpMultiFactorGenerator.generateSecret(session);
const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, verificationCode);
await multiFactor(auth.currentUser).enroll(assertion, 'Authenticator app');
```
