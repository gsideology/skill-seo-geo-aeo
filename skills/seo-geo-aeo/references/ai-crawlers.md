# AI crawlers, robots.txt and CDN/WAF access

Goal: the crawlers the owner wants can actually read the site, the ones the owner doesn't want are told so, and both are verified on the live host. robots.txt expresses preferences; the host, CDN or WAF decides what really gets through.

## Who fetches what (checked 2026-11-03 on the vendors' pages; recheck before relying on it)

| Token (robots.txt) | Vendor | Kind | What it does | robots.txt | Verify real requests |
|---|---|---|---|---|---|
| `Googlebot` | Google | search | Google Search, including AI Overviews and AI Mode | honoured | reverse DNS, or the IP range JSON files on Google's "Verify requests from Google crawlers and fetchers" page |
| `Google-Extended` | Google | training | Not a crawler: a robots.txt token that controls use for Gemini training and grounding outside Search. No effect on inclusion or ranking in Google Search | honoured (token) | n/a (Google's normal crawlers fetch) |
| `Bingbot` | Microsoft | search | Bing search; the AI Performance report counts citations in Copilot and Bing AI summaries | honoured | "Verify Bingbot" tool in Bing Webmaster Tools, reverse DNS |
| `OAI-SearchBot` | OpenAI | search | Shows sites in ChatGPT search answers; opted-out sites can still appear as plain navigational links | honoured; changes take about 24 h | `https://openai.com/searchbot.json` |
| `ChatGPT-User` | OpenAI | user | Pages a ChatGPT user or a GPT action asks for; not used to decide search inclusion | may not apply (user-initiated) | `https://openai.com/chatgpt-user.json` |
| `GPTBot` | OpenAI | training | Content that may be used to train OpenAI models | honoured | `https://openai.com/gptbot.json` |
| `Claude-SearchBot` | Anthropic | search | Improves search result quality for Claude | honoured (Anthropic's bots follow robots.txt) | `https://claude.com/crawling/bots.json` |
| `Claude-User` | Anthropic | user | Pages fetched when Claude users ask questions | as above | as above |
| `ClaudeBot` | Anthropic | training | Content that may contribute to training; supports `Crawl-delay` | honoured | as above |
| `PerplexityBot` | Perplexity | search | Surfaces and links sites in Perplexity search; not used for training foundation models | honoured | `https://www.perplexity.ai/perplexitybot.json` |
| `Perplexity-User` | Perplexity | user | Visits a page to answer a user's question | generally ignored (user-initiated) | `https://www.perplexity.ai/perplexity-user.json` |

If OpenAI's `OAI-SearchBot` and `GPTBot` are both allowed, OpenAI may use one crawl for both purposes. Anthropic advises against blocking its IP addresses, because the crawler then can't read robots.txt. Version numbers in user-agent strings change; match on the token.

## Decide per kind, with the owner

| Kind | If blocked | Typical choice for a site that wants AI visibility |
|---|---|---|
| Search crawlers (`Googlebot`, `Bingbot`, `OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`) | The site can't appear or be cited in that engine's answers | Allow |
| User-initiated fetchers (`ChatGPT-User`, `Claude-User`, `Perplexity-User`) | Assistants can't open a page a user points them to; robots.txt may not stop them, so blocking needs a server rule | Allow |
| Training (`GPTBot`, `ClaudeBot`, `Google-Extended`) | Content is excluded from future training sets; no documented effect on search inclusion | The owner's decision (licensing, business model); record it |

## robots.txt

Template: `templates/robots.txt`. Rules that matter (RFC 9309):

- A crawler uses the group(s) whose `User-agent` matches its token (case-insensitive); only if none matches does it use `User-agent: *`. **A named group replaces `*` entirely**: rules in `*` are not inherited. Repeat the `Disallow` lines you need in each named group.
- The longest matching path wins; on a tie, `Allow` wins. `*` matches any characters, `$` anchors the end.
- `Disallow:` with an empty value allows everything.
- A 4xx robots.txt lets crawlers crawl everything; a 5xx or unreachable robots.txt makes them assume everything is disallowed. Keep it reachable and fast.
- Add `Sitemap: https://example.com/sitemap.xml`.
- Disallow only what must not be crawled (admin, counters, internal APIs). robots.txt is public and is not access control: protect private pages with authentication, and use `noindex` (meta or `X-Robots-Tag`) for pages that may be crawled but must not be indexed; the crawler must be allowed to fetch the page to see `noindex`.

Check it: `node scripts/check_ai_access.mjs https://example.com/ --paths .,important-page,it/pagina`. Search and user-initiated crawlers blocked on a checked path fail; training crawlers are reported as the owner's choice.

## Host, CDN and WAF

robots.txt allowing a crawler is not enough if the infrastructure blocks it.

- **Look at the bot settings** of the CDN or host: "AI bots", "bot fight", "AI crawl control", rate limits, country blocks, JavaScript challenges. Some providers have changed their defaults for AI crawlers on new or free plans (Cloudflare documents AI Crawl Control and managed robots.txt directives); read the current dashboard rather than assuming.
- **Managed robots.txt**: some CDNs prepend their own rules to your robots.txt. Fetch the live file (`curl -s https://example.com/robots.txt`) and compare it with the one you deploy.
- **Spoofing tests prove little.** A request with a crawler's user agent from your own IP can get 403/429 from anti-spoofing even when the real crawler passes (seen on a production site: 429 for a spoofed GPTBot, 403 for spoofed Googlebot and Bingbot, while robots.txt allowed them). `check_ai_access.mjs --probe-ua` reports these answers only as information.
- **What does prove access**: the access logs (requests from the vendor's published IP ranges with status 200), Search Console URL Inspection (live test) for Google, Bing's URL inspection, and the vendors' own tools.
- **JavaScript challenges and CAPTCHAs** stop crawlers that don't run them; exempt verified crawlers if the provider supports it.

## Logs: are they coming, and what do they get?

Monthly, or after changing bot rules:

1. Count requests per token (`Googlebot`, `Bingbot`, `OAI-SearchBot`, `ChatGPT-User`, `GPTBot`, `Claude-SearchBot`, `Claude-User`, `ClaudeBot`, `PerplexityBot`, `Perplexity-User`) and status code.
2. Check a sample of IPs against the published ranges or reverse DNS: a user agent string alone can be faked.
3. Look for 403/429/5xx served to verified crawlers, robots.txt requests that fail, and important pages never fetched.
4. Write down the result with the date (what changed, which crawler, which pages).

## Bing's role

Bing Webmaster Tools reports citations in Copilot and Bing AI summaries (AI Performance), and OpenAI's help says ChatGPT search sometimes partners with other search providers. Being crawled and indexed well by Bing therefore matters beyond Bing's own search: verify the site in Bing Webmaster Tools, submit the sitemap and use IndexNow (`references/search-engines-and-indexing.md`).
