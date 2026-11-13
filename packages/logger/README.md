# @fusabase/logger

## Introduction

> **Private, internal package — not for direct application use.**
> `@fusabase/logger` is published to support Fusabase SDK packages. Public
> packages expose the logging controls applications need.

`@fusabase/logger` provides the shared logging level enum used across the SDK.
Use `setLogLevel` from `@fusabase/app` instead of depending on this package
directly.

## Install

Applications should not install this package directly:

```bash
npm install @fusabase/app
```

## Documentation

- [App package README](../app/README.md)
- [Oracle Backend for Firebase documentation](https://docs.oracle.com/en/database/oracle/backend-for-firebase/index.html)

## Example: use the supported App package instead

```javascript
import { LogLevel, setLogLevel } from '@fusabase/app';

setLogLevel(LogLevel.WARN);
```
