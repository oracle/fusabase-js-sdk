# API Reference

Use the generated API reference when you need a fuller view of the public SDK surface.

## Generate the Docs

From the SDK root:

```bash
npm run docs
```

That runs TypeDoc and writes output to:

```text
docs/api-reference/
```

## Notes

- The docs directory might not exist until you run `npm run docs`.
- The current `typedoc.json` entry points cover `app`, `auth`, `oracledb`, `storage`, and `ui`.
- `app-trust` is part of the current public package surface, but it is not currently listed in `typedoc.json`. Until that entry point is added, inspect `packages/app-trust/src/index.ts` directly for the public exports.

## Useful Local Source Anchors

- `packages/app/src/index.ts`
- `packages/auth/src/index.ts`
- `packages/oracledb/src/index.ts`
- `packages/storage/src/index.ts`
- `packages/ui/src/index.ts`
- `packages/app-trust/src/index.ts`
