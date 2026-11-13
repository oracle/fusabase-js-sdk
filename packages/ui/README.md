# @fusabase/ui

## Introduction

`@fusabase/ui` provides browser authentication UI helpers for Oracle Backend
with Firebase APIs (Fusabase). It renders configurable sign-in experiences that
use an existing Fusabase application or Auth instance.

## Install

```bash
npm install @fusabase/app @fusabase/auth @fusabase/ui
```

## Quick start

```javascript
import { authUI } from '@fusabase/ui';

new authUI.AuthUI(app).start('#auth-root', { signInOptions: ['password'] });
```

## Documentation

- [Oracle Backend for Firebase documentation](https://docs.oracle.com/en/database/oracle/backend-for-firebase/index.html)

## Before you begin

Initialize the application and configure the authentication providers you want
to offer before mounting the UI into a browser DOM element.

## Examples

### Configure a sign-in screen

```javascript
import { EmailAuthProvider, GoogleAuthProvider } from '@fusabase/auth';
import { authUI } from '@fusabase/ui';

const ui = new authUI.AuthUI(app);
ui.start('#auth-root', {
  signInOptions: [
    EmailAuthProvider.PROVIDER_ID,
    GoogleAuthProvider.PROVIDER_ID
  ],
  signInSuccessUrl: '/home'
});
```

### Handle successful sign-in without redirecting

```javascript
ui.start('#auth-root', {
  signInOptions: [EmailAuthProvider.PROVIDER_ID],
  callbacks: {
    signInSuccessWithAuthResult: (result) => {
      console.log(`Signed in as ${result.user.uid}`);
      return false;
    }
  }
});
```
