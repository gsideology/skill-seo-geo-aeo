# Testing and verification: test → fix → retest

## Baseline (phase 0, and the start of any audit)

1. **Inventory**: pages per language from the registry or the sitemap; which of `robots.txt`, `sitemap.xml`, `llms.txt`, `agents.md`, structured data, an MCP server, WebMCP tools exist.
2. **Sitemap**: `node scripts/check_sitemap.mjs https://example.com/sitemap.xml --fetch --canonical`.
3. **Crawler access and page basics**: `node scripts/check_ai_access.mjs https://example.com/ --paths .,<top pages>,<one page per language>` (add `--probe-ua` for information only).
4. **Lighthouse/PageSpeed** on the home and a typical page, mobile and desktop (performance, accessibility, best practices, SEO, Agentic Browsing).
5. **Search Console and Bing Webmaster Tools**, if verified: Pages report reasons, Core Web Vitals, Enhancements, AI Performance.
6. **The citation check** once, to have a starting point (`references/measurement.md`).
7. Write the baseline down with the date; every later change is compared with it.

## The loop

1. Write the expected behaviour down first: protocol rules, error cases, and a set of **reference searches** with the tool each must return (top 1 or in the top 3), the language picked when none is given, or "no result" / "partial". ~90 cases in 5 languages, including full sentences in each language, word-order pairs ("jpg to pdf" / "pdf to jpg"), and nonsense.
2. Run the whole suite locally; it prints only what fails and a summary per suite; exit code 1 on failure.
3. For each failure find the cause before changing anything: wrong ranking (fix the algorithm in **every** implementation), wrong expectation (change it only if the new result is better for the user, with a comment), missing translated keywords (fix the content, not the ranking), protocol bug.
4. Rerun until green. **Add a case for every bug found** so it stays fixed.
5. Deploy, then run the same suite against production; failures there that pass locally mean the deploy didn't happen or the environment differs.

A case whose expected page isn't published yet is **skipped**, not failed, so cases can be written ahead of release dates.

## Suites

| Suite | Checks |
|---|---|
| protocol | initialize (echo of a known version, newest for an unknown one), notification → 202 empty, ping, tools/list names and schemas (`additionalProperties: false`, read-only annotations), unknown method, parse error (HTTP 400), invalid request, batch, client response → 202, oversized body → 413, GET → 405 (also on the public `/mcp` URL), OPTIONS → 204 + CORS, unknown tool, non-object arguments |
| tools | argument errors (empty query, unknown language, too long, undeclared parameter) → `isError`; `get_tool` with slug, uppercase slug, localized slugs, URL with query/fragment, trailing slash → the right tool and localized URL; unknown slug / site root → `isError`; `list_tools` totals equal the index |
| search | every reference case; and the same language, `partial` flag and top 8 as the other implementation (parity), in every language locally |
| package | the same for the stdio package plus known results |
| latency | remote only: N timed calls spaced 0.5 s; median, p95, max; empty or failed responses fail, calls over 2 s warn |

`scripts/mcp_smoke_test.mjs` implements protocol, tools-style checks, golden cases from a JSON file and latency for any endpoint; extend it with parity when you have two implementations.

## Local targets

- Serve the site's public folder with the server language you deploy (e.g. `php -S 127.0.0.1:<port> -t public` for PHP) and call the script directly (no rewrite rules in the built-in server).
- **`php -S` is single-threaded**: fine for API tests, but for whole-site tests (pages + many assets + counters) use Apache/Nginx locally with the same rewrite file, or pages may hang waiting for an asset.
- Keep test data out of the repository (environment variable for the data folder).
- Antivirus HTTPS scanning can intercept traffic that looks like MCP (path `/mcp`, `MCP-Protocol-Version` header), even on localhost: the response arrives empty or "terminated". Check the certificate issuer (`openssl s_client -connect host:443 | openssl x509 -noout -issuer`); test through an alias path, without that header, or from another network. A good test runner detects this and falls back with a warning.

## Production verification after every deploy

1. **The deploy happened**: the CI run succeeded; the build ID in the live HTML equals the one in the published artifact/branch; `Last-Modified` is recent.
2. **Pages**: spot-check new pages in every language, the sitemap (`scripts/check_sitemap.mjs --fetch --canonical`), `robots.txt`, `llms.txt`, `agents.md` (served as `text/markdown`), a 404.
3. **Crawler access on the live host**: `scripts/check_ai_access.mjs` on the home, the changed pages and one page per language; the live robots.txt equals the deployed one (CDNs can inject rules); no `noindex`/`nosnippet` slipped in.
4. **Agents**: the MCP suite against the live URL; `GET /mcp` with `Accept: text/event-stream` → 405 and a plain GET → the explanation page, from outside; the Server Card and the AI Catalog (`references/discovery.md`).
5. **External agent test**: ask another assistant session (no access to the code) to read `/ai-assistants`, call the live `/mcp` with realistic requests and report what fails. In practice this found: full sentences without a language returning nothing, uppercase/localized slugs rejected, undeclared parameters accepted, occasional slow responses from the host.
6. **Lighthouse/PageSpeed** (mobile and desktop): performance, accessibility, best practices, SEO, and the Agentic Browsing audits (below).
7. **Real crawlers**: real crawler behaviour depends on the CDN/host; a spoofed Googlebot/GPTBot user agent getting 403/429 proves only anti-spoofing. Use Search Console's URL Inspection (live test) for Google, Bing's URL Inspection, and the access logs checked against the vendors' IP ranges (`references/ai-crawlers.md`).
8. **IndexNow**: the deploy pinged the changed URLs and got 200 or 202.

## Writing results down

Record in the project docs, with the date: what was tested, numbers (e.g. "234 checks passed", "median 88 ms, p95 4.8 s"), environment quirks found, and what remains for the owner (e.g. "add the connector in claude.ai and ask X").

## Lighthouse "Agentic Browsing"

Lighthouse has an Agentic Browsing category with a fractional score (checks passed), not the usual 0–100. Chrome's documentation (checked 2026-11-03) describes four groups and says testing it needs Chrome 150 or later; the WebMCP audits also need the WebMCP origin trial. Audit titles vary by version.

| Group | What it wants | How to pass |
|---|---|---|
| Agent-centric accessibility | Interactive elements with programmatic names, a valid accessibility tree (roles and parent–child relations), interactive content not hidden from it | Real buttons, links and labels; one `h1`; landmarks; no clickable `div`s |
| Stability | Low Cumulative Layout Shift | Reserved sizes for images, embeds and late content |
| Discoverability | An `llms.txt` at the domain root | `references/llms-and-agents-md.md` |
| WebMCP integration | Tools registered (declarative forms and imperative JavaScript) with valid schemas | `references/webmcp.md`; "not applicable" without WebMCP or without tools on that page |

The first write-up of this workflow (November 2026) also listed an "`ai-catalog.json` is valid" audit seen in PageSpeed; Chrome's Agentic Browsing pages don't mention it, so treat it as version-dependent and check your own report (`references/discovery.md`). Trusted Types (`require-trusted-types-for 'script'` in the CSP) appears under best practices as informative: a large refactor of every DOM sink, planned separately.

## GEO checks that belong in the loop

- Expected: the crawlers the owner chose are allowed (robots and host); key pages are indexable with a snippet; the answer-first passage and the main facts are in the server HTML; JSON-LD is valid and visible-content-only.
- Run: `check_ai_access.mjs` per release; the monthly citation check (`references/measurement.md`).
- Fix and retest: a wrong statement in an assistant's answer is a test failure. Find the source it cites, fix the page or the third-party source, rerun the question next month and record the result.
