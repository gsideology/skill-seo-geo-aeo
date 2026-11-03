# Sources and dates

Every vendor statement in this skill comes from one of these pages. "Checked" is the date the page was read for this version. Vendors change crawlers, reports and specs often: reread the page before relying on a statement, update the date here, and rerun the tests.

## Search engines and answer engines

| Topic | Source | Checked |
|---|---|---|
| Google: optimizing for generative AI features ("still SEO", no special markup, llms.txt not used, no chunking, non-commodity content, Generative AI performance report) | [Google's guide to optimizing for generative AI features](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) (page updated 2026-07-10) | 2026-11-03 |
| Google: AI Overviews and AI Mode for site owners (indexed + snippet-eligible, no extra requirements, Web search type in Search Console, snippet controls) | [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) | 2026-11-03 |
| Google: FAQ rich results stopped appearing 2026-05-07, documentation removed 2026-06-15; llms.txt note added 2026-06-15 | [Search Central documentation updates](https://developers.google.com/search/updates) | 2026-11-03 |
| Google: don't mark up content that isn't visible | [Structured data general guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) | 2026-11-03 |
| Google: Google-Extended (training and grounding outside Search, no effect on Search), Googlebot | [Google's common crawlers](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers) | 2026-11-03 |
| Google: verify Googlebot (reverse DNS, IP range JSON files) | [Verify requests from Google crawlers and fetchers](https://developers.google.com/crawling/docs/crawlers-fetchers/verify-google-requests) | 2026-11-03 |
| Google: scaled content abuse, cloaking | [Spam policies](https://developers.google.com/search/docs/essentials/spam-policies) | 2026-11-03 |
| Google: rendering JavaScript | [JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) | 2026-11-03 |
| Google: no meta description length limit | [Snippets](https://developers.google.com/search/docs/appearance/snippet) | 2026-11-03 |
| Bing: AI Performance report (public preview 2026-02-10), guidance on IndexNow, freshness, structure, evidence, consistency | [Introducing AI Performance in Bing Webmaster Tools](https://blogs.bing.com/webmaster/2026/2/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview/) | 2026-11-03 |
| Bing: verify Bingbot | [Verify Bingbot](https://www.bing.com/webmasters/help/how-to-verify-bingbot-3905dc26) | 2026-11-03 |
| IndexNow: key, endpoints, bulk POST, response codes, participants | [indexnow.org documentation](https://www.indexnow.org/documentation), [FAQ](https://www.indexnow.org/faq) | 2026-11-03 |
| OpenAI: OAI-SearchBot, ChatGPT-User, GPTBot, OAI-AdsBot, IP lists, ~24 h for robots.txt changes | [Overview of OpenAI crawlers](https://developers.openai.com/api/docs/bots) | 2026-11-03 |
| OpenAI: ChatGPT search "sometimes partners with other search providers" | [Searching the web with ChatGPT](https://help.openai.com/en/articles/9237897-chatgpt-search) | 2026-11-03 |
| OpenAI: `utm_source=chatgpt.com` on referral links | Publishers and developers FAQ (`help.openai.com/en/articles/12627856`): the statement appears in search engines' copies of the page, but on 2026-11-03 the address redirected to an unrelated help article. Treat it as unconfirmed and check your own analytics | 2026-11-03 |
| Anthropic: ClaudeBot, Claude-User, Claude-SearchBot, robots.txt, Crawl-delay, IP list | [Does Anthropic crawl data from the web…](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) (updated 2026-04-07) | 2026-11-03 |
| Perplexity: PerplexityBot, Perplexity-User, IP lists | [Perplexity crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers) | 2026-11-03 |
| Cloudflare: AI Crawl Control, managed robots.txt directives | [AI Crawl Control docs](https://developers.cloudflare.com/ai-crawl-control/) | 2026-11-03 |
| robots.txt matching rules | [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309) | 2026-11-03 |
| `sameAs` definition | [schema.org/sameAs](https://schema.org/sameAs) | 2026-11-03 |
| Wikidata notability | [Wikidata:Notability](https://www.wikidata.org/wiki/Wikidata:Notability) | 2026-11-03 |
| llms.txt format, `## Optional`, `.md` page copies | [llmstxt.org](https://llmstxt.org/) (proposal, 2024; page modified 2026-08-10) | 2026-11-03 |

## Young specs (agentic navigation)

| Spec | Status when checked | Source | Checked |
|---|---|---|---|
| WebMCP | Draft Community Group Report, W3C Web Machine Learning CG, 2 November 2026; `document.modelContext`, `registerTool(tool, { signal })`, secure contexts only | [Spec](https://webmachinelearning.github.io/webmcp/) | 2026-11-03 |
| WebMCP in Chrome | Origin trial from Chrome 149, flag `#enable-webmcp-testing`, declarative API for forms, Model Context Tool Inspector | [Chrome for Developers: WebMCP](https://developer.chrome.com/docs/ai/webmcp) (updated 2026-10-07) | 2026-11-03 |
| Lighthouse Agentic Browsing | Fractional score; accessibility, CLS, llms.txt and WebMCP checks; Chrome 150+ | [Agentic Browsing scoring](https://developer.chrome.com/docs/lighthouse/agentic-browsing/scoring) | 2026-11-03 |
| MCP protocol | Latest revision 2026-07-28 (stateless, `server/discover`, no `initialize`); earlier revisions 2025-11-25 … 2024-11-05 | [Specification](https://modelcontextprotocol.io/specification/latest), [changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog), [versioning and backward compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning) | 2026-11-03 |
| MCP Server Card | SEP-2127 page shows Final (extensions track); format in `ext-server-card` (renamed from `experimental-ext-server-card`; README still says experimental): `schema.ts`, `docs/discovery.md` | [SEP-2127](https://modelcontextprotocol.io/seps/2127-mcp-server-cards), [repository](https://github.com/modelcontextprotocol/ext-server-card) | 2026-11-03 |
| AI Catalog | Specification of the Linux Foundation AI Catalog working group; `/.well-known/ai-catalog.json`, `rel="ai-catalog"`, `application/ai-catalog+json` | [Agent-Card/ai-catalog](https://github.com/Agent-Card/ai-catalog) | 2026-11-03 |
| Agentic Resource Discovery (ARD) | v0.91, status "Proposal"; `/.well-known/ard.json`, `rel="ard"`, `representativeQueries`; ai-catalog path as predecessor | [Announcement](https://developers.googleblog.com/en/announcing-the-agentic-resource-discovery-specification/) (2026-06-17), [site](https://agenticresourcediscovery.org/), [spec repository](https://github.com/ards-project/ard-spec) | 2026-11-03 |

## Claude skills and plugins (for this repository)

| Topic | Source | Checked |
|---|---|---|
| Skill frontmatter (`name` ≤ 64, lowercase/digits/hyphens, no "anthropic"/"claude"; `description` ≤ 1024, no XML tags), progressive disclosure | [Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) | 2026-11-03 |
| Skills in Claude Code (locations, SKILL.md under 500 lines recommended) | [Skills](https://code.claude.com/docs/en/skills) | 2026-11-03 |
| Uploading skills in claude.ai | [Use Skills in Claude](https://support.claude.com/en/articles/12512180-use-skills-in-claude), [How to create custom Skills](https://support.claude.com/en/articles/12512198-how-to-create-custom-skills) | 2026-11-03 |
| Plugins and marketplaces | [Plugin manifest reference](https://code.claude.com/docs/en/plugins-reference), [Create a marketplace](https://code.claude.com/docs/en/plugin-marketplaces), [Marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference) | 2026-11-03 |

## Observations from a production site (dated, not vendor statements)

Seen on a multilingual static site with a PHP MCP endpoint, November 2026: a CDN answered 429 to a spoofed GPTBot user agent and 403 to spoofed Googlebot and Bingbot while robots.txt allowed them (anti-spoofing); AVG Web Shield on the developer's PC emptied HTTPS responses to `/mcp` and to requests carrying `MCP-Protocol-Version`; an assistant reading the site concluded there was no MCP server until the home, `llms.txt` and `GET /mcp` explained it; an external agent test found full sentences without a language returning no tools, uppercase and localized slugs rejected and undeclared parameters accepted (all fixed and covered by tests).
