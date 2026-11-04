---
name: seo-geo-aeo
description: Make a website findable, citable and usable by search engines, AI answer engines and AI agents, and prove it with tests. Use for SEO audits and fixes (canonical URLs, sitemaps, hreflang, robots.txt, structured data and JSON-LD, titles, Core Web Vitals, 404s), GEO and AEO (generative and answer engine optimization, AI search, getting cited by ChatGPT, Perplexity, Gemini, Claude or Copilot, answer-first content, entities and sameAs, AI referral tracking, citation checks), AI crawler access (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, Claude-SearchBot, PerplexityBot, Google-Extended, CDN or WAF blocks), llms.txt and agents.md, Google Search Console, Bing Webmaster Tools and IndexNow, in-page agent tools (WebMCP), a remote MCP server for a website, and MCP Server Card or ai-catalog.json discovery. Includes a test, fix and retest loop, production verification, and dependency-free Node scripts that check sitemaps, AI crawler access and MCP endpoints.
---

# SEO, GEO, AEO and agentic navigation

A website has four kinds of visitors: people, search engines, answer engines (AI assistants and AI search features that retrieve pages, quote them and cite them) and agents (browser agents that act in the page, MCP clients that call tools). This skill makes a site work for all four and proves each step with a test, locally and in production.

GEO (generative engine optimization) and AEO (answer engine optimization) are not a separate trick. Google states that optimizing for its generative AI features is still SEO; the other assistants run their own crawlers and indexes, or rely on search providers. So the work is: be crawlable and indexable by every engine that matters, write pages that answer clearly with checkable facts, make entities unambiguous, expose the site to agents, then measure and recheck.

## Principles

1. **Every claim is sourced or tested.** A fact on a page (number, limit, price, compatibility, "how to connect" step) comes from the code, a measurement with a date and test files, or an official source linked with the date checked. Never invent statistics, quotes, benchmarks or reviews. The same rule applies to this skill's own advice: vendor behaviour is cited in `references/sources.md` with dates.
2. **One source of truth.** Pages, sitemap, `llms.txt`, `agents.md`, structured data, the agent tool index and the MCP server all read the same registry (a data file listing every page with slug, names, descriptions, keywords, languages, dates). Generate them at build time; never hand-maintain parallel lists.
3. **Test, fix, retest.** Write the expected result first, run the check, find the cause of each failure before changing anything, fix it everywhere it lives, rerun until green, and add a check for every bug found.
4. **Verify in production, from outside.** Local tests are necessary but not sufficient: confirm the deploy happened, crawl the live sitemap, check AI crawler access on the live host (CDN rules differ from local), run the MCP suite against the live URL, and ask an external agent to use the site.
5. **Agents get links, not files.** Remote channels (MCP server, assistants) receive only search words and return names and links; user files stay in the browser. Count usage, never store queries.
6. **Same behaviour everywhere.** If the same logic exists twice (search in TypeScript for the pages and in PHP for the server), a parity test compares them on every reference query.
7. **Never break published URLs.** Slugs, including localized ones, are permanent; redirect (301) only real moves.
8. **Young specs are re-verified before release.** WebMCP, MCP Server Cards, the AI Catalog / Agentic Resource Discovery and the MCP protocol itself change often (table below).

## Pick the starting point

| The user asks for | Start with |
|---|---|
| An SEO audit, "why am I not ranking/indexed", a health check | Phase 0, then `references/seo-foundations.md`; report in the format below |
| GEO, AEO, "AI search", "get cited by ChatGPT / Perplexity / Gemini / Claude" | `references/geo-aeo.md`, `references/ai-crawlers.md`, `references/measurement.md` |
| AI crawlers, robots.txt for AI bots, "is GPTBot blocked", CDN/WAF bot rules | `references/ai-crawlers.md`, `scripts/check_ai_access.mjs` |
| Sitemap, hreflang, canonical, multilingual titles, structured data | `references/seo-foundations.md`, `scripts/check_sitemap.mjs` |
| Search Console, Bing Webmaster Tools, IndexNow, getting indexed | `references/search-engines-and-indexing.md` |
| llms.txt, agents.md, a "use with AI assistants" page | `references/llms-and-agents-md.md` |
| WebMCP, tools for browser agents | `references/webmcp.md` |
| An MCP server for a website, custom connector for Claude/ChatGPT | `references/remote-mcp-server.md`, `templates/mcp-server.php` |
| Server Card, `ai-catalog.json`, MCP Registry, discovery | `references/discovery.md` |
| Analytics without cookies, AI referral traffic, citation tracking | `references/measurement.md`, `references/privacy-first-analytics.md` |
| "Did the deploy work?", verification after a release | `references/testing-and-verification.md` |

## Workflow

Work through the phases in order for a full build; for an audit run phase 0 and the checks of the phases that apply. Commit after each phase with its tests.

| Phase | What | Reference |
|---|---|---|
| 0 | Baseline: inventory pages and languages, PageSpeed/Lighthouse (including the Agentic Browsing category), crawl the sitemap, check AI crawler access, note what exists | `references/testing-and-verification.md` |
| 1 | SEO foundations: canonical, sitemap + hreflang, robots.txt, titles and descriptions per language, structured data, 404, security headers, performance | `references/seo-foundations.md` |
| 2 | Crawler access: decide per crawler (search, user-initiated, training), write robots.txt, check the host/CDN/WAF bot settings, verify real crawlers in the logs | `references/ai-crawlers.md` |
| 3 | Content for answer engines: answer-first passages, facts with sources and dates, entities and `sameAs`, visible FAQs, honest comparison pages, freshness, text in the server HTML | `references/geo-aeo.md` |
| 4 | LLM-facing files: `llms.txt` with a "For AI agents" section, `agents.md`, both generated | `references/llms-and-agents-md.md` |
| 5 | In-page tools (WebMCP): site-wide `find_tools`/`open_tool`, page tools, late activation | `references/webmcp.md` |
| 6 | Remote MCP server (`/mcp`): catalog tools, protocol, search quality, slug resolution, privacy | `references/remote-mcp-server.md` |
| 7 | Discovery: GET explanation page, homepage block, MCP Server Card, `/.well-known/ai-catalog.json`, registries | `references/discovery.md` |
| 8 | Optional local MCP package (stdio) reusing the pure tool functions | `references/local-mcp-package.md` |
| 9 | Human page "Use with AI assistants", Markdown snippet for users' agents, privacy texts | `references/llms-and-agents-md.md`, `templates/ai-assistants-page.md` |
| 10 | Test → fix → retest: protocol, errors, reference searches, parity, latency, crawler access | `references/testing-and-verification.md` |
| 11 | Deploy and verify in production; external agent test | `references/testing-and-verification.md` |
| 12 | Search Console, Bing Webmaster Tools, IndexNow, first links | `references/search-engines-and-indexing.md` |
| 13 | Measurement: AI referrals, Search Console and Bing AI reports, crawler logs, monthly citation check, optional privacy-first analytics | `references/measurement.md` |

## The loop: test → fix → retest

1. **Expected results first.** Before changing code, write what must be true: URLs that answer 200 with their own canonical, crawlers that must be allowed, MCP reference searches with the tool each must return, questions the site should be cited for.
2. **Run the checks** (scripts below, Lighthouse, Rich Results Test). They print what fails and exit 1 on failure.
3. **Find the cause before fixing.** Wrong ranking or wrong expectation? Missing translation or wrong algorithm? Robots rule or CDN rule? Content or markup? Fix the cause in every place it lives (both implementations, every language, the generator rather than the output).
4. **Rerun until green**, then add a check for every bug found so it stays fixed.
5. **Deploy and rerun the same checks against production.** A failure that passes locally means the deploy didn't happen or the environment differs (CDN, host bot rules, rewrites, antivirus on the developer's PC).
6. **Write the result down** with the date: what was tested, the numbers, quirks found, what remains for the owner.

## Production verification (after every deploy)

1. The deploy happened: CI succeeded; the build ID or `Last-Modified` in the live HTML matches the release.
2. `node scripts/check_sitemap.mjs https://example.com/sitemap.xml --fetch --canonical`: every URL 200, no redirect, canonical equals `<loc>`, hreflang reciprocal.
3. `node scripts/check_ai_access.mjs https://example.com/ --paths .,key-page,it/pagina`: robots.txt per crawler, noindex/nosnippet, canonical, text in the server HTML, JSON-LD, `llms.txt`.
4. `node scripts/mcp_smoke_test.mjs https://example.com/mcp --cases cases.json --repeat 20` when the site has an MCP server.
5. `robots.txt`, `llms.txt`, `agents.md` (served as `text/markdown`), a 404 page, new pages in every language.
6. External agent test: another assistant session, without access to the code, uses the site and the MCP server and reports what fails.
7. PageSpeed/Lighthouse on mobile and desktop, including the Agentic Browsing audits; Search Console URL Inspection (live test) for key pages; IndexNow pinged for the changed URLs.

Details and the reasons behind each step: `references/testing-and-verification.md`.

## Scripts (Node 18+, no dependencies)

Paths in this skill (`scripts/`, `references/`, `templates/`) are relative to the folder that contains this SKILL.md; run the scripts from there or with their full path.

- `node scripts/check_sitemap.mjs <sitemap URL or file> [--fetch] [--canonical] [--trailing-slash]`: sitemaps.org rules, hreflang self-reference, reciprocity and x-default, duplicates, lastmod; with `--fetch` the status of every URL, with `--canonical` each page's canonical and noindex.
- `node scripts/check_ai_access.mjs <site URL> [--paths .,page] [--require-allow LIST|none] [--probe-ua] [--min-words 100]`: robots.txt evaluated per crawler with RFC 9309 matching (search and user-initiated crawlers must be allowed, training crawlers are reported for the owner to decide), Sitemap lines, `llms.txt`, and per page status, noindex/nosnippet, canonical, title/description/h1, words of text in the server HTML and JSON-LD validity. `--probe-ua` requests pages with crawler user agents (informational: CDNs block spoofed crawlers).
- `node scripts/mcp_smoke_test.mjs <endpoint> [--cases cases.json] [--repeat N]`: Streamable HTTP MCP checks (initialize and version negotiation, notifications → 202, ping, tools/list schemas, JSON-RPC errors, GET → 405, the GET explanation page, AI Catalog and Server Card, CORS, unknown tool, extra parameters), reference cases, latency; explains empty or cut replies (antivirus or proxy interception).

In Git Bash on Windows, write paths without a leading slash (`--paths .,pricing`) or set `MSYS_NO_PATHCONV=1`: the shell rewrites arguments that start with `/`.

## Templates

| File | Use |
|---|---|
| `templates/robots.txt` | robots.txt with explicit groups for search, user-initiated and training crawlers; choices marked |
| `templates/structured-data.tool.json`, `templates/structured-data.guide.json` | JSON-LD `@graph` for a tool page (Organization with `sameAs`, WebSite, WebPage with breadcrumb, WebApplication) and a guide (Person author, BlogPosting, FAQ that must mirror a visible FAQ) |
| `templates/citation-check.csv` | Fixed question set and log columns for the monthly citation check |
| `templates/mcp-server.php` | Stateless MCP server (catalog search, slug resolution, protocol rules, GET explanation page); reads `site.json` + `tools.<lang>.json`; PHP ≥ 8.1, no dependencies |
| `templates/cases.example.json` | Reference cases for `mcp_smoke_test.mjs` (searches with expected results, slug forms, error cases) |
| `templates/server-card.example.json`, `templates/ai-catalog.example.json` | MCP Server Card and AI Catalog for pre-connection discovery |
| `templates/webmcp-register.ts`, `templates/webmcp-shim.js` | WebMCP registration helpers; late activation from the console or a browser agent |
| `templates/agents.template.md`, `templates/ai-assistants-page.md` | Guide for agents; human page with connection steps and a Markdown snippet |
| `templates/htaccess-snippets.conf` | Apache/LiteSpeed: dotfiles, `/mcp` rewrite, canonical without slash, `.html` mapping, Markdown MIME, cache and security headers |

Adapt names, languages and stop words to the site; keep the behaviours.

## Young specs and moving targets (checked 2026-11-03)

| Spec | Status when checked | Where |
|---|---|---|
| WebMCP | W3C Web Machine Learning Community Group draft report (2 November 2026), not a W3C standard; Chrome origin trial from Chrome 149 and a testing flag | `references/webmcp.md` |
| MCP Server Card | SEP-2127 Final (extensions track); format in the `ext-server-card` repository, whose README still says experimental | `references/discovery.md` |
| AI Catalog / Agentic Resource Discovery | AI Catalog spec (Linux Foundation working group) at `/.well-known/ai-catalog.json`; ARD v0.91 "Proposal" builds on it and renames the path to `/.well-known/ard.json` | `references/discovery.md` |
| MCP protocol | Revision 2026-07-28 removed `initialize` and sessions (stateless); the PHP template speaks 2024-11-05 to 2025-11-25 | `references/remote-mcp-server.md` |
| Lighthouse Agentic Browsing | Category with llms.txt, WebMCP, accessibility-tree and CLS checks; needs Chrome 150+ | `references/testing-and-verification.md` |
| AI crawler names | Vendors add and rename crawlers | `references/ai-crawlers.md` |

Before shipping anything that depends on them, reread the linked spec, update the date, and rerun the tests. All sources with dates: `references/sources.md`.

## Reporting an audit

For each finding: **severity** (blocks indexing or citation / loses traffic or trust / polish), **evidence** (URL, command and its output, screenshot or report name), **cause**, **fix** (where in the code or settings), **how to retest** (the exact command or report). Group by phase; put blocking issues first; list what only the owner can do (DNS, Search Console, CDN settings, decisions on training crawlers, licenses). Do not report a guess as a finding: mark it "to verify" with the test that would settle it.

## Pitfalls seen in practice

- **"There is no MCP server here."** An assistant reading the site concluded that because the home didn't mention it, `llms.txt` listed it at the bottom and `GET /mcp` returned a bare 405. It also assumed the server would receive files. Put the procedure on the home and at the top of `llms.txt`/`agents.md`, answer a plain GET with an explanation page, and publish the Server Card and AI Catalog.
- **"No results" for full sentences.** Agents send "find a tool to merge my PDF files" or the user's sentence in another language. Strip request words in every supported language, split apostrophes, fall back to partial matches flagged as such, pick the language from the query (`references/remote-mcp-server.md`).
- **Word order ignored.** "jpg to pdf" and "pdf to jpg" share words; rank the tool whose name or keyword equals the query as written first.
- **Scores are not comparable across indexes.** When choosing a language, compare matched words, not scores.
- **CDNs block spoofed crawlers.** A request with a Googlebot or GPTBot user agent from a non-crawler IP can get 403/429: that is anti-spoofing, not a robots problem. Judge real access from the host/CDN bot settings and the access logs, not from a spoofed request.
- **Antivirus HTTPS scanning** (e.g. AVG Web Shield) on the developer's PC can swallow responses to `/mcp` or to requests with an `MCP-Protocol-Version` header. Check the TLS issuer; test through an alias path or from another network.
- **FAQ markup is not a shortcut.** Google stopped showing FAQ rich results in May 2026; keep FAQs as visible content and mark up only what is visible.
- **llms.txt is not a Google ranking file.** Google Search doesn't use it; keep it for agents and other tools, and keep it identical in substance to the pages.
- **`php -S` handles one request at a time.** A page can hang waiting for a script while a long request runs; test whole sites behind Apache/Nginx.
- **Scheduled CI runs start from the default branch.** If production builds another branch, name the commit actually built in deploy messages.
- **Hidden browser panes** report 0×0 windows and `screen.width = 0`; verify layout-dependent metrics in a visible tab.
