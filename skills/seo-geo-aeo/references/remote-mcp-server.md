# Remote MCP server (`/mcp`)

A small, stateless MCP server that people add to Claude, ChatGPT or other MCP clients as a custom connector. It searches the site's catalog and returns names, descriptions and links in the user's language. The tools themselves still run in the browser, so the server never sees files. A ready PHP implementation is in `templates/mcp-server.php` (no dependencies, PHP ≥ 8.1; works on shared hosting).

## Protocol checklist (Streamable HTTP, JSON responses, handshake-based revisions)

- `POST /mcp` with one JSON-RPC message (or a batch array for older clients); reply `Content-Type: application/json`.
- `initialize`: reply `protocolVersion` = the client's if supported (e.g. `2025-11-25`, `2025-06-18`, `2025-03-26`, `2024-11-05`; see "Protocol versions" below for 2026-07-28), else your newest; `capabilities: { tools: { listChanged: false } }`; `serverInfo { name, title, version }`; `instructions` telling the model what the server is for ("pick a tool, give the user the link; this server never receives files").
- Notifications and client responses (no `id`): HTTP 202, empty body.
- `ping` → `{}`; `tools/list` → tools with `name`, `title`, `description`, `inputSchema` (`additionalProperties: false`), `annotations` (`readOnlyHint`, `idempotentHint`, `openWorldHint: false`).
- `tools/call`: result `{ content: [{ type: "text", text: JSON }], structuredContent: {...} }`. Bad arguments → **result with `isError: true`** and a readable message (the model can fix its call). Unknown tool or non-object arguments → JSON-RPC `-32602`. Unknown method → `-32601`. Invalid JSON → HTTP 400 with `-32700`. Invalid request → `-32600`.
- Reject parameters the schema doesn't declare (`isError`), since the schema says `additionalProperties: false`.
- `GET` with `Accept: text/event-stream` → 405 with `Allow: POST, OPTIONS` (no SSE stream needed); any other `GET` → 200 explanation page (`references/discovery.md`). `OPTIONS` → 204 with `Access-Control-Allow-Origin: *` and the MCP headers (no cookies or credentials are involved).
- Limits: body size (64 KB), batch length, query length.
- `Cache-Control: no-store`, `X-Robots-Tag: noindex`.
- Stateless: no session id; nothing to clean up.
- Rewrite `/mcp` to the script (Apache: `RewriteRule ^mcp$ /a/mcp.php [L]`), placed before generic rewrites.

## Make it self-explanatory and discoverable

A plain `GET` (browser, web-fetch tool) gets a 200 explanation page, not a bare 405; the homepage, `llms.txt` and `agents.md` say the server exists and what it receives; an MCP Server Card and `/.well-known/ai-catalog.json` allow discovery before connecting; registries are the owner's decision. All of it, with the formats and the checks: `references/discovery.md`.

## Protocol versions (re-verify before release)

- The template answers `initialize` with the client's version if it is one of `2025-11-25`, `2025-06-18`, `2025-03-26`, `2024-11-05`, else its newest. These are the handshake-based ("legacy") revisions.
- MCP revision **2026-07-28** (checked 2026-11-03) makes the protocol stateless: no `initialize` handshake and no sessions, the protocol version and client capabilities travel in each request's `_meta`, servers must implement `server/discover`, results carry a required `resultType`, `ping` is removed, and Streamable HTTP POSTs carry `Mcp-Method`/`Mcp-Name` headers. Its backward-compatibility section says a dual-era client falls back to `initialize` when a modern request gets a 4xx without a recognized modern error body, and that a modern-only client cannot use a legacy server.
- So: keep `supportedProtocolVersions` in the Server Card equal to what the server really implements, test with the clients people actually use (claude.ai custom connector, ChatGPT, Claude Code) after each of their releases, and before claiming 2026-07-28 implement and test `server/discover`, per-request `_meta`, `resultType` and the header rules (a "dual-era" server keeps answering `initialize` for older clients).
- Tested on 2026-11-03 with the fixtures of this repository: the template answers a 2026-07-28-style `server/discover` with HTTP 200 and JSON-RPC `-32601` (method not found), and answers `tools/list` and `tools/call` carrying 2026-07-28 `_meta` with ordinary results without `resultType` (which that revision tells clients to treat as complete). How a given client reacts to the `-32601` is up to the client: test it.
- The production server this template was extracted from answered a claude.ai custom connector in November 2026; that is a dated observation, not a guarantee for later client versions.

## Catalog tools

| Tool | Parameters | Returns |
|---|---|---|
| `find_tools` | `query` (string, required), `language` (enum, optional) | up to 8 tools, best first: slug, name, description, category, absolute URL, in-page agent tools; `language` chosen; `partial: true` + hint when no tool matches well; a hint when nothing matches |
| `list_tools` | `category` (enum, optional), `language` | every tool (or one category) with slug, name, category, URL |
| `get_tool` | `slug` (string, required), `language` | one tool with its URL in every language and its in-page agent tools |

The server reads the same generated index as the pages (`/agent/tools.<lang>.json`) and a small `site.json` (name, URL, count, categories), so it lists only published tools.

## Search that works for agents

The first version failed in practice on exactly what agents send. The ranking that works:

1. Lowercase; split on whitespace, commas, semicolons, slashes **and apostrophes** ("l'arrière-plan").
2. Drop words that don't identify a tool, in every supported language: articles and prepositions, and request words ("find", "tool", "need", "want", "how", "please"; "trova", "strumento", "voglio"; "necesito", "herramienta"; "je veux", "outil"; "ich", "möchte", "Werkzeug"…). Check that none of them appears in tool names in a meaningful way (e.g. keep "ai").
3. For each word, score name match (3) + keyword match (2) + description match (1), weighted by IDF (rare words count more). Match at word starts.
4. Keep tools that match every word or at least two; if none, keep tools matching at least one word and return `partial: true` with a hint ("these share only some words; check that one fits") — a sentence never comes back empty because of one word.
5. Sort by matched words, then by **phrase**: 2 if the name or a keyword equals the query as written, 1 if it contains it, else 0 ("jpg to pdf" must give Image to PDF, not PDF to JPG), then by score.
6. Without `language`: search every language's index and keep the one with full matches first, then more matched words. **Do not compare scores across languages** (IDF differs per index). Ties go to the default language. Return the language chosen.
7. Localized indexes include the default-language keywords too, since agents often search in English.

## Resolving a tool the agent names

Accept the slug in any case, a localized slug (`unire-pdf`) or a page URL (with query, fragment, trailing slash): lowercase, strip `?…`/`#…` and trailing slashes, take the last path segment, then match the slug or the last segment of any language's URL. Default-language slugs win.

## Two implementations, one behaviour

If the pages (TypeScript) and the server (PHP) both search, port the algorithm line by line, keep the stop-word lists identical, and add a parity test that runs every reference query through both and compares language, `partial` and the first 8 results. Comment each side with "keep in sync with …".

## Privacy and counting

- Never store or log queries or slugs; they travel in the POST body, so access logs don't contain them.
- If you measure usage, count in daily totals: calls per method/tool, language chosen, result kind (results/partial/none), client name from `initialize` (`clientInfo.name`). Count after replying; a counting failure must never break a reply.
- State both in the privacy policy (see `references/llms-and-agents-md.md`).

## After deploy

- `curl -X POST https://example.com/mcp -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`
- `node scripts/mcp_smoke_test.mjs https://example.com/mcp --cases cases.json --repeat 20`
- Add it as a custom connector in an assistant and ask a natural sentence in a non-default language. Better: let another assistant session test it from outside and report.
- Occasional slow or failed calls on shared hosting are the host, not the code: measure the median and p95, and look at the access logs.
