# seo-geo-aeo: a Claude skill for SEO, GEO, AEO and agentic navigation

A Claude skill that makes a website **findable** by search engines, **citable** by AI answer engines (ChatGPT search, Perplexity, Gemini, Claude, Copilot, Google AI Overviews and AI Mode) and **usable** by AI agents, and that **proves each step with tests**, locally and in production.

It covers:

- **SEO**: canonical URLs, sitemaps with hreflang, robots.txt, titles and descriptions per language, structured data (JSON-LD), 404s, security headers, Core Web Vitals; Google Search Console, Bing Webmaster Tools, IndexNow.
- **GEO / AEO**: what Google, Bing, OpenAI, Anthropic and Perplexity actually document; answer-first passages, facts with sources and dates, entities and `sameAs` (Wikidata), FAQs only when visible, honest comparison pages, freshness, text in the server HTML.
- **AI crawler access**: GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User, Google-Extended; robots.txt per crawler kind, CDN/WAF checks, log verification.
- **Measurement**: Search Console and Bing AI Performance, AI referrals (`utm_source=chatgpt.com`, referrer domains), crawler logs, and a repeatable monthly citation check.
- **Agentic navigation**: `llms.txt`, `agents.md`, in-page tools (WebMCP), a remote MCP server for a website (PHP template), MCP Server Card and `ai-catalog.json` discovery, an optional local MCP package.
- **The loop**: test → fix → retest, then the same checks against production.

Every vendor statement is linked with the date it was checked (`skills/seo-geo-aeo/references/sources.md`); young specs (WebMCP, Server Cards, AI Catalog / ARD, the MCP protocol revision) are marked as such.

**Who it is for**: developers and site owners who use Claude (claude.ai or Claude Code) to build, audit or fix a website, especially static or multilingual sites that want to be cited by AI assistants and usable by agents.

## What's inside

```
skills/seo-geo-aeo/
  SKILL.md                         workflow, principles, routing, production checklist
  references/
    seo-foundations.md             canonical, sitemap, hreflang, titles, JSON-LD, headers, performance
    geo-aeo.md                     answer engines: what vendors say, content rules, checklist
    ai-crawlers.md                 crawler table, robots.txt rules, CDN/WAF, logs, Bing's role
    search-engines-and-indexing.md Search Console, Bing Webmaster Tools, IndexNow, first links
    measurement.md                 reports, AI referrals, crawler logs, monthly citation check
    llms-and-agents-md.md          llms.txt, agents.md, the "use with AI assistants" page, privacy texts
    webmcp.md                      in-page tools for browser agents
    remote-mcp-server.md           MCP server for a website: protocol, search that works for agents
    discovery.md                   GET explanation page, Server Card, AI Catalog, registries
    local-mcp-package.md           optional stdio package
    privacy-first-analytics.md     cookie-free measurement
    testing-and-verification.md    baseline, the loop, production verification, Lighthouse Agentic Browsing
    sources.md                     every source with the date checked
  templates/                       robots.txt, JSON-LD (tool page, guide), citation-check.csv,
                                   mcp-server.php, cases.example.json, server-card / ai-catalog examples,
                                   webmcp-register.ts, webmcp-shim.js, agents.template.md, ai-assistants-page.md,
                                   htaccess-snippets.conf
  scripts/                         check_sitemap.mjs, check_ai_access.mjs, mcp_smoke_test.mjs
.claude-plugin/                    plugin.json and marketplace.json (Claude Code plugin)
scripts/                           build-zip.mjs, validate-skill.mjs, test.mjs (repository tooling)
tests/                             unit tests and fixtures
```

## Install

### claude.ai

1. Build the zip (Node 18 or later): `node scripts/build-zip.mjs` → `dist/seo-geo-aeo.zip`, with the `seo-geo-aeo/` folder at the root of the archive.
2. Make sure code execution is on: Settings → Capabilities ("Create and edit files" in the current layout).
3. Upload: as of 2026-11-03 the Claude help center puts skills under **Customize → Skills** → "+" → "Create skill" → "Upload a skill" (older guides say Settings → Capabilities → Skills; menus change, follow the [current help article](https://support.claude.com/en/articles/12512180-use-skills-in-claude)).
4. Turn the skill on and ask, for example, "audit https://example.com for SEO and AI search visibility".

The skill's description is under the 1024 characters allowed by the [Agent Skills docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) (`scripts/validate-skill.mjs` checks it). One claude.ai help article mentions 200 characters as a maximum; if an upload is rejected for that reason, shorten the `description` in `SKILL.md` and rebuild.

### Claude Code (skill folder)

Copy the skill folder to your personal skills (all projects) or to a project:

```bash
# personal
cp -r skills/seo-geo-aeo ~/.claude/skills/
# one project
cp -r skills/seo-geo-aeo /path/to/project/.claude/skills/
```

```powershell
# Windows PowerShell, personal
Copy-Item -Recurse skills\seo-geo-aeo "$env:USERPROFILE\.claude\skills\"
```

Claude uses the skill when a task matches its description; you can also ask for it by name.

### Claude Code (plugin)

This repository is also a plugin marketplace with one plugin. In Claude Code:

```
/plugin marketplace add gsideology/skill-seo-geo-aeo
/plugin install seo-geo-aeo@skill-seo-geo-aeo
```

or from a shell: `claude plugin marketplace add gsideology/skill-seo-geo-aeo` and `claude plugin install seo-geo-aeo@skill-seo-geo-aeo`. The skill is then available as `/seo-geo-aeo:seo-geo-aeo`. The repository is private: installing needs read access to it and working git credentials for GitHub. Format checked against the Claude Code plugin docs on 2026-11-03; `claude plugin validate .` passes (with a warning that `CLAUDE.md` at the plugin root isn't loaded as context, which is intended: it is for people working on this repository).

## How the workflow runs

| Phase | What |
|---|---|
| 0 | Baseline: inventory, sitemap crawl, AI crawler access, Lighthouse (including Agentic Browsing) |
| 1 | SEO foundations |
| 2 | Crawler access: decide per crawler kind, robots.txt, host/CDN/WAF, logs |
| 3 | Content for answer engines (GEO/AEO) |
| 4 | `llms.txt` and `agents.md` |
| 5 | WebMCP tools in the pages |
| 6 | Remote MCP server |
| 7 | Discovery: explanation page, Server Card, AI Catalog |
| 8 | Optional local MCP package |
| 9 | "Use with AI assistants" page and privacy texts |
| 10–11 | Test → fix → retest; deploy and verify in production; external agent test |
| 12 | Search Console, Bing Webmaster Tools, IndexNow, first links |
| 13 | Measurement and the monthly citation check |

For an audit, Claude runs phase 0 and the checks of the phases that apply, and reports each finding with severity, evidence, cause, fix and the command that retests it.

## Scripts

All Node 18+, no dependencies; each prints what fails and exits 1 on failure.

| Script | What it checks |
|---|---|
| `skills/seo-geo-aeo/scripts/check_sitemap.mjs <sitemap> [--fetch] [--canonical]` | sitemaps.org rules, hreflang self-reference, reciprocity and x-default, duplicates, lastmod; every URL 200 without redirect; canonical equals `<loc>`; no noindex in the sitemap |
| `skills/seo-geo-aeo/scripts/check_ai_access.mjs <site> [--paths .,page] [--probe-ua]` | robots.txt per AI and search crawler (RFC 9309 matching), Sitemap lines, `llms.txt`, and per page: status, noindex/nosnippet, canonical, title/description/h1, text in the server HTML, JSON-LD validity |
| `skills/seo-geo-aeo/scripts/mcp_smoke_test.mjs <endpoint> [--cases f.json] [--repeat N]` | Streamable HTTP MCP protocol, errors, GET explanation page, Server Card and AI Catalog, reference searches, latency |
| `scripts/build-zip.mjs` | builds `dist/seo-geo-aeo.zip` for claude.ai |
| `scripts/validate-skill.mjs` | SKILL.md frontmatter (name, description length), body length, links between the skill's files, line endings |
| `scripts/test.mjs [--online <site> --mcp <endpoint>]` | everything above, against local fixtures served by `php -S` (which also runs the PHP MCP template) and optionally against a live site |

In Git Bash on Windows, write `--paths` without leading slashes (`--paths .,pricing`) or set `MSYS_NO_PATHCONV=1`.

## Testing

```bash
node scripts/test.mjs            # offline suite; PHP ≥ 8.1 needed for the PHP and HTTP steps (PHP_BIN=/path/to/php)
node scripts/test.mjs --online https://example.com --mcp https://example.com/mcp
```

## Credits

Developed and tested on a real multilingual static website (five languages, client-side tools, a PHP MCP endpoint on shared hosting) during 2026, then generalized. The pitfalls in the skill (assistants concluding there was no MCP server, full-sentence searches returning nothing, CDNs blocking spoofed crawlers, antivirus software emptying MCP responses) were all met there and fixed with tests.

External specifications and vendor documentation are credited where they are used, in `skills/seo-geo-aeo/references/sources.md`.

## License

To be decided by the owner. There is no license file yet; until one is added, default copyright applies.
