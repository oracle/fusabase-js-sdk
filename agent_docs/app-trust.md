# App Trust Module

Use `fusabase/app-trust` to initialize browser app-trust protection and retrieve trust tokens for protected backend access.

## Primary Imports

```ts
import {
  HCaptchaProvider,
  ReCaptchaEnterpriseProvider,
  ReCaptchaV3Provider,
  TurnstileProvider,
  getToken,
  initializeAppTrust,
  onTokenChanged
} from "fusabase/app-trust";
```

## Common Pattern

```ts
import {
  ReCaptchaV3Provider,
  getToken,
  initializeAppTrust
} from "fusabase/app-trust";

const appTrust = initializeAppTrust(app, {
  provider: new ReCaptchaV3Provider("site-key")
});

const tokenResult = await getToken(appTrust);
console.log(tokenResult.token);
```

## Token Listener

```ts
import { onTokenChanged } from "fusabase/app-trust";

const unsubscribe = onTokenChanged(appTrust, {
  next: (tokenResult) => {
    console.log(tokenResult.expireTimeMillis);
  }
});
```

## Providers

- `ReCaptchaV3Provider`
- `ReCaptchaEnterpriseProvider`
- `TurnstileProvider`
- `HCaptchaProvider`

## Notes

- These providers are browser-oriented and load external attestation scripts.
- Initialize app trust once per app and reuse the instance where possible.
- Use this module only through `fusabase/app-trust`.

## Related Docs

- `agent_docs/app.md`
