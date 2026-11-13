# @fusabase/app-trust

## Introduction

`@fusabase/app-trust` adds browser attestation to an Oracle Backend with
Firebase APIs (Fusabase) application. Configure one supported provider during
application startup.

## Install

```bash
npm install @fusabase/app @fusabase/app-trust
```

## Quick start

```javascript
import { initializeAppTrust, ReCaptchaV3Provider } from '@fusabase/app-trust';

const appTrust = initializeAppTrust(app, {
  provider: new ReCaptchaV3Provider('your-site-key')
});
```

## Documentation

- [Oracle Backend for Firebase documentation](https://docs.oracle.com/en/database/oracle/backend-for-firebase/index.html)

## Before you begin

Create the Fusabase app first and register the site key with the attestation
provider you select.

## Examples

### Initialize and retrieve a token

```javascript
import { initializeApp } from '@fusabase/app';
import { getToken, initializeAppTrust, ReCaptchaV3Provider } from '@fusabase/app-trust';

const app = initializeApp(config);
const appTrust = initializeAppTrust(app, {
  provider: new ReCaptchaV3Provider('your-site-key')
});

const { token } = await getToken(appTrust, true);
```

### Observe token changes

```javascript
import { onTokenChanged } from '@fusabase/app-trust';

const unsubscribe = onTokenChanged(appTrust, (result) => {
  console.log(`App Trust token expires at ${result.expireTimeMillis}`);
});

// Call unsubscribe() when the listener is no longer needed.
```
