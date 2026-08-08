# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product goal

IPAutoFill is an IP-optimized proxy-node generator with a plain static HTML/CSS/JavaScript frontend. The required user flow is:

1. Paste one original proxy node.
2. Select `HZCT` or `HZCM`.
3. The backend reads the IP values for that selection from local `config.json`.
4. The backend creates three copies of the node, replacing only each copy's connection address with the corresponding configured IP.
5. Set the three node names to exactly `-1`, `-2`, and `-3` and return the three complete node links for direct copying.

The frontend is static, but configuration loading and node conversion are backend responsibilities. Do not expose `config.json` as a browser asset.

## Current repository state

The repository is incomplete. It currently contains:

- `app.js`: browser-side form handling, a `POST /api/generate` request, result rendering, copy controls, and QR-code controls.
- `ip.json`: an empty placeholder.

There is currently no HTML entry page, backend implementation, `config.json`, `package.json`, README, test suite, linter configuration, or dependency lockfile. The requested configuration source is `config.json`; do not silently use the empty `ip.json` in its place.

## Commands

No build, lint, test, single-test, or application-start command is currently defined. Do not assume npm commands. When tooling is added, document commands here from the actual project configuration, including the command for running one test file.

## Architecture and migration target

`app.js` is only the existing browser controller; it does not parse or modify nodes. It currently expects fixed DOM element IDs, submits to `/api/generate`, renders subscription URLs and a preview table, escapes preview values with `escapeHtml()`, and provides copy and QR-code interactions.

Its current request body is:

```json
{
  "nodeLinks": "...",
  "preferredIps": "...",
  "namePrefix": "...",
  "keepOriginalHost": true
}
```

This is a legacy contract that does not match the required product flow. Replace the free-form preferred-IP and name-prefix inputs with an `HZCT`/`HZCM` selector. Change the request to send the original node and selected key. Update the static HTML, `app.js`, and `/api/generate` response contract together so the result is three directly copyable node links rather than the current auto/raw/Clash/Surge subscription URL set.

The backend should keep these responsibilities separate: validate the selected key, load and validate `config.json`, parse the source node into structured fields, create three copies, change the connection address and name in each copy, and serialize all three back to the source protocol's link format.

Before implementing configuration parsing, inspect the real `config.json` format once that file exists. Do not invent its schema. The implementation must establish a deterministic mapping from the three IP values selected for `HZCT` or `HZCM` to names `-1`, `-2`, and `-3`.

## Node conversion constraints

The connection address is the field to replace. Other node fields must remain unchanged unless a protocol requires an encoding-only normalization during parse/serialize. In particular, do not confuse the network connection address with transport Host or TLS SNI fields.

Protocol-specific parsing and serialization must be paired: decode the original link, edit structured data, then encode a valid link of the same protocol. Do not perform blind string replacement on an encoded node URL.

## Frontend constraints

Keep the frontend framework-free and usable as plain static HTML/CSS/JavaScript. If the missing HTML is added, either provide every DOM ID referenced by `app.js` or update the selectors and event handlers in the same change. Preserve HTML escaping for backend-derived preview values.

`app.js` currently expects a global `window.QRCode` implementation. Retain it only if QR display remains part of the revised three-node output interface.

## Verification

After implementation, verify decoded output fields. One valid source node and either selector must produce exactly three valid links; their names must be exactly `-1`, `-2`, and `-3`; their connection addresses must match the three backend-selected IP values in deterministic order; and all unrelated node fields must match the source. Also verify explicit failures for malformed nodes, an unsupported selector, missing or invalid `config.json`, and insufficient valid IP values.
