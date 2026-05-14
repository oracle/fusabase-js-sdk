# Configuration

Use the Oracle Backend for Firebase console-generated application config when calling `initializeApp(...)`. The public config object uses **snake_case** keys — they are passed through verbatim from the JSON the console emits.

## Canonical Shape

Required keys (emitted by the console):

- `ords_host`
- `schema`
- `app_name`
- `app_type`
- `app_id`
- `project_id`
- `objs_type`
- `storage_bucket`
- `auth_type`
- `auth_id`

Optional keys read by the SDK:

- `idcs_config`
- `use_socket`
- `long_polling_interval`
- `upload_chunk_size`
- `max_upload_bytes`
- `version`

Typical app setup:

```ts
import { initializeApp } from "fusabase/app";

const fusabaseConfig = {
  schema: "testuser",
  app_name: "RecipeShare",
  app_type: "WEB",
  app_id: "51B5903721B0DA8CE0630401590AEC31",
  objs_type: "dbfs",
  project_id: "51B56660341BD922E0630401590A2E1F",
  storage_bucket: "dbfs_SKRDUZBGZAGUBCF",
  auth_type: "base",
  auth_id: "51B56660341FD922E0630401590A2E1F",
  ords_host: "http://localhost:8080/ords/testuser/"
};

const app = initializeApp(fusabaseConfig);
```

`auth_type` values: `base`, `ldap_s`, `base_s`, `idcs`.

## Notes

- Treat the console-provided JSON as the source of truth — pass it to `initializeApp` unchanged.
- Internally the SDK converts these into a camelCase `FusabaseOptions` object on `app.options` (e.g. `app.options.ordsHost`). Application code that **reads** options sees the camelCase form; code that **passes** config in must use snake_case.
- `idcs_config` is available for IDCS-specific settings.
- Named apps are supported through the optional second parameter to `initializeApp(config, name)`.

## Related Docs

- `agent_docs/app.md`
- `agent_docs/auth.md`
