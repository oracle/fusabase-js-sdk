<p align="center">
  <img src="assets/fusabase-color.svg" alt="Fusabase logo" width="180" />
</p>

# Fusabase JavaScript SDK

Fusabase is a modular JavaScript SDK for Oracle Backend with Firebase APIs. It
provides Firebase-compatible application initialization, authentication,
document data, storage, App Trust, and browser UI APIs. The SDK also includes
Oracle Backend with Supabase APIs (Fusabase), a Supabase-compatible relational
client for data, authentication, storage, App Trust, and offline data.

Firebase and Supabase are trademarks of their respective owners. Fusabase is an
Oracle offering and is not affiliated with or endorsed by Firebase or Supabase.

## Install a package

Install only the packages your application needs. Scoped packages are the
recommended modular imports.

### Oracle Backend with Firebase APIs (Fusabase)

| Package | Purpose | Install |
| --- | --- | --- |
| `@fusabase/app` | App initialization and lifecycle | `npm install @fusabase/app` |
| `@fusabase/auth` | Authentication and multi-factor authentication | `npm install @fusabase/auth` |
| `@fusabase/oracledb` | Collection and document data APIs | `npm install @fusabase/oracledb` |
| `@fusabase/storage` | Object storage APIs | `npm install @fusabase/storage` |
| `@fusabase/app-trust` | Browser attestation APIs | `npm install @fusabase/app-trust` |
| `@fusabase/ui` | Browser authentication UI helpers | `npm install @fusabase/ui` |
| `@fusabase/fusabase-collections` | Convenience package with Firebase-compatible subpaths | `npm install @fusabase/fusabase-collections` |

### Oracle Backend with Supabase APIs (Fusabase)

| Package | Purpose | Install |
| --- | --- | --- |
| `@fusabase/fusabase-relational` | Recommended relational client | `npm install @fusabase/fusabase-relational` |
| `@fusabase/relational` | Relational client compatibility entry point | `npm install @fusabase/relational` |

The unscoped `fusabase` package provides the full SDK. Use its `fusabase/...`
subpaths when a single full-SDK dependency is preferred.

### Internal shared packages

`@fusabase/auth-core` and `@fusabase/logger` are published to support Fusabase
SDK packages. They are private, internal packages and are **not intended for
direct application use**. Use the public packages above instead.

## Documentation

- [Oracle Backend for Firebase documentation](https://docs.oracle.com/en/database/oracle/backend-for-firebase/index.html)

## Live Labs

- [Oracle Backend for Firebase workshop](https://livelabs.oracle.com/ords/r/dbpm/livelabs/view-workshop?wid=4404)

## Package READMEs

### Oracle Backend with Firebase APIs (Fusabase)

- [App](./packages/app/README.md)
- [Authentication](./packages/auth/README.md)
- [OracleDB](./packages/oracledb/README.md)
- [Storage](./packages/storage/README.md)
- [App Trust](./packages/app-trust/README.md)
- [UI](./packages/ui/README.md)
- [Collections convenience package](./packages/fusabase-collections/README.md)

### Oracle Backend with Supabase APIs (Fusabase)

- [Relational compatibility package](./packages/relational/README.md)
- [Relational convenience package](./packages/fusabase-relational/README.md)

### Internal shared packages

- [Authentication core — internal only](./packages/auth-core/README.md)
- [Logger — internal only](./packages/logger/README.md)

## Contributing and security

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidance and
[SECURITY.md](./SECURITY.md) for security reporting.

## License

Copyright (c) 2015, 2026, Oracle and/or its affiliates.

This software is dual-licensed under the [Universal Permissive License 1.0](https://oss.oracle.com/licenses/upl)
and the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).
