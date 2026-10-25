# Nahhasio API contract

`openapi.json` is the single versioned network-contract source. The generated TypeScript
schemas/client live in `src/generated.ts`; never edit that file by hand.

```sh
devenv shell -- pnpm --filter @nahhasio/api-contract generate
```

Native Rust owns bounded HTTP transport and session secrets. Desktop UI validates native
replies using generated schemas and feature-owned boundary schemas. No private local-admin
credential belongs in the client. The server enforces current account/admin access per operation.

## Contract rules

- Use parsed, typed input/output; update OpenAPI and its generator together for new model shapes.
- Current generator supports objects, refs, arrays, unions, nullable values, records and JSON.
- Keep stable catalog IDs, bounded pagination, deterministic sorting and cancellation.
- Separate viewer data, private editorial/admin fields, file identity and actual playback access.
- Asset URLs/IDs do not expose server filesystem paths; fetch registered artwork with native auth.
- Release-date state and registered-file availability are independent of watched/completed state.
- `hasMediaFile` is a recorded mapping, not proof that a file exists or is currently playable.
- Work/part/episode ancestry and account ownership remain server-enforced.
- Viewing progress, manually watched state and offline/job state are distinct records.
- Full-document editor operations use authenticated Rust services shared with the local operator
  CLI; no private Node worker is installed.

Detailed current models and endpoints are in OpenAPI/source rather than repeated field tables.
Read [PROJECT](../../docs/PROJECT.md), [DEVELOPMENT](../../docs/DEVELOPMENT.md) and
[TESTING](../../docs/TESTING.md) for product scope, transport and acceptance limits.
