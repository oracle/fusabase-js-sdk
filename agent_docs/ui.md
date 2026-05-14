# UI Module

Use `fusabase/ui` when you want a browser auth UI helper instead of building a custom auth form from scratch.

## Primary Import

```ts
import { authUI } from "fusabase/ui";
```

`authUI` exposes `authUI.AuthUI`, which can be constructed with an app instance, an auth instance, or a config object.

## Common Pattern

```ts
import { EmailAuthProvider, GoogleAuthProvider } from "fusabase/auth";
import { authUI } from "fusabase/ui";

const ui = new authUI.AuthUI(app);
ui.start("#auth", {
  signInOptions: [
    EmailAuthProvider.PROVIDER_ID,
    GoogleAuthProvider.PROVIDER_ID
  ],
  signInSuccessUrl: "/app"
});
```

## Supported Sign-In Option Pattern

The current UI helper checks `signInOptions` against provider `PROVIDER_ID` values, including:

- `EmailAuthProvider.PROVIDER_ID`
- `GoogleAuthProvider.PROVIDER_ID`
- `FacebookAuthProvider.PROVIDER_ID`
- `GithubAuthProvider.PROVIDER_ID`

## Notes

- This module is browser-oriented.
- The helper renders and styles its own DOM inside the target container.
- Use `fusabase/auth` directly when you need a custom auth experience.

## Related Docs

- `agent_docs/auth.md`
