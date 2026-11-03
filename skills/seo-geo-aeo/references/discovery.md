# Discovery: making agents find the MCP server and the agent channels

An assistant that reads the site but has no connector yet must be able to learn, from the site alone, that an MCP server exists, where it is, what it does and what it receives. Learned the hard way: an assistant concluded "there is no MCP server here" because the homepage didn't mention it, `llms.txt` had it at the bottom and `GET /mcp` answered a bare 405 that looked like a broken link. It also assumed the server would receive the user's files. Fix all of the following.

## 1. Plain GET → an explanation page

If a GET does not ask for `text/event-stream` (browsers, web-fetch tools), answer 200 with a short page: what the address is, how to connect it per client (no sign-in), the tools, what it receives ("never files"), links to the human page, `agents.md`, `llms.txt`, the Server Card and the catalog. HTML when `Accept` has `text/html`, Markdown otherwise; `Link` headers to `agents.md` (`rel="describedby"`) and the catalog (`rel="ai-catalog"`). MCP clients that open a GET stream send `Accept: text/event-stream` and still get 405, as the 2025 transport allows. Implemented in `templates/mcp-server.php` (`mcp_describe`).

## 2. Say it on the homepage

Near the top, one short block "Use it from your AI assistant": the URL, what it does and doesn't receive, links to the how-to page and `agents.md`. Models reading a site start from the home.

## 3. Quick start first in llms.txt and agents.md

Three steps right after the summary, before any long list (`references/llms-and-agents-md.md`).

## 4. Pre-connection discovery files (young specs: reread before shipping)

### MCP Server Card

Status (checked 2026-11-03): SEP-2127 "MCP Server Cards" is Final on the extensions track; the format lives in the [`ext-server-card`](https://github.com/modelcontextprotocol/ext-server-card) repository (renamed from `experimental-ext-server-card`; its README still calls it experimental), where `schema.ts` is the source of truth and `docs/discovery.md` the discovery rules. Example: `templates/server-card.example.json`.

- Location: `<streamable-http-url>/server-card` is the recommended location (e.g. `https://example.com/mcp/server-card`); any unreserved URI works if the catalog points to it.
- `Content-Type: application/mcp-server-card+json`.
- Fields: `$schema` = `https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json`; `name` in `namespace/name` form, reverse DNS recommended (`com.example/tools`, ≤ 200 chars); `version` (≤ 255); `description` (≤ 100 chars); optional `title` (≤ 100), `websiteUrl`, `repository`, `icons`, `remotes: [{ "type": "streamable-http", "url": "...", "supportedProtocolVersions": [...] }]`, `_meta`.
- No tools, resources or prompts in the card: they vary per user and session and come from `tools/list`. Never put credentials or user-specific data in it.
- Serve with `Access-Control-Allow-Origin: *` (public, read-only), `Access-Control-Expose-Headers: ETag`, `Cache-Control: public, max-age=3600`, an `ETag`, and answer `If-None-Match` with 304.

### AI Catalog (`/.well-known/ai-catalog.json`)

Status (checked 2026-11-03): the [AI Catalog specification](https://github.com/Agent-Card/ai-catalog) (Linux Foundation AI Catalog working group) defines a typed catalog of AI artifacts (MCP Server Cards, A2A agent cards, skills, plugins, nested catalogs) at `/.well-known/ai-catalog.json` with the `ai-catalog` link relation; the MCP Server Card discovery doc uses the same path. Google's [Agentic Resource Discovery](https://agenticresourcediscovery.org/) (ARD, announced 2026-06-17, Apache 2.0, [spec](https://github.com/ards-project/ard-spec) v0.91 with status "Proposal") builds on the AI Catalog data model, adds registries that index entries, and in v0.91 names `/.well-known/ard.json` and `rel="ard"` as its path and link relation, treating the `ai-catalog` ones as the predecessor that consumers may still read. The two specs are moving; reread both before shipping. Example: `templates/ai-catalog.example.json`.

- `Content-Type: application/ai-catalog+json`.
- Required: `specVersion` and `entries`; each entry has `identifier` (`urn:air:<domain>:<namespace>:<name>`, e.g. `urn:air:example.com:mcp:tools`), `type` (`application/mcp-server-card+json` for a Server Card) and exactly one of `url` or inline `data`.
- Optional: a `host` object (`displayName` required inside it; `identifier`, `documentationUrl`, `logoUrl` optional); per entry `description`, `tags`, `version`, `updatedAt`. Omit the entry's `displayName` for a Server Card: the card carries its own `title`, and a duplicate can drift.
- For ARD registries, add `representativeQueries` to the entry (ARD: 2–5 natural-language requests the resource serves; without it the entry can't be found by ARD search). ARD's manifest is a JSON document with an `entries` array, so the same document can also be served at `/.well-known/ard.json` with `<link rel="ard">`; confirm against the current ARD spec.
- Link the catalog from every page: `<link rel="ai-catalog" href="/.well-known/ai-catalog.json">` and the HTTP `Link: <…>; rel="ai-catalog"` header.
- Generate the card and the catalog at build time from the registry, so they never disagree with the server.
- Earlier versions of this guidance used `mediaType` on entries; it isn't in the AI Catalog specification checked on 2026-11-03, and neither is a `url` member inside `host`. Drop both.

`scripts/mcp_smoke_test.mjs` warns when the catalog or the card is missing or doesn't list the server.

## 5. Registries and directories (the owner's decision, outward-facing)

- The official MCP Registry: a `server.json` with a `remotes` entry, namespace verified by DNS TXT or an HTTP well-known file, published with `mcp-publisher`.
- The assistant vendors' connector directories: submission forms that ask for a privacy policy and a support contact.

Publishing makes the server public in new places: decide it with the owner and record the date.

## Checks

- `curl -s https://example.com/mcp` (no `Accept: text/event-stream`) → 200 explanation page; with `-H "Accept: text/event-stream"` → 405.
- `curl -sI https://example.com/mcp/server-card` → 200, `application/mcp-server-card+json`, `ETag`, CORS.
- `curl -s https://example.com/.well-known/ai-catalog.json` → valid JSON listing the card; the card's `remotes[].url` is the live endpoint.
- An assistant without the connector, asked "does this site have an MCP server and how do I use it?", answers correctly from the site alone.
