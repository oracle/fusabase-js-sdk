# App Module

Use `fusabase/app` to initialize SDK instances and manage app lifecycle.

## Primary Imports

```ts
import {
  deleteApp,
  getApp,
  getApps,
  initializeApp,
  setLogLevel
} from "fusabase/app";
```

## What This Module Owns

- Creating the default app or named apps.
- Looking up existing app instances.
- Deleting app instances.
- Setting SDK-wide log level for initialized apps.

## Common Pattern

```ts
import { getApp, getApps, initializeApp } from "fusabase/app";

export function ensureApp(config: Parameters<typeof initializeApp>[0]) {
  return getApps().length ? getApp() : initializeApp(config);
}
```

## Named Apps

```ts
import { getApp, initializeApp } from "fusabase/app";

const reportingApp = initializeApp(reportingConfig, "reporting");
const sameApp = getApp("reporting");
```

## Related Docs

- `agent_docs/configuration.md`
- `agent_docs/auth.md`
- `agent_docs/oracledb.md`
- `agent_docs/storage.md`
- `agent_docs/app-trust.md`
