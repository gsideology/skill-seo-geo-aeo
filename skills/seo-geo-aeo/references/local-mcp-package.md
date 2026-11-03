# Optional: a local MCP package (stdio)

For people using local MCP clients (Claude Desktop, Claude Code, IDEs): a small npm package that runs the site's **pure** tools (text, data, calculators, generators) on the user's computer, plus the catalog search. Nothing is uploaded; only what the user types reaches their assistant's provider, as with any tool.

## Shape

- `packages/mcp/src/protocol.ts`: JSON-RPC over newline-delimited stdin/stdout (one message per line, logs only on stderr). Same protocol rules as the remote server (version negotiation, notifications ignored, `-32601`, `-32700` for a malformed line, `-32602` for unknown tools, `isError` for bad arguments, reject undeclared parameters). Include `structuredContent` only for protocol versions that have it (2025-06-18+).
- `src/tools.ts`: imports the same tool modules the pages use (no duplicated logic) and rewrites browser wording at registration ("Runs locally in this browser tab" → "Runs locally on this computer"). Expose only tools whose page is published (check the bundled index).
- `src/catalog.ts`: `find_tools` and `get_tool` over the bundled index, same search as the site; `get_tool` returns `languages` like the remote server.
- `src/server.ts`: the stdio loop; `--list-tools` and `--version` flags; exit when stdin closes.
- Shims for browser-only modules, swapped in at bundle time: e.g. a Web Worker with a timeout → `worker_threads`; DOM-based generators → `@xmldom/xmldom`. Leave out tools that truly need a browser DOM and list them in the README with the reason.

## Build

- Bundle with esbuild (`platform: node`, `format: esm`, `target: node20`, shebang banner, `mainFields: ["module", "main"]` if a UMD `main` breaks the bundle).
- Generate `THIRD_PARTY_NOTICES.txt` from the esbuild metafile (each bundled package: name, version, license text) and fail the build on licenses you can't redistribute.
- Fail the build if a description still mentions a browser tab or page.
- Regenerate the README tool table from `--list-tools`.

## README

What it is; that everything runs locally; config for Claude Desktop (`claude_desktop_config.json`: `"command": "npx", "args": ["-y", "<package>"]`) and Claude Code (`claude mcp add <name> -- npx -y <package>`); running from a checkout (`node dist/server.mjs`); the tool table; excluded tools.

## Before publishing

Publishing on npm makes the bundled code public: choose a license deliberately (the site's repository may be private). Declare build-time tools you rely on (esbuild) instead of using transitive copies.

## Tests

End-to-end over stdio: initialize and version negotiation, tools/list (count, no browser wording), a malformed line, unknown method/tool, known results (e.g. SHA-256 of "abc", a loan payment, sorted JSON), a regex that backtracks catastrophically (stopped by the timeout, next call still works), catalog searches with expected results, nothing but replies on stdout, exit on stdin close.
